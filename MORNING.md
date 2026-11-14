# MORNING

## 1. Status

Works offline: map with levers, card, totals, What units say, County memo, Sources & limitations, demo keys 0–7 and `?`.

```bash
npm ci && npm run build && npx vite preview --port 4173
```

Then open http://localhost:4173. Checks:

- `npx vitest run`: 17 tests pass.
- `.venv/bin/python -I scripts/09_check_data.py`: passes. It now re-runs the memo validator live against the current data instead of trusting the stored counts.
- `npx playwright test tests/e2e/demo.spec.ts --trace off`: passes. It runs keys 0–7, fails on any console error or any request that leaves localhost, checks that the bone card line is not clipped, and saves screenshots to `screenshots/`. The app is ready in about 0.3 s locally.
- Vercel: skipped. The Vercel CLI isn't installed or logged in here.

**AI steps ran through the API** (`claude-sonnet-5-5`, recorded in the JSON files). The key is in the gitignored `.env`, never committed. It was pasted in chat, so rotate it after judging.

- **Memos:** all 22 regenerated with `method: llm-api` against current data. Every memo passes the full validator.
- **Unit statements:** `method: llm-api`, from 12 page snapshots. 6 of them are new, from a deeper search of every unit's site. Statements whose quotes failed the verbatim check were dropped. All of the drops were "nothing stated" with no quote.

To rerun:

```bash
.venv/bin/python -I scripts/extract_schedules.py
```

```bash
.venv/bin/python -I scripts/06_sources.py
```

```bash
.venv/bin/python -I scripts/generate_memos.py
```

**Small screens:** the page used to go blank when the map area was under about 100 px tall. That happens on a 1024×768 screen at 200% scaling. Fixed:

- The map's fit margins now shrink to fit, with a safe fallback view.
- Below 1440×900 the whole UI scales down proportionally (CSS zoom on `#root`). The map canvas cancels that zoom, so clicking and hovering stay accurate.
- `tests/e2e/viewports.spec.ts` covers 512×384 up to 1920×1080. Screenshots are in `screenshots/viewports/`.

The UI is designed for 1440×900; at 1024×768 everything is about 70% size.

New validator rules, which apply to the API path too:

- A bone sentence, or the bone proposal, may not cite the breast case tables (S33–S35).
- No "only", "none of the units", "does not publish" and similar wording.
- Each "within 30 days" step must be a clinical team's review or decision, never a patient-page change or a publication.
- The memo tab shows the "numbers traced" badge only when a memo's stored `validated` flag is true, and the data check confirms that flag against a live run.

## 2. Story changes

- **Breast now leads**, per the owner's post-audit instruction, which overrides SPEC §2 ("lead with bone"). The app opens on breast; key 3 = breast (columns rise to 15 sessions, pause, lever on); key 4 = bone; key 5 also switches back to breast, because the national totals are breast-only.
- **Bone card line** (bone lever on, when trips don't fall): "Fewer nights away; trips about the same, because some patients need a second session."
- **Premise check:** no unit states 5 sessions as its standard breast schedule, so the breast lever is not reframed.
- **What units say** headline: "1 of 12 units publishes which schedule it uses" (Jyväskylä: breast, "usually 15 times"; its own leaflet also says "5 or 15"), tied to the ask to publish the schedule mix every year. No unit states a session count for bone metastases.
  - Turku and Tampere are **not verified**, not absent: tyks.fi, the Pirkanmaa instruction sites and hoito-ohjeet.fi were unreachable from the build environment. The UI and limitations say so.
  - DuckDuckGo blocked automated search, so the deeper search used each site's sitemap, site search and links.
  - Some breast pathways (Lahti, Kotka) sit behind patient logins.
- **Rovaniemi has no unit:** Lapland routes to OYS in Oulu (S52).
- **Routing:**
  - Helsinki, Uusimaa, Pirkanmaa and Lapland follow their sourced catchments.
  - The other 222 municipalities go to the nearest unit by drive time, which is an assumption. The limitation names Kanta-Häme (split Turku 4, Lahti 4, Tampere 3, although Tays says it treats most of Kanta-Häme) and Kainuu (Oulu 5, Kuopio 2, Joensuu 1; no catchment source).
- **Breast cases:** 5,232 new cases in women in 2024 (Finnish Cancer Registry, S33/S34). This is now shown with a Sourced badge in the totals strip. The totals use the 5,204 mainland cases.
- **Fold inward** stays off by default.

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

## 5. Demo script (2 minutes)

- **0:00 (key 0, then 1):** Finland, with the 12 units as dots. "Same cancer, same treatment. Different distance." The national roadmap (p. 13) says palliative radiotherapy is used less by patients living more than 100 km from a unit, and outcomes are worse beyond 50 km. 89 municipalities, home to 637,661 people, are more than 100 km by road from their unit.
- **0:15 (key 2):** Utsjoki. The nearest unit is OYS in Oulu, 676 km and 9 h 22 min by road. A 15-session breast course means 16 nights away and 75 hours on the road.
- **0:35 (key 3):** Breast, the lead lever. The columns stand at 15 sessions, then 5 sessions as default for eligible patients (whole breast or chest wall, no nodes). Utsjoki goes from 16 to 6 nights away and from 75 to 37 hours on the road. The columns shrink across the north and east while the south stays flat. FAST-Forward, 4,096 patients, 10-year follow-up: "at least as good, in one week."
- **0:55 (key 4):** Painful bone metastases: a single 8 Gy session gives equal pain relief, with more retreatment, and the model includes it. Utsjoki goes from 6.2 to 2.4 expected nights away. "Fewer nights away; trips about the same, because some patients need a second session." The baseline is Turku: single fractions were 7% of courses in the last year of life.
- **1:10 (key 5):** National totals, breast, per year, from 5,232 new cases in women (2024). The lever removes about 1,950 nights away, 15,900 round trips and 16,200 hours on the road, and frees 17,500 machine sessions. Goal 3: patients receive treatment within target times.
- **1:25 (key 6):** What units say. "1 of 12 units publishes which schedule it uses." Most units don't publish theirs, so the current mix stays an assumption you can set. Read by AI, with verbatim quotes checked against the saved pages.
- **1:40 (key 7):** Lapland's memo writes itself, with every number traced to a source. Its first steps are clinical-team reviews.
- **1:55 The ask:**
  - 5 sessions as the default for eligible breast patients, with distance named as a reason to choose it.
  - A single 8 Gy session as the default for uncomplicated painful bone metastases.
  - Every unit publishes its schedule mix and radiotherapy use by distance band, every year.

## 6. Questions for the AstraZeneca mentor

1. "A breast patient living 300 km from the unit: does she get 15 sessions or 5 today, and is distance an accepted reason for the short course?"
2. "For painful bone metastases in someone 200 km out, how often is it a single 8 Gy in practice, and can planning and treatment happen in one visit?"
3. "Which Goal 3 indicator would you file this under: target access times or regional equality? Would you accept a new one, travel burden per radiotherapy course by county?"
