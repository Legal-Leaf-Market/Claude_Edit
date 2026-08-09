// Sample content for the /articles section. Kept as plain data so the list
// page and the individual article page can share one source of truth.

export type ArticleSection = {
  heading?: string
  paragraphs: string[]
}

export type Article = {
  slug: string
  title: string
  excerpt: string
  readTime: string
  publishedAt: string // ISO date
  image: string
  sections: ArticleSection[]
}

export const ARTICLES: Article[] = [
  {
    slug: "what-is-thca",
    title: "What Is THCA? A Beginner's Guide to the Raw Cannabinoid",
    excerpt:
      "THCA shows up on nearly every hemp flower label, but most shoppers aren't sure what it actually is. Here's a plain-language breakdown.",
    readTime: "5 min read",
    publishedAt: "2026-05-04",
    image: "/products/thca-flower.png",
    sections: [
      {
        paragraphs: [
          "THCA, short for tetrahydrocannabinolic acid, is the raw, non-intoxicating cannabinoid found in freshly harvested hemp and cannabis plants. It's the compound that eventually becomes THC, but on its own it behaves very differently in the body.",
          "If you've shopped for legal hemp flower, pre-rolls, or concentrates, you've likely seen THCA listed as the dominant cannabinoid on the lab report. That's because raw plant material is naturally rich in THCA, not THC.",
        ],
      },
      {
        heading: "Why raw flower is mostly THCA, not THC",
        paragraphs: [
          "Cannabis plants don't produce THC directly. As the plant grows, it produces THCA, an acidic form of the cannabinoid that isn't intoxicating in its raw state. THC only forms when THCA is exposed to heat through a process called decarboxylation — think smoking, vaping, or baking.",
          "This is why a lab certificate of analysis (COA) usually shows a small percentage of 'Delta-9 THC' alongside a much larger percentage of THCA — the flower simply hasn't been heated yet.",
        ],
      },
      {
        heading: "How THCA converts to THC",
        paragraphs: [
          "When THCA is heated, it loses a carboxyl group (a molecular structure) and converts into Delta-9 THC, the compound widely known for its intoxicating effects. This conversion happens quickly at high heat, which is why combustion or vaporization is the most common way people experience THC from THCA-rich flower.",
          "Because of this chemistry, a product's 'total THC' potential is usually calculated using both the THCA and Delta-9 THC numbers on a lab report, since the THCA can convert almost entirely to THC once heated.",
        ],
      },
      {
        heading: "Why it matters for legality",
        paragraphs: [
          "Federal hemp law draws its line at Delta-9 THC content, not total cannabinoid content, which is part of why THCA-dominant hemp flower has become widely available. Rules vary by state and can change, so it's always worth checking current regulations in your area before purchasing or traveling with any hemp product.",
        ],
      },
      {
        heading: "Reading a lab report",
        paragraphs: [
          "A good COA will list THCA, Delta-9 THC, and 'Total THC' separately, along with results for pesticides, heavy metals, and residual solvents. When you're comparing flower across stores, that lab sheet is the most reliable way to know what you're actually getting — price per gram only tells half the story.",
        ],
      },
    ],
  },
  {
    slug: "thca-vs-thc",
    title: "THCA vs. THC: What's the Real Difference?",
    excerpt:
      "They sound like the same thing, but THCA and THC behave very differently in the body — and that difference matters more than you'd think.",
    readTime: "4 min read",
    publishedAt: "2026-05-18",
    image: "/products/prerolls.png",
    sections: [
      {
        paragraphs: [
          "THCA and THC are chemically related, but they are not the same compound, and they don't affect the body the same way. Understanding the difference helps explain why a jar of hemp flower can be legal to sell while still containing a cannabinoid that becomes intoxicating once it's heated.",
        ],
      },
      {
        heading: "The core difference",
        paragraphs: [
          "THCA is the acidic precursor compound found in raw, unheated cannabis and hemp. On its own, THCA does not produce the intoxicating effects commonly associated with cannabis. THC (specifically Delta-9 THC) is the compound that forms after THCA is heated, and it's the one responsible for the effects most people associate with cannabis use.",
          "In short: THCA is the 'before,' and THC is the 'after.' The heat is what makes the difference.",
        ],
      },
      {
        heading: "Does that mean raw THCA flower is 'legal weed'?",
        paragraphs: [
          "It's more nuanced than that. Unheated, THCA-dominant flower can be lab-tested to fall within legal hemp thresholds for Delta-9 THC, even though it contains enough THCA to convert into a meaningful amount of THC once it's smoked or vaporized. This is exactly why THCA products exist in a regulatory gray area that varies by state, and why laws around them continue to evolve.",
        ],
      },
      {
        heading: "What to check before you buy",
        paragraphs: [
          "Look for three numbers on the lab report: THCA percentage, Delta-9 THC percentage, and 'Total THC' (a calculated figure that estimates how much THC the product could yield once heated). A flower listed at 24% THCA and 0.3% Delta-9 THC, for example, has a total THC potential well above what most people picture when they hear 'hemp.'",
          "It's also worth checking your local and state laws, since THCA regulation is one of the fastest-moving areas of hemp policy right now.",
        ],
      },
    ],
  },
  {
    slug: "storing-thca-flower",
    title: "How to Store THCA Flower to Protect Potency and Freshness",
    excerpt:
      "THCA is sensitive to light, heat, and air. A few simple storage habits go a long way toward keeping flower fresh and potent.",
    readTime: "4 min read",
    publishedAt: "2026-06-01",
    image: "/products/cbd-flower.png",
    sections: [
      {
        paragraphs: [
          "THCA-rich flower is a living product — even after harvest and curing, it keeps reacting to its environment. Light, heat, humidity, and air exposure can all degrade cannabinoids and terpenes over time, which is why storage matters just as much as the price you paid per gram.",
        ],
      },
      {
        heading: "Keep it cool and dark",
        paragraphs: [
          "Heat and UV light both accelerate the natural degradation of THCA, gradually converting it into other compounds and dulling the aroma. A cool, dark cabinet or drawer works far better than a windowsill or a spot near a stove or heating vent.",
        ],
      },
      {
        heading: "Airtight containers beat bags",
        paragraphs: [
          "Glass jars with a tight seal are the standard for a reason: they limit oxygen exposure, which slows cannabinoid and terpene breakdown, and they don't impart any plastic smell the way some bags can over time. Opaque or amber glass adds an extra layer of light protection.",
        ],
      },
      {
        heading: "Watch your humidity",
        paragraphs: [
          "Flower that's too dry loses aromatic terpenes and can feel harsh, while flower that's too damp risks mold. Many shoppers use small two-way humidity packs inside their storage jar to keep conditions in a stable range without having to think about it daily.",
        ],
      },
      {
        heading: "Buy what you'll use",
        paragraphs: [
          "Even with ideal storage, cannabinoid content slowly declines over months. Buying reasonable quantities and rotating through your stash — rather than stockpiling a huge amount at once — is one of the simplest ways to make sure you're actually smoking what the lab report promised.",
        ],
      },
    ],
  },
]

export function getArticle(slug: string) {
  return ARTICLES.find((a) => a.slug === slug)
}
