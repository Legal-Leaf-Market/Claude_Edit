import { env } from "@/lib/env"
import { IMPACT_MERCHANTS } from "./impact-merchants"
import { STOREFRONT_MERCHANTS } from "@/lib/storefronts"

/**
 * WHY IS THIS SOURCE NOT PRODUCING ROWS, AND WHAT WOULD FIX IT.
 *
 * THE PROBLEM THIS SOLVES. /api/health answers the first half of that question
 * and stops: it says `zzounds-feed=absent` and `musiciansfriend:
 * no-catalogue-id` and reports that `andertons-catalogue` failed. All true, all
 * useless to somebody who wants product on the site, because none of it says
 * WHICH value is missing, WHERE that value comes from, or whether anybody can
 * do anything about it at all.
 *
 * That gap has already cost this project real money twice. The Anderton's API
 * job failed every hour for two weeks reporting only a status code, and the one
 * line that explained it (the advertiser had not enabled API delivery) was
 * sitting in the response body nobody printed. The FTP job has not run since 11
 * August, and its failure reason has been sitting in `ingest_runs.error` ever
 * since, which nothing reads.
 *
 * So this is the map: every source, what state it is actually in, and for the
 * blocked ones the exact variable and the exact place its value is found. The
 * "where from" halves are the part nobody remembers, and they are the reason a
 * source stays unconfigured for a month.
 *
 * THREE STATES THAT LOOK IDENTICAL FROM OUTSIDE AND ARE NOT.
 *
 *   `blocked`       Somebody has to paste a value. This is the only state that
 *                   is anybody here's fault, and the only one worth chasing.
 *   `merchant-side` The fix is a setting in somebody else's account. Retrying
 *                   never helps. Anderton's over the API is the example, and
 *                   recording it as a failure was what made it invisible.
 *   `paused`        A deliberate decision, with a reason.
 *
 * WHAT THIS IS NOT. It carries no credential and no feed URL, only whether one
 * is set. It is still served behind the admin passcode rather than on /health,
 * because the "where from" text names internal platform settings, and because
 * it sits beside the stored error text, which is a feed's own words and cannot
 * be vetted in advance.
 */

export type SourceState = "live" | "blocked" | "merchant-side" | "paused"

export type SourceStatus = {
  source: string
  label: string
  state: SourceState
  /** How the catalogue arrives, so a reader knows what kind of thing broke. */
  transport: string
  /** The variable or setting that has to change. Absent when nothing does. */
  blockedBy?: string
  /** Where its value is found. The half that is always missing. */
  whereFrom?: string
}

/**
 * Ordered by how much catalogue is behind each one, because the point of the
 * list is deciding what to chase first, and the largest blocked source is
 * almost always the right answer.
 */
export function sourceStatuses(): SourceStatus[] {
  const statuses: SourceStatus[] = []

  /* ---- Impact.com, one credential pair and eight catalogue ids ---- */

  for (const merchant of IMPACT_MERCHANTS) {
    /*
     * ANDERTON'S IS TWO ENTRIES BECAUSE IT IS TWO TRANSPORTS, and collapsing
     * them is how its real state got lost. The API path is settled as
     * impossible from the advertiser's side; the FTP path is the only way in
     * and is a completely separate question about credentials we do hold.
     */
    if (merchant.key === "andertons") {
      statuses.push({
        source: "andertons",
        label: `${merchant.label} (FTP drop)`,
        state: env.impact.hasAndertonsFeed ? "live" : "blocked",
        transport: "Impact FTP drop, the whole catalogue per run",
        ...(env.impact.hasAndertonsFeed
          ? {}
          : {
              blockedBy: "IMPACT_ANDERTONS_FTP_USER and IMPACT_ANDERTONS_FTP_PASSWORD",
              whereFrom:
                "A dedicated pair Impact mails on request, from 'Email Product Catalog FTP Username " +
                "and Password' in the platform. Not the Impact account login; requesting them needs " +
                "the Technical Settings permission. The host is on the platform's 'Download via FTP' panel.",
            }),
      })
      statuses.push({
        source: "andertons-api",
        label: `${merchant.label} (REST API)`,
        state: "merchant-side",
        transport: "Impact catalogue API, paginated HTTPS",
        blockedBy: "The advertiser has not published catalogue 30480 to the API",
        whereFrom:
          "Nothing here can fix it. Impact answers every request with 'The requested catalog has not " +
          "been made available via API by the Advertiser.' The credentials are fine (a 400, not a 401) " +
          "and the id is right (a 400, not a 404). Andertons would have to switch API delivery on. " +
          "Until they do, the FTP drop above is the only way in.",
      })
      continue
    }

    if (!env.impact.hasApi) {
      statuses.push({
        source: merchant.key,
        label: merchant.label,
        state: "blocked",
        transport: "Impact catalogue API, paginated HTTPS",
        blockedBy: "IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN",
        whereFrom: "Impact's API settings page. Both are shared by every advertiser on the account.",
      })
      continue
    }

    statuses.push({
      source: merchant.key,
      label: merchant.label,
      state: merchant.catalogId ? "live" : "blocked",
      transport: "Impact catalogue API, paginated HTTPS",
      ...(merchant.catalogId
        ? {}
        : {
            blockedBy: `IMPACT_${merchant.key.toUpperCase()}_CATALOG_ID`,
            whereFrom:
              "Press 'List the Impact catalogues' above: it reads the real ids off the account. " +
              "NEVER guess one, and never use the programme id from the marketplace export " +
              `(${merchant.label} is programme ${merchant.programId}, which is a different numbering ` +
              "scheme entirely). A wrong id does not fail safely: it returns another advertiser's " +
              "products under this merchant's name. Note that an approval is not a catalogue, so a " +
              "correct id can still be answered the way Anderton's is.",
          }),
    })
  }

  /* ---- The network feeds, each one URL away ---- */

  statuses.push({
    source: "zzounds",
    label: "zZounds",
    state: env.cj.hasZzoundsFeed ? "live" : "blocked",
    transport: "CJ Affiliate product feed",
    ...(env.cj.hasZzoundsFeed
      ? {}
      : {
          blockedBy: "CJ_ZZOUNDS_FEED_URL",
          whereFrom:
            "The CJ Affiliate dashboard, under the zZounds programme's product feeds. Paste the whole " +
            "download URL including its credentials. The parser is written and tested; this is the " +
            "only thing missing.",
        }),
  })

  statuses.push({
    source: "fullcompass",
    label: "Full Compass Systems",
    state: env.cj.hasFullCompassFeed ? "live" : "blocked",
    transport: "CJ Affiliate product feed",
    ...(env.cj.hasFullCompassFeed
      ? {}
      : {
          blockedBy: "CJ_FULLCOMPASS_FEED_URL",
          whereFrom:
            "The CJ Affiliate dashboard, under Full Compass's own programme. It is a SEPARATE " +
            "advertiser from zZounds with its own feed URL, not a second view of one shared feed. " +
            "Built and tested; unset is the only thing stopping it.",
        }),
  })

  statuses.push({
    source: "pinevillemusic",
    label: "Pineville Music",
    state: env.cj.hasPinevilleMusicFeed ? "live" : "blocked",
    transport: "CJ Affiliate product feed",
    ...(env.cj.hasPinevilleMusicFeed
      ? {}
      : {
          blockedBy: "CJ_PINEVILLEMUSIC_FEED_URL",
          whereFrom:
            "The CJ Affiliate dashboard, under Pineville Music's own programme. A third separate " +
            "advertiser again, with its own feed URL. Built and tested; unset is the only thing " +
            "stopping it.",
        }),
  })

  statuses.push({
    source: "reverb",
    label: "Reverb",
    state: env.awin.hasFeed ? "live" : "blocked",
    transport: "Awin product datafeed",
    ...(env.awin.hasFeed
      ? {}
      : {
          blockedBy: "AWIN_REVERB_FEED_URL",
          whereFrom:
            "The Awin dashboard's Create-a-Feed tool, advertiser 67144 (Reverb US). The feed is " +
            "CONFIRMED to exist and the programme is at 100% approval, so this is pending retrieval " +
            "rather than pending existence. The Reverb API is not an alternative and never will be.",
        }),
  })

  statuses.push({
    source: "gear4music",
    label: "Gear4music",
    state: env.awin.hasGear4musicFeed ? "live" : "blocked",
    transport: "Awin product datafeed",
    ...(env.awin.hasGear4musicFeed
      ? {}
      : {
          blockedBy: "AWIN_GEAR4MUSIC_FEED_URL",
          whereFrom: "The Awin dashboard, advertiser 1117. Confirmed to exist, same as Reverb's.",
        }),
  })

  statuses.push({
    source: "sweetwater",
    label: "Sweetwater",
    state: env.linkconnector.hasSweetwaterFeed ? "live" : "blocked",
    transport: "LinkConnector product datafeed",
    ...(env.linkconnector.hasSweetwaterFeed
      ? {}
      : {
          blockedBy: "LINKCONNECTOR_SWEETWATER_FEED_URL",
          whereFrom:
            "LinkConnector, IF their programme publishes a product datafeed at all. Unlike Reverb and " +
            "Gear4music this one is unconfirmed to exist, so unset is the expected state rather than " +
            "an oversight. Sweetwater has no product API and their search index is not a substitute.",
        }),
  })

  statuses.push({
    source: "ebay",
    label: "eBay",
    state: env.ebay.isConfigured ? "live" : "blocked",
    transport: "Buy Feed API, gzipped TSV in byte ranges",
    ...(env.ebay.isConfigured
      ? {}
      : {
          blockedBy: "EBAY_OAUTH_TOKEN",
          whereFrom:
            "An application token from an approved eBay keyset. EBAY_FEED_BASE_URL defaults to " +
            "SANDBOX and must be pointed at production per environment once a production keyset is " +
            "actually approved, never by changing the default.",
        }),
  })

  /* ---- The independent storefronts, which need no credential at all ---- */

  for (const merchant of STOREFRONT_MERCHANTS) {
    statuses.push({
      source: merchant.source,
      label: merchant.label,
      state: merchant.schedule === null ? "paused" : "live",
      transport:
        merchant.platform === "shopify"
          ? "Public Shopify storefront JSON"
          : "Public WooCommerce Store API",
      ...(merchant.schedule === null ? { whereFrom: merchant.pausedReason } : {}),
    })
  }

  return statuses
}

/** The ones somebody could actually act on, largest catalogues first. */
export function blockedSources(): SourceStatus[] {
  return sourceStatuses().filter((s) => s.state === "blocked")
}
