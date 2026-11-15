// Computes every number the deck shows, from public/data/ with the app's own model
// (src/model/metrics.ts, imported directly; Node 22 strips the types).
// Run: node deck/compute_numbers.mjs  ->  writes deck/numbers.json
// Rounding follows src/hooks.ts: fmtRounded = 3 significant figures for counts >= 1000.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  breastYear, breastTotals, perPatient, affectedBreastPatients,
} from '../src/model/metrics.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(path.join(root, 'public/data', f), 'utf8'));

const munis = load('municipalities.json').municipalities;
const routes = load('routes.json').routes;
const cases = load('cases.json');
const paramsFile = load('parameters.json').parameters;
const units = load('rt_units.json').units;
const statements = load('unit_statements.json');
const memos = load('memos.json');
const sources = load('sources.json').sources;
const facts = load('facts.json');

const defaults = Object.fromEntries(paramsFile.map((p) => [p.id, p.default]));
const pmeta = Object.fromEntries(paramsFile.map((p) => [p.id, p]));

// Same rows as TotalsStrip.tsx
const rows = munis
  .filter((m) => routes[m.code])
  .map((m) => ({ code: m.code, county_code: m.county_code, route: routes[m.code], cases: cases.municipalities[m.code] ?? 0 }));

// Same rounding as src/hooks.ts
const fmtRounded = (v) => {
  if (Math.abs(v) < 1000) return Math.round(v);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
  return Math.round(v / mag) * mag;
};
const r1 = (v) => Math.round(v * 10) / 10;
const pick = (b) => ({
  patients: b.patients, machineSessions: b.machineSessions, nights: b.nights,
  roundTrips: b.roundTrips, hours: b.hours, km: b.km, kelaEur: b.kelaEur,
});
const rounded = (b) => Object.fromEntries(Object.entries(pick(b)).map(([k, v]) => [k, fmtRounded(v)]));

const out = { generated_by: 'deck/compute_numbers.mjs', model: 'src/model/metrics.ts', params: defaults };

// 1. Municipalities beyond the commuting threshold (TotalsStrip / facts over_100km)
const far = munis.filter((m) => routes[m.code] && routes[m.code].road_km > defaults.commute_threshold_km);
out.over_threshold = {
  municipalities: far.length,
  population: far.reduce((a, m) => a + m.population, 0),
  total_municipalities: rows.length,
  total_population: munis.filter((m) => routes[m.code]).reduce((a, m) => a + m.population, 0),
  source_ids: ['S60', 'S57', 'S59'],
};

// 2. Utsjoki card
const uts = munis.find((m) => m.name_fi === 'Utsjoki');
const ur = routes[uts.code];
const card = (ind, sched) => {
  const b = perPatient(ur, ind, sched, defaults);
  return { nights: r1(b.nights), roundTrips: r1(b.roundTrips), hours: Math.round(b.hours), kelaEur: Math.round(b.kelaEur), km: Math.round(b.km) };
};
out.utsjoki = {
  code: uts.code, unit: ur.unit_id, road_km: ur.road_km, drive_min: ur.drive_min,
  drive_hm: `${Math.floor(Math.round(ur.drive_min) / 60)} h ${Math.round(ur.drive_min) % 60} min`,
  breast_long: card('breast', 'long'), breast_short: card('breast', 'short'),
  bone_long: card('bone', 'long'), bone_short: card('bone', 'short'),
};

// 3. Bone per patient: stayer (beyond threshold) and commuter (within)
const near = munis.find((m) => routes[m.code] && routes[m.code].road_km <= defaults.commute_threshold_km && routes[m.code].road_km > 50);
const nb = (r, s) => { const b = perPatient(r, 'bone', s, defaults); return { nights: r1(b.nights), roundTrips: r1(b.roundTrips) }; };
out.bone = {
  stayer_long: nb(ur, 'long'), stayer_short: nb(ur, 'short'),
  commuter_example: near.name_fi, commuter_long: nb(routes[near.code], 'long'), commuter_short: nb(routes[near.code], 'short'),
  source_ids: ['S30', 'S31', 'S62'],
};

// 4. Breast per patient for a commuter (round trips 16 -> 6)
const bc = (s) => { const b = perPatient(routes[near.code], 'breast', s, defaults); return { nights: r1(b.nights), roundTrips: r1(b.roundTrips) }; };
out.breast_commuter = { example: near.name_fi, long: bc('long'), short: bc('short') };

// 5. National yearly breast figures (TotalsStrip)
const year = breastYear(rows, defaults);
out.national = {
  current: pick(year.current), current_rounded: rounded(year.current),
  removed: pick(year.removed), removed_rounded: rounded(year.removed),
  cases_national: cases.national_cases, cases_mainland: cases.mainland_cases, cases_year: cases.year,
  source_ids: ['S33', 'S34', 'S35', 'S57', 'S60', 'S9', 'S15'],
};

// 6. By county (breastTotals byCounty, lever on)
const totals = breastTotals(rows, defaults, true);
const countyNames = {};
for (const m of munis) countyNames[m.county_code] = (m.county_name_en || m.county_name_fi).replace(' wellbeing services county', '');
const farByCounty = {};
for (const m of munis) {
  if (!routes[m.code]) continue;
  const c = (farByCounty[m.county_code] ??= { munis: 0, far: 0 });
  c.munis += 1;
  if (routes[m.code].road_km > defaults.commute_threshold_km) c.far += 1;
}
out.by_county = Object.entries(totals.byCounty)
  .map(([code, b]) => ({
    code, name: countyNames[code],
    patients: r1(b.patients), machineSessions: Math.round(b.machineSessions), nights: Math.round(b.nights),
    roundTrips: Math.round(b.roundTrips), hours: Math.round(b.hours),
    nights_per_patient: b.patients ? r1(b.nights / b.patients) : 0,
    hours_per_patient: b.patients ? r1(b.hours / b.patients) : 0,
    municipalities: farByCounty[code].munis, municipalities_over_threshold: farByCounty[code].far,
  }))
  .sort((a, b) => b.nights - a.nights);

// 6b. Concentration of nights removed across counties
{
  const totalNights = out.by_county.reduce((a, c) => a + c.nights, 0);
  const top = out.by_county.slice(0, 6);
  out.county_concentration = {
    areas: out.by_county.length,
    top6_names: top.map((c) => c.name),
    top6_share_nights: r1((100 * top.reduce((a, c) => a + c.nights, 0)) / totalNights),
    top6_share_patients: r1((100 * top.reduce((a, c) => a + c.patients, 0)) / out.by_county.reduce((a, c) => a + c.patients, 0)),
    areas_zero_nights: out.by_county.filter((c) => c.nights === 0).length,
  };
}

// 7. Distance split: eligible patients beyond the threshold vs their share of what is removed
const split = { near: { patients: 0, nights: 0, hours: 0, roundTrips: 0 }, far: { patients: 0, nights: 0, hours: 0, roundTrips: 0 } };
for (const r of rows) {
  const b = totals.byMunicipality[r.code];
  const k = r.route.road_km > defaults.commute_threshold_km ? 'far' : 'near';
  split[k].patients += b.patients; split[k].nights += b.nights; split[k].hours += b.hours; split[k].roundTrips += b.roundTrips;
}
const tot = (k) => split.near[k] + split.far[k];
out.distance_split = {
  far_share_patients: r1((100 * split.far.patients) / tot('patients')),
  far_share_hours_removed: r1((100 * split.far.hours) / tot('hours')),
  far_share_nights_removed: r1((100 * split.far.nights) / tot('nights')),
  far_patients: r1(split.far.patients),
  far_hours_per_patient_removed: r1(split.far.hours / split.far.patients),
  near_hours_per_patient_removed: r1(split.near.hours / split.near.patients),
  far_nights_per_patient_removed: r1(split.far.nights / split.far.patients),
};

// 8. Pilot: everything routed to OYS (Oulu), and Lapland county alone
const sumRows = (filter) => {
  let acc = { patients: 0, machineSessions: 0, nights: 0, roundTrips: 0, hours: 0, munis: 0, far: 0, cases: 0 };
  for (const r of rows.filter(filter)) {
    const b = totals.byMunicipality[r.code];
    acc.patients += b.patients; acc.machineSessions += b.machineSessions; acc.nights += b.nights;
    acc.roundTrips += b.roundTrips; acc.hours += b.hours; acc.munis += 1; acc.cases += r.cases;
    if (r.route.road_km > defaults.commute_threshold_km) acc.far += 1;
  }
  const stillLong = rows.filter(filter).reduce((a, r) => a + affectedBreastPatients(r.cases, defaults), 0);
  return {
    municipalities: acc.munis, municipalities_over_threshold: acc.far, cases: Math.round(acc.cases),
    patients: Math.round(acc.patients), still_long_patients: Math.round(stillLong),
    machineSessions: Math.round(acc.machineSessions), nights: Math.round(acc.nights),
    roundTrips: Math.round(acc.roundTrips), hours: Math.round(acc.hours),
  };
};
out.pilot = {
  oys_catchment: sumRows((r) => r.route.unit_id === 'oulu'),
  oys_counties: [...new Set(rows.filter((r) => r.route.unit_id === 'oulu').map((r) => countyNames[r.county_code]))],
  lapland: sumRows((r) => r.county_code === '21'),
};
const oysPop = munis.filter((m) => routes[m.code]?.unit_id === 'oulu').reduce((a, m) => a + m.population, 0);
out.pilot.oys_catchment.population = oysPop;
out.pilot.oys_share_of_national_nights_removed = r1((100 * out.pilot.oys_catchment.nights) / year.removed.nights);
out.pilot.oys_share_of_national_patients = r1((100 * out.pilot.oys_catchment.patients) / year.removed.patients);

// 9. Sensitivity of machine sessions freed and nights removed to each breast assumption (slider min/max)
const sens = [];
for (const id of ['breast_share_rt', 'breast_share_eligible_short', 'breast_share_already_short', 'commute_threshold_km']) {
  const p = pmeta[id];
  const at = (v) => { const y = breastYear(rows, { ...defaults, [id]: v }); return { machineSessions: fmtRounded(y.removed.machineSessions), nights: fmtRounded(y.removed.nights), patients: fmtRounded(y.removed.patients) }; };
  sens.push({ id, label: p.label, kind: p.kind, unit: p.unit, default: p.default, min: p.min, max: p.max, at_min: at(p.min), at_default: at(p.default), at_max: at(p.max) });
}
// a "plausible" mid-range for the already-short dial: 0.5
const half = breastYear(rows, { ...defaults, breast_share_already_short: 0.5 });
out.sensitivity = sens;
out.sensitivity_already_short_half = { machineSessions: fmtRounded(half.removed.machineSessions), nights: fmtRounded(half.removed.nights), patients: fmtRounded(half.removed.patients) };

// 10. AI steps and provenance
const memoList = memos.memos;
out.ai = {
  units_pages_read: statements.pages_read,
  units_statements_extracted: statements.statements_extracted ?? statements.statements.length,
  units_statements_dropped: statements.dropped,
  units_method: statements.method, units_model: statements.model, units_generated: statements.generated,
  units_total: units.length,
  units_with_any_statement: new Set(statements.statements.map((s) => s.unit_id)).size,
  units_stating_breast_default: new Set(statements.statements.filter((s) => s.indication === 'breast' && s.stated_default_fractions != null).map((s) => s.unit_id)).size,
  units_stating_5_as_default: statements.statements.filter((s) => s.indication === 'breast' && s.stated_default_fractions === 5).length,
  units_stating_bone_default: statements.statements.filter((s) => s.indication === 'bone' && s.stated_default_fractions != null).length,
  units_distance_mentioned: statements.statements.filter((s) => s.distance_mentioned).length,
  memos: memoList.length,
  memos_validated: memoList.filter((m) => m.validated).length,
  memo_numbers_checked: memoList.reduce((a, m) => a + m.numbers_checked, 0),
  memo_numbers_passed: memoList.reduce((a, m) => a + m.numbers_passed, 0),
  memo_first_attempt: memoList.filter((m) => (m.attempts ?? 1) === 1).length,
  memos_method: memos.method, memos_model: memos.model, memos_generated: memos.generated,
  lapland_memo: memoList.find((m) => m.county_code === '21'),
};
out.provenance = {
  sources: sources.length,
  parameters: paramsFile.length,
  parameters_by_kind: paramsFile.reduce((a, p) => ((a[p.kind] = (a[p.kind] ?? 0) + 1), a), {}),
  limitations: facts.limitations.length,
};

// 10b. Which units the AI actually read: page snapshots in data/raw/pages are named <unit>__<page>.txt
{
  const { readdirSync } = await import('node:fs');
  const files = readdirSync(path.join(root, 'data/raw/pages')).filter((f) => f.endsWith('.txt'));
  const unitIds = [...new Set(files.map((f) => f.split('__')[0]))].sort();
  out.ai.units_pages_from = unitIds.length;
  out.ai.units_pages_from_ids = unitIds;
  out.ai.units_no_page_read = units.length - unitIds.length;
}

// 10c. Robustness of the concentration finding to the commuting-threshold assumption:
// share of nights removed in the municipalities routed to each unit, at several thresholds.
out.threshold_robustness = [30, 50, 100, 150, 200, 300].map((t) => {
  const tt = breastTotals(rows, { ...defaults, commute_threshold_km: t }, true);
  const byUnit = {};
  for (const r of rows) byUnit[r.route.unit_id] = (byUnit[r.route.unit_id] ?? 0) + tt.byMunicipality[r.code].nights;
  const ranked = Object.entries(byUnit).sort((a, b) => b[1] - a[1]);
  return {
    threshold_km: t,
    top_unit: ranked[0][0],
    oys_share_nights: r1((100 * byUnit.oulu) / tt.national.nights),
    oys_rank: ranked.findIndex(([u]) => u === 'oulu') + 1,
  };
});

// 10d. How the 22 county memos pair the first two proposals with Goal 3 indicators
{
  const pair = {};
  for (const m of memoList) {
    const paras = m.text.split('\n').filter((p) => p.trim());
    const ind = (p) => (/target times/.test(p) ? 'target_times' : /agreed cancers/.test(p) ? 'agreed_cancers' : 'other');
    const key = `${ind(paras[1])}+${ind(paras[2])}`;
    pair[key] = (pair[key] ?? 0) + 1;
  }
  out.ai.memo_indicator_pairings = pair;
}

// 11. Unit tests (the deck states the count): run vitest and record the result
{
  const { execSync } = await import('node:child_process');
  const { tmpdir } = await import('node:os');
  const tmp = path.join(tmpdir(), `matka-vitest-${process.pid}.json`);
  execSync(`npx vitest run --reporter=json --outputFile=${tmp}`, { cwd: root, stdio: 'ignore' });
  const j = JSON.parse(readFileSync(tmp, 'utf8'));
  out.tests = { total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, run: new Date().toISOString().slice(0, 10) };
}

writeFileSync(path.join(root, 'deck/numbers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, (k, v) => (k === 'lapland_memo' ? '[memo]' : v), 2));
