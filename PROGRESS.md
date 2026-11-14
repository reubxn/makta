# Matka build progress

Legend: [x] done · [~] in progress · [ ] not started · [!] blocked / changed (see MORNING.md)

## Phase 0: setup and feedback loop
- [x] Network check (data hosts were blocked; new "makta" environment with allowlist created)
- [!] ANTHROPIC_API_KEY not present in this container (owner adding it to the "makta" env; AI scripts check at runtime, fall back to in-session)
- [x] Vite + React + TS scaffold, deck.gl, lucide-react, @fontsource/inter, Vitest, Playwright
- [x] Python venv (requests, pandas, shapely, anthropic, python-dotenv, pypdf)
- [x] `npx playwright init-agents --loop=claude`; Playwright MCP added to `.mcp.json` (loads on next session start)
- [x] tests/e2e/demo.spec.ts (keys 0-7, fail on console errors and external requests, screenshots)

## Phase 1: data (section 7)
- [x] 01 municipalities.json (code, fi/sv names, county, centre point + method, population by sex/age; Åland excluded)
- [x] 02 municipalities.geojson + counties.geojson (WFS, EPSG:4326, < 2 MB each)
- [x] 03 rt_units.json (12 units; Rovaniemi has no unit → Lapland routes to Oulu)
- [x] 04 routes.json (OSRM table, 3 nearest, fallback flagged; Helsinki < 20 km, Utsjoki > 400 km)
- [x] 05 cases.json (5,232 women 2024; 5,204 mainland; age-specific incidence, scaled to county counts) (national breast cases allocated by age-weighted female population)
- [x] 06 sources.json (61 sources; 1 unverifiable dropped) (all section 4 facts + verified section 5 facts, quotes, roadmap page numbers)
- [x] 07 parameters.json + facts.json (all section 8 parameters)
- [x] Phase 1 reviewer sub-agent + fixes (bone mix → assumption, 8 Gy sourced, wording, real-route tests)

## Phase 1b: model (section 8)
- [x] src/model pure functions (commuter/stayer, retreatment, Kela lower bound, aggregates)
- [x] Vitest: Utsjoki stayer, Helsinki-area commuter, threshold boundary, no NaN, national = sum of counties

## Phase 2: app (section 9)
- [x] Top bar, tabs, footer
- [x] Left panel: indication switch, lever toggles, assumptions drawer with sliders + reset
- [x] Map: GeoJsonLayer, county borders, ColumnLayer animated, metric switch, unit dots, pitch + flatten, click/hover
- [x] Right card: nearest unit, before → after
- [x] Bottom strip: national totals with tweening, Goal 3 chips, bone note
- [x] Provenance badges + popovers
- [x] Sources & limitations tab
- [x] Demo keys 0-7, ?
- [x] Playwright demo spec passes; screenshots reviewed against section 14
- [x] Design pass: 3 critic rounds, screenshots/design/round0-before → round3-after (see screenshots/design/README.md)
- [ ] Phase 2 reviewer + fixes

## Phase 3: AI reads unit schedules (section 10)
- [x] Page snapshots in data/raw/pages/ (6 pages; most units publish none reachable)
- [x] scripts/extract_schedules.py (agent-extracted fallback used: no API key in container), substring check
- [x] public/data/unit_statements.json
- [x] What units say tab; premise check: 0 units state 5 as standard → no reframe
- [ ] Phase 3 reviewer + fixes

## Phase 4: county memos (section 11)
- [x] scripts/generate_memos.py with number validator
- [x] public/data/memos.json (22 counties, agent-written, all numbers traced)
- [x] County memo tab with typing effect, source chips, traced-numbers badge
- [ ] Phase 4 reviewer + fixes

## Phase 5: polish and checks (section 12)
- [ ] Vitest passes
- [x] Data check script
- [ ] Playwright demo 1-7 screenshots reviewed
- [ ] Build + preview offline, no external requests
- [ ] Load < 2 s
- [ ] Vercel deploy (if CLI logged in)

## Phase 6: stretch
- [ ] "Finland folds inward" toggle

## Wrap-up
- [ ] MORNING.md
