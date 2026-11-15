# MORNING

## 0. Redesign status (branch `redesign`)

**The redesign is solid and ready to present (finished about 02:45 Helsinki, well before the 07:00 cut-off).** All checks below pass on the final commit. If anything misbehaves on the presenting laptop, `claude/sharp-sagan-uaohy1` still has the old demo, untouched.

- Branch: `redesign`, cut from `claude/sharp-sagan-uaohy1` at its tip **236197c** (one screenshot-only commit after 96dad9b). `claude/sharp-sagan-uaohy1` is untouched. The cloud session also mirrors every push to `claude/funny-franklin-79imfr` (the platform's session branch); it holds the same commits.
- The old demo is still on `claude/sharp-sagan-uaohy1`. To present it instead: `git checkout claude/sharp-sagan-uaohy1`.
- While the redesign was being built, another session pushed two commits to `claude/sharp-sagan-uaohy1` (a6a58e1, 4b36382). They change only `scripts/generate_memos.py`, not the data; `memos.json` is unchanged. They are merged into `redesign`, so `redesign` contains everything on the old branch.

```bash
npm ci && npm run build && npx vite preview --port 4173
```

Then open http://localhost:4173. Everything is bundled: no tile server, no keys, no request leaves localhost (the Playwright specs fail if one does).

### Live on Vercel

**https://matka-hack-europe.vercel.app** shows `redesign` at 3df9a03, built by Vercel with `npm ci` and `npm run build`.
- The production URL is public. Preview deployments stay behind Vercel login.
- Checked from a browser after deploy: the page loads; key 2 ends at "676 km · 9 h 22 min"; key 3 gives 6 nights and 2 dots; the memo shows its traced badge.
- No console errors, and no requests leave the site.
- Screenshot: `screenshots/redesign/vercel-live-1440x900.png`.

How it is set up:
- Vercel project `matka` in the **Team HackEurope** Vercel team. That is the account the Vercel connector is signed in as, and it has GitHub access to `reubxn`.
- The project is linked to `reubxn/makta`.
- Framework: Vite, Node 22.x, output `dist`.

**Production branch is the repo's default, `main`**, which does not contain the app. So:
- A push to `redesign` creates a protected *preview* deployment, not production.
- A push to `main` would deploy `main` to production.
- To update production after changes, redeploy `redesign` to production (Claude can do this through the Vercel connector), or merge `redesign` into `main`.

The Vercel CLI (65.16.0) is installed in the cloud container but not logged in: `api.vercel.com` is not on this environment's network allowlist. Deployment went through the Vercel connector instead.

### Checks

All run on the final commit of `redesign`:

- `npx vitest run`: **21 tests pass** (4 new: lever-off yearly burden, lever-on removed = old totals, current − removed = same patients on 5 sessions, trip dots 4 → 2).
- `.venv/bin/python -I scripts/09_check_data.py`: **passes**. It now also checks `route_lines.json` (all 292 routes present, km/min equal to routes.json, endpoints snapped to the municipality centre and the unit) and `basemap.json`.
- `npx playwright test tests/e2e/layout.spec.ts --trace off`: **passes at 1280×720, 1440×900 and 1920×1080**. Every demo step (16 per size), checked for overlapping panels, cards and labels within the same `data-layer`, for clipped text (`scrollWidth > clientWidth`), and for boxes cut off by their scroll container or the window. It also asserts the map is ≥ 60% of the width, no console errors, and no request leaving localhost. Screenshots: `screenshots/redesign/<size>/`.
- `npx playwright test tests/e2e/demo.spec.ts --trace off`: **passes**. Keys 0–7, no console errors, no external requests, the bone card line unclipped, and key 2 ends the counter at exactly "676 km · 9 h 22 min". Screenshots: `screenshots/redesign/demo-1440x900/`.
- `npx playwright test tests/e2e/viewports.spec.ts --trace off`: **passes** (512×384 to 1920×1080). The fitBounds fallback is kept.
- `npx oxlint`: 0 errors, 3 warnings (fast-refresh export and a setState-in-effect in MemoTab, all harmless).
- Data scripts: `scripts/11_natural_earth.py` (raw.githubusercontent.com reachable; 18 MB raw cache in `data/raw/naturalearth/`, gitignored). `scripts/10_route_lines.py` (router.project-osrm.org reachable; 292 routes fetched once and cached in `data/raw/osrm_routes/`, committed like the other OSRM caches). The largest difference between the OSRM route length and routes.json `road_km` is 0.0 km.

### Design critic rounds

Two fresh design-critic sub-agents reviewed the screenshots. Their fixes were applied, and the layout test was re-run after each round.

- **Round 1 (applied):**
  - Fluid `rem` type scale (14px up to ~1330px wide, ~17.5px at 1920), so text grows on large projectors.
  - The lever has an explicit On/Off state and a larger switch.
  - Teal is kept for data only: routes, the selection, the lever-on state and "after" values. UI underlines, links and slider thumbs are graphite.
  - Darker choropleth.
  - The terrain sits on the flat choropleth (zero-height areas keep their fill), with softer light and lower relief.
  - County outlines are drawn only when zoomed in (they speckled the archipelago).
  - A faint ghost of the folded-away route.
  - Only the remaining nights turn teal.
  - Non-breaking "non-inferior" and "8 Gy"; markers stay on the line with their last word.
  - The memo body is in sans.
  - Short county names in the memo picker.
  - The before/after table was rebuilt to fit at 1280.
- **Round 1 (not applied):** shifting the map when the drawer opens. The owner's plan makes the drawer an overlay.
- **Round 2 (applied):**
  - Trip dots, night icons, the km/hours counter and hospital labels scale with the type.
  - The legend is built from the map's actual colour ramp, and route lines are darker.
  - The national view (keys 0/1) shows the selected route in graphite; teal and the dots arrive with key 2 or a click.
  - The totals highlight is a 3px graphite top rule.
  - Links, the memo button, citation numbers, the traced badge and the map hover are graphite.
  - The lever title is in Zilla Slab, with larger page headings.
  - Drawer width in `rem`; the popover is wider and taller.
  - Balanced caption, and wrap fixes.
- **Round 2 (not applied):** clamping the flight's bearing to near-north and docking the counter in a corner. The brief says the bearing follows the direction of travel and the label rides with the dot.
- Also fixed during testing:
  - deck.gl camera transitions could be cancelled by a React re-render, leaving key 5 flat at 1920. All camera moves are now animated by Matka itself.
  - Fold dropped all grey routes (deck.gl needed fresh path arrays).

### AI steps: confirmed API-generated

- `public/data/memos.json`: `method: llm-api`, `model: claude-sonnet-5-5`, generated 2026-11-14, 22 memos, all 22 stored `validated: true` with numbers_passed = numbers_checked. `scripts/09_check_data.py` re-runs the validator live and passes.
- `public/data/unit_statements.json`: `method: llm-api`, `model: claude-sonnet-5-5`, generated 2026-11-14, 12 pages read.
- The memo tab still shows the "numbers traced" badge only when a memo's stored `validated` flag is true.

### What changed in the redesign

- **Visual language:** Zilla Slab (OFL, self-hosted via @fontsource) for headings, light italic Zilla Slab hero line, Helvetica Neue/Helvetica/Arial body. Graphite #3C4242 / #6B7272, white, #F8F8F8 panels, #E1E1E1 hairlines, one accent (teal #00626A, also the "after" values). Radius 0, no shadows, no pills; tabs, indication and metric switches are text with a 2px underline. No AstraZeneca logo or colours (named in the footer as text only). Inter is no longer loaded.
- **Provenance:** badges are now quiet superscript markers (S / C / A) with the same popover. The footer explains them once: "S sourced · C calculated · A assumption: click a marker for its sources".
- **Layout:** rail `clamp(216px,17vw,256px)` | map | right column `clamp(280px,22.5vw,340px)`, hairlines between. The map canvas is 60.3% of the width at 1280, 60.4% at 1440 and 68.9% at 1920 (the layout test asserts ≥ 60%). The whole-UI CSS zoom below 1440×900 from 96dad9b is gone: the fluid grid replaces it. The fitBounds fallback and `tests/e2e/viewports.spec.ts` are kept.
- **Rail:** indication (Breast | Bone metastases), the lever, one line of evidence, the Assumptions toggle. All sliders, the "Today, if X% already get the short schedule…" line and Reset live in the **Assumptions drawer**, an overlay over the map edge (Esc closes it).
- **Town card:** Zilla Slab name; "To Oulu · 676 km · 9 h 22 min" with a C marker; plain English: "One patient from Utsjoki: 15 sessions over three weeks, or 5 in one week."; whether they commute or stay (A marker on the 100 km threshold); a compact before/after table with "after" in teal when the lever is on; one moon icon per night away under the nights row (removed nights fade to a hairline outline; fractional bone values are partial icons).
- **Totals (never zeros, machine sessions first):** lever off = the yearly burden of the eligible breast patients still on 15 sessions (about 1,750 patients: 26,200 machine sessions, 3,120 nights away, 25,600 round trips, 26,700 hours on the road). Lever on = what moving them to 5 sessions removes (17,500 machine sessions, 1,950 nights, 15,900 round trips, 16,200 hours). New pure functions `breastStillLong` / `breastYear` / `tripDots` in `src/model/metrics.ts` with Vitest tests. Bone stays per patient beyond 100 km (6.2 → 2.4 nights away per course), because no national count of bone courses exists.
- **Map:** the needle columns are gone. Natural Earth 10m lakes, land and land borders are bundled (`public/data/basemap.json`, 667 kB). Every municipality is joined to its unit by its real OSRM road route (`public/data/route_lines.json`, 196 kB) in thin graphite; units are square DOM markers with labels placed greedily without collisions (a label is skipped rather than overlap). The headline overlay and the floating "89 municipalities" card are gone; one caption is docked under the map with the legend.
- **Selecting a municipality** draws its route in teal with N dots looping along it, N = round trips per patient (breast 4 → 2).
- **Key 2:** 1.2 s fly-in to Utsjoki, then 5 s following the road to Oulu at pitch 55 with the bearing following the road, a teal dot and a label counting km and hours. It ends exactly at routes.json (676 km · 9 h 22 min), then pulls back north-up to a tilted overview of the route.
- **Key 5:** fly out to Finland at pitch 45 with **burden terrain** on (height = nights away per patient, breast lever off), pause, then the lever flips and the terrain sinks to 6/16 of its height. The totals block highlights.
- **Fold inward** stays off by default. When on, each route is truncated toward its unit to the distance at which the long course would cost the km the short course costs today, and the caption reads "We can't move the hospital. The schedule can."
- **Memo tab:** the whole memo streams in 4 s (elapsed-time based, any length); citations become superscript numbers in order of first use, with a numbered source list beneath that fills in as sources are first cited.

### Deviations from the local plan, and why

- The Natural Earth clip box is 3–48°E, 54.5–74°N, not 14–36.5°E, 57.5–71.5°N: at 1920×1080 the old box's edge showed as a rectangle around Finland. basemap.json is 667 kB (581 lakes) instead of 473 kB.
- The terrain is a separate extruded layer, and the lever's "sink" is a uniform scale, not an attribute transition. Exact here: every municipality beyond 100 km has the same nights (sessions + planning [+ expected retreatment]) and commuters have none. deck.gl attribute transitions forced GPU read-backs that froze software-rendered browsers for seconds.
- Trip dots and the flight label are DOM elements (like the hospital markers), so deck.gl does not redraw every frame.
- Two test-only hooks: `window.__matkaFlightHold = 0.42` holds the key-2 flight part-way, and `window.__matkaHold = true` holds a demo key's timed steps. They are only used by `tests/e2e/layout.spec.ts` to take deterministic screenshots in a software-rendered browser.

### Not done / known limits

- **Software-rendered browsers are slow.** In this cloud container (no GPU, SwiftShader), a deck.gl redraw takes about a second, so the key-2 flight shows few frames and animations lag in headless runs. Tests use long waits and the hold hooks. On a laptop with a GPU it is smooth. **Rehearse once on the presenting laptop.**
- The flight's dot moves along the drawn OSRM route; its km/hours label is proportional to distance along the route and ends exactly at the routes.json values (676 km · 9 h 22 min). Mid-route values are therefore approximate (constant average speed).
- Route lines are drawn from municipality centre points, like the distances. Ferry links in the archipelago follow OSRM.
- The Assumptions drawer overlays the left part of the map (by design) and covers part of the caption while open.
- The old screenshots in `screenshots/*.png` and `screenshots/design/` show the previous design. The new ones are in `screenshots/redesign/`.
- `tests/e2e/design.spec.ts` (DESIGN_ROUND captures from the old design passes) was not updated or run; it is skipped unless DESIGN_ROUND is set.

## 1. Previous status (still true)

- The API key used for the memos and unit statements is in the gitignored `.env`, never committed. It was pasted in chat, so rotate it after judging.
- Breast leads (key 3), bone is key 4, the "1 of 12 units publishes which schedule it uses" headline, Rovaniemi has no unit (Lapland routes to OYS), Uusimaa/Helsinki/Pirkanmaa/Lapland follow sourced catchments and the other municipalities go to the nearest unit by drive time (an assumption; Kanta-Häme and Kainuu are named in the limitations), 5,232 new breast cases in women in 2024 (5,204 mainland used).

## 3. Assumptions in use

| Parameter | Value |
|---|---|
| Commuting threshold | 100 km (framed by roadmap p. 13) |
| Planning visit | 1 round trip, every schedule |
| Breast: share treated with radiotherapy | 70% |
| Breast: share eligible for 5 sessions | 60% |
| Breast: share already on 5 sessions | 20% |
| Bone: multi-fraction course | 5 sessions |
| Bone: share already single session | 7% (Turku 2005–13, all courses in the last year of life, single centre) |

Also assumed:

- Distances run from municipality centre points.
- Breast cases are allocated to municipalities by age-weighted female population.
- Routing outside the sourced catchments is nearest by drive time.

Sourced: 15 vs 5 sessions, single 8 Gy, retreatment 20% vs 8% (Rich 2018, S30), Kela 0.33 €/km and 20.18 €/night.

## 4. Unverified

- The real Finnish schedule mix (not public).
- Kanta-Häme and Kainuu referral paths.
- The Turku and Tampere unit pages (sites unreachable during the search).
- Breast radiotherapy and eligibility shares for Finland.
- The Rich 2018 corrigendum content was not checked.
- The roadmap's 100 km fact cites Norwegian data (Åsli 2018).

## 5. Demo script (2 minutes, redesign)

**Use `deck/demo-script.md` instead.** It's the rehearsed version, matched to the submission video (`deck/matka-demo.mp4`). It opens with Helsinki against Utsjoki, ends on the pilot ask, and adds a 30-second fallback and likely Medical Affairs questions. The older draft below is kept for reference.

Press `0` before you start. `?` shows the keys.

- **0:00 (key 1):** Finland, flat and north-up. Every municipality is joined to its radiotherapy unit by its real road route; the 12 units are the squares. "Same cancer, same treatment. Different distance." Caption: 89 municipalities, home to 637,661 people, are more than 100 km by road from their unit. The national roadmap (p. 13): palliative radiotherapy is used less beyond 100 km. Right, totals: every year about 1,750 eligible breast patients are still on 15 sessions; between them 26,200 machine sessions, 3,120 nights away, 25,600 round trips, 26,700 hours on the road.
- **0:15 (key 2):** Utsjoki. The camera flies the road to OYS in Oulu: the counter runs to 676 km and 9 h 22 min. The card: "One patient from Utsjoki: 15 sessions over three weeks, or 5 in one week." Sixteen moons: 16 nights away. Four dots on the route: four journeys.
- **0:35 (key 3):** Breast, the lead lever: 5 sessions as default for eligible patients (whole breast or chest wall, no nodes). Journeys 4 → 2, nights 16 → 6 (ten moons fade), hours on the road 75 → 37. FAST-Forward, 4,096 patients, 10-year follow-up: non-inferior. Totals switch to what's removed: 17,500 machine sessions freed, 1,950 nights away, 15,900 round trips, 16,200 hours on the road.
- **0:55 (key 4):** Painful bone metastases: a single 8 Gy session relieves pain as well, with more retreatment, and the model includes it. Utsjoki: 6.2 → 2.4 expected nights away; "Fewer nights away; trips about the same, because some patients need a second session." Per patient only: no national count of bone courses is published.
- **1:10 (key 5):** Fly out, tilt: the burden terrain. Height is nights away per patient on 15 sessions; the north and east stand up, the south is flat. Then the lever flips and the terrain sinks to 6/16. Totals highlighted.
- **1:25 (key 6):** What units say: "1 of 12 units publishes which schedule it uses." So the current mix stays an assumption you can set (Assumptions drawer). Read by AI via the API, quotes checked against the saved pages.
- **1:40 (key 7):** Lapland's memo writes itself in four seconds; superscript numbers are its sources, listed beneath; 9 of 9 numbers traced. Its first steps are clinical-team reviews.
- **1:55 The ask:**
  - 5 sessions as the default for eligible breast patients, with distance named as a reason to choose it.
  - A single 8 Gy session as the default for uncomplicated painful bone metastases.
  - Every unit publishes its schedule mix and radiotherapy use by distance band, every year.
- Optional: toggle **Fold inward** over the map: "We can't move the hospital. The schedule can."

## 6. Questions for the AstraZeneca mentor

1. "A breast patient living 300 km from the unit: does she get 15 sessions or 5 today, and is distance an accepted reason for the short course?"
2. "For painful bone metastases in someone 200 km out, how often is it a single 8 Gy in practice, and can planning and treatment happen in one visit?"
3. "Which Goal 3 indicator would you file this under: target access times or regional equality? Would you accept a new one, travel burden per radiotherapy course by county?"
