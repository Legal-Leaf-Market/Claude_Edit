import {
  fetchCommentText,
  listRecentVideos,
  resolveUploadsPlaylist,
  summariseChannel,
  type ChannelSummary,
} from "@/lib/ingestion/andertons-youtube"
import { env } from "@/lib/env"

/**
 * The Anderton's TV summary, sized to fit inside the API quota.
 *
 * THE QUOTA IS THE WHOLE DESIGN CONSTRAINT. The YouTube Data API gives 10,000
 * units a day for the entire project, and a comment-threads call costs a unit
 * per video. Reading 50 videos with their comments is ~52 units, which is
 * nothing once a day and fatal per request: a hundred visitors would spend the
 * day's quota before lunch and every other YouTube-backed thing on the site
 * would start failing, with the cause a page nobody was looking at.
 *
 * So two limits, and they are not tuning knobs:
 *
 *   1. The caller is an ISR page with a long `revalidate`, so this runs a
 *      handful of times a day rather than per request.
 *   2. VIDEO_LIMIT caps the fan-out, because the comment cost is per video and
 *      the tail of a channel's uploads adds very little to the counts.
 *
 * UNSET KEY IS A SUPPORTED STATE, the same as GROQ_API_KEY. It returns null
 * and the caller renders no panel, rather than a broken one.
 *
 * COMMENTS ARE COUNTED, NEVER SHOWN. The reader's own header sets that rule
 * and it survives here: what leaves this function is gear names and integers.
 * No comment text, no author, no video attribution to a person.
 */

/**
 * How many recent uploads to read.
 *
 * 25 rather than the reader's default 50 purely because comments cost a unit
 * each. The counts are a ranking, and a ranking over 25 recent videos and one
 * over 50 disagree about the tail, not the top.
 */
const VIDEO_LIMIT = 25

/** Comments per video. The reader defaults to 100; the top of a thread is enough to rank by. */
const COMMENT_LIMIT = 60

export async function andertonsChannelSummary(): Promise<ChannelSummary | null> {
  if (!env.youtube.isConfigured) return null

  const { uploadsPlaylistId } = await resolveUploadsPlaylist()
  const videos = await listRecentVideos(uploadsPlaylistId, VIDEO_LIMIT)

  /*
   * Comment threads are disabled on some videos and that answers 403. One
   * video refusing must not lose the other twenty-four, so each is allowed to
   * come back empty. This is the only place a swallowed error is right here:
   * the failure mode is a slightly lower count, not a wrong one.
   */
  const commentTexts = (
    await Promise.all(videos.map((video) => fetchCommentText(video.id, COMMENT_LIMIT).catch(() => [])))
  ).flat()

  return summariseChannel(videos, commentTexts)
}
