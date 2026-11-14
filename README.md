# Matka

Matka ("journey") shows how many trips and nights away from home radiotherapy costs cancer patients in each Finnish municipality, and how much of that two evidence-based shorter schedules would remove:

- a single 8 Gy session for uncomplicated painful bone metastases (retreatment included), and
- 5 sessions instead of 15 for eligible breast cancer patients (whole breast or chest wall without nodal radiotherapy).

It also shows what each radiotherapy unit says publicly about its schedules, and gives every wellbeing services county a short action memo in which every number is traced to a source.

Built at Junction 2026 for the AstraZeneca challenge. Public aggregate data only. Proposals for clinical teams to evaluate, not clinical advice.

## Run it

```bash
npm install
npm run build
npx vite preview
```

Open http://localhost:4173. The built app makes no network calls: all data is in `public/data/`.

Presenting: press `?` for the keyboard shortcuts (1–7 walk through the demo, 0 resets).

## Tests and checks

```bash
npm test                                           # Vitest: model functions
.venv/bin/python -I scripts/09_check_data.py       # every number has a kind and sources; totals add up
npx playwright test tests/e2e/demo.spec.ts         # demo keys 0-7, no console errors, no external requests, screenshots
DESIGN_ROUND=latest npx playwright test tests/e2e/design.spec.ts   # every view at 1440x900
```

## Data pipeline

Python 3 scripts in `scripts/`, run in order with the venv (`python3 -m venv .venv && .venv/bin/pip install requests pandas shapely anthropic python-dotenv pypdf beautifulsoup4`). Downloads are cached in `data/raw/` and never fetched twice.

| Script | Output |
|---|---|
| `02_geometry.py` | municipality and wellbeing services county polygons (Statistics Finland WFS, 2026) |
| `01_municipalities.py` | codes, names, county, Wikidata centre point, population by sex and age (StatFin 11re, 31 Dec 2025) |
| `04_routes.py` | road km and drive time to the nearest of 12 radiotherapy units (OSRM) |
| `05_cases.py` | 2024 breast cancer cases (Cancer Registry) allocated to municipalities |
| `06_sources.py` | `sources.json` with ids S1… |
| `07_parameters_facts.py` | `parameters.json`, `facts.json` (displayed statements, Goal 3 indicators, limitations) |
| `extract_schedules.py` | `unit_statements.json` from saved unit pages (Claude API, or validated in-session extraction) |
| `generate_memos.py` | `memos.json`, with a validator that checks every number against the county's facts |
| `09_check_data.py` | data checks |

`ANTHROPIC_API_KEY` (and optional `MODEL`, default `claude-sonnet-5-5`) are read from the environment or `.env`; the key is never written to files or sent to the browser.

See the Sources & limitations tab for every source, parameter and limitation.
