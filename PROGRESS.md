# Matka build progress

Legend: [x] done · [~] in progress · [ ] not started · [!] blocked / changed (see MORNING.md)

## Phase 0: setup and feedback loop
- [x] Network check (data hosts were blocked; new "makta" environment with allowlist created)
- [!] ANTHROPIC_API_KEY not present in this container (owner adding it to the "makta" env; AI scripts check at runtime, fall back to in-session)
- [x] Vite + React + TS scaffold, deck.gl, lucide-react, @fontsource/inter, Vitest, Playwright
- [x] Python venv (requests, pandas, shapely, anthropic, python-dotenv, pypdf)
- [x] `npx playwright init-agents --loop=claude`; Playwright MCP added to `.mcp.json` (loads on next session start)
- [ ] tests/e2e/demo.spec.ts (keys 0-7, fail on console errors, screenshots)

## Phase 1: data (section 7)
- [ ] 01 municipalities.json (code, fi/sv names, county, centre point + method, population by sex/age; Åland excluded)
- [ ] 02 municipalities.geojson + counties.geojson (WFS, EPSG:4326, < 2 MB each)
- [ ] 03 rt_units.json (incl. Rovaniemi decision, source URLs)
- [ ] 04 routes.json (OSRM table, 3 nearest, fallback flagged; Helsinki < 20 km, Utsjoki > 400 km)
- [ ] 05 cases.json (national breast cases allocated by age-weighted female population)
- [ ] 06 sources.json (all section 4 facts + verified section 5 facts, quotes, roadmap page numbers)
- [ ] 07 parameters.json (all section 8 parameters)
- [ ] Phase 1 reviewer sub-agent + fixes

## Phase 1b: model (section 8)
- [ ] src/model pure functions (commuter/stayer, retreatment, Kela lower bound, aggregates)
- [ ] Vitest: Utsjoki stayer, Helsinki-area commuter, threshold boundary, no NaN, national = sum of counties

## Phase 2: app (section 9)
- [ ] Top bar, tabs, footer
- [ ] Left panel: indication switch, lever toggles, assumptions drawer with sliders + reset
- [ ] Map: GeoJsonLayer, county borders, ColumnLayer animated, metric switch, unit dots, pitch + flatten, click/hover
- [ ] Right card: nearest unit, before → after
- [ ] Bottom strip: national totals with tweening, Goal 3 chips, bone note
- [ ] Provenance badges + popovers
- [ ] Sources & limitations tab
- [ ] Demo keys 0-7, ?
- [ ] Playwright demo spec passes; screenshots reviewed against section 14
- [ ] Phase 2 reviewer + fixes

## Phase 3: AI reads unit schedules (section 10)
- [ ] Page snapshots in data/raw/pages/
- [ ] scripts/extract_schedules.py (llm-api or agent-extracted fallback), substring check
- [ ] public/data/unit_statements.json
- [ ] What units say tab; premise check logged
- [ ] Phase 3 reviewer + fixes

## Phase 4: county memos (section 11)
- [ ] scripts/generate_memos.py with number validator
- [ ] public/data/memos.json (every county)
- [ ] County memo tab with typing effect, source chips, traced-numbers badge
- [ ] Phase 4 reviewer + fixes

## Phase 5: polish and checks (section 12)
- [ ] Vitest passes
- [ ] Data check script
- [ ] Playwright demo 1-7 screenshots reviewed
- [ ] Build + preview offline, no external requests
- [ ] Load < 2 s
- [ ] Vercel deploy (if CLI logged in)

## Phase 6: stretch
- [ ] "Finland folds inward" toggle

## Wrap-up
- [ ] MORNING.md
