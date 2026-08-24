/**
 * WHERE TO POINT THE COLLECTOR, AND THE PAGES WORTH STARTING FROM.
 *
 * The install page needs this for one blunt reason: an operator with a
 * bookmarklet and no list has to go and find the right category page on every
 * merchant, every time, and remember which merchant key it files under. That
 * friction is the whole difference between a tool that gets used and one that
 * gets built.
 *
 * SCOPED TO MERCHANTS WE HOLD AN AGREEMENT WITH. This list is a set of links on
 * a page, so nothing stops anybody running the bookmarklet anywhere. What it
 * does is decide which merchants the tool actively points at, and that is worth
 * being deliberate about: Guitar Center is absent here for the same reason it
 * is absent from PROMOTION_RULES and from section 2's source list, and a row
 * added here should be a merchant somebody has already decided about.
 *
 * THE ENTRY URLS ARE CATEGORY PAGES, not homepages. A crawl starts where it is
 * pointed and walks that section's pagination, so a homepage is the one page on
 * a retailer's site guaranteed to contain no paginated grid at all.
 *
 * These are the merchant's own public category URLs, the same ones a shopper
 * lands on from a search engine. They go stale when a retailer reorganises;
 * that shows up immediately as a capture finding nothing, which the panel says
 * in words.
 */

export type CaptureTarget = {
  /** Must match a merchant key the operator files captures under. */
  merchantKey: string
  label: string
  /** Where a shopper would start. */
  homeUrl: string
  /** Category pages worth crawling, most useful first. */
  entries: { label: string; url: string }[]
  /** What we hold, so the operator knows why this one is on the list. */
  basis: string
  /**
   * Warnings specific to this merchant's site, learned the hard way rather
   * than guessed. Empty is fine; a wrong one is worse than none.
   */
  notes?: string[]
}

export const CAPTURE_TARGETS: CaptureTarget[] = [
  {
    merchantKey: "andertons",
    label: "Andertons Music Co.",
    homeUrl: "https://www.andertons.co.uk",
    basis: "Approved Impact.com partner since 11 Aug 2026, commission 1-4%.",
    entries: [
      { label: "Guitar pedals", url: "https://www.andertons.co.uk/guitars/guitar-pedals" },
      { label: "Electric guitars", url: "https://www.andertons.co.uk/guitars/electric-guitars" },
      { label: "Acoustic guitars", url: "https://www.andertons.co.uk/guitars/acoustic-guitars" },
      { label: "Guitar amps", url: "https://www.andertons.co.uk/guitars/guitar-amps" },
      { label: "Bass guitars", url: "https://www.andertons.co.uk/bass" },
      { label: "Studio and recording", url: "https://www.andertons.co.uk/recording" },
    ],
    notes: [
      "Prices are GBP and Andertons ships UK only, which section 15 already handles: these listings " +
        "are hidden from shoppers outside the UK unless they ask to see everything.",
      "The FTP feed carries all ~27,000 products AND the tracked links. A crawl carries the products " +
        "and no links, so use this while that is being connected rather than instead of it.",
    ],
  },
  {
    merchantKey: "zzounds",
    label: "zZounds",
    homeUrl: "https://www.zzounds.com",
    basis: "Approved CJ Affiliate partner.",
    entries: [
      { label: "Effects pedals", url: "https://www.zzounds.com/cat--Guitar-Effects--2828" },
      { label: "Electric guitars", url: "https://www.zzounds.com/cat--Electric-Guitars--2829" },
      { label: "Guitar amplifiers", url: "https://www.zzounds.com/cat--Guitar-Amplifiers--2830" },
      { label: "Bass guitars", url: "https://www.zzounds.com/cat--Bass-Guitars--2831" },
    ],
    notes: [
      "The CJ product feed carries pre-built BUY_URL tracking links and is one environment variable " +
        "away. Crawled rows earn nothing.",
    ],
  },
  {
    merchantKey: "musiciansfriend",
    label: "Musician's Friend",
    homeUrl: "https://www.musiciansfriend.com",
    basis: "Approved Impact.com partner, August 2026. US only.",
    entries: [
      { label: "Effects pedals", url: "https://www.musiciansfriend.com/guitar-effects" },
      { label: "Electric guitars", url: "https://www.musiciansfriend.com/electric-guitars" },
      { label: "Guitar amplifiers", url: "https://www.musiciansfriend.com/guitar-amplifiers" },
      { label: "Bass", url: "https://www.musiciansfriend.com/bass" },
    ],
    notes: [
      "US only, declared on its StoreProfile, so section 15 hides these from shoppers elsewhere.",
    ],
  },
]

export function captureTarget(merchantKey: string): CaptureTarget | null {
  return CAPTURE_TARGETS.find((t) => t.merchantKey === merchantKey.toLowerCase()) ?? null
}
