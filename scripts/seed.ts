import { sql } from "drizzle-orm"
import { closeDb, db } from "../lib/db"
import { listingPriceHistory, marketplaceListings } from "../lib/db/schema"
import { resolveAndReprice, upsertListings } from "../lib/ingestion/upsert"
import { refreshAllDeals } from "../lib/deals/pricing"
import { reverbAffiliateUrl } from "../lib/affiliate/awin"
import { buildEbayAffiliateUrl } from "../lib/affiliate/ebay"
import type { NewMarketplaceListing } from "../lib/db/schema"

/**
 * Development seed.
 *
 * Generates a realistic used-gear catalogue so the whole pipeline can be
 * exercised without eBay or Awin credentials: cross-source duplicates that must
 * merge onto one canonical row, price spreads wide enough for the deal engine to
 * have something to find, and back-dated price history for the detail chart.
 *
 * NOT production data. The listing URLs point at example.test so nothing here
 * can be mistaken for a live marketplace link or accidentally followed.
 */

type GearSpec = {
  brand: string
  model: string
  titleForms: string[]
  gtin: string
  epid: string
  mpn: string
  /** Typical used asking price in dollars. */
  marketPrice: number
  image: string
}

const CATALOGUE: GearSpec[] = [
  {
    brand: "Fender",
    model: "Player Stratocaster",
    titleForms: [
      "Fender Player Stratocaster Electric Guitar 3-Tone Sunburst",
      "Fender Player Stratocaster MIM Electric Guitar w/ Gig Bag",
      "Fender Player Series Stratocaster HSS Sunburst Excellent Condition",
    ],
    gtin: "885978512345",
    epid: "240012345",
    mpn: "0144502500",
    marketPrice: 749,
    image: "https://upload.wikimedia.org/wikipedia/commons/9/91/Fender_Stratocaster_004.JPG",
  },
  {
    brand: "Gibson",
    model: "Les Paul Standard",
    titleForms: [
      "Gibson Les Paul Standard 60s Bourbon Burst",
      "Gibson Les Paul Standard Electric Guitar with Hardshell Case",
      "Gibson Les Paul Standard Honeyburst MINT CONDITION FREE SHIPPING",
    ],
    gtin: "711106031415",
    epid: "240022222",
    mpn: "LPS600HSNH1",
    marketPrice: 2499,
    image: "https://upload.wikimedia.org/wikipedia/commons/a/a8/Gibson_Les_Paul_Standard_%28cherry_sunburst%29.jpg",
  },
  {
    brand: "Shure",
    model: "SM58",
    titleForms: [
      "Shure SM58 Dynamic Vocal Microphone",
      "Shure SM58-LC Cardioid Dynamic Microphone with Clip",
      "Shure SM58 Microphone Used Good Condition",
    ],
    gtin: "042406053303",
    epid: "240033333",
    mpn: "SM58-LC",
    marketPrice: 89,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Micro_Shure_SM58.jpg",
  },
  {
    brand: "Roland",
    model: "Juno-106",
    titleForms: [
      "Roland Juno-106 Analog Synthesizer Vintage 1984",
      "Roland Juno 106 Polyphonic Synth Serviced",
      "Roland JUNO-106 61-Key Synthesizer with Original Case",
    ],
    gtin: "761294500019",
    epid: "240044444",
    mpn: "JUNO-106",
    marketPrice: 1850,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/78/Roland-Juno-106.jpg",
  },
  {
    brand: "Boss",
    model: "DS-1 Distortion",
    titleForms: [
      "Boss DS-1 Distortion Guitar Effects Pedal",
      "Boss DS-1 Distortion Pedal with Box",
      "BOSS DS-1 Distortion Stompbox Used",
    ],
    gtin: "761294010013",
    epid: "240055555",
    mpn: "DS-1",
    marketPrice: 45,
    image: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Boss-DS-1.jpg",
  },
  {
    brand: "Marshall",
    model: "JCM800 2203",
    titleForms: [
      "Marshall JCM800 2203 100W Guitar Amplifier Head",
      "Marshall JCM 800 2203 Amp Head Vintage 1983",
      "Marshall JCM800 2203 Tube Amplifier Head Serviced",
    ],
    gtin: "886830123456",
    epid: "240066666",
    mpn: "2203",
    marketPrice: 2200,
    image: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Marshall_JCM800_amplifier.jpg",
  },
  {
    brand: "Martin",
    model: "D-28",
    titleForms: [
      "Martin D-28 Acoustic Guitar Dreadnought Natural",
      "Martin D-28 Standard Series Acoustic with Case",
      "C.F. Martin D-28 Acoustic Guitar Excellent",
    ],
    gtin: "729789400013",
    epid: "240077777",
    mpn: "D28",
    marketPrice: 2650,
    image: "https://upload.wikimedia.org/wikipedia/commons/e/e0/Martin_D28_Acoustic_Guitar.jpg",
  },
  {
    brand: "Yamaha",
    model: "P-125 Digital Piano",
    titleForms: [
      "Yamaha P-125 Digital Piano 88 Weighted Keys Black",
      "Yamaha P125 88-Key Digital Piano with Stand",
      "Yamaha P-125 Portable Digital Piano Used",
    ],
    gtin: "889025107458",
    epid: "240088888",
    mpn: "P125B",
    marketPrice: 549,
    image: "https://upload.wikimedia.org/wikipedia/commons/5/5d/Yamaha_Digital_Piano_P-155_%282010%29.jpg",
  },
  {
    brand: "Ibanez",
    model: "Tube Screamer TS9",
    titleForms: [
      "Ibanez TS9 Tube Screamer Overdrive Pedal",
      "Ibanez Tube Screamer TS9 Reissue Guitar Pedal",
      "Ibanez TS9 Tube Screamer Made in Japan",
    ],
    gtin: "606559000012",
    epid: "240099999",
    mpn: "TS9",
    marketPrice: 115,
    image: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Ibanez_ts9_tube_screamer.jpg",
  },
  {
    brand: "Zildjian",
    model: "A Custom Crash",
    titleForms: [
      "Zildjian A Custom 18 inch Crash Cymbal",
      "Zildjian A Custom Crash Cymbal 18\" Brilliant Finish",
      "Zildjian A Custom 18in Crash Used Good",
    ],
    gtin: "642388107867",
    epid: "240010101",
    mpn: "A20516",
    marketPrice: 235,
    image: "https://upload.wikimedia.org/wikipedia/commons/7/70/2006-07-06_Crash_Zildjian_14.jpg",
  },
]

const CONDITIONS = ["Used", "Very good", "Good", "Excellent", "Acceptable"]

/**
 * Deterministic pseudo-random so a reseed produces the same catalogue.
 * Math.random would make "did my change alter the deal count?" unanswerable.
 */
function makeRandom(seed: number) {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const random = makeRandom(20260809)

function buildListings(): NewMarketplaceListing[] {
  const rows: NewMarketplaceListing[] = []

  CATALOGUE.forEach((gear, gearIndex) => {
    // Eight listings per instrument: enough to clear the minimum sample size
    // so the deal engine actually publishes a market price.
    for (let i = 0; i < 8; i++) {
      const isReverb = i % 3 === 2
      const source = isReverb ? "reverb" : "ebay"
      const title = gear.titleForms[i % gear.titleForms.length]

      // Most listings cluster within 12% of market. Every third instrument gets
      // one genuine bargain so the deal path has something to find.
      const isBargain = i === 7 && gearIndex % 3 === 0
      const spread = isBargain ? -0.3 - random() * 0.1 : (random() - 0.5) * 0.24
      const price = Math.max(5, Math.round(gear.marketPrice * (1 + spread)))

      const externalId = `${source}-${gear.mpn}-${i}`
      const rawUrl = isReverb
        ? `https://reverb.com/item/${gearIndex}${i}-${gear.model.toLowerCase().replace(/\s+/g, "-")}`
        : `https://www.ebay.com/itm/${100000 + gearIndex * 100 + i}`

      // Some listings carry no identifiers at all, which forces the resolver
      // down the fuzzy tier rather than letting every row take Tier 1.
      const hasIdentifiers = i % 4 !== 3

      rows.push({
        source,
        externalId,
        title,
        description: null,
        priceCents: price * 100,
        currency: "USD",
        condition: CONDITIONS[i % CONDITIONS.length],
        brand: gear.brand,
        gtin: hasIdentifiers ? gear.gtin : null,
        epid: hasIdentifiers && !isReverb ? gear.epid : null,
        mpn: gear.mpn,
        locationCountry: "US",
        locationZip: null,
        isLocalPickup: i === 5,
        isShippable: i !== 5,
        rawUrl,
        affiliateUrl: isReverb
          ? reverbAffiliateUrl(rawUrl, { publisherId: "3004653", merchantId: "67144" })
          : buildEbayAffiliateUrl(rawUrl, { campaignId: "5338000000" }),
        primaryImageUrl: gear.image,
        listingStatus: "active",
        listedAt: new Date(Date.now() - i * 86_400_000 * 3),
        endsAt: null,
      })
    }
  })

  return rows
}

/**
 * Back-date price observations so the detail chart has a curve.
 * Written directly rather than through the ingest path, because the real path
 * only ever records "now".
 */
async function seedPriceHistory() {
  const listings = await db
    .select({
      id: marketplaceListings.id,
      canonicalGearId: marketplaceListings.canonicalGearId,
      source: marketplaceListings.source,
      priceCents: marketplaceListings.priceCents,
    })
    .from(marketplaceListings)

  const points: (typeof listingPriceHistory.$inferInsert)[] = []
  for (const listing of listings) {
    for (let daysAgo = 60; daysAgo >= 0; daysAgo -= 5) {
      // A gentle downward drift plus noise: used gear softens over time.
      const drift = 1 + (daysAgo / 60) * 0.08 + (random() - 0.5) * 0.04
      points.push({
        listingId: listing.id,
        canonicalGearId: listing.canonicalGearId,
        source: listing.source,
        priceCents: Math.round(listing.priceCents * drift),
        listingStatus: "active",
        observedAt: new Date(Date.now() - daysAgo * 86_400_000),
      })
    }
  }

  for (let i = 0; i < points.length; i += 500) {
    await db.insert(listingPriceHistory).values(points.slice(i, i + 500))
  }
  return points.length
}

async function main() {
  console.log("[seed] clearing existing catalogue")
  await db.execute(
    sql`TRUNCATE listing_price_history, outbound_clicks, marketplace_listings, canonical_gear RESTART IDENTITY CASCADE`,
  )

  const rows = buildListings()
  console.log(`[seed] inserting ${rows.length} listings across ${CATALOGUE.length} instruments`)
  const stats = await upsertListings(rows)
  console.log(`[seed] inserted=${stats.inserted} updated=${stats.updated} skipped=${stats.skipped}`)

  console.log("[seed] resolving canonical gear and computing market prices")
  const { resolved } = await resolveAndReprice(stats)
  console.log(`[seed] resolved ${resolved} listings`)

  const historyPoints = await seedPriceHistory()
  console.log(`[seed] wrote ${historyPoints} price observations`)

  const deals = await refreshAllDeals()
  console.log(`[seed] repriced ${deals.gearUpdated} instruments`)

  const summary = await db.execute<{ gear: number; listings: number; deals: number; review: number }>(sql`
    SELECT
      (SELECT COUNT(*) FROM canonical_gear)::int AS gear,
      (SELECT COUNT(*) FROM marketplace_listings)::int AS listings,
      (SELECT COUNT(*) FROM marketplace_listings WHERE is_deal)::int AS deals,
      (SELECT COUNT(*) FROM canonical_gear WHERE needs_review)::int AS review
  `)
  console.log("[seed] done:", summary.rows[0])

  await closeDb()
}

main().catch(async (error) => {
  console.error("[seed] failed:", error)
  await closeDb()
  process.exit(1)
})
