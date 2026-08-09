# Admin operating model — implementation brief

**For:** a Claude Code session working in `Legal-Leaf-Market/Code_Backup`.
**Goal:** serve the four-site 24-month operating model privately at
`/admin/operating-model` on legal-leafmarket.com.

The feature is already written and verified against a **24 July 2026 snapshot**
of this codebase (it was built from `Claude_Edit`, which turned out to hold only
a backup zip and is not the deploy source). `Code_Backup` has moved on since —
flip cards, shelf sort controls, the shared edge cache, the COA overlay, the GA4
analytics layer, the Woo/BigCommerce cart fixes. **Port the feature onto current
`main`. Do not restore the snapshot over the top of it.**

The finished files ship alongside this brief in `operating-model-files.zip`. If
you have that zip, section 3 is a port. If you don't, sections 5–8 specify the
model exactly enough to rebuild it, and section 9 tells you whether you got it
right.

---

## 1. Read first

- This repo's `CLAUDE.md` — the existing work follows its conventions (there are
  references to "additively per CLAUDE.md section 5"). Follow them over anything
  in this brief where the two disagree.
- Ship this as a feature branch → PR, matching how #54–#63 were done. Do not
  push to `main`.

## 2. Known collision risks

Check each before writing a file. These are the ones I could infer without
having read current `main`:

| Risk | What to check |
|---|---|
| `lib/admin.ts` | There is a `window.LL_admin` global and a "published overrides" admin concept in this codebase. If `lib/admin.ts` or anything named `admin` already exists, rename the new gate to `lib/admin-gate.ts` and update the four imports. |
| `app/robots.ts` | The only *modified* file. One line: add `"/admin"` to the `disallow` array. Merge into whatever is there now — do not overwrite. |
| `app/admin/*` | Confirm no existing `/admin` route. If one exists, mount at `/admin/model` instead and adjust the redirect in `app/admin/page.tsx` and the `PATH` constant in the page. |
| `components/ui/button.tsx`, `lib/utils.ts` (`cn`) | The new components import `cn`. Confirm it still lives at `@/lib/utils`. |
| Tailwind brand tokens | The UI uses `text-mint`, `text-gold`, `bg-navy`, `text-lime`, `text-destructive`, `border-border`. These come from `app/globals.css`. Confirm they still exist. |
| `next.config.mjs` | It sets `typescript.ignoreBuildErrors: true`, so **`next build` will not catch type errors**. Run `tsc --noEmit` separately. |

## 3. Files to add

All additive except `app/robots.ts`.

```
lib/operating-model.ts                  engine: curves, ramps, aggregation, actuals
lib/operating-model-data.ts             site profiles, scenarios, merchant mix, copy
lib/admin.ts                            the gate (see collision note above)
app/admin/layout.tsx                    admin chrome + noindex metadata
app/admin/page.tsx                      redirect → /admin/operating-model
app/admin/sign-in/page.tsx              passcode screen / setup instructions
app/admin/operating-model/page.tsx      the gated page
app/api/admin/session/route.ts          passcode check, cookie issue/clear
components/admin/operating-model.tsx    composition, state, persistence
components/admin/model-chart.tsx        stacked-area SVG
components/admin/model-tables.tsx       unit economics, summary, quarterly, monthly, merchants, reverse
components/admin/model-controls.tsx     scenario picker, assumptions, export/import/reset
components/admin/model-ui.tsx           shared primitives
components/admin/admin-passcode-form.tsx
components/admin/admin-sign-out.tsx
app/robots.ts                           MODIFIED — one line
```

No new dependencies. The chart is hand-rolled inline SVG.

## 4. The gate

Two independent ways in, either sufficient. **With neither configured the gate
denies everyone** — an unset env var must never publish the financials. This is
deliberate; keep it.

| Variable | Behaviour |
|---|---|
| `ADMIN_PASSCODE` | Typed at `/admin/sign-in`. Doubles as the HMAC key for the session cookie, so rotating it invalidates every outstanding session. No database needed. |
| `ADMIN_EMAILS` | Comma-separated allowlist checked against the Better Auth session. Needs `DATABASE_URL` working. |

Requirements to preserve:

- Cookie `llm_admin`, value `<issuedAtSeconds>.<hmacSHA256>` over `v1:<issuedAt>`,
  keyed by `ADMIN_PASSCODE`. `httpOnly`, `sameSite: lax`, `secure` in production,
  30-day max age. Reject tokens older than 30 days **and** future-dated by more
  than 60s.
- Constant-time comparison. Hash both sides before comparing so it is
  length-independent.
- Per-IP throttle on the passcode endpoint (8 attempts / 10 min) plus a fixed
  400ms delay on failure. Per-instance is fine — it's a speed bump, and combined
  with the delay it makes online guessing impractical without a shared store.
- The Better Auth lookup must be wrapped in try/catch. It throws without
  `DATABASE_URL`, and that must not 500 the sign-in page when the passcode path
  is the one in use.
- `export const dynamic = "force-dynamic"` on both admin pages and the API route.
- `robots: { index: false, follow: false, nocache: true }` in the admin layout
  metadata, `/admin` in `robots.ts` disallow, and **not** in `sitemap.ts`.

## 5. The model

`lib/operating-model.ts`, no React in it. Horizon 24 months, starting September
2026 (`MODEL_START = { year: 2026, month: 8 }`, month 0-indexed).

**Traffic** — S-curve in log space, fitted so it passes through the three
session anchors exactly:

```
ln sessions(t) = A + B · sigmoid(k · (t − t0))
```

`k` is a per-site constant. Solve `t0` by bisection on
`(v−u)/(w−u) = (ln s12 − ln s1)/(ln s24 − ln s1)` where `u,v,w` are the sigmoid
at t = 1, 12, 24; then `B = (ln s24 − ln s1)/(w−u)` and `A = ln s1 − B·u`. Scan
for a sign change before bisecting rather than assuming a bracket, and fall back
to piecewise-geometric interpolation if no root exists — a user can type anchors
that admit no solution, and the page must not render `NaN`.

**Seasonality** — fixed per-category multiplier by calendar month, applied on
top. The anchors describe the *deseasonalised* trend, which is why a month can
print slightly above or below its anchor.

**Maturation** — conversion runs from 80% to 125% of the stated rate; attribution
from today's capture to its month-24 target. Both are normalised Weibull CDFs,
`p(t) = F(t)/F(24)`, so both hit their end state exactly at month 24.
Attribution ramps faster than conversion: the affiliate wiring gets fixed in the
first quarter, while trust and reviews accumulate across the whole two years.

```
revenue = sessions × conversion × basket × commission × attribution
```

Derive GMV and orders *from* revenue — `gmv = revenue / (commission × attribution)`,
`orders = gmv / basket` — so `revenue/GMV` always equals `commission × attribution`
and `GMV/orders` always equals the basket. This holds for modelled and
actuals-overridden months alike; computing them forward instead breaks that
invariant the moment an actual is entered.

## 6. Constants

These were recovered by fitting against the source document, not chosen. Don't
round them.

```ts
CONVERSION_FLOOR   = 0.80
CONVERSION_CEILING = 1.25
CONVERSION_RAMP    = { scale: 11.1445, shape: 1.1606 }   // Weibull, normalised at t=24
ATTRIBUTION_RAMP   = { scale:  9.5411, shape: 1.2217 }
```

Curve steepness `k`, and seasonality indexed **January → December**:

```ts
legal:   k 0.2558  [0.8281, 0.8150, 0.9292, 1.1072, 1.0106, 1.0088, 1.0380, 1.0116, 0.9597, 0.9336, 0.8508, 0.8305]
kawaii:  k 0.2588  [0.7542, 0.8734, 0.8157, 0.8273, 0.8707, 0.9165, 0.9541, 1.0241, 0.9606, 0.9799, 1.1063, 1.0918]
herbal:  k 0.2782  [0.9572, 0.8765, 0.8681, 0.8645, 0.8684, 0.8368, 0.8472, 0.9010, 0.9898, 1.0482, 1.1018, 1.1371]
nicotia: k 0.2794  [0.9620, 0.8837, 0.9062, 0.9165, 0.9437, 0.9545, 0.9663, 0.9802, 0.9873, 0.9461, 0.9091, 0.9008]
```

They read as you'd expect: hemp peaks in April, kawaii in November–December,
herbal in Q4, nicotine is flattest with a January lift.

Default assumptions:

| Site | m1 / m12 / m24 sessions | Basket | Comm | Conv | Attr now → mo24 | Pages |
|---|---|---|---|---|---|---|
| Legal Leaf | 600 / 4,500 / 20,000 | $95 | 15% | 1.50% | 60 → 90% | 15 |
| KawaiiKatz | 500 / 5,000 / 26,000 | $45 | 9% | 1.20% | 25 → 90% | 2 |
| Herbal Leaf | 350 / 2,000 / 8,500 | $58 | 17% | 1.30% | 40 → 88% | 5 |
| Nicotia | 450 / 3,000 / 14,000 | $52 | 9% | 1.40% | 55 → 88% | 17 |

Scenarios multiply the assumptions — they do not replace them, so a user's edits
survive a scenario switch:

```ts
bear: { sessions12: 0.55, sessions24: 0.40, conversion: 0.85, freezeAttribution: true  }
base: { sessions12: 1.00, sessions24: 1.00, conversion: 1.00, freezeAttribution: false }
bull: { sessions12: 1.60, sessions24: 2.20, conversion: 1.15, freezeAttribution: false }
```

`freezeAttribution` pins attribution at today's rate — the bear case is "the
affiliate applications never get filed."

## 7. Actuals re-anchoring

The feature that makes this a tool rather than a slide.

A month is **closed** only when it has *both* real sessions and real earned
commission. Both are required: revenue alone can't distinguish missing on
traffic from missing on yield. Once closed months exist:

```
trafficIndex = Σ actualSessions / Σ modelSessions          (over closed months)
yieldIndex   = (Σ actualRevenue / Σ actualSessions)
             / (Σ modelRevenue  / Σ modelSessions)
```

Pool the totals rather than averaging per-month ratios, so one freak month
doesn't dominate. Then:

- closed months → use the actuals verbatim
- months after the last closed month → `sessions × trafficIndex`,
  `revPerSession × yieldIndex`
- gaps before the last closed month → leave modelled

This keeps the modelled improvement curve while re-basing its level. Both
indices are 1 when there are no actuals, so the pure model is the limiting case.

State persists to `localStorage` under `llm.operating-model.v1` with export,
import and reset. Load it in an effect, not during render, or the server and
client HTML disagree.

## 8. Chart

Inline SVG, no library. Stacked area, 24 months, four series, bottom band is
Legal Leaf.

Colours were validated as a set against the dark chart surface `#0a1a29` for
lightness band, chroma floor, colour-vision separation and contrast:

```
Legal Leaf  #25a942     Herbal Leaf  #c98500
KawaiiKatz  #d55181     Nicotia      #4a90e2
```

The green↔pink pair sits in the 6–8 ΔE colour-vision band, which is **only
acceptable with secondary encoding**. That's why the bands carry a 2px
surface-coloured gap, a legend, and direct end-of-series labels. If you restyle
the chart, keep all three or re-validate the palette.

Also keep: solid hairline grid (never dashed), the x-axis band inside the
container height, crosshair + tooltip with keyboard (←/→) parity, hover targets
spanning the full column height, and `tabular-nums` in tables but not on the
hero figures.

## 9. Acceptance — the numbers it must produce

Base scenario, defaults, no actuals. These are the check that the port didn't
break the math:

| | Expected |
|---|---|
| Year 1 | $5,766 |
| Year 2 | $62,207 |
| 24-month total | $67,973 |
| Month 24 | $8,390 |
| Exit run-rate | $100,679 |
| Sessions, month 24 | 68,241 |
| Blended rev/session | $0.123 |
| Maturity rev/session | $0.240 / $0.055 / $0.141 / $0.072 |
| Bear 24-month total | $15,371 |
| Bull exit run-rate | $254,715 |

Maturity revenue per session is
`basket × commission × conversion × 1.25 × attributionExit` — check that one
first, it isolates the unit economics from the traffic curve.

## 10. Verify before opening the PR

1. `tsc --noEmit` clean (the build won't do this for you).
2. `next build` — `/admin/operating-model` and `/admin/sign-in` must appear as
   **ƒ (Dynamic)**. Static would mean the gate got prerendered.
3. Gate, all five cases: no cookie → redirect; forged cookie → redirect; wrong
   passcode → 401; no env configured → redirect + setup instructions, API 501;
   correct passcode → 200.
4. `/robots.txt` contains `Disallow: /admin`; `/sitemap.xml` does not mention it;
   the page's meta robots is `noindex, nofollow`.
5. Enter a month-1 actual at roughly half plan for Legal Leaf and confirm the
   whole forward curve drops, the header chip reads "Re-anchored on 1 closed
   month", and **the other three sites are unaffected** — re-anchoring is
   per-site.
6. Scenario switch, an inline cell edit, export/import/reset, and a reload to
   confirm persistence.
7. No horizontal page scroll at 390 / 768 / 1440px.

## 11. One thing to look at with your own eyes

The public site paints a full-bleed paisley behind everything via `body::before`.
It's right for a landing page and makes a document this dense unreadable. The
admin layout lays an almost-opaque navy over it
(`linear-gradient(180deg, rgba(4,16,27,0.955), rgba(6,21,33,0.975))`) so text and
table rules stay legible while keeping a hint of texture. If `globals.css` has
changed since the snapshot, screenshot the page and check this still works —
it's the one thing that can't be caught by a type check.
