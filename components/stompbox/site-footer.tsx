import Link from "next/link"
import { StompboxMark } from "@/components/stompbox/logo"
import { InstagramGlyph } from "@/components/icons/instagram-glyph"
import { sbHref } from "@/lib/stompbox/host"
import { NAV } from "@/lib/stompbox/nav"
import { env } from "@/lib/stompbox/env"
import { SITE_NAME } from "@/lib/stompbox/site"

export function SiteFooter({ base }: { base: string }) {
  const handle = env.social.instagramHandle

  return (
    <footer className="mt-24 border-t border-[var(--line)] bg-[var(--bg2)]">
      <div className="shell py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <StompboxMark size={32} flat />
              <span className="text-lg font-black tracking-tight text-[var(--text)]">
                {SITE_NAME}
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--dim)]">
              A plain guide to what effects pedals actually do. No affiliate links, no
              prices and nothing to buy here, which is why the descriptions can say a
              pedal sounds thin.
            </p>
            <a
              href={`https://instagram.com/${handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline"
            >
              <InstagramGlyph className="h-4 w-4" />@{handle}
            </a>
          </div>

          <nav aria-label="Footer">
            <h2 className="stencil">Pages</h2>
            <ul className="mt-4 space-y-3">
              {NAV.map((link) => (
                <li key={link.href}>
                  <Link
                    href={sbHref(base, link.href)}
                    className="text-sm font-semibold text-[var(--text)] underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </Link>
                  <p className="text-xs text-[var(--dim)]">{link.blurb}</p>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/*
          The disclaimer is load bearing rather than boilerplate. This site
          names manufacturers and products constantly, and it is not connected
          to any of them. Saying so once, plainly, is what keeps a directory
          from reading as an endorsement in either direction.
        */}
        <p className="mt-12 border-t border-[var(--line)] pt-6 text-xs leading-relaxed text-[var(--dim)]">
          Product and company names are the property of their respective owners and are
          used here to identify the equipment being described. {SITE_NAME} is not
          affiliated with, endorsed by, or speaking for any manufacturer named on this
          site. Circuit descriptions are written to be checkable against the pedal in
          your hands: if one of them is wrong, it is worth telling us.
        </p>
      </div>
    </footer>
  )
}
