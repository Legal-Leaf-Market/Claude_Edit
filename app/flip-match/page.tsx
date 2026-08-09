import { permanentRedirect } from "next/navigation"

/** Flip Match became one board among several; the feed is the entry point now. */
export default function FlipMatchRedirect() {
  permanentRedirect("/boards/flip-match")
}
