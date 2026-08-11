import { env } from "@/lib/env"
import { PEDALS } from "@/lib/pedalboard/catalog/pedals"

/**
 * Anderton's TV, via the YouTube Data API v3.
 *
 * WHY THIS IS ALLOWED AND THE OBVIOUS ALTERNATIVE IS NOT. The Data API is a
 * published partner API meant for third-party use, which is exactly the
 * standard section 2 sets for adding a source. Video metadata and comments
 * come from documented endpoints with a key and a quota.
 *
 * TRANSCRIPTS DO NOT, and the distinction is worth stating plainly because
 * every npm package in this space blurs it. `captions.download` only works for
 * videos you own. Every "youtube-transcript" library gets around that by
 * hitting YouTube's internal timedtext endpoint, which is the same "built for
 * the site's own frontend rather than published for this use" shape this
 * project rejected for Guitar Center and the Reverb API. Anderton's own
 * blessing would not fix it either: they own the video copyright, Google owns
 * the access terms, and only the second one is in question. The legitimate
 * route to transcripts is asking Anderton's for the files.
 *
 * WHAT IT IS FOR. Anderton's demo an enormous amount of gear, and the titles
 * and descriptions of those videos are a record of WHICH gear, while the
 * comments are a record of what their audience actually cares about. Matched
 * against the spec catalogue, that answers questions no product feed can:
 * which pedals get demoed most, and what people ask about them.
 *
 * COMMENTS ARE AGGREGATED, NEVER REPUBLISHED. `summariseComments` returns
 * counts and matched gear, and deliberately returns no author names and no
 * comment text. Reprinting a named person's comment on a commercial page is a
 * privacy and defamation surface for no extra value, and "the Anderton's
 * audience mentions the Tumnus more than anything else here" is the useful
 * part anyway.
 *
 * QUOTA IS THE REAL CONSTRAINT. The free tier is 10,000 units a day.
 * `search.list` costs 100 units per call, `videos.list` and
 * `commentThreads.list` cost 1 each. So this reads the uploads PLAYLIST rather
 * than searching, which is 1 unit a page instead of 100, and is the difference
 * between a few hundred videos a day and tens of thousands.
 */

export type YouTubeVideo = {
  id: string
  title: string
  description: string
  publishedAt: string
  viewCount: number | null
  commentCount: number | null
}

/** Injectable so tests exercise the whole reader against fixtures, no network. */
export type YouTubeFetch = (path: string, params: Record<string, string>) => Promise<unknown>

export class YouTubeError extends Error {}

function requireKey(): string {
  const key = env.youtube.apiKey
  if (!key) throw new YouTubeError("YOUTUBE_API_KEY is not set.")
  return key
}

const realFetch: YouTubeFetch = async (path, params) => {
  const url = new URL(`${env.youtube.baseUrl}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  url.searchParams.set("key", requireKey())

  const response = await fetch(url, { headers: { accept: "application/json" } })
  if (!response.ok) {
    const body = await response.text().catch(() => "")
    // 403 with "quotaExceeded" is the one worth recognising by name: it is not
    // a bug and retrying makes it worse.
    throw new YouTubeError(
      `YouTube ${path} returned ${response.status}${/quotaExceeded/.test(body) ? " (daily quota exhausted, try tomorrow)" : ""}. ${body.slice(0, 300)}`,
    )
  }
  return response.json()
}

/* -------------------------------------------------------------------------- */
/*  Reading                                                                   */
/* -------------------------------------------------------------------------- */

type ChannelResponse = {
  items?: { id?: string; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[]
}

/**
 * Resolve a handle like "@Andertons" to its uploads playlist.
 *
 * The handle is configurable and the id is not hardcoded, because a channel id
 * is an opaque string nobody can verify by eye, and a wrong one fails as an
 * empty result rather than an error.
 */
export async function resolveUploadsPlaylist(
  handle = env.youtube.andertonsHandle,
  fetchImpl: YouTubeFetch = realFetch,
): Promise<{ channelId: string; uploadsPlaylistId: string }> {
  const data = (await fetchImpl("channels", {
    part: "contentDetails",
    forHandle: handle.startsWith("@") ? handle : `@${handle}`,
  })) as ChannelResponse

  const item = data.items?.[0]
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads
  if (!item?.id || !uploads) {
    throw new YouTubeError(`No channel found for handle ${handle}.`)
  }
  return { channelId: item.id, uploadsPlaylistId: uploads }
}

type PlaylistResponse = {
  items?: { contentDetails?: { videoId?: string } }[]
  nextPageToken?: string
}

type VideoResponse = {
  items?: {
    id?: string
    snippet?: { title?: string; description?: string; publishedAt?: string }
    statistics?: { viewCount?: string; commentCount?: string }
  }[]
}

/**
 * Recent uploads, newest first.
 *
 * Reads the playlist rather than calling search.list, which costs 100 quota
 * units against this one's 1. At 10,000 units a day that is the difference
 * between a hundred videos and ten thousand.
 */
export async function listRecentVideos(
  uploadsPlaylistId: string,
  max = 50,
  fetchImpl: YouTubeFetch = realFetch,
): Promise<YouTubeVideo[]> {
  const ids: string[] = []
  let pageToken: string | undefined

  while (ids.length < max) {
    const page = (await fetchImpl("playlistItems", {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: String(Math.min(50, max - ids.length)),
      ...(pageToken ? { pageToken } : {}),
    })) as PlaylistResponse

    for (const item of page.items ?? []) {
      const id = item.contentDetails?.videoId
      if (id) ids.push(id)
    }
    if (!page.nextPageToken || (page.items ?? []).length === 0) break
    pageToken = page.nextPageToken
  }

  const videos: YouTubeVideo[] = []
  // videos.list takes up to 50 ids per call and costs 1 unit either way, so
  // batching is free quota and fewer round trips.
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const data = (await fetchImpl("videos", {
      part: "snippet,statistics",
      id: batch.join(","),
    })) as VideoResponse

    for (const item of data.items ?? []) {
      if (!item.id) continue
      videos.push({
        id: item.id,
        title: item.snippet?.title ?? "",
        description: item.snippet?.description ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
        commentCount: item.statistics?.commentCount ? Number(item.statistics.commentCount) : null,
      })
    }
  }

  return videos
}

type CommentResponse = {
  items?: { snippet?: { topLevelComment?: { snippet?: { textOriginal?: string } } } }[]
  nextPageToken?: string
}

/**
 * Top-level comment TEXT for one video, and nothing else about them.
 *
 * No author, no id, no timestamp, deliberately. Everything downstream only
 * counts gear mentions, and not carrying the identifying fields at all is a
 * stronger guarantee than carrying them and promising not to print them.
 */
export async function fetchCommentText(
  videoId: string,
  max = 100,
  fetchImpl: YouTubeFetch = realFetch,
): Promise<string[]> {
  const texts: string[] = []
  let pageToken: string | undefined

  while (texts.length < max) {
    const page = (await fetchImpl("commentThreads", {
      part: "snippet",
      videoId,
      maxResults: String(Math.min(100, max - texts.length)),
      order: "relevance",
      textFormat: "plainText",
      ...(pageToken ? { pageToken } : {}),
    })) as CommentResponse

    for (const item of page.items ?? []) {
      const text = item.snippet?.topLevelComment?.snippet?.textOriginal
      if (text) texts.push(text)
    }
    if (!page.nextPageToken || (page.items ?? []).length === 0) break
    pageToken = page.nextPageToken
  }

  return texts
}

/* -------------------------------------------------------------------------- */
/*  Aggregation                                                               */
/* -------------------------------------------------------------------------- */

export type GearMention = {
  pedalId: string
  brand: string
  model: string
  /** How many distinct videos or comments mentioned it. */
  count: number
}

/**
 * Which catalogue gear is named in a body of text.
 *
 * Matched on the full "brand model" string, not the model alone. A model name
 * on its own is far too loose across a whole channel's worth of text: "Mood",
 * "Julia" and "Plumes" are all real pedal names and all ordinary English, and
 * counting them unqualified produces confident nonsense. Requiring the brand
 * nearby is the same under-match bias the entity resolver takes.
 */
const NEEDLE_CACHE = new Map<string, RegExp[]>()

/**
 * The strings that count as naming this pedal.
 *
 * Matching the catalogue's full model text alone does not work, and the tests
 * caught it: the TS9 is filed as "TS9 Tube Screamer", so a comment saying
 * "Ibanez TS9" matched nothing at all. Real people write the part code, not
 * the marketing name.
 *
 * So the needles are the full model, every alias, AND the leading part code
 * when there is one ("TS9", "DS-1", "M238"). A leading token only counts as a
 * part code if it contains a digit, which keeps "Phase" out of it while
 * keeping "Phase 90" as a whole.
 *
 * Bounded by "not adjacent to another alphanumeric" rather than \b, because
 * \b does the wrong thing next to punctuation and several real models end in
 * one: MXR's Distortion+ would never match with \b.
 */
function needlesFor(pedal: (typeof PEDALS)[number]): RegExp[] {
  const cached = NEEDLE_CACHE.get(pedal.id)
  if (cached) return cached

  const names = new Set([pedal.model, ...(pedal.aliases ?? [])])
  const firstToken = pedal.model.split(/\s+/)[0]
  if (firstToken && /\d/.test(firstToken)) names.add(firstToken)

  const patterns = [...names]
    .filter((n) => n.length >= 3)
    .map((n) => {
      const escaped = n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i")
    })

  NEEDLE_CACHE.set(pedal.id, patterns)
  return patterns
}

export function countGearMentions(texts: string[]): GearMention[] {
  const counts = new Map<string, number>()

  for (const text of texts) {
    const haystack = text.toLowerCase()
    const seen = new Set<string>()

    for (const pedal of PEDALS) {
      if (seen.has(pedal.id)) continue
      // Brand must appear somewhere in the same text, so "Mood" in a sentence
      // about a mood is not counted as a Chase Bliss Mood.
      if (!haystack.includes(pedal.brand.toLowerCase())) continue
      if (!needlesFor(pedal).some((re) => re.test(haystack))) continue

      seen.add(pedal.id)
      counts.set(pedal.id, (counts.get(pedal.id) ?? 0) + 1)
    }
  }

  const byId = new Map(PEDALS.map((p) => [p.id, p]))
  return [...counts.entries()]
    .map(([pedalId, count]) => {
      const pedal = byId.get(pedalId)!
      return { pedalId, brand: pedal.brand, model: pedal.model, count }
    })
    .sort((a, b) => b.count - a.count || a.model.localeCompare(b.model))
}

export type ChannelSummary = {
  videosRead: number
  totalViews: number
  /** Gear named in video titles and descriptions, most demoed first. */
  demoed: GearMention[]
  /** Gear named in comments, most discussed first. */
  discussed: GearMention[]
  /** Gear the audience talks about more than the channel does. */
  audienceFavourites: GearMention[]
}

/**
 * Turn videos and comments into something worth putting on a page.
 *
 * `audienceFavourites` is the interesting output and the reason to bother with
 * comments at all: gear the audience brings up more often than the channel
 * does is a signal no product feed and no view count contains.
 */
export function summariseChannel(videos: YouTubeVideo[], commentTexts: string[]): ChannelSummary {
  const demoed = countGearMentions(videos.map((v) => `${v.title}\n${v.description}`))
  const discussed = countGearMentions(commentTexts)

  const demoedById = new Map(demoed.map((m) => [m.pedalId, m.count]))
  const audienceFavourites = discussed
    .filter((m) => m.count > (demoedById.get(m.pedalId) ?? 0))
    .slice(0, 12)

  return {
    videosRead: videos.length,
    totalViews: videos.reduce((sum, v) => sum + (v.viewCount ?? 0), 0),
    demoed: demoed.slice(0, 20),
    discussed: discussed.slice(0, 20),
    audienceFavourites,
  }
}
