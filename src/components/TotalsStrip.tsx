import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { useData } from '../context';
import { breastTotals, perPatient, type Indication, type Params } from '../model/metrics';
import { fmt, fmtRounded, useTween } from '../hooks';
import { Prov } from './Prov';

function Counter({ v }: { v: number }) {
  const t = useTween(v, 900);
  return <div className={`stat-value${v === 0 ? ' zero' : ''}`}>{fmtRounded(t)}</div>;
}

export function TotalsStrip({ params, leverOn, boneLever, indication, highlight }: { params: Params; leverOn: boolean; boneLever: boolean; indication: Indication; highlight: boolean }) {
  const { data } = useData();
  const totals = useMemo(() => {
    const rows = data.municipalities
      .filter((m) => data.routes[m.code])
      .map((m) => ({ code: m.code, county_code: m.county_code, route: data.routes[m.code], cases: data.cases.municipalities[m.code] ?? 0 }));
    return breastTotals(rows, params, leverOn);
  }, [data, params, leverOn]);
  const ids = Array.from(new Set([...data.cases.source_ids, ...data.routesMeta.source_ids, ...data.parameters.filter((p) => p.id.startsWith('breast') || p.id.startsWith('kela')).flatMap((p) => p.source_ids)]));
  const note = `Breast, per year: ${data.cases.mainland_cases.toLocaleString('en-GB')} new cases in women on the mainland (${data.cases.year}) × share treated with radiotherapy × share eligible × (1 − share already on 5 sessions), allocated to municipalities by age-weighted female population. Rounded to 3 significant figures.`;
  const stats: [string, number][] = [
    ['Nights away removed', totals.national.nights],
    ['Round trips removed', totals.national.roundTrips],
    ['Road hours removed', totals.national.hours],
    ['Machine sessions freed', totals.national.machineSessions],
  ];
  const chips = (
    <div className="chips">
      {data.goal3.map((g) => (
        <span className="chip" key={g.id} title={`${g.fi} — ${g.en}`}>
          <Target size={14} /> {g.short}
        </span>
      ))}
    </div>
  );

  if (indication === 'bone') {
    const far = data.municipalities.filter((m) => data.routes[m.code] && data.routes[m.code].road_km > params.commute_threshold_km);
    const farPop = far.reduce((a, m) => a + m.population, 0);
    const ref = far.length ? data.routes[far[0].code] : null;
    const before = ref ? perPatient(ref, 'bone', 'long', params).nights : 0;
    const after = ref ? perPatient(ref, 'bone', 'short', params).nights : 0;
    const boneIds = Array.from(new Set(data.parameters.filter((p) => p.id.startsWith('bone')).flatMap((p) => p.source_ids)));
    return (
      <section className={`panel strip strip-bone${highlight ? ' highlight' : ''}`} aria-label="Bone metastases summary" data-testid="totals">
        <div>
          <div className="stat-label">
            Painful bone metastases: a patient living in any of the {far.length} municipalities more than {params.commute_threshold_km} km by road from a unit (home to {farPop.toLocaleString('en-GB')} people)
            <Prov kind="calculated" ids={[...data.routesMeta.source_ids, 'statfin_population', ...boneIds]} note="Expected nights away per course for a patient beyond the commuting threshold, including retreatment. The same for every such municipality, because stayers spend the treatment weeknights near the unit." />
          </div>
          <div className="bone-line num">
            <span className={boneLever ? 'dimtxt' : ''}>{fmt(before, 1)}</span>
            <span className="arrow">→</span>
            <span className={boneLever ? 'aftertxt' : 'dimtxt'}>{fmt(after, 1)}</span>
            <span className="bone-unit">nights away per course</span>
          </div>
          <div className="strip-note">Per patient only: no national yearly count of bone radiotherapy courses is published.</div>
        </div>
        <div className="strip-side">{chips}</div>
      </section>
    );
  }

  return (
    <section className={`panel strip${highlight ? ' highlight' : ''}`} aria-label="National yearly totals" data-testid="totals">
      {stats.map(([label, v], i) => (
        <div key={label} className={i === 0 ? 'strip-hero' : ''}>
          <div className="stat-label">
            {label} <Prov kind="calculated" ids={ids} note={note} />
          </div>
          <Counter v={v} />
        </div>
      ))}
      <div className="strip-side">
        <div className="strip-caption" data-testid="breast-cases">
          Breast, per year: <b className="num">{data.cases.national_cases.toLocaleString('en-GB')}</b> new cases in women ({data.cases.year}){' '}
          <Prov kind="sourced" ids={['fcr_breast_2024', 'fcr_breast_2024_counties']} note={`Finnish Cancer Registry: ${data.cases.national_cases.toLocaleString('en-GB')} new breast cancer cases in women in Finland in ${data.cases.year}; ${data.cases.mainland_cases.toLocaleString('en-GB')} on the mainland (Åland excluded), which the totals use, allocated to municipalities by age-weighted female population.`} />
          {leverOn ? ` · about ${fmtRounded(totals.national.patients)} eligible` : ' · lever off'}
        </div>
        {chips}
      </div>
    </section>
  );
}
