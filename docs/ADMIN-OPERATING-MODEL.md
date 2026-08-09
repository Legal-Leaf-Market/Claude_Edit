# Operating model — admin mode

The 24-month projection for the four-site affiliate family, served privately at
**`/admin/operating-model`** on legal-leafmarket.com.

## Turning it on

The gate **fails closed**. With no credential configured nobody gets in, and the
sign-in page says so rather than silently exposing the page. Set one of these in
your Vercel project's environment variables and redeploy:

| Variable | What it does |
|---|---|
| `ADMIN_PASSCODE` | A long random string. Type it at `/admin/sign-in` to unlock. It also signs the session cookie, so changing it signs everyone out. Sessions last 30 days. |
| `ADMIN_EMAILS` | Comma-separated addresses. Anyone signed in to the site with one of these accounts gets in without a second secret. Requires the site's own Better Auth login (`DATABASE_URL`) to be working. |

Either is sufficient; both can be set. `ADMIN_PASSCODE` is the quicker path
because it needs no database.

Failed passcode attempts are rate-limited per IP and compared in constant time.
The whole `/admin` tree is `noindex, nofollow`, listed in `robots.txt` under
`Disallow`, and absent from `sitemap.xml`.

## What the page does

Everything recalculates live — nothing downstream of the assumptions is
hard-coded.

- **Scenario** — bear / base / bull. The scenario *multiplies* the assumptions
  rather than replacing them, so your edits survive a scenario switch.
- **Edit any cell** — basket, commission, conversion and attribution are
  editable inline in the unit-economics table; all eight inputs per site
  (including the three session anchors) live in the assumptions panel.
- **Actuals** — enter real sessions *and* real earned commission for a closed
  month. Both are required: revenue alone can't tell you whether you missed on
  traffic or on yield. Once a month has both, it overrides the model and
  re-anchors everything after it — forward traffic scales by how you're tracking
  against plan, and forward revenue per session is re-based on realised yield
  while keeping the modelled improvement curve.
- **Persistence** — entries save to your browser automatically, with export,
  import and reset.

## How the projection is built

`lib/operating-model.ts` is the whole engine and has no React in it.

1. **Traffic** follows an S-curve in log space,
   `ln sessions(t) = A + B·sigmoid(k(t − t0))`, solved so it passes through the
   month-1, month-12 and month-24 anchors exactly. `k` is a per-site constant;
   `A`, `B` and `t0` are derived. If a pathological set of anchors admits no
   solution it falls back to piecewise-geometric interpolation rather than
   returning `NaN`.
2. **Seasonality** multiplies on top — a fixed per-category monthly vector.
   April for hemp, January for nicotine, Q4 for tea and gifting, Black Friday
   through December for kawaii. The anchors describe the deseasonalised trend,
   which is why a month can print slightly above or below its anchor.
3. **Conversion** matures from 80% to 125% of the stated rate over the horizon;
   **attribution** ramps from today's capture to its month-24 target. Both are
   normalised Weibull curves reaching their end state exactly at month 24.
   Attribution ramps faster than conversion because the affiliate wiring gets
   fixed in the first quarter, while trust and reviews accumulate across the
   whole two years.
4. **Revenue** = sessions × conversion × basket × commission × attribution.
   GMV and orders are derived from revenue so that `revenue / GMV` always equals
   `commission × attribution` and `GMV / orders` always equals the basket — true
   for modelled and re-anchored months alike.

### Fidelity to the source document

Reproduced from the 8 August 2026 model. Month 24 (`$8,390`), exit run-rate
(`$100,679`), blended revenue per session (`$0.123`), month-24 sessions
(`68,241`) and the per-site maturity economics (`$0.240 / $0.055 / $0.141 /
$0.072`) all land on the published figures. The 24-month total comes in at
`$67,973` against a published `$67,297` — within 1%, the residual being the
difference between a fitted curve and the original's month-by-month table.
Bear (`$15,371` over two years) and bull (`$254,715` exit run-rate) are
calibrated to the same document.

## Files

```
lib/operating-model.ts              engine — curves, ramps, aggregation, actuals
lib/operating-model-data.ts         site profiles, scenarios, merchant mix, copy
lib/admin.ts                        the gate: passcode + email allowlist
app/admin/layout.tsx                admin chrome, noindex metadata
app/admin/page.tsx                  redirect to the model
app/admin/sign-in/page.tsx          passcode screen / setup instructions
app/admin/operating-model/page.tsx  the gated page
app/api/admin/session/route.ts      passcode check, cookie issue/clear
components/admin/operating-model.tsx  page composition + state + persistence
components/admin/model-chart.tsx      stacked-area SVG chart
components/admin/model-tables.tsx     unit economics, summary, quarterly, monthly, merchants, reverse
components/admin/model-controls.tsx   scenario picker, assumptions, export/import/reset
components/admin/model-ui.tsx         shared primitives
components/admin/admin-passcode-form.tsx
components/admin/admin-sign-out.tsx
app/robots.ts                       (modified) /admin added to Disallow
```

The chart is inline SVG with no new dependencies. Its four colours were
validated as a set against the dark chart surface for lightness band, chroma
floor, colour-vision separation and contrast; the green↔pink pair sits in the
6–8 ΔE band, which is why the bands carry a 2px surface gap, a legend and
direct end-of-series labels rather than relying on hue alone.
