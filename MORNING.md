# MORNING: Matka, presentation day

## 1. Status

- **Live:** https://matka-hack-europe.vercel.app (public). Vercel rebuilds it automatically on every push to `main`.
- **Code:** `main` and `redesign` hold the same thing: the redesigned app plus the v2 API memos.
- **Fallback:** the old design is on `claude/sharp-sagan-uaohy1`, with the same v2 memos.
- **Checks:** all pass on the current code.
  - Vitest: 23 tests.
  - Data check: re-validates all 22 memos live.
  - Playwright layout test at 1280×720, 1440×900 and 1920×1080.
  - Demo spec.
  - Viewport spec, from 512×384 up.
- **Still to do yourself:** rehearse once on the presenting laptop (section 4).

## 2. Run it locally (no internet needed)

```bash
npm ci && npm run build && npx vite preview --port 4173
```

Open http://localhost:4173. Everything is bundled: no tile server, no keys, no request leaves the machine. If the venue Wi-Fi is bad, use this instead of the Vercel link.

## 3. Demo script (2 minutes)

**Use `deck/demo-script.md` instead.** It's the rehearsed version, matched to the submission video (`deck/matka-demo.mp4`). It opens with Helsinki against Utsjoki, ends on the pilot ask, and adds a 30-second fallback and likely Medical Affairs questions. The draft below is kept for reference.

Press `0` before you start. `?` shows the keys; `Esc` closes overlays.

- **0:00 (key 1):** Finland, flat. Every municipality is joined to its radiotherapy unit by its real road route; the squares are the 12 units.
  - "Same cancer, same treatment. Different distance."
  - Caption: 89 municipalities, home to 637,661 people, are more than 100 km by road from their unit. The national roadmap (p. 13) says palliative radiotherapy is used less beyond 100 km.
  - Totals, right: every year about 1,750 eligible breast patients are still on 15 sessions. Between them: 26,200 machine sessions, 3,120 nights away, 25,600 round trips and 26,700 hours on the road.
- **0:15 (key 2):** Utsjoki. The camera flies the road to OYS in Oulu, and the counter runs to 676 km and 9 h 22 min.
  - Card: "One patient from Utsjoki: 15 sessions over three weeks, or 5 in one week."
  - Sixteen moons: 16 nights away. Four dots on the route: four journeys.
- **0:35 (key 3):** Breast, the lead lever: 5 sessions as the default for eligible patients (whole breast or chest wall, no nodes).
  - Journeys 4 → 2, nights 16 → 6 (ten moons fade), hours on the road 75 → 37.
  - FAST-Forward, 4,096 patients, 10-year follow-up: non-inferior.
  - The totals switch to what's removed: 17,500 machine sessions freed, 1,950 nights away, 15,900 round trips, 16,200 hours on the road.
- **0:55 (key 4):** Painful bone metastases. A single 8 Gy session relieves pain as well, with more retreatment, and the model includes it.
  - Utsjoki: 6.2 → 2.4 expected nights away.
  - Card: "Fewer nights away; trips about the same, because some patients need a second session."
- **1:10 (key 5):** Fly out and tilt: the burden terrain, hours on the road per patient at every point of Finland.
  - "Close in, you lose hours driving in every day; that's the ring around each hospital. Far out, you lose nights and long drives; that's the climb north."
  - The lever flips and the landscape sinks: "Five sessions cuts both."
- **1:25 (key 6):** What units say: "1 of 12 units publishes which schedule it uses." So the current mix stays an assumption you can set, in the Assumptions drawer.
- **1:40 (key 7):** Lapland's memo writes itself in four seconds.
  - Utsjoki, 676 km from Oulu: 16 nights away with 15 breast sessions versus 6 with 5.
  - County-wide: 445 nights away removed and 454 machine sessions freed a year.
  - Every number is traced to a source, and every first step is a clinical-team review.
- **1:55 The ask:**
  - 5 sessions as the default for eligible breast patients, with distance named as a reason to choose it.
  - A single 8 Gy session as the default for uncomplicated painful bone metastases.
  - Every unit publishes its schedule mix and radiotherapy use by distance band, every year.
- Optional: switch on **Fold inward** above the map: "We can't move the hospital. The schedule can."

## 4. Rehearse once on the presenting laptop

The animations were only ever seen in a browser with no GPU, so check them on real hardware:

- **Key 2:** the flight should be smooth and end with the counter at 676 km · 9 h 22 min.
- **Key 5:** the terrain should rise, pause, then sink without stuttering. It rebuilds its contour bands in 8 steps.
- **Projector resolution:** anything from 1280×720 to 1920×1080 is tested. Below that it still works, but it gets cramped.
- **If key 2 or key 5 is rough:** skip it. Keys 1, 3, 4, 6 and 7 tell the story without them.

## 5. Likely questions, short answers

- **"Why does everyone far away get exactly 16 nights?"** The model assumes anyone more than 100 km by road stays near the unit on treatment weeknights: 15 sessions + 1 planning visit = 16 nights, however far beyond 100 km they live. Within 100 km they commute and have 0 nights. The 100 km threshold is an assumption you can change in the drawer.
- **"What's the ring in the terrain?"** People within 100 km drive in for every session, so they log more hours than people just beyond 100 km, who stay over and drive weekly. The sharp edge comes from the model's hard 100 km cut-off; real patients near 100 km decide either way.
- **"Where do the distances come from?"** OSRM road routing (OpenStreetMap), from each municipality's centre point to its unit. The terrain uses a 10 km grid of drive times instead. 101 of its 3,866 points were snapped onto Russian roads or long ferry waits; they were dropped and filled from their neighbours.
- **"Which unit does each municipality go to?"** Uusimaa, Helsinki, Pirkanmaa and Lapland follow their sourced catchments (Lapland has no unit and goes to OYS). Everyone else goes to the nearest unit by drive time, which is an assumption.
- **"How many patients is that?"** 5,232 new breast cancer cases in women in 2024 (Finnish Cancer Registry); the model uses the 5,204 on the mainland. × 70% treated with radiotherapy × 60% eligible for 5 sessions × 80% not already on 5 sessions ≈ 1,750 a year. The three shares are assumptions.
- **"Why is bone only per patient?"** No national count of bone radiotherapy courses is published.
- **"Do we know what units do today?"** No. Only 1 of 12 units publishes which schedule it uses, which is why the ask includes publishing it.
- **"Did the AI write the memos?"** Yes, through the Anthropic API (claude-sonnet-5-5). Every number in each memo is checked against the sourced facts it was given, and the "numbers traced" badge appears only for memos that pass that check. All 22 pass.
- **"Is this clinical advice?"** No. They are proposals for clinical teams to evaluate. The evidence is FAST-Forward for breast and the Rich 2018 review for bone.

## 6. Assumptions in use

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

- Distances run from municipality centre points; the terrain uses a 10 km grid.
- Breast cases are allocated to municipalities by age-weighted female population.
- Routing outside the sourced catchments goes to the nearest unit by drive time.

Sourced: 15 vs 5 sessions, single 8 Gy, retreatment 20% vs 8% (Rich 2018, S30), Kela 0.33 €/km and 20.18 €/night.

## 7. Known limits and unverified points

- The real Finnish schedule mix is not public.
- Kanta-Häme and Kainuu referral paths are unverified.
- The Turku and Tampere unit pages are unverified: their sites were unreachable during the search.
- The breast radiotherapy and eligibility shares are not Finnish figures.
- The Rich 2018 corrigendum was not checked.
- The roadmap's 100 km fact cites Norwegian data (Åsli 2018).
- The flight's km/hours counter assumes a constant average speed along the route. It ends exactly at the routed values, but mid-route readings are approximate.
- The Assumptions drawer covers the left part of the map while it is open (by design).

## 8. Questions for the AstraZeneca mentor

1. "A breast patient living 300 km from the unit: does she get 15 sessions or 5 today, and is distance an accepted reason for the short course?"
2. "For painful bone metastases in someone 200 km out, how often is it a single 8 Gy in practice, and can planning and treatment happen in one visit?"
3. "Which Goal 3 indicator would you file this under: target access times or regional equality? Would you accept a new one, travel burden per radiotherapy course by county?"

## 9. After judging

- Rotate the Anthropic API key: it is in the gitignored `.env`, but it was pasted in chat.
- Housekeeping:
  - Old-design screenshots are still in `screenshots/*.png` and `screenshots/design/`.
  - `tests/e2e/design.spec.ts` still targets the old design (it is skipped unless `DESIGN_ROUND` is set).
  - `oxlint` shows 3 warnings.

---

## Appendix: how this was built (overnight log)

### Branches

- `redesign` was cut from `claude/sharp-sagan-uaohy1` at 236197c (a screenshot-only commit after 96dad9b).
- Overnight, another session pushed to `claude/sharp-sagan-uaohy1`:
  - a memo-generator fix (a6a58e1, 4b36382);
  - the v2 memos (049d6fa, ff3b6c8).
  Both were merged into `redesign`.
- `main` was fast-forwarded to `redesign` on the owner's go-ahead, so nothing on `main` was lost.
- Every push was mirrored to `claude/funny-franklin-79imfr`, the cloud session's own branch.

### Vercel

- **Project:** `matka` in the **Team HackEurope** Vercel team. That is the account the Vercel connector is signed in as, and it has GitHub access to `reubxn`.
- **Build:** linked to `reubxn/makta`; production branch `main`; Vite, Node 22.x, `npm ci`, `npm run build`, output `dist`.
- **Access:** production is public; preview deployments need a Vercel login.
- **Checked live, in a browser, after deploying:**
  - key 2 ends at 676 km · 9 h 22 min;
  - key 3 gives 6 nights and 2 dots;
  - key 5 terrain renders;
  - the memo shows its traced badge;
  - no console errors, and no requests leave the site.
  Screenshots: `screenshots/redesign/vercel-live-*.png`.
- **CLI:** the Vercel CLI (65.16.0) is installed in the cloud container but not logged in, because `api.vercel.com` is not on its network allowlist. Deploys went through the Vercel connector.

### What changed in the redesign

- **Visual language:**
  - Zilla Slab headings (OFL, self-hosted), with the hero line in light italic; Helvetica Neue/Helvetica/Arial for body text.
  - Graphite #3C4242 / #6B7272 text on white, #F8F8F8 panels, #E1E1E1 hairlines.
  - One accent: teal #00626A, used for data and "after" values.
  - Radius 0, no shadows, no pills.
  - Fluid type that grows on large projectors.
  - No AstraZeneca logo or colours; AstraZeneca is named in the footer as text only.
- **Provenance:** superscript S / C / A markers with the sources popover, explained once in the footer.
- **Layout:** rail | map (≥ 60% of the width, asserted by the test) | town card and totals. All sliders, the "Today, if X% already…" line and Reset are in the Assumptions drawer. The whole-UI zoom below 1440×900 is gone.
- **Town card:**
  - Plain-English line, plus whether the patient commutes or stays over.
  - Before/after table with "after" in teal.
  - One moon icon per night away; removed nights fade to an outline.
- **Totals:** never zero, machine sessions first. With the lever off they show the yearly burden of eligible patients still on 15 sessions; with it on, what moving them to 5 removes (`breastYear` in `src/model/metrics.ts`).
- **Map:**
  - Natural Earth lakes and coastline, bundled.
  - Every municipality's OSRM road route to its unit.
  - Hospital squares with collision-free labels.
  - Selecting a municipality draws its route in teal, with one dot per round trip.
  - Key 2: a 1.2 s fly-in, 5 s following the road at 55° tilt with the bearing following the road, then a pull-back.
  - Key 5: the burden terrain, hours on the road per patient on the 10 km drive-time grid, drawn as 3-hour contour bands. It sinks when the lever flips. The Terrain button also tilts and flattens the camera.
- **Memo tab:** the whole memo streams in 4 s, with superscript citation numbers and a numbered source list.

### Data scripts (all cached, never fetched twice)

- `10_route_lines.py`: 292 OSRM routes. The largest difference from the routes.json km is 0.0 km.
- `11_natural_earth.py`: basemap clipped to 3–48°E, 54.5–74°N (667 kB). The raw downloads are gitignored.
- `12_drive_grid.py`: 3,866 grid points in 45 OSRM requests; 101 implausible points dropped and filled from neighbours (86 kB).

### AI steps (confirmed API-generated)

- `memos.json`: `llm-api`, claude-sonnet-5-5, v2 from 2026-11-15. All 22 are validated; Lapland's has 16 of 16 numbers traced.
- `unit_statements.json`: `llm-api`, claude-sonnet-5-5, 2026-11-14, from 12 pages.

### Design review

Two fresh design-critic rounds reviewed the screenshots, and their fixes were applied:
- fluid type and a stronger lever;
- teal kept for data only;
- terrain drawn over the flat map;
- map marks that scale with the type, and a legend built from the real colour scale;
- the national view stays graphite until key 2;
- the lever title in serif.

Not applied, because the owner's brief decides otherwise:
- moving the map when the drawer opens (the drawer stays an overlay);
- keeping the flight's camera pointing north (the bearing follows the road).

Also fixed during testing:
- deck.gl camera transitions could be cancelled by a re-render; Matka now animates the camera itself;
- Fold dropped all grey routes.

### Test-only hooks

`window.__matkaFlightHold` (holds the key-2 flight part-way) and `window.__matkaHold` (holds a demo key's timed steps). Only the layout test uses them, so it can take deterministic screenshots in a software-rendered browser.
