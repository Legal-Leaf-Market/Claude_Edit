import { describe, expect, it } from "vitest"
import {
  countGearMentions,
  fetchCommentText,
  listRecentVideos,
  resolveUploadsPlaylist,
  summariseChannel,
  YouTubeError,
  type YouTubeFetch,
  type YouTubeVideo,
} from "@/lib/ingestion/andertons-youtube"

/**
 * The Anderton's TV reader.
 *
 * No test touches the network: every call goes through an injected fetch, the
 * same pattern the Impact FTP module uses and for the same reason.
 *
 * The two behaviours worth defending are the ones that are easy to get wrong
 * in the direction that matters: quota (search.list costs 100x what the
 * playlist read costs) and privacy (comments must aggregate, never carry an
 * author).
 */

function stubFetch(routes: Record<string, unknown>): { fetch: YouTubeFetch; calls: string[] } {
  const calls: string[] = []
  const fetch: YouTubeFetch = async (path, params) => {
    calls.push(path)
    const key = params.pageToken ? `${path}:${params.pageToken}` : path
    if (!(key in routes)) throw new YouTubeError(`unstubbed: ${key}`)
    return routes[key]
  }
  return { fetch, calls }
}

describe("resolveUploadsPlaylist", () => {
  it("turns a handle into the uploads playlist", async () => {
    const { fetch } = stubFetch({
      channels: { items: [{ id: "UC123", contentDetails: { relatedPlaylists: { uploads: "UU123" } } }] },
    })

    expect(await resolveUploadsPlaylist("@Andertons", fetch)).toEqual({
      channelId: "UC123",
      uploadsPlaylistId: "UU123",
    })
  })

  it("throws rather than returning nothing when the handle is wrong", async () => {
    const { fetch } = stubFetch({ channels: { items: [] } })
    await expect(resolveUploadsPlaylist("@nope", fetch)).rejects.toThrow(/No channel found/)
  })
})

describe("listRecentVideos", () => {
  const playlistPage = {
    items: [
      { contentDetails: { videoId: "v1" } },
      { contentDetails: { videoId: "v2" } },
    ],
  }
  const videoPage = {
    items: [
      {
        id: "v1",
        snippet: { title: "Ibanez TS9 demo", description: "The classic Ibanez Tube Screamer", publishedAt: "2026-08-01T00:00:00Z" },
        statistics: { viewCount: "12000", commentCount: "300" },
      },
      {
        id: "v2",
        snippet: { title: "Strymon El Capistan", description: "Tape echo from Strymon", publishedAt: "2026-08-02T00:00:00Z" },
        statistics: { viewCount: "8000", commentCount: "150" },
      },
    ],
  }

  it("reads videos with their view counts", async () => {
    const { fetch } = stubFetch({ playlistItems: playlistPage, videos: videoPage })
    const videos = await listRecentVideos("UU123", 50, fetch)

    expect(videos).toHaveLength(2)
    expect(videos[0].title).toBe("Ibanez TS9 demo")
    expect(videos[0].viewCount).toBe(12000)
  })

  /**
   * The quota decision, pinned. search.list costs 100 units a call against
   * playlistItems' 1, so at 10,000 units a day the choice is the difference
   * between a hundred videos and ten thousand. A refactor to search.list would
   * work perfectly and quietly cost a hundredfold.
   */
  it("never calls the search endpoint, which costs 100x the quota", async () => {
    const { fetch, calls } = stubFetch({ playlistItems: playlistPage, videos: videoPage })
    await listRecentVideos("UU123", 50, fetch)

    expect(calls).not.toContain("search")
    expect(calls).toContain("playlistItems")
  })

  it("stops at the requested count rather than walking the whole channel", async () => {
    const { fetch } = stubFetch({
      playlistItems: { ...playlistPage, nextPageToken: "more" },
      "playlistItems:more": playlistPage,
      videos: videoPage,
    })

    const videos = await listRecentVideos("UU123", 2, fetch)
    expect(videos.length).toBeLessThanOrEqual(2)
  })

  it("survives a video with no statistics rather than reporting zero views", async () => {
    const { fetch } = stubFetch({
      playlistItems: { items: [{ contentDetails: { videoId: "v9" } }] },
      videos: { items: [{ id: "v9", snippet: { title: "No stats" } }] },
    })

    const videos = await listRecentVideos("UU123", 5, fetch)
    expect(videos[0].viewCount).toBeNull()
  })
})

describe("fetchCommentText", () => {
  /**
   * The privacy guarantee, and it is structural rather than a promise: the
   * function returns strings. There is no author field to leak because none is
   * carried out of the response at all.
   */
  it("returns text only, carrying no author or id out of the response", async () => {
    const { fetch } = stubFetch({
      commentThreads: {
        items: [
          {
            snippet: {
              topLevelComment: {
                snippet: {
                  textOriginal: "Love my Boss DS-1",
                  authorDisplayName: "SomeRealPerson",
                  authorChannelUrl: "https://youtube.com/@somerealperson",
                },
              },
            },
          },
        ],
      },
    })

    const texts = await fetchCommentText("v1", 10, fetch)
    expect(texts).toEqual(["Love my Boss DS-1"])
    expect(JSON.stringify(texts)).not.toMatch(/SomeRealPerson|somerealperson/)
  })

  it("returns nothing when comments are disabled, rather than throwing", async () => {
    const { fetch } = stubFetch({ commentThreads: { items: [] } })
    expect(await fetchCommentText("v1", 10, fetch)).toEqual([])
  })
})

describe("countGearMentions", () => {
  it("counts gear named with its brand", () => {
    const counts = countGearMentions([
      "The Ibanez TS9 Tube Screamer is the classic",
      "Another look at the Ibanez TS9",
    ])
    expect(counts.find((m) => m.pedalId === "ibanez-ts9")?.count).toBe(2)
  })

  /**
   * The under-match bias. "Mood", "Julia" and "Plumes" are real pedal names
   * AND ordinary English, so counting a bare model name across a channel's
   * worth of text produces confident nonsense. The brand has to be nearby.
   */
  it("does not count a model name used as an ordinary word", () => {
    const counts = countGearMentions([
      "I was in a great mood watching this",
      "Julia did the camera work on this one",
      "the plumes of smoke in the intro",
    ])
    expect(counts).toHaveLength(0)
  })

  it("counts each pedal once per text, however often it is repeated", () => {
    const counts = countGearMentions(["Boss DS-1, the Boss DS-1, my Boss DS-1"])
    expect(counts.find((m) => m.pedalId === "boss-ds-1")?.count).toBe(1)
  })

  it("returns the most mentioned first", () => {
    const counts = countGearMentions([
      "Ibanez TS9",
      "Ibanez TS9",
      "Ibanez TS9",
      "Boss DS-1 Distortion",
    ])
    expect(counts[0].pedalId).toBe("ibanez-ts9")
  })

  it("finds nothing in text about no gear at all", () => {
    expect(countGearMentions(["great video", "first!", ""])).toEqual([])
  })
})

describe("summariseChannel", () => {
  const videos: YouTubeVideo[] = [
    {
      id: "v1",
      title: "Ibanez TS9 shootout",
      description: "Ibanez TS9 against everything",
      publishedAt: "2026-08-01T00:00:00Z",
      viewCount: 10000,
      commentCount: 100,
    },
  ]

  it("separates what the channel demos from what the audience discusses", () => {
    const summary = summariseChannel(videos, ["Boss DS-1 is better", "the Boss DS-1 for me"])

    expect(summary.videosRead).toBe(1)
    expect(summary.totalViews).toBe(10000)
    expect(summary.demoed[0].pedalId).toBe("ibanez-ts9")
    expect(summary.discussed[0].pedalId).toBe("boss-ds-1")
  })

  /**
   * The output that justifies reading comments at all: gear the audience
   * brings up more than the channel does is a signal no product feed and no
   * view count contains.
   */
  it("surfaces gear the audience raises more often than the channel does", () => {
    const summary = summariseChannel(videos, [
      "what about the Boss DS-1",
      "Boss DS-1 please",
      "do the Boss DS-1 next",
    ])

    expect(summary.audienceFavourites.map((m) => m.pedalId)).toContain("boss-ds-1")
    // The channel demoed the TS9, so it is not an audience favourite.
    expect(summary.audienceFavourites.map((m) => m.pedalId)).not.toContain("ibanez-ts9")
  })

  it("handles a channel read with no comments at all", () => {
    const summary = summariseChannel(videos, [])
    expect(summary.discussed).toEqual([])
    expect(summary.audienceFavourites).toEqual([])
  })
})
