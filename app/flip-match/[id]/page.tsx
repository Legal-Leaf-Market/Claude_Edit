import { permanentRedirect } from "next/navigation"

/** Threads moved to /posts/[id] once boards other than Flip Match existed. */
export default async function FlipMatchThreadRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  permanentRedirect(`/posts/${id}`)
}
