# Matka: build spec

Matka (Finnish for "journey") is a web app for the AstraZeneca challenge at Junction 2026 in Helsinki. It shows how many trips and nights away from home radiotherapy costs cancer patients in each Finnish municipality, and how much of that evidence-based shorter schedules would remove. It also writes each wellbeing services county a sourced action memo.

Judging is Sunday 15 November 2026 at 14:00 Helsinki time. The owner is asleep while you build. This folder starts with only this file and maybe a `.env`. Read the whole spec before you start.

## 1. How to work

- Don't ask questions: the owner is asleep. When something is unclear or broken, make the safest reasonable choice, log it in MORNING.md and keep going.
- Work through the phases in order. Every phase must leave the app running. Run `git init` at the start and commit after each phase.
- Keep PROGRESS.md as a checklist of every task in this spec, with its status. If you're a new session, read PROGRESS.md first and carry on from there.
- Never invent a number. Every number the UI shows must come from a file in `public/data/`, have a provenance label (sourced, calculated or assumption), and point to source ids in `sources.json`.
- The finished app makes no network calls at runtime. Scripts fetch data into `data/raw/` (cached, never fetched twice) and write clean JSON to `public/data/`. Be polite to public APIs: cache everything, batch requests and pause between calls.
- If a source contradicts this spec, trust the source, change the app and log it in MORNING.md.
- Check the clock (`date`). Once it's past 07:30 Helsinki time, stop adding features: make sure the app runs, then write MORNING.md.

## 2. The story the judges must get in 2 minutes

1. In Finland, radiotherapy means travelling to one of a handful of units, often daily for weeks. The national roadmap says palliative radiotherapy use drops for patients living more than 100 km from a unit, and outcomes are worse beyond 50 km.
2. In two common situations, randomised evidence supports much shorter schedules:
   - Painful bone metastases: a single 8 Gy session relieves pain as well as a multi-session course, at the cost of more retreatment.
   - Breast cancer after surgery: 5 sessions in one week (26 Gy) is at least as good as 15 sessions over three weeks (FAST-Forward, 4,096 patients, now with 10-year follow-up).
3. Matka shows, for every municipality, what the current schedule costs a patient in trips, nights away and hours on the road, and what switching removes. It also counts radiotherapy machine sessions freed, which helps patients start treatment within target times (a Goal 3 indicator).
4. AI read every unit's public patient pages to find which schedule each one says it uses, which is the evidence for the baseline. AI also writes each county's memo, with every number checked against the sources.
5. The ask:
   - make a single 8 Gy session the default for uncomplicated painful bone metastases
   - make 5 sessions the default for eligible breast patients, and name distance as a reason to choose it
   - publish schedule mix and radiotherapy use by distance band every year

Lead with the bone pain lever. It connects to the roadmap's own 100 km fact and to lung cancer, where Finland lags the Nordics most. Breast is the second lever.

## 3. Rules on claims (Medical Affairs judges will check)

1. Never say the 5-session breast schedule is "better". Say "at least as good" or "non-inferior".
2. Short schedules only apply to eligible patients. For breast, that means whole breast or chest wall without nodal radiotherapy; 15 sessions stays standard when nodes are treated. Show the eligibility share as a visible, editable assumption.
3. A single 8 Gy session gives equal pain relief but more retreatment. The model must include retreatment.
4. Schedule choice is a clinical decision. The app proposes; it doesn't prescribe. The footer says so.
5. The real current schedule mix in Finland isn't public. Show it as an adjustable assumption ("share already on the short schedule"), next to the AI-extracted unit statements.
6. Distances are measured from each municipality's centre point, and patient numbers are allocated by population. Label both.
7. No survival claims for the shorter schedules.
8. No AstraZeneca logo or branding anywhere.

## 4. Facts already verified (14 Nov 2026)

Put each one in `sources.json` with its URL and a short supporting quote.

- **Kela 2025 travel spend:** 364 million euros of travel reimbursement for 4.6 million trips, 3.3 million of them by taxi (227 million euros). Highest per resident is Kainuu at 157 euros; lowest is Helsinki at 23 euros. https://www.kela.fi/tietotarjotin/1369368-kelan-matkakorvausmenot-kasvoivat-taustalla-etenkin-arvonlisaveron-ja-taksitaksan-korotukset
- **Kela travel rules:** patients pay up to 25 euros per one-way trip, with an annual cap of 300 euros, and own-car travel is reimbursed at 0.33 euros/km (https://kela.fi/reimbursements-of-travel-costs-copayment). The overnight allowance is up to 20.18 euros per night (https://www.kela.fi/web/selkokieli/korvaukset-matkoista).
- **FAST-Forward:** 4,096 patients were randomised to 40 Gy in 15 fractions over 3 weeks, or 26 or 27 Gy in 5 fractions over 1 week. 26 Gy in 5 fractions was non-inferior, with similar side effects (Brunt et al., Lancet 2020;395:1613-26).
  - 10-year results: breast recurrence was 2.1% after 26 Gy in 1 week against 3.6% after 3 weeks, described as a "similar level of cancer control". Presented at ESTRO in May 2025; published in Lancet Oncology in 2026.
  - Sources: https://www.healthday.com/healthpro-news/cancer/one-week-radiotherapy-for-breast-cancer-safe-effective-up-to-10-years and https://www.irishnews.com/news/uk/one-week-of-radiotherapy-just-as-good-as-three-for-early-stage-breast-cancer-5RH43IPCKRIX3HNQGDPAVHQIAI/ . Find and cite the Lancet Oncology paper itself.
- **Nodal radiotherapy:** 15 fractions remains standard where nodal radiotherapy is needed (RCR breast fractionation consensus): https://www.rcr.ac.uk/media/br2aqgpd/03-breast-cancer-radiotherapy-dose-fractionation-fourth-edition.pdf
- **Turku single-fraction use:** at Turku University Hospital, 2005 to 2013, single-fraction radiotherapy was used in only 7% of courses during patients' last year of life (Rautakorpi et al., Acta Oncologica 2017: https://medicaljournalssweden.se/actaoncologica/article/view/25257). The related thesis found that the time from last radiotherapy fraction to death was longer for patients living more than 100 km from the hospital: https://www.utupub.fi/bitstream/10024/154009/1/Annales%20D%201636%20Rautakorpi%20DISS.pdf
- **Lahti:** Päijät-Häme central hospital in Lahti has a radiotherapy unit. https://www.sttinfo.fi/tiedote/72243478/paijat-hameen-hyvinvointialue-uusi-sadehoitolaite-vahvistaa-syovanhoitoa?lang=fi
- **Tampere:** radiotherapy at Tays treats Pirkanmaa, most of Kanta-Häme and part of South Ostrobothnia. https://pirha.fi/documents/d/guest/syovanhoidon-omavalvontasuunnitelma
- **Challenge material:** the Goal 3 indicators and the 100 km, 50 km, 400 km and 700 km facts. Find the page numbers in the roadmap and cite them.
  - Strategy: https://files.hackjunction.app/resources/Kansallinen_syopastrategia_2026_2035_FINAL.pdf
  - Roadmap: https://files.hackjunction.app/resources/Kansallinen_syopastrategia_toimeenpanon_tiekartta_2026_2031.pdf

## 5. Facts to verify before use (drop any you can't source)

- **Radiotherapy units:** the full list of public units in mainland Finland. Candidates: Helsinki (HUS), Lahti, Kotka, Lappeenranta, Turku, Pori, Tampere, Seinäjoki, Vaasa, Jyväskylä, Kuopio, Joensuu, Oulu.
  - Rovaniemi is the critical unknown. It decides whether Lapland's patients go to Rovaniemi or Oulu, so find a source either way.
  - Exclude private clinics, but mention them in the limitations.
- **Breast cases:** national new breast cancer cases for the latest year. An unverified note says the Registry's 2024 figure is about 5,262.
- **Retreatment rates** after single versus multi-fraction bone radiotherapy. They're often cited as about 20% against 8%; find the meta-analysis.
- **Breast radiotherapy shares:** the share of breast cancer patients who get radiotherapy, and the share of those eligible for 5 sessions. Look for Nordic or European figures.
- **Distance meta-analysis (2022):** 16% lower odds of palliative radiotherapy for patients living 50 km or more away. https://hull-repository.worktribe.com/output/3916737
- **Ostrobothnia lung study:** non-small-cell lung cancer patients living more than 50 km away had a death hazard 1.47 times that of nearer patients. https://medicaljournalssweden.se/actaoncologica/article/download/27507/45850?inline=1

## 6. Stack

- **Frontend:**
  - Vite + React + TypeScript.
  - deck.gl (`@deck.gl/react`, `@deck.gl/core`, `@deck.gl/layers`) with a MapView and no basemap tiles. Draw municipality polygons only, so nothing depends on the venue wifi.
  - `lucide-react` for icons and Inter via `@fontsource/inter` (self-hosted).
  - Vitest for tests and Playwright for screenshots.
- **Data scripts:** Python 3 in a venv, with `requests`, `pandas`, `shapely`, `anthropic` and `python-dotenv`.
- **Keys:** `.env` holds `ANTHROPIC_API_KEY` and an optional `MODEL` (default `claude-sonnet-5-5`). Never send the key to the browser.
- **Folders:**
  - `scripts/`: data and AI scripts, numbered in run order
  - `data/raw/`: cached downloads and page snapshots
  - `public/data/`: the clean JSON the app loads
  - `src/model/`: pure calculation functions, unit-tested
  - `src/components/`
  - `PROGRESS.md`, `MORNING.md`, `README.md`

## 7. Phase 1: data

Write each step as a script in `scripts/`, run it, and check the output.

1. **Municipalities** (`public/data/municipalities.json`): Statistics Finland code, Finnish and Swedish names, wellbeing services county code and name, centre point and population.
   - Centre point: the Wikidata coordinate (P625) of each municipality, matched on the Statistics Finland municipality number (P1203), via https://query.wikidata.org/sparql . Fall back to the polygon's representative point, and record which method was used.
   - Population by sex and age: StatFin PxWeb (https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/ , population structure tables), latest year.
   - Exclude Åland, which has a separate health system, and say so in the limitations.
2. **Geometry** (`public/data/municipalities.geojson`, `public/data/counties.geojson`): from Statistics Finland's WFS (https://geo.stat.fi/geoserver/wfs ). Use GetCapabilities to find the current municipality and wellbeing services county layers. Use EPSG:4326 and simplify each file to under 2 MB. If the county mapping isn't in the attributes, assign counties with a spatial join.
3. **Radiotherapy units** (`public/data/rt_units.json`): name, hospital, town, county, coordinates, a source URL proving the unit gives external beam radiotherapy, and the accessed date. See section 5.
4. **Routes** (`public/data/routes.json`):
   - For every municipality, find road km and drive minutes to its 3 nearest units by straight line, then pick the nearest by drive time.
   - Use the OSRM table service (https://router.project-osrm.org/table/v1/driving/...) in batches of at most 100 coordinates, and cache the results.
   - If OSRM fails, fall back to straight-line distance × 1.3 at 70 km/h, flagged "estimated".
   - Sanity checks: Helsinki is under 20 km; Utsjoki is over 400 km.
5. **Breast cases** (`public/data/cases.json`):
   - Take national new breast cancer cases for the latest year from the Cancer Registry (https://tilastot.syoparekisteri.fi/syovat/?_inputs_&language=%22en%22 or the Registry's published statistics).
   - Allocate them to municipalities by female population weighted by age. Use age-specific incidence if you can get it; otherwise use women aged 45+. Label the result as calculated.
   - If the Registry gives county-level counts, scale the municipality allocations to match them.
6. **Sources** (`public/data/sources.json`): id (S1, S2...), title, publisher, year, URL, accessed date, what it supports, and a short verbatim quote (max 25 words).
7. **Parameters** (`public/data/parameters.json`): every assumption in section 8 with default, min, max, unit, kind, source ids and a one-line rationale.

## 8. Model (`src/model/`, pure functions with Vitest tests)

Parameters and defaults (kind in brackets):

- `commute_threshold_km` = 100 (assumption, framed by the roadmap's 100 km fact). Within it, the patient travels daily. Beyond it, they stay near the unit on treatment weeknights and go home at weekends.
- `planning_visit` = 1 round trip before treatment, for every schedule (assumption; the same for every schedule).
- `breast_fractions_long` = 15 and `breast_fractions_short` = 5 (sourced).
- `breast_share_rt`: share of new breast cancers that get adjuvant radiotherapy (sourced if found; otherwise assumption 0.7).
- `breast_share_eligible_short`: share of those eligible for 5 sessions (sourced if found; otherwise assumption 0.6).
- `breast_share_already_short` = 0.2: share of eligible patients already on 5 sessions (assumption, slider 0 to 1). This is the "we already do this" dial, so label it prominently.
- `bone_fractions_multi` = 5 (assumption; common alternatives are 5 × 4 Gy and 10 × 3 Gy) and `bone_fractions_single` = 1 (sourced).
- `bone_retreat_single` = 0.20 and `bone_retreat_multi` = 0.08 (verify; see section 5).
- `bone_share_single_now` = 0.07 (sourced from Turku 2005 to 2013; it's a single centre and old, so say so).
- `kela_car_eur_per_km` = 0.33 and `kela_overnight_eur` = 20.18 (sourced).

Per-patient metrics for a municipality and a course of n sessions:

- **Commuter** (road km ≤ threshold): round trips = n + planning; nights away = 0.
- **Stayer** (beyond the threshold): treatment weeks = ceil(n / 5); round trips = weeks + planning; nights away = n + planning.
- km travelled = round trips × 2 × road km.
- Hours on the road = round trips × 2 × drive hours.
- Kela cost, lower bound = km × 0.33 + nights × 20.18. Always label it "lower bound (own-car rate; taxis cost more)".
- Bone lever: expected metrics = the course + retreatment probability × one single-session retreatment course.

Yearly aggregates cover breast only, unless you find a citable yearly count of palliative bone radiotherapy courses. Don't invent one.

- Affected patients per municipality = cases × share_rt × share_eligible × (1 − share_already_short).
- Removed = affected × (long metrics − short metrics), summed by county and nationally: nights away, round trips, hours on the road, km and the Kela lower bound.
- Machine sessions freed = affected × (15 − 5). Tie this to the Goal 3 indicator "patients receive treatment within target times".

Tests:
- Utsjoki patients are stayers and lose most of their nights away.
- A Helsinki-area municipality commutes.
- The threshold boundary behaves.
- There's no NaN anywhere.
- National totals equal the sum of the counties.

## 9. Phase 2: the app

Design for a 1440 × 900 projector, with a light theme, on one page.

**Top bar:** the "Matka" wordmark, the line "Same cancer, same treatment. Different distance.", and tabs: Map, What units say, County memo, Sources & limitations.

**Left panel (Map tab):**
- An indication switch: "Painful bone metastases" | "Breast cancer". It controls what the map and the card show.
- Under each indication, its lever as a large toggle:
  - "Single 8 Gy session as default"
  - "5 sessions as default for eligible patients"
- An "Assumptions" drawer with a slider for every parameter and a reset button.

**Centre: the map.**
- A GeoJsonLayer of municipalities, filled by nights away per patient for the selected indication under the current settings (sequential blue ramp), with county borders slightly darker.
- A ColumnLayer at municipality centre points, with height = nights away per patient, animated (800 ms ease) whenever the indication, a lever or a slider changes. This is the 3D wow: the columns across the north and east shrink when the lever flips, while the south stays flat. That shows the burden falls on people who live far away.
- A metric switch (Nights away | Hours on the road | Round trips), defaulting to nights away.
- Radiotherapy units drawn as labelled dots.
- The camera pitched at about 45°, with a button to flatten it.
- Click a municipality to select it; hovering shows its name.

**Right panel: the selected municipality card.**
- Nearest unit, road km and drive time.
- For the selected indication, before → after for nights away, round trips, hours on the road and the Kela lower bound, in large tabular numbers.
- Default selection: Utsjoki, or whichever northern municipality the routing shows is the clearest example (log the choice).

**Bottom strip:** national yearly totals under the current settings (nights away removed, round trips removed, hours on the road removed, machine sessions freed), with counters that tween on change. Add chips naming the Goal 3 indicators they serve. If the bone indication is selected, add the note "Bone: per-patient view only; national yearly count not public".

**Provenance everywhere:** every number gets a small badge (Sourced = solid, Calculated = outline, Assumption = amber dashed). Clicking a badge opens a popover with the source title, link, quote and note.

**Sources & limitations tab:**
- The full source table.
- The parameter table (value, kind, rationale).
- An honest limitations list: current schedule mix unknown, centre-point distances, population allocation, bone counts not public, private units excluded, Åland excluded, OSRM road data, and anything else you run into.

**Demo mode:** keyboard shortcuts so the owner can present alone.
- 1 = reset to all of Finland
- 2 = select Utsjoki and zoom
- 3 = select the bone indication, pause 1 second, toggle its lever on
- 4 = select the breast indication (the columns rise to the 15-session values), pause 1.2 seconds, toggle its lever on
- 5 = fly out to all of Finland and highlight the totals strip
- 6 = open What units say
- 7 = open County memo for Lapland and start writing
- 0 = reset everything
- ? = show the list of shortcuts

## 10. Phase 3: AI reads the units' schedules

`scripts/extract_schedules.py`:

1. For each radiotherapy unit, find its public patient pages and care pathway documents on breast cancer radiotherapy and on bone metastasis or palliative radiotherapy. Search terms like "sädehoito rintasyöpä potilasohje", "rintasyövän hoitoketju", "luustoetäpesäke sädehoito" and "palliatiivinen sädehoito". Save text snapshots, with URL and date, in `data/raw/pages/`.
2. Send each snapshot to the LLM with a strict JSON schema per unit and indication:
   - `stated_default_fractions` (int or null)
   - `stated_alternatives`
   - `criteria_for_short_course`
   - `distance_mentioned` (bool)
   - `quote_fi` (verbatim, max 2 sentences)
   - `quote_en` (translation)
   - `url`, `accessed`, `confidence`

   Use null when the page doesn't state something. Never infer.
3. Check that every `quote_fi` is an exact substring of the snapshot text. Drop any that aren't.
4. Write `public/data/unit_statements.json` with `method: "llm-api"`.
5. If `ANTHROPIC_API_KEY` is missing, do the same extraction yourself in-session, run the same substring check, set `method: "agent-extracted"`, and log it.

**UI (What units say tab):**
- A table with: unit, breast default as stated, bone default as stated, whether distance is mentioned, the quote (hover shows Finnish and English), and the link.
- Header: "Read by AI from N public pages on <date>. Quotes are verbatim and checked against the page text."
- A summary line, for example "X of Y units state 15 sessions as the standard breast schedule."

**Premise check:** if 2 or more units state 5 sessions as their standard breast schedule, keep the breast lever but reframe it as "make it standard everywhere". Log this at the top of MORNING.md.

## 11. Phase 4: AI writes each county's memo

`scripts/generate_memos.py`, for each wellbeing services county:

1. Build a facts JSON: the county's aggregates, its 3 hardest-hit municipalities, its nearest units, those units' statements, every parameter with its kind, and the relevant subset of sources.
2. Prompt for a memo of at most 250 words, addressed to the county's director of cancer services:
   - a one-sentence finding
   - three proposals, each with an owner role (no personal names) and a first step within 30 days
   - the Goal 3 indicator each proposal serves
   - one sentence on limitations

   Every sentence ends with source ids like [S4]. The memo uses only numbers from the facts, and the proposals are framed for clinical teams to evaluate.
3. Validate: pull every number out of the memo and check it appears in the facts. Allow rounding the memo states, such as "about 1,200". On failure, regenerate up to 3 times. Save `public/data/memos.json` with the count of numbers checked and passed.
4. No-key fallback: write the memos yourself in-session with the same prompt and validator, and set `method: "agent-written"`.

**UI (County memo tab):**
- A county selector and a "Write memo" button.
- The pre-generated memo streams in with a typing effect, with no network call.
- Source chips are clickable.
- A badge shows "12 of 12 numbers traced to sources".
- Only show a "Regenerate live" button if you also build a small local server that holds the key. Otherwise leave it out.

## 12. Phase 5: polish and checks

- Vitest passes.
- A data check script confirms every displayed number has a kind and source ids, every municipality has a route, and the totals add up.
- Playwright: run demo steps 1 to 7, save screenshots to `screenshots/`, look at each one, and fix anything broken (overflowing text, overlapping labels, low contrast, layout jumps).
- `npm run build` and `npm run preview` work with the network off. Confirm there are no external requests in the network log.
- The app loads in under 2 seconds locally.
- If the Vercel CLI is already logged in, deploy the static build as a backup URL. If not, skip it and say so in MORNING.md.

## 13. Phase 6: stretch (only once everything above is done)

"Finland folds inward": animate each municipality's column towards its unit, to the distance where a long-course patient would carry the same burden as a short-course patient. The north and east visibly slide inward while the cities stay put. The on-screen line is "We can't move the hospital. The schedule can." Keep it behind its own toggle so it can't break the main demo.

## 14. Design

- **Feel:** a calm, serious public-sector analytics tool that THL or a county could have commissioned. No AstraZeneca branding.
- **Colours:**
  - background #F6F6F3, panels white
  - ink #15191E, muted text #5B6470
  - accent #0B5FA5, map ramp #E8EEF5 to #0B3D6E
  - "after" values in teal #0E7C66, assumption badges in amber #B26B00
- **Type:** Inter. Big numbers at 40 to 56 px with tabular figures. Body text at least 15 px. Sentence-case labels.
- **Layout and motion:** generous whitespace, at most three panels visible, and 600 to 900 ms eased transitions.
- **Footer on every view:** "Built at Junction 2026 for the AstraZeneca challenge. Public aggregate data only. Proposals for clinical teams to evaluate, not clinical advice."

## 15. MORNING.md (write last, keep it short)

1. **Status:** what works, what doesn't, and the command or URL to run it.
2. **Story changes:** anything that changed the story, such as the premise check result, Rovaniemi, or missing data.
3. **Assumptions:** every assumption still in use, with its value.
4. **Unverified:** what's still unverified.
5. **Demo script:** a 2-minute script for the finished app, tied to the shortcuts, using the app's real numbers:
   - 0:00 Map of Finland with the units as dots. "Same cancer, same treatment. Different distance." Cite the roadmap's 100 km fact.
   - 0:15 Key 2: Utsjoki. Nearest unit, road km, nights away.
   - 0:35 Key 3: a single 8 Gy session for painful bone metastases. Nights away drop from about a week to one or two. Mention Turku's 7% baseline.
   - 0:55 Key 4: breast, 15 sessions to 5. The columns shrink across the north and east. "At least as good, in one week."
   - 1:10 Key 5: national totals, machine sessions freed, Goal 3.
   - 1:25 Key 6: what the units say, read by AI, with verbatim quotes.
   - 1:40 Key 7: Lapland's memo writes itself, with every number traced.
   - 1:55 The ask (section 2, point 5).
6. **Three questions for the AstraZeneca mentor:**
   - "A breast patient living 300 km from the unit: does she get 15 sessions or 5 today, and is distance an accepted reason for the short course?"
   - "For painful bone metastases in someone 200 km out, how often is it a single 8 Gy in practice, and can planning and treatment happen in one visit?"
   - "Which Goal 3 indicator would you file this under: target access times or regional equality? Would you accept a new one, travel burden per radiotherapy course by county?"

## 16. Done means

- [ ] Map, levers, card, totals and sources all work offline
- [ ] Every number has a provenance badge that opens its source
- [ ] The What units say table is filled with verified verbatim quotes
- [ ] Every county has a memo, with all numbers traced
- [ ] Demo keys 0 to 7 work
- [ ] Tests and data checks pass, and screenshots have been reviewed
- [ ] MORNING.md is written
