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
}

const ROWS: RowDef[] = [
  { key: 'nights', label: 'Nights away', format: (v) => fmt(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1) },
  { key: 'roundTrips', label: 'Round trips', format: (v) => fmt(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1) },
  { key: 'hours', label: 'Hours on the road', format: fmtHours },
  { key: 'kelaEur', label: 'Kela travel cost, lower bound', format: (v) => fmt(v), suffix: '€' },
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
  const routeIds = [...data.routesMeta.source_ids, unit?.source_id ?? ''].filter(Boolean);
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
        <div className="card-sub">{m.county_name_fi}</div>
      </div>
      <div className="route-line">
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }}>
          <MapPin size={15} /> <b>{unit?.town ?? route.unit_id}</b>
        </span>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }} className="num">
          <Car size={15} /> {fmt(route.road_km)} km
        </span>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center' }} className="num">
          <Clock size={15} /> {Math.floor(route.drive_min / 60)} h {String(Math.round(route.drive_min % 60)).padStart(2, '0')} min
        </span>
        <Prov kind="calculated" ids={routeIds} note={`${data.routesMeta.note}${route.method === 'estimated' ? ' This route is ESTIMATED (OSRM unavailable).' : ''}`} />
      </div>
      <div className="ba-head">
        <span>
          {indication === 'bone' ? `${nLong} sessions → single session` : `${nLong} → ${nShort} sessions`}, per patient
        </span>
        <Prov kind="calculated" ids={Array.from(new Set(paramIds))} note={calcNote} />
      </div>
      {ROWS.map((r) => (
        <div className="ba-row" key={r.key}>
          <div className="ba-label">{r.label}</div>
          <div className="ba-values">
            <Tweened v={before[r.key]} format={r.format} className={`big before${lever ? ' dim' : ''}`} />
            <ArrowRight className="arrow" size={22} />
            <Tweened v={after[r.key]} format={r.format} className={`big ${lever ? 'after' : 'dim'}`} />
            {r.suffix && <span className="unit-suffix">{r.suffix}</span>}
          </div>
        </div>
      ))}
      <div className="small-note">
        Today, with the assumed {Math.round(shareNow * 100)}% already on the short schedule: about{' '}
        <b className="num">{fmt(today.nights, 1)}</b> nights away per patient.{' '}
        <Prov kind="assumption" ids={data.parameters.find((p) => p.id === (indication === 'bone' ? 'bone_share_single_now' : 'breast_share_already_short'))?.source_ids ?? []} note="The real current schedule mix in Finland is not public." />
        <br />
        Kela cost is a lower bound (own-car rate; taxis cost more).
      </div>
    </aside>
  );
}
