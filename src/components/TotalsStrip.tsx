import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { useData } from '../context';
import { breastTotals, type Indication, type Params } from '../model/metrics';
import { fmtRounded, useTween } from '../hooks';
import { Prov } from './Prov';

function Counter({ v }: { v: number }) {
  const t = useTween(v, 900);
  return <div className={`stat-value${v === 0 ? ' zero' : ''}`}>{fmtRounded(t)}</div>;
}

export function TotalsStrip({ params, leverOn, indication, highlight }: { params: Params; leverOn: boolean; indication: Indication; highlight: boolean }) {
  const { data } = useData();
  const totals = useMemo(() => {
    const rows = data.municipalities
      .filter((m) => data.routes[m.code])
      .map((m) => ({ code: m.code, county_code: m.county_code, route: data.routes[m.code], cases: data.cases.municipalities[m.code] ?? 0 }));
    return breastTotals(rows, params, leverOn);
  }, [data, params, leverOn]);
  const ids = Array.from(new Set([...data.cases.source_ids, ...data.routesMeta.source_ids, ...data.parameters.filter((p) => p.id.startsWith('breast') || p.id.startsWith('kela')).flatMap((p) => p.source_ids)]));
  const note = `Breast, per year: ${data.cases.national_cases} new cases (${data.cases.year}) × share treated with radiotherapy × share eligible × (1 − share already on 5 sessions), allocated to municipalities by age-weighted female population. Rounded to 3 significant figures.`;
  const stats: [string, number][] = [
    ['Nights away removed', totals.national.nights],
    ['Round trips removed', totals.national.roundTrips],
    ['Hours on the road removed', totals.national.hours],
    ['Machine sessions freed', totals.national.machineSessions],
  ];
  return (
    <section className={`panel strip${highlight ? ' highlight' : ''}`} aria-label="National yearly totals" data-testid="totals">
      {stats.map(([label, v]) => (
        <div key={label}>
          <div className="stat-label">
            {label} <Prov kind="calculated" ids={ids} note={note} />
          </div>
          <Counter v={v} />
        </div>
      ))}
      <div className="strip-side">
        <div className="strip-caption">
          Finland, per year, breast lever {leverOn ? 'on' : 'off'}
          {leverOn ? ` · about ${fmtRounded(totals.national.patients)} patients` : ''}
        </div>
        <div className="chips">
          {data.goal3.map((g) => (
            <span className="chip" key={g.id} title={`${g.fi} — ${g.en}`}>
              <Target size={12} /> {g.short}
            </span>
          ))}
        </div>
        {indication === 'bone' && <div className="strip-note">Bone: per-patient view only; national yearly count not public</div>}
      </div>
    </section>
  );
}
