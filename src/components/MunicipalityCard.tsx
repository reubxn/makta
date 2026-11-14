import { ArrowRight, Car, Clock, MapPin } from 'lucide-react';
import { useData } from '../context';
import { add, isCommuter, perPatient, scale, type Burden, type Indication, type Params } from '../model/metrics';
import { fmt, fmtHours, useTween } from '../hooks';
import { Prov } from './Prov';

interface RowDef {
  key: keyof Burden;
  label: string;
  format: (v: number) => string;
  suffix?: string;
  sub?: string;
}

const ROWS: RowDef[] = [
  { key: 'nights', label: 'Nights away', format: (v) => fmt(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1) },
  { key: 'roundTrips', label: 'Round trips', format: (v) => fmt(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1) },
  { key: 'hours', label: 'Hours on the road', format: fmtHours },
  { key: 'kelaEur', label: 'Kela cost, lower bound', sub: 'own car; taxis cost more', format: (v) => fmt(v), suffix: '€' },
];

function Tweened({ v, format, className }: { v: number; format: (v: number) => string; className: string }) {
  const t = useTween(v, 800);
  return <span className={className}>{format(t)}</span>;
}

export function MunicipalityCard({ code, indication, lever, params }: { code: string; indication: Indication; lever: boolean; params: Params }) {
  const { data } = useData();
  const m = data.muniByCode[code];
  const route = data.routes[code];
  if (!m || !route) return <aside className="panel card">Select a municipality.</aside>;
  const unit = data.unitById[route.unit_id];
  const before = perPatient(route, indication, 'long', params);
  const after = perPatient(route, indication, 'short', params);
  const shareNow = indication === 'bone' ? params.bone_share_single_now : params.breast_share_already_short;
  const today = add(scale(before, 1 - shareNow), scale(after, shareNow));
  const commuter = isCommuter(route, params);
  const nLong = indication === 'bone' ? params.bone_fractions_multi : params.breast_fractions_long;
  const nShort = indication === 'bone' ? params.bone_fractions_single : params.breast_fractions_short;
  const routeIds = [...data.routesMeta.source_ids, unit?.source_id ?? '', route.basis_source ?? ''].filter(Boolean);
  const paramIds = data.parameters
    .filter((p) => p.id.startsWith(indication) || p.id.startsWith('kela') || p.id === 'commute_threshold_km' || p.id === 'planning_visit')
    .flatMap((p) => p.source_ids);
  const calcNote =
    `Per patient on a ${nLong}-session course (before) vs ${nShort}-session course (after), including one planning visit` +
    (indication === 'bone' ? ' and expected retreatment.' : '.') +
    (commuter ? ' Within the commuting threshold: travels daily.' : ' Beyond the commuting threshold: stays near the unit on treatment weeknights, home at weekends.');

  return (
    <aside className="panel card" aria-label="Selected municipality">
      <div>
        <h2 className="card-title" data-testid="card-title">
          {m.name_fi}
        </h2>
        <div className="card-sub">{m.county_name_en ?? m.county_name_fi}</div>
      </div>
      <div className="route-line">
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }} title={route.basis === 'county_catchment' ? 'The unit that serves this county, as its sources state' : 'Nearest radiotherapy unit by drive time'}>
          <MapPin size={15} /> <b>{unit?.town ?? route.unit_id}</b>
        </span>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }} className="num">
          <Car size={15} /> {fmt(route.road_km)} km
        </span>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }} className="num">
          <Clock size={15} /> {Math.floor(route.drive_min / 60)} h {String(Math.round(route.drive_min % 60)).padStart(2, '0')} min
        </span>
        <span className="route-micro">{route.basis === 'county_catchment' ? 'Serves the county' : 'Nearest by drive'} · from centre point</span>
        <Prov kind="calculated" ids={routeIds} note={`${route.basis === 'county_catchment' ? 'Routed to the unit that serves this county, as its sources state.' : 'Routed to the nearest unit by drive time (an assumption, not a referral rule).'} ${data.routesMeta.note}${route.method === 'estimated' ? ' This route is ESTIMATED (OSRM unavailable).' : ''}`} />
      </div>
      <div className="ba-head">
        <span>
          {indication === 'bone' ? `${nLong} sessions → single session` : `${nLong} → ${nShort} sessions`}, per patient
        </span>
        <Prov kind="calculated" ids={Array.from(new Set(paramIds))} note={calcNote} />
      </div>
      <div className="small-note today-note">
        Today, if {Math.round(shareNow * 100)}% already get the short schedule: <b className="num">{fmt(today.nights, 1)}</b> nights away.{' '}
        <Prov kind="assumption" ids={data.parameters.find((p) => p.id === (indication === 'bone' ? 'bone_share_single_now' : 'breast_share_already_short'))?.source_ids ?? []} note="The real current schedule mix in Finland is not public." />
      </div>
      {ROWS.map((r) => {
        const diff = after[r.key] - before[r.key];
        const up = diff > 0.05;
        const label = r.key === 'kelaEur' ? 'Own-car rate plus overnight allowance; taxis cost more, so this is a lower bound.' : undefined;
        return (
          <div className="ba-row" key={r.key}>
            <div className="ba-label" title={label}>
              {r.label}
              {r.sub && <span className="label-sub">({r.sub})</span>}
              {up && lever && <span className="up-note">↑ {r.format(diff)} (retreatment)</span>}
            </div>
            {lever ? (
              <div className="ba-values">
                <Tweened v={before[r.key]} format={r.format} className="big before dim" />
                <ArrowRight className="arrow" size={22} />
                <Tweened v={after[r.key]} format={r.format} className={`big ${up ? 'before' : 'after'}`} />
                {r.suffix && <span className="unit-suffix">{r.suffix}</span>}
              </div>
            ) : (
              <div className="ba-values">
                <Tweened v={before[r.key]} format={r.format} className="big before" />
                {r.suffix && <span className="unit-suffix">{r.suffix}</span>}
                <span className="after-hint" title={`With ${indication === 'bone' ? 'a single session' : `${nShort} sessions`}`}>→ {r.format(after[r.key])}{r.suffix ? ` ${r.suffix}` : ''} if short</span>
              </div>
            )}
          </div>
        );
      })}
      {lever && indication === 'bone' && before.roundTrips - after.roundTrips < 0.5 && (
        <div className="bone-up-note" data-testid="bone-note">Fewer nights away; trips about the same, because some patients need a second session.</div>
      )}
    </aside>
  );
}
