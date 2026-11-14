import { useMemo } from 'react';
import { useData } from '../context';
import { breastYear, perPatient, type Indication, type Params } from '../model/metrics';
import { fmt, fmtRounded, useTween } from '../hooks';
import { Prov } from './Prov';

function Counter({ v, className }: { v: number; className?: string }) {
  const t = useTween(v, 900);
  return <span className={className}>{fmtRounded(t)}</span>;
}

/** Totals block under the town card. Never zeros: lever off = today's yearly burden, lever on = what's removed. */
export function TotalsStrip({ params, leverOn, boneLever, indication, highlight }: { params: Params; leverOn: boolean; boneLever: boolean; indication: Indication; highlight: boolean }) {
  const { data } = useData();
  const year = useMemo(() => {
    const rows = data.municipalities
      .filter((m) => data.routes[m.code])
      .map((m) => ({ code: m.code, county_code: m.county_code, route: data.routes[m.code], cases: data.cases.municipalities[m.code] ?? 0 }));
    return breastYear(rows, params);
  }, [data, params]);
  const ids = Array.from(new Set([...data.cases.source_ids, ...data.routesMeta.source_ids, ...data.parameters.filter((p) => p.id.startsWith('breast') || p.id === 'commute_threshold_km' || p.id === 'planning_visit').flatMap((p) => p.source_ids)]));
  const goal = data.goal3[0];
  const casesMarker = (
    <Prov
      kind="sourced"
      ids={['fcr_breast_2024', 'fcr_breast_2024_counties']}
      note={`Finnish Cancer Registry: ${data.cases.national_cases.toLocaleString('en-GB')} new breast cancer cases in women in Finland in ${data.cases.year}; ${data.cases.mainland_cases.toLocaleString('en-GB')} on the mainland (Åland excluded), which the totals use, allocated to municipalities by age-weighted female population.`}
    />
  );

  if (indication === 'bone') {
    const far = data.municipalities.filter((m) => data.routes[m.code] && data.routes[m.code].road_km > params.commute_threshold_km);
    const farPop = far.reduce((a, m) => a + m.population, 0);
    const ref = far.length ? data.routes[far[0].code] : null;
    const before = ref ? perPatient(ref, 'bone', 'long', params).nights : 0;
    const after = ref ? perPatient(ref, 'bone', 'short', params).nights : 0;
    const boneIds = Array.from(new Set(data.parameters.filter((p) => p.id.startsWith('bone')).flatMap((p) => p.source_ids)));
    return (
      <section className={`totals${boneLever ? ' on' : ''}${highlight ? ' highlight' : ''}`} aria-label="Bone metastases summary" data-testid="totals" data-box="totals">
        <p className="kicker">Per patient beyond {params.commute_threshold_km} km</p>
        <div className="bone-big" data-testid="bone-big">
          <span className="before">{fmt(before, 1)}</span>
          <span className="arrow">→</span>
          <span className="after">{fmt(after, 1)}</span>
          <Prov kind="calculated" ids={[...data.routesMeta.source_ids, 'statfin_population', ...boneIds]} note="Expected nights away per course for a patient beyond the commuting threshold, including retreatment. The same for every such municipality, because stayers spend the treatment weeknights near the unit." />
        </div>
        <div className="hero-stat">
          <span className="l">nights away per course, multi-session → single 8 Gy</span>
        </div>
        <p className="totals-lede">
          For a patient in any of the {far.length} municipalities more than {params.commute_threshold_km} km by road from a unit, home to {farPop.toLocaleString('en-GB')} people.
          <Prov kind="calculated" ids={['osrm_table', 'statfin_population', 'wikidata_coords']} note="Road distance from each municipality's centre point; population 31 Dec 2025." />
        </p>
        <p className="totals-foot">Per patient only: no national yearly count of bone radiotherapy courses is published.</p>
      </section>
    );
  }

  const v = leverOn ? year.removed : year.current;
  const patients = year.current.patients;
  return (
    <section className={`totals${leverOn ? ' on' : ''}${highlight ? ' highlight' : ''}`} aria-label="National yearly totals" data-testid="totals" data-box="totals">
      <p className="kicker">{leverOn ? 'Removed every year with 5 sessions' : 'Every year on 15 sessions'}</p>
      <p className="totals-lede" data-testid="totals-lede">
        {leverOn ? (
          <>
            Switching about <span className="num">{fmtRounded(patients)}</span> eligible breast patients a year to 5 sessions:
          </>
        ) : (
          <>
            About <span className="num">{fmtRounded(patients)}</span> eligible breast patients a year are still on 15 sessions. Between them:
          </>
        )}
        <Prov
          kind="calculated"
          ids={ids}
          note={`${data.cases.mainland_cases.toLocaleString('en-GB')} new cases in women on the mainland (${data.cases.year}) × share treated with radiotherapy × share eligible × (1 − share already on 5 sessions), allocated to municipalities by age-weighted female population. Lever off: their yearly burden on 15 sessions. Lever on: what moving them to 5 sessions removes. Rounded to 3 significant figures.`}
        />
      </p>
      <div className="hero-stat" data-box="hero-stat">
        <span className="v">
          <Counter v={v.machineSessions} />
          <Prov kind="calculated" ids={ids} note={`Treatment sessions on the linear accelerator: patients × ${leverOn ? '(15 − 5) sessions freed' : '15 sessions'}.`} />
        </span>
        <span className="l">{leverOn ? 'radiotherapy machine sessions freed' : 'radiotherapy machine sessions'}</span>
      </div>
      <div className="stats3" data-box="stats3">
        <div>
          <div className="v">
            <Counter v={v.nights} />
            <Prov kind="calculated" ids={ids} note="Nights away: only patients beyond the commuting threshold stay near the unit." />
          </div>
          <div className="l">nights away</div>
        </div>
        <div>
          <div className="v">
            <Counter v={v.roundTrips} />
          </div>
          <div className="l">round trips</div>
        </div>
        <div>
          <div className="v">
            <Counter v={v.hours} />
          </div>
          <div className="l">hours on the road</div>
        </div>
      </div>
      <p className="totals-foot" data-testid="breast-cases">
        From {data.cases.national_cases.toLocaleString('en-GB')} new breast cancer cases in women in Finland ({data.cases.year}){casesMarker}.{' '}
        {goal && (
          <>
            {goal.short}
            <Prov kind="sourced" ids={goal.source_ids} note={`${goal.fi} — ${goal.en}`} />.
          </>
        )}
      </p>
    </section>
  );
}
