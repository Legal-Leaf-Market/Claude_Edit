import { StompLink } from "@/components/ui/stomp"

export default function NotFound() {
  return (
    <div className="shell-narrow py-24 text-center">
      <p className="stencil">404</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--text)]">
        No signal
      </h1>
      <p className="mx-auto mt-4 max-w-prose leading-relaxed text-[var(--dim)]">
        Nothing at this address. Check the cable, then try the directory.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <StompLink href="/pedals" variant="go">
          Browse the circuits
        </StompLink>
        <StompLink href="/" variant="ghost">
          Home
        </StompLink>
      </div>
    </div>
  )
}
