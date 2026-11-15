// Builds deck/deck.html from deck/numbers.json, public/data/sources.json and parameters.json.
// Every model number comes from numbers.json (src/model/metrics.ts at default settings);
// sourced figures are read from the source records. Run: node deck/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const D = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(D, '..');
const N = JSON.parse(readFileSync(path.join(D, 'numbers.json'), 'utf8'));
const SOURCES = JSON.parse(readFileSync(path.join(root, 'public/data/sources.json'), 'utf8')).sources;
const PARAMS = JSON.parse(readFileSync(path.join(root, 'public/data/parameters.json'), 'utf8')).parameters;
const SRC = Object.fromEntries(SOURCES.map((s) => [s.id, s]));
const P = Object.fromEntries(PARAMS.map((p) => [p.id, p]));

// ---------- formatting (same rules as src/hooks.ts) ----------
const nf0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const f0 = (v) => nf0.format(Math.round(v));
const f1 = (v) => nf1.format(v);
const fr = (v) => {
  if (Math.abs(v) < 1000) return nf0.format(Math.round(v));
  const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
  return nf0.format(Math.round(v / mag) * mag);
};
const pct = (share) => `${Math.round(share * 100)}%`;
const k = (kind) => `<sup class="k">${kind}</sup>`; // provenance marker, as in the app: S / C / A

// ---------- sourced figures, read from the source records ----------
const must = (cond, msg) => { if (!cond) throw new Error(`source check failed: ${msg}`); };
const quoteHas = (id, s) => must((SRC[id].quote + ' ' + (SRC[id].note ?? '') + ' ' + SRC[id].supports).includes(s), `${id} lacks "${s}"`);
quoteHas('S10', '4096'); quoteHas('S11', '2·1%'); quoteHas('S11', '3·6%'); quoteHas('S11', '14.4%'); quoteHas('S11', '13.1%');
quoteHas('S31', '61%'); quoteHas('S31', '62%'); quoteHas('S30', '20%'); quoteHas('S30', '8%'); quoteHas('S30', '29 RCTs');
quoteHas('S16', '7%'); quoteHas('S27', 'OR 0.84'); quoteHas('S3', '157 euroa'); quoteHas('S3', '23 euroa');
quoteHas('S21', '100 km'); quoteHas('S21', 'page 13'); quoteHas('S27', '50 km'); quoteHas('S6', '0,33'); quoteHas('S7', '20,18');
must(P.bone_retreat_single.default === 0.2 && P.bone_retreat_multi.default === 0.08, 'retreatment params');
must(P.breast_share_rt.default === 0.7 && P.breast_share_eligible_short.default === 0.6 && P.breast_share_already_short.default === 0.2, 'breast params');

const U = N.utsjoki, NT = N.national, OYS = N.pilot.oys_catchment, AI = N.ai, BC = N.by_county, CC = N.county_concentration;
const utsKm = f0(U.road_km);
const lap = BC.find((c) => c.code === '21');
const sens = Object.fromEntries(N.sensitivity.map((s) => [s.id, s]));

// one moon per night away, as in the app's town card (partial moon for fractions)
const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.6 8.6 0 1 1 9.8 3.5a6.9 6.9 0 0 0 10.7 10.7z"/></svg>';
const moons = (n) => {
  const full = Math.floor(n + 1e-9), frac = n - full;
  let h = '';
  for (let i = 0; i < full; i++) h += `<i class="moon">${MOON}</i>`;
  if (frac > 0.05) h += `<i class="moon part">${MOON}<span style="width:${(frac * 100).toFixed(0)}%">${MOON}</span></i>`;
  return `<span class="moons" title="${n} nights">${h}</span>`;
};

// ---------- slide chrome ----------
const TOTAL = 12;
let pageNo = 0;
const cited = new Set();
const cite = (...ids) => { ids.forEach((i) => cited.add(i)); return `<span class="cite">[${ids.join(', ')}]</span>`; };

function slide({ section, title, body, foot, cls = '', appendix = false }) {
  pageNo += 1;
  const num = appendix ? `A${pageNo - TOTAL}` : `${pageNo} / ${TOTAL}`;
  return `
<section class="slide ${cls}" data-slide="${pageNo}">
  <header class="top">
    <div class="wm"><i></i>Matka${section ? `<span class="sec">${section}</span>` : ''}</div>
    <div class="topr">S sourced · C calculated · A assumption<span class="pg">${num}</span></div>
  </header>
  ${title ? `<h1>${title}</h1>` : ''}
  <div class="body">${body}</div>
  <footer class="foot"><div class="src">${foot}</div><div class="disc">Proposals for clinical teams to evaluate, not clinical advice.</div></footer>
</section>`;
}

const slides = [];

// ===== 1. Title =====
slides.push(slide({
  cls: 's-title',
  section: 'Junction 2026 · AstraZeneca challenge',
  body: `
  <div class="tgrid">
    <div class="tl">
      <p class="kicker">Radiotherapy travel burden in Finland · National Cancer Strategy, Goal 3</p>
      <p class="hero">Same cancer, same treatment. Different distance.</p>
      <p class="lede">Matka shows what a radiotherapy course costs patients in every Finnish municipality, in trips, nights away and hours on the road, and how much evidence-based shorter schedules would remove.</p>
      <div class="duo">
        <div><div class="v num">${f0(N.over_threshold.population)}${k('C')}</div><div class="l">people in ${N.over_threshold.municipalities} municipalities live more than ${P.commute_threshold_km.default}&nbsp;km by road from their radiotherapy unit</div></div>
        <div><div class="v num teal">${fr(NT.removed.machineSessions)}${k('C')}</div><div class="l">radiotherapy machine sessions freed a year if eligible breast patients get ${P.breast_fractions_short.default} sessions instead of ${P.breast_fractions_long.default}</div></div>
      </div>
      <div class="askbox"><p class="kicker">The ask</p><p>A 12-month pilot at OYS in Oulu: ${P.breast_fractions_short.default} sessions as the default for eligible breast patients, a single 8&nbsp;Gy session for uncomplicated painful bone metastases, and the schedule mix published every year.</p></div>
    </div>
    <figure class="tr"><img src="img/terrain.jpg" alt="Matka burden terrain over Finland"><figcaption>In the app: height = nights away per breast patient on ${P.breast_fractions_long.default} sessions. The burden stands in the north and east.</figcaption></figure>
  </div>`,
  foot: `Live app: <b>matka-hack-europe.vercel.app</b> · Code and data: <b>github.com/reubxn/makta</b>. Calculated with the app's model at its default assumptions from population ${cite('S57')}, OSRM road routes ${cite('S60')} and Cancer Registry cases ${cite('S33', 'S34', 'S35')}.`,
}));

// ===== 2. The gap =====
slides.push(slide({
  section: 'The gap',
  title: `${N.over_threshold.municipalities} municipalities, home to ${f0(N.over_threshold.population)} people, are more than ${P.commute_threshold_km.default}&nbsp;km by road from their radiotherapy unit`,
  body: `
  <div class="gapgrid">
    <figure class="mapfig"><img src="img/finland.jpg" alt="Map of Finland from the app">
      <figcaption>
        <span class="lg"><i class="sw taupe"></i>More than ${P.commute_threshold_km.default}&nbsp;km by road from the unit</span>
        <span class="lg"><i class="sw unit"></i>Public radiotherapy unit</span>
        <span class="lg"><i class="sw road"></i>Road route to the unit · <i class="sw outline"></i>Utsjoki</span>
      </figcaption>
    </figure>
    <div class="cells">
      <div class="cell"><div class="v num">12${k('S')}</div><p>public radiotherapy units serve mainland Finland. Lapland has none: its patients are treated in Oulu.</p></div>
      <div class="cell"><div class="v num">${utsKm}&nbsp;km${k('C')}</div><p>from Utsjoki to OYS in Oulu, one way: ${U.drive_hm} by road.</p></div>
      <div class="cell"><div class="v num">&gt;${P.commute_threshold_km.default}&nbsp;km${k('S')}</div><p>The national roadmap: palliative radiotherapy is used less by patients living more than ${P.commute_threshold_km.default}&nbsp;km from a unit (p.&nbsp;13).</p></div>
      <div class="cell"><div class="v num">OR 0.84${k('S')}</div><p>Meta-analysis: living 50&nbsp;km or more from a centre goes with 16% lower odds of receiving palliative radiotherapy.</p></div>
      <div class="cell wide"><div class="v num">157 € <span class="vs">vs</span> 23 €${k('S')}</div><p>Kela travel reimbursement per resident in 2025: Kainuu, the highest, against Helsinki, the lowest. All reimbursed travel, not only radiotherapy.</p></div>
    </div>
  </div>`,
  foot: `Units: each unit's public pages and a national study ${cite('S56', 'S52', 'S45')}; the private Docrates clinic is excluded. Roadmap p. 13 ${cite('S21')}, which cites Norwegian data ${cite('S29')}. Meta-analysis ${cite('S27')}. Kela 2025 ${cite('S3')}. Calculated: OSRM road distance ${cite('S60')} from municipality centre points ${cite('S59')}; population 31 Dec 2025 ${cite('S57')}.`,
}));

// ===== 3. Care pathway =====
slides.push(slide({
  section: 'The care pathway',
  title: 'Distance bites at radiotherapy, where the schedule chosen at planning sets weeks of travel',
  body: `
  <div class="path">
    <div class="ptrack"><span class="tlabel">Early breast cancer</span>
      <span class="node">Diagnosis</span><span class="arr"></span><span class="node">Surgery</span><span class="arr"></span><span class="node rt">Radiotherapy after surgery</span><span class="arr"></span><span class="node">Follow-up</span>
    </div>
    <div class="ptrack"><span class="tlabel">Advanced cancer</span>
      <span class="node">Bone metastases</span><span class="arr"></span><span class="node rt">Radiotherapy for bone pain</span><span class="arr"></span><span class="node">End-of-life care</span>
    </div>
  </div>
  <div class="pcards">
    <div class="pcard">
      <p class="kicker">Radiotherapy after breast surgery</p>
      <p class="pq">Common schedule today: ${P.breast_fractions_long.default} sessions over 3 weeks${k('S')}</p>
      <div class="prow"><span>From Utsjoki, ${utsKm}&nbsp;km</span><b class="num">${f0(U.breast_long.nights)} nights away · ${f0(U.breast_long.roundTrips)} round trips · ${f0(U.breast_long.hours)} h on the road${k('C')}</b>${moons(U.breast_long.nights)}</div>
      <div class="prow"><span>Within ${P.commute_threshold_km.default}&nbsp;km</span><b class="num">${f0(N.breast_commuter.long.roundTrips)} round trips${k('C')}</b></div>
    </div>
    <div class="pcard">
      <p class="kicker">Radiotherapy for painful bone metastases</p>
      <p class="pq">Multi-session course: ${P.bone_fractions_multi.default} sessions${k('A')}</p>
      <div class="prow"><span>Beyond ${P.commute_threshold_km.default}&nbsp;km</span><b class="num">${f1(N.bone.stayer_long.nights)} nights away per course${k('C')}</b>${moons(N.bone.stayer_long.nights)}</div>
      <div class="prow"><span>Within ${P.commute_threshold_km.default}&nbsp;km</span><b class="num">${f1(N.bone.commuter_long.roundTrips)} round trips per course${k('C')}</b></div>
      <p class="pnote">Expected values, retreatment included. One moon per night away, as in the app.</p>
    </div>
    <div class="pcard rule">
      <p class="kicker">How Matka counts a course${k('A')}</p>
      <p>Within ${P.commute_threshold_km.default}&nbsp;km by road: drive in for every session. Beyond: stay near the unit on treatment weeknights, home at weekends. Plus ${P.planning_visit.default} planning visit.</p>
    </div>
  </div>
  <p class="pline">Radiotherapy patients often attend daily for several weeks${k('S')}. Every session also takes a treatment-machine slot, and Goal 3 tracks whether <b>patients receive treatment within target times</b>${k('S')}.</p>`,
  foot: `Daily attendance ${cite('S19')}. 40 Gy in 15 fractions over 3 weeks ${cite('S9', 'S14')}. The 5-session bone comparator is an assumption (20 Gy in 5 fractions is a common comparator) ${cite('S62')}. Goal 3 indicator ${cite('S24', 'S25')}. Calculated with Matka's model; the ${P.commute_threshold_km.default}&nbsp;km threshold and the planning visit are assumptions.`,
}));

// ===== 4. Evidence =====
slides.push(slide({
  section: 'The evidence',
  title: 'For eligible patients, randomised evidence backs the short schedules; today’s practice is not published',
  body: `
  <div class="ev">
    <div class="evc">
      <p class="kicker">Breast, after surgery</p>
      <div class="v num">4,096${k('S')}</div><p class="vl">patients randomised in FAST-Forward</p>
      <p><b>26 Gy in ${P.breast_fractions_short.default} sessions over 1 week is non-inferior</b> to 40 Gy in ${P.breast_fractions_long.default} over 3 weeks.${k('S')}</p>
      <p>At 10 years, a similar level of cancer control: breast recurrence 2.1% vs 3.6%; late moderate or marked breast effects 14.4% vs 13.1%.${k('S')}</p>
      <p class="elig">Eligible: whole breast or chest wall <b>without nodal radiotherapy</b>. ${P.breast_fractions_long.default} sessions stays standard when nodes are treated.${k('S')}</p>
    </div>
    <div class="evc">
      <p class="kicker">Painful bone metastases</p>
      <div class="v num">61% <span class="vs">vs</span> 62%${k('S')}</div><p class="vl">pain response, single vs multiple sessions, 29 randomised trials</p>
      <p><b>Retreatment ${pct(P.bone_retreat_single.default)} vs ${pct(P.bone_retreat_multi.default)}</b>: the cost of a single session. Matka counts it.${k('S')}</p>
      <p>Guidelines name a single 8&nbsp;Gy session.${k('S')}</p>
    </div>
    <div class="evc dim">
      <p class="kicker">Today's practice in Finland</p>
      <div class="v num">1 <span class="vs">of</span> ${AI.units_total}${k('C')}</div><p class="vl">units publishes which schedule it uses</p>
      <p>No unit page found states ${P.breast_fractions_short.default} breast sessions as standard, a session count for painful bone metastases, or distance as a reason.${k('C')}</p>
      <p>Turku University Hospital, 2005–2013: ${pct(P.bone_share_single_now.default)} of courses in the last year of life were single-session. One centre, all indications.${k('S')}</p>
    </div>
  </div>
  <p class="pline">No survival claims are made for the shorter schedules. They apply to eligible patients only; schedule choice stays a clinical decision.</p>`,
  foot: `FAST-Forward: Brunt et al., Lancet 2020 ${cite('S9', 'S10')}; 10-year results, Lancet Oncol 2026, 26 Gy vs 40 Gy arms ${cite('S11')}. RCR consensus ${cite('S15', 'S14')}. Rich et al., Radiother Oncol 2018 ${cite('S31', 'S30')}, updating Chow et al. 2012 ${cite('S32')}. ASCO guideline as cited ${cite('S62')}. Unit pages read 14 Nov 2026 ${cite('S65', 'S66', 'S67', 'S68')}; the Turku and Tampere sites could not be reached. Rautakorpi et al., Acta Oncol 2017 ${cite('S16')}.`,
}));

// ===== 5. What Matka does =====
slides.push(slide({
  section: 'What Matka does',
  title: 'Matka turns public data into each municipality’s travel burden and a sourced memo for each county',
  body: `
  <div class="mgrid">
    <figure class="appshot"><img src="img/app-breast.jpg" alt="Matka app, Utsjoki selected, breast lever on">
      <span class="badge" style="left:16.5%;top:20%">1</span>
      <span class="badge" style="left:76.5%;top:40%">2</span>
      <span class="badge" style="left:76.5%;top:64%">3</span>
      <span class="badge" style="left:54%;top:30%">4</span>
      <span class="badge" style="left:95.6%;top:17.6%">5</span>
    </figure>
    <ol class="feat">
      <li><b>The lever.</b> Switch the default schedule; map, card and totals update.</li>
      <li><b>One patient, before → after:</b> nights away, round trips, hours on the road, Kela cost (lower bound).</li>
      <li><b>Every year, nationally:</b> machine sessions, nights, trips and hours.</li>
      <li><b>The real road route</b> from each municipality to its unit.</li>
      <li><b>Every number is marked S, C or A.</b> Click it for the source and a verbatim quote.</li>
    </ol>
  </div>
  <p class="tabs3"><b>Three more tabs:</b> What units say (unit pages read by AI) · County memo (one for each of ${AI.memos} areas) · Sources &amp; limitations (${N.provenance.sources} sources, ${N.provenance.limitations} limitations). Runs offline: no request leaves the page.</p>`,
  foot: `Screenshot of the app with Utsjoki selected and the breast lever on. Live at matka-hack-europe.vercel.app. The ${AI.memos} areas are the 21 wellbeing services counties and the City of Helsinki.`,
}));

// ===== 6. What changes =====
const bar = (label, rem, cur) => {
  const w = (100 * rem) / cur;
  return `<div class="brow"><div class="bl">${label}</div><div class="track"><div class="rem" style="width:${w.toFixed(1)}%"></div></div><div class="bv num"><b class="teal">${fr(rem)}</b> <span>of ${fr(cur)}</span></div></div>`;
};
slides.push(slide({
  section: 'What changes if counties act',
  title: `${P.breast_fractions_short.default} sessions for eligible breast patients would free about ${fr(NT.removed.machineSessions)} radiotherapy machine sessions a year`,
  body: `
  <div class="cgrid">
    <div class="cl">
      <p class="kicker">Every year, nationally, breast${k('C')}</p>
      <p class="clede">About <b class="num">${fr(NT.current.patients)}</b> eligible breast patients a year are still on ${P.breast_fractions_long.default} sessions. Moving them to ${P.breast_fractions_short.default} removes:</p>
      <div class="bars">
        ${bar('Machine sessions', NT.removed.machineSessions, NT.current.machineSessions)}
        ${bar('Nights away', NT.removed.nights, NT.current.nights)}
        ${bar('Round trips', NT.removed.roundTrips, NT.current.roundTrips)}
        ${bar('Hours on the road', NT.removed.hours, NT.current.hours)}
        <div class="bkey">Whole bar: these patients' yearly burden on ${P.breast_fractions_long.default} sessions today. <i class="sw tealsw"></i>Removed by moving them to ${P.breast_fractions_short.default}.</div>
        <p class="assume">Assumptions, each a slider in the app${k('A')}: <b>${pct(P.breast_share_rt.default)}</b> of new breast cancers get radiotherapy · <b>${pct(P.breast_share_eligible_short.default)}</b> of them are eligible for ${P.breast_fractions_short.default} sessions · <b>${pct(P.breast_share_already_short.default)}</b> of those already get ${P.breast_fractions_short.default}.</p>
      </div>
      <p class="goal">Freed machine sessions serve Goal 3: patients receive treatment within target times.${k('S')}</p>
    </div>
    <div class="cr">
      <p class="kicker">One patient from Utsjoki, breast${k('C')}</p>
      <table class="pp num">
        <thead><tr><th></th><th>${P.breast_fractions_long.default} sessions</th><th>${P.breast_fractions_short.default} sessions</th></tr></thead>
        <tr><td>Nights away</td><td>${f0(U.breast_long.nights)}</td><td class="teal">${f0(U.breast_short.nights)}</td></tr>
        <tr><td>Round trips</td><td>${f0(U.breast_long.roundTrips)}</td><td class="teal">${f0(U.breast_short.roundTrips)}</td></tr>
        <tr><td>Hours on the road</td><td>${f0(U.breast_long.hours)}</td><td class="teal">${f0(U.breast_short.hours)}</td></tr>
        <tr><td>Kela €, at least</td><td>${f0(U.breast_long.kelaEur)}</td><td class="teal">${f0(U.breast_short.kelaEur)}</td></tr>
      </table>
      <p class="kicker k2">Painful bone metastases, single 8&nbsp;Gy${k('C')}</p>
      <p class="bone">Beyond ${P.commute_threshold_km.default}&nbsp;km: <b class="num">${f1(N.bone.stayer_long.nights)} → <span class="teal">${f1(N.bone.stayer_short.nights)}</span></b> nights away per course. Within ${P.commute_threshold_km.default}&nbsp;km: <b class="num">${f1(N.bone.commuter_long.roundTrips)} → <span class="teal">${f1(N.bone.commuter_short.roundTrips)}</span></b> round trips.</p>
      <p class="bone small">Retreatment is included, so far patients make about the same number of trips (${f1(N.bone.stayer_long.roundTrips)} → ${f1(N.bone.stayer_short.roundTrips)}). Per patient only: no national count of bone courses is published.</p>
    </div>
  </div>`,
  foot: `Calculated with Matka's model at its defaults: ${f0(NT.cases_mainland)} new breast cancers in women on the mainland, ${NT.cases_year} ${cite('S33', 'S34')} × ${pct(P.breast_share_rt.default)} treated with radiotherapy (A) × ${pct(P.breast_share_eligible_short.default)} eligible (A) × (1 − ${pct(P.breast_share_already_short.default)} already on 5 sessions, A), allocated by age-weighted female population ${cite('S35', 'S57')}; rounded to 3 significant figures, as in the app. Kela lower bound: 0.33 €/km + 20.18 € a night ${cite('S6', 'S7')}. Retreatment ${cite('S30')}. Goal 3 ${cite('S24', 'S25')}.`,
}));

// ===== 7. Where it lands =====
const shown = BC.filter((c) => c.nights > 0);
const maxN = Math.max(...shown.map((c) => c.nights));
const top6 = new Set(CC.top6_names);
const crow = (c) => `<div class="crow${top6.has(c.name) ? ' hi' : ''}"><div class="cn">${c.name}</div><div class="ctrack"><div class="cbar" style="width:${((100 * c.nights) / maxN).toFixed(1)}%"></div></div><div class="cv num">${f0(c.nights)}</div><div class="cpp num">${f1(c.nights_per_patient)}</div></div>`;
slides.push(slide({
  section: 'Where it lands',
  title: `Six counties with ${Math.round(CC.top6_share_patients)}% of the eligible patients carry ${Math.round(CC.top6_share_nights)}% of the nights away the switch removes`,
  body: `
  <div class="wgrid">
    <div class="chart">
      <div class="chead"><span class="kicker">Nights away removed a year, breast, by area${k('C')}</span><span class="kicker r">per eligible patient</span></div>
      ${shown.map(crow).join('')}
      <p class="cfoot">The other ${CC.areas_zero_nights} of ${CC.areas} areas have no municipality beyond ${P.commute_threshold_km.default}&nbsp;km, so no nights away to remove.</p>
    </div>
    <div class="wside">
      <div class="wbig"><div class="v num teal">${Math.round(N.pilot.oys_share_of_national_nights_removed)}%${k('C')}</div><p>of all nights removed fall in the ${OYS.municipalities} municipalities routed to <b>OYS in Oulu</b>, home to ${Math.round(N.pilot.oys_share_of_national_patients)}% of the eligible patients.</p></div>
      <p>Lapland has no unit: ${lap.municipalities_over_threshold} of its ${lap.municipalities} municipalities are beyond ${P.commute_threshold_km.default}&nbsp;km, and the switch removes <b class="num">${f1(lap.nights_per_patient)}</b> nights per eligible patient.${k('C')}</p>
      <p>Near a unit the switch still matters: a patient within ${P.commute_threshold_km.default}&nbsp;km makes <b class="num">${f0(N.breast_commuter.long.roundTrips)} → ${f0(N.breast_commuter.short.roundTrips)}</b> round trips.${k('C')}</p>
    </div>
  </div>`,
  foot: `Calculated with Matka's model at its defaults, summed by wellbeing services county; the City of Helsinki is its own area. Lapland is routed to OYS by its published catchment ${cite('S52')}; other municipalities go to the nearest unit by drive time, an assumption ${cite('S60')} (Kainuu splits Oulu 5, Kuopio 2, Joensuu 1).`,
}));

// ===== 8. Recommendation =====
slides.push(slide({
  section: 'The recommendation',
  title: 'Three changes for every county: two defaults the evidence supports, and one number published every year',
  body: `
  <table class="rec">
    <thead><tr><th class="c1">Change</th><th>Owner</th><th>First step, within 30 days</th><th>Goal 3 indicator it serves</th></tr></thead>
    <tr><td class="c1"><div class="c1w"><span class="rn">1</span><div><b>${P.breast_fractions_short.default} sessions as the default for eligible breast patients</b> (whole breast or chest wall, no nodal radiotherapy), with distance named as a reason to choose it.${k('S')}</div></div></td>
      <td>Breast radiotherapy lead</td><td>Clinical team reviews its eligibility criteria and last year's schedule mix.</td><td>Patients receive treatment within target times${k('S')}</td></tr>
    <tr><td class="c1"><div class="c1w"><span class="rn">2</span><div><b>A single 8&nbsp;Gy session as the default for uncomplicated painful bone metastases</b>, with retreatment tracked.${k('S')}</div></div></td>
      <td>Head of radiotherapy</td><td>Clinical team agrees which bone cases count as uncomplicated and reviews retreatment rates.</td><td>National targets and effectiveness indicators for agreed cancers${k('S')}</td></tr>
    <tr><td class="c1"><div class="c1w"><span class="rn">3</span><div><b>Publish the schedule mix, and radiotherapy use by distance band, every year.</b>${k('S')}</div></div></td>
      <td>Director of cancer services, with the unit's quality manager</td><td>Agree the distance bands and the data to extract.</td><td>Regional differences in treatment are available and used to steer services${k('S')}</td></tr>
  </table>
  <div class="recnote">
    <p><b>Why all three:</b> the evidence exists, the burden is measurable, and change 3 makes changes 1 and 2 checkable. Today Matka found a published schedule for 1 of ${AI.units_total} units.</p>
    <p><b>Proposals for clinical teams to evaluate.</b> Schedule choice stays a clinical decision for each patient. Each county's memo in the app carries these proposals with its own numbers.</p>
  </div>`,
  foot: `Breast ${cite('S9', 'S11', 'S15', 'S14')}. Bone ${cite('S31', 'S30', 'S62')}. Distance and palliative radiotherapy use ${cite('S21', 'S27')}. Goal 3 indicators: target times ${cite('S24', 'S25')}; agreed-cancer indicators ${cite('S61')}; regional differences ${cite('S26')}.`,
}));

// ===== 9. Pilot =====
slides.push(slide({
  section: 'The pilot ask',
  title: `Start where the nights are: a 12-month pilot at OYS, whose catchment carries ${Math.round(N.pilot.oys_share_of_national_nights_removed)}% of them`,
  body: `
  <div class="pgrid">
    <div class="pl">
      <p class="kicker">OYS catchment, as modelled${k('C')}</p>
      <p class="pscope"><b class="num">${OYS.municipalities}</b> municipalities, <b class="num">${OYS.municipalities_over_threshold}</b> beyond ${P.commute_threshold_km.default}&nbsp;km, home to <b class="num">${f0(OYS.population)}</b> people. Lapland has no unit of its own, and Utsjoki, ${utsKm}&nbsp;km away, is the longest drive in Matka's routing.</p>
      <p class="pscope">About <b class="num">${f0(OYS.still_long_patients)}</b> eligible breast patients a year on ${P.breast_fractions_long.default} sessions. If all switch, every year:</p>
      <div class="v num teal">${fr(OYS.machineSessions)}${k('C')}</div><p class="vl">machine sessions freed</p>
      <div class="trio num">
        <div><b class="teal">${fr(OYS.nights)}</b><span>nights away</span></div>
        <div><b class="teal">${fr(OYS.roundTrips)}</b><span>round trips</span></div>
        <div><b class="teal">${fr(OYS.hours)}</b><span>hours on the road</span></div>
      </div>
    </div>
    <div class="pr">
      <ol class="tl">
        <li><span class="when">Days 0–30</span><span>OYS clinical teams review breast eligibility criteria and which bone cases count as uncomplicated. Extract last year's schedule mix and retreatment rate as the baseline.</span></li>
        <li><span class="when">Month 2</span><span>Teams decide whether to adopt the two defaults. If adopted, distance is named as a reason to choose ${P.breast_fractions_short.default} sessions.</span></li>
        <li><span class="when">Month 6</span><span>Interim report, by distance band.</span></li>
        <li><span class="when">Month 12</span><span>Published report. Decide whether to extend to the other units.</span></li>
      </ol>
      <div class="measure"><p class="kicker">Measured at baseline and month 12</p>
        <p>Share of eligible breast patients on ${P.breast_fractions_short.default} sessions · share of uncomplicated bone metastases on a single 8&nbsp;Gy session · retreatment rate · nights away and round trips per course, by distance band · machine sessions freed · time to start of radiotherapy</p></div>
    </div>
  </div>`,
  foot: `Expected size calculated with Matka's model at its defaults; the baseline replaces the ${pct(P.breast_share_already_short.default)} "already on 5 sessions" assumption. Routing: Lapland by its published catchment ${cite('S52')}; North Ostrobothnia, Kainuu and Central Ostrobothnia municipalities by nearest drive time, an assumption ${cite('S60')}. Rounded to 3 significant figures.`,
}));

// ===== 10. AI and trust =====
slides.push(slide({
  section: 'How AI is used',
  title: 'AI reads and writes; it never computes. Every number traces to a file and a source',
  body: `
  <div class="aigrid">
    <div class="ail">
      <div class="airow"><p class="kicker">Read</p><div class="aiv num">${AI.units_pages_read}</div><div><b>public unit pages read by AI.</b> Strict schema; null when a page does not say. Every Finnish quote must match the saved page word for word: ${AI.units_statements_extracted} statements kept, ${AI.units_statements_dropped} dropped. Result: 1 of ${AI.units_total} units publishes which schedule it uses.</div></div>
      <div class="airow"><p class="kicker">Compute</p><div class="aiv num">0</div><div><b>AI in the numbers.</b> Pure, unit-tested functions: ${N.tests.passed} of ${N.tests.total} tests pass, including national totals = sum of counties. A data check confirms every municipality has a route and every fact a kind and known sources. ${PARAMS.length} parameters: ${N.provenance.parameters_by_kind.sourced} sourced, ${N.provenance.parameters_by_kind.assumption} assumptions, each a slider.</div></div>
      <div class="airow"><p class="kicker">Write</p><div class="aiv num">${AI.memo_numbers_passed}/${AI.memo_numbers_checked}</div><div><b>numbers traced in ${AI.memos} county memos.</b> A validator extracts every number and checks it against the facts given to the writer. A sentence without source ids, "better" or a survival claim fails.</div></div>
      <p class="aifoot">${N.provenance.sources} sources, each with a short verbatim quote. Every number in this deck is checked against the repo data by a script, like the memos.</p>
    </div>
    <figure class="memofig"><img src="img/memo.jpg" alt="Lapland county memo in the app"><figcaption>Lapland's memo in the app: every number traced, superscripts link to the sources.</figcaption></figure>
  </div>`,
  foot: `AI: ${AI.units_model} via the Anthropic API, ${AI.units_generated} (public/data/unit_statements.json, memos.json). Unit pages ${cite('S65', 'S66', 'S67', 'S68')}. Tests (npx vitest run) and data check (scripts/09_check_data.py) re-run for this deck on 15 Nov 2026; deck numbers: deck/compute_numbers.mjs, checked by deck/render.mjs (deck/number_check.txt).`,
}));

// ===== 11. Limitations =====
const RMAX = 27000;
const rng = (s, lo, hi, loLab, hiLab, extra = '') => {
  const a = Math.min(lo, hi), b = Math.max(lo, hi);
  const name = s.label.replace('Breast: ', '');
  const aLab = a === lo ? loLab : hiLab, bLab = b === hi ? hiLab : loLab;
  return `<div class="rrow"><div class="rl">${name[0].toUpperCase() + name.slice(1)}${k('A')}<span class="rk">default ${pct(s.default)}</span></div>
    <div class="rtrack"><div class="rbar" style="left:${((100 * a) / RMAX).toFixed(1)}%;width:${((100 * (b - a)) / RMAX).toFixed(1)}%"></div>
      <span class="rlo num" style="left:${((100 * a) / RMAX).toFixed(1)}%">${f0(a)} <em>at ${aLab}</em></span><span class="rhi num" style="left:${((100 * b) / RMAX).toFixed(1)}%">${f0(b)} <em>at ${bLab}</em></span>${extra}</div></div>`;
};
const sa = sens.breast_share_already_short, se = sens.breast_share_eligible_short, sr = sens.breast_share_rt, st = sens.commute_threshold_km;
slides.push(slide({
  section: 'Limitations',
  title: 'The biggest unknown is today’s schedule mix, so the headline is a range, not a point',
  body: `
  <div class="lgrid">
    <div class="sens">
      <p class="kicker">Machine sessions freed a year, across each assumption's range in the app${k('C')}</p>
      <div class="raxis"><div></div><div class="rt"><span style="left:${((100 * NT.removed_rounded.machineSessions) / RMAX).toFixed(1)}%">default ${fr(NT.removed.machineSessions)}</span></div></div>
      <div class="rwrap">
        <div class="rdef" style="left:calc(var(--rl) + (100% - var(--rl)) * ${(NT.removed_rounded.machineSessions / RMAX).toFixed(4)})"></div>
        ${rng(sa, sa.at_max.machineSessions, sa.at_min.machineSessions, pct(sa.max), pct(sa.min))}
        ${rng(se, se.at_min.machineSessions, se.at_max.machineSessions, pct(se.min), pct(se.max))}
        ${rng(sr, sr.at_min.machineSessions, sr.at_max.machineSessions, pct(sr.min), pct(sr.max))}
      </div>
      <p class="snote">If half the eligible patients already get ${P.breast_fractions_short.default} sessions, the switch frees <b class="num">${fr(N.sensitivity_already_short_half.machineSessions)}</b>; if all do, nothing. That is why change 3 asks units to publish the mix.</p>
      <p class="snote">Commuting threshold ${st.min}–${st.max} km${k('A')}: sessions freed unchanged; nights away removed <b class="num">${fr(st.at_min.nights)}</b> to <b class="num">${fr(st.at_max.nights)}</b>.</p>
    </div>
    <div class="lims">
      <p class="kicker">Also limits the numbers</p>
      <ul>
        <li>Distances run from municipality centre points, not from homes.</li>
        <li>Outside published catchments, routing is nearest by drive time; Kanta-Häme and Kainuu may differ.</li>
        <li>Breast cases are allocated to municipalities by age-weighted female population.</li>
        <li>Bone: no national count of courses is published, so per patient only.</li>
        <li>Treatment and eligibility shares (${pct(P.breast_share_rt.default)}, ${pct(P.breast_share_eligible_short.default)}) are assumptions; no citable Finnish figure was found.</li>
        <li>The ${pct(P.bone_share_single_now.default)} single-session baseline is one hospital, 2005–2013, all indications.</li>
        <li>The roadmap's ${P.commute_threshold_km.default}&nbsp;km finding cites Norwegian data.</li>
        <li>Turku and Tampere unit sites were unreachable: "no page found" is not "no page".</li>
        <li>Private units and Åland are excluded; Kela cost is a lower bound; drive times assume free-flowing traffic.</li>
      </ul>
    </div>
  </div>`,
  foot: `Calculated with Matka's model, moving one assumption at a time across its slider range in the app (Assumptions drawer); rounded to 3 significant figures, as in the app. Full list: Sources &amp; limitations tab (${N.provenance.limitations} limitations). Turku baseline ${cite('S16')}; roadmap ${cite('S21', 'S29')}.`,
}));

// ===== 12. Next step =====
slides.push(slide({
  section: 'Next step',
  title: 'Next step: one introduction and one year of OYS data, to replace our assumptions with real numbers',
  body: `
  <div class="next">
    <div class="ns"><span class="nn">1</span><p><b>An introduction</b> to the OYS head of radiotherapy and Lapland's director of cancer services. Lapland's memo is already written, every number traced.</p></div>
    <div class="ns"><span class="nn">2</span><p><b>Last year's aggregate schedule mix and retreatment rate</b> from OYS. It replaces the "already on ${P.breast_fractions_short.default} sessions" assumption and sets the pilot baseline.</p></div>
    <div class="ns"><span class="nn">3</span><p><b>We rerun Matka with those numbers</b> and update the memos for the counties OYS serves. The same memo already exists for all ${AI.memos} areas.</p></div>
  </div>
  <p class="close">We can’t move the hospital. The schedule can.</p>
  <div class="check"><p class="kicker">Check it yourself in five minutes</p>
    <p>Open <b>matka-hack-europe.vercel.app</b>. Press <span class="key">2</span> to fly the road from Utsjoki to Oulu; <span class="key">3</span> turns the breast lever on. Click any S, C or A marker for its source and quote. <span class="key">7</span> writes Lapland's memo. Code and data: <b>github.com/reubxn/makta</b>.</p></div>`,
  foot: `Built at Junction 2026 for the AstraZeneca challenge. Public aggregate data only. No AstraZeneca data, logo or branding is used.`,
}));

// ===== Appendix: sources =====
const short = (u) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\?.*$/, '');
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const citedIds = () => [...cited].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
const srcItem = (id) => {
  const s = SRC[id];
  const t = trunc(s.title, 88);
  return `<li><b>${id}</b> ${t}${t.endsWith('…') ? '' : '.'} <span class="pub">${trunc(s.publisher, 48)}, ${s.year}.</span> <span class="url">${trunc(short(s.url), 70)}</span></li>`;
};
const ids = citedIds();
const half = Math.ceil(ids.length / 2);
for (const [i, part] of [ids.slice(0, half), ids.slice(half)].entries()) {
  slides.push(slide({
    appendix: true,
    section: 'Appendix',
    title: `Sources cited in this deck (${i + 1} of 2)`,
    body: `<ul class="srcs">${part.map(srcItem).join('')}</ul>`,
    foot: `S-numbers match the app's Sources &amp; limitations tab (public/data/sources.json: ${N.provenance.sources} sources, each with URL, access date and a verbatim quote). All accessed 14 Nov 2026.`,
  }));
}

// ===== Appendix: method and parameters =====
const pv = (p) => (p.unit === 'share' ? pct(p.default) : `${p.default} ${p.default === 1 ? p.unit.replace(/s$/, '') : p.unit}`);
const kindLetter = { sourced: 'S', calculated: 'C', assumption: 'A' };
const pidToS = (keys) => keys.map((key) => SOURCES.find((s) => s.key === key)?.id).filter(Boolean);
slides.push(slide({
  appendix: true,
  section: 'Appendix',
  title: 'Method and parameters',
  body: `
  <div class="mgrid2">
    <div class="meth">
      <p class="kicker">Per patient, for a course of n sessions</p>
      <ul>
        <li><b>Commuter</b> (road km ≤ threshold): round trips = n + planning; nights away = 0.</li>
        <li><b>Stayer</b> (beyond): weeks = ceil(n / 5); round trips = weeks + planning; nights away = n + planning.</li>
        <li>Hours on the road = round trips × 2 × drive time. Kela, lower bound = km × own-car rate + nights × overnight allowance.</li>
        <li><b>Bone</b>: expected = course + retreatment probability × one single-session course.</li>
      </ul>
      <p class="kicker">Every year, breast</p>
      <ul>
        <li>Patients = cases × share treated × share eligible × (1 − share already on 5 sessions), per municipality.</li>
        <li>Removed = patients × (15-session burden − 5-session burden), summed by county and nationally. Machine sessions freed = patients × (15 − 5).</li>
      </ul>
      <p class="kicker">Reproduce</p>
      <p class="code">node deck/compute_numbers.mjs → deck/numbers.json (runs src/model/metrics.ts on public/data)<br>node deck/build.mjs &amp;&amp; node deck/render.mjs → deck/matka.pdf, deck/slides/*.png, number check</p>
    </div>
    <table class="ptab">
      <thead><tr><th>Parameter</th><th>Default</th><th>Kind</th><th>Sources</th></tr></thead>
      ${PARAMS.map((p) => `<tr><td>${p.label}</td><td class="num">${pv(p)}</td><td>${kindLetter[p.kind]}</td><td>${pidToS(p.source_ids).join(', ') || '–'}</td></tr>`).join('')}
    </table>
  </div>`,
  foot: `Parameters from public/data/parameters.json; each is a slider in the app's Assumptions drawer. Routes: OSRM ${cite('S60')} from Wikidata centre points ${cite('S59')}; cases ${cite('S33', 'S34', 'S35')}; population ${cite('S57')}.`,
}));

// make sure every cited id exists
for (const id of cited) if (!SRC[id]) throw new Error(`unknown source ${id}`);
// the parameter table cites sources too; list them on the sources pages if missing
const paramIds = new Set(PARAMS.flatMap((p) => pidToS(p.source_ids)));
const missing = [...paramIds].filter((id) => !ids.includes(id));
if (missing.length) console.warn('parameter sources not in the sources appendix:', missing.join(', '));

// ---------- talk track (deck/notes.md), from the same numbers ----------
const notes = `# Matka: 2-minute talk track

About WORDS words: two minutes at a calm pace. Slide numbers in brackets. Every number below is on the slides and in the app.

**[1] 0:00**
Same cancer, same treatment. Different distance. Matka shows what radiotherapy costs patients in travel, municipality by municipality, and what shorter schedules would remove.

**[2] 0:10**
${f0(N.over_threshold.population)} people in ${N.over_threshold.municipalities} municipalities live more than ${P.commute_threshold_km.default} km by road from their unit. Lapland has none: from Utsjoki it is ${utsKm} km to Oulu, ${U.drive_hm} each way. The national roadmap itself says palliative radiotherapy is used less beyond ${P.commute_threshold_km.default} km.

**[3] 0:25**
Distance bites at one step: radiotherapy, where the schedule sets the travel. ${P.breast_fractions_long.default} breast sessions from Utsjoki means ${f0(U.breast_long.nights)} nights away.

**[4] 0:35**
For eligible patients, the evidence is there. FAST-Forward, 4,096 patients: ${P.breast_fractions_short.default} sessions in one week is non-inferior to ${P.breast_fractions_long.default} over three. For painful bone metastases, a single 8 Gy session relieves pain as well, with more retreatment, which we count. Yet Matka found a published schedule for 1 of ${AI.units_total} units.

**[5] 0:50**
Matka puts it on a map with a lever, and every number clicks through to its source.

**[6–7] 1:00**
Moving the roughly ${fr(NT.current.patients)} eligible breast patients still on ${P.breast_fractions_long.default} sessions to ${P.breast_fractions_short.default} frees about ${fr(NT.removed.machineSessions)} machine sessions a year, and ${fr(NT.removed.nights)} nights away. Six counties carry ${Math.round(CC.top6_share_nights)}% of those nights. The OYS catchment alone carries ${Math.round(N.pilot.oys_share_of_national_nights_removed)}%.

**[8–9] 1:15**
Three changes. ${P.breast_fractions_short.default} sessions as the default for eligible breast patients, with distance named as a reason. A single 8 Gy session for uncomplicated painful bone metastases. And every unit publishes its schedule mix by distance band, every year. Each has an owner, a 30-day first step and a Goal 3 indicator. We ask for a 12-month pilot at OYS.

**[10–11] 1:35**
AI read the units' pages and wrote ${AI.memos} county memos, but never computes: ${AI.memo_numbers_passed} of ${AI.memo_numbers_checked} memo numbers trace to the facts. The biggest unknown is today's schedule mix, so we show the range, not a point.

**[12] 1:50**
Next step: an introduction to OYS and Lapland, and one year of their data. We can't move the hospital. The schedule can.

---

## If a judge asks

- **"Is 5 sessions better?"** No: non-inferior, with a similar level of cancer control at 10 years. It applies to whole breast or chest wall without nodal radiotherapy; ${P.breast_fractions_long.default} sessions stays standard when nodes are treated.
- **"Bone: doesn't a single session mean more trips?"** Beyond ${P.commute_threshold_km.default} km, nights away fall from ${f1(N.bone.stayer_long.nights)} to ${f1(N.bone.stayer_short.nights)}, but trips stay about the same (${f1(N.bone.stayer_long.roundTrips)} to ${f1(N.bone.stayer_short.roundTrips)}) because ${pct(P.bone_retreat_single.default)} need retreatment. We show that rather than hide it.
- **"What if units already use 5 sessions?"** Then the gain is smaller: at ${pct(0.5)} already on 5 sessions it is about ${fr(N.sensitivity_already_short_half.machineSessions)} sessions a year. Nobody publishes the mix, which is why change 3 exists.
- **"Why OYS?"** It serves Lapland, which has no unit, and has the longest drive in Matka's routing (Utsjoki, ${utsKm} km).
`;
const trackWords = notes.split('---')[0].split('\n').filter((l) => l && !l.startsWith('**[') && !l.startsWith('#') && !l.startsWith('About')).join(' ').split(/\s+/).filter(Boolean).length;
writeFileSync(path.join(D, 'notes.md'), notes.replace('WORDS', String(Math.round(trackWords / 10) * 10)));

const css = readFileSync(path.join(D, 'deck.css'), 'utf8');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Matka: same cancer, same treatment, different distance</title>
<style>${css}</style></head>
<body>${slides.join('\n')}</body></html>`;
writeFileSync(path.join(D, 'deck.html'), html);
console.log(`deck.html: ${slides.length} slides, ${ids.length} sources cited`);
