import { useData } from '../context';
import { isCommuter, perPatient, type Burden, type Indication, type Params } from '../model/metrics';
import { fmt, fmtHours, useTween } from '../hooks';
import { Prov } from './Prov';

const WEEK_WORDS = ['', 'one week', 'two weeks', 'three weeks', 'four weeks', 'five weeks', 'six weeks'];
const weeks = (n: number) => WEEK_WORDS[Math.ceil(n / 5)] ?? `${Math.ceil(n / 5)} weeks`;

export function fmtDrive(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return m === 60 ? `${h + 1} h 00 min` : `${h} h ${String(m).padStart(2, '0')} min`;
}

interface RowDef {
  key: keyof Burden;
  label: string;
  format: (v: number) => string;
  suffix?: string;
}

const oneDp = (v: number) => fmt(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1);
const ROWS: RowDef[] = [
  { key: 'nights', label: 'Nights away', format: oneDp },
  { key: 'roundTrips', label: 'Round trips', format: oneDp },
  { key: 'hours', label: 'Hours on the road', format: fmtHours },
  { key: 'kelaEur', label: 'Kela €, at least', format: (v) => fmt(v) },
];

function Tweened({ v, format }: { v: number; format: (v: number) => string }) {
  const t = useTween(v, 800);
  return <>{format(t)}</>;
}

const MOON = 'M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z';

function Moon({ fill, color }: { fill: number; color: string }) {
  return (
    <span className="night" aria-hidden>
      <svg viewBox="0 0 24 24">
        <path d={MOON} fill="none" stroke="#c9cdcd" strokeWidth="1.5" />
      </svg>
      <span className="fill" style={{ width: `${Math.max(0, Math.min(1, fill)) * 100}%` }}>
        <svg viewBox="0 0 24 24">
          <path d={MOON} fill={color} stroke={color} strokeWidth="1.5" />
        </svg>
      </span>
    </span>
  );
}

/** One icon per night away on the long schedule; with the lever on, removed nights fade to an outline. */
export function NightIcons({ before, after, lever }: { before: number; after: number; lever: boolean }) {
  const shown = useTween(lever ? after : before, 900);
  const slots = Math.ceil(before - 1e-6);
  if (slots <= 0) return <span className="nights-none">No nights away: travels in for each session.</span>;
  return (
    <span className="nights" data-testid="night-icons" data-nights={oneDp(lever ? after : before)} aria-label={`${oneDp(lever ? after : before)} nights away`}>
      {Array.from({ length: slots }, (_, i) => (
        // Only the nights that remain turn teal; removed ones drain in graphite to an outline.
        <Moon key={i} fill={shown - i} color={lever && i < after - 1e-6 ? '#00626a' : '#3c4242'} />
      ))}
    </span>
  );
}

export function MunicipalityCard({ code, indication, lever, params }: { code: string; indication: Indication; lever: boolean; params: Params }) {
  const { data } = useData();
  const m = data.muniByCode[code];
  const route = data.routes[code];
  if (!m || !route) return <section className="card">Select a municipality on the map.</section>;
  const unit = data.unitById[route.unit_id];
  const before = perPatient(route, indication, 'long', params);
  const after = perPatient(route, indication, 'short', params);
  const commuter = isCommuter(route, params);
  const nLong = indication === 'bone' ? params.bone_fractions_multi : params.breast_fractions_long;
  const nShort = indication === 'bone' ? params.bone_fractions_single : params.breast_fractions_short;
  const routeIds = [...data.routesMeta.source_ids, unit?.source_id ?? '', route.basis_source ?? ''].filter(Boolean);
  const paramIds = data.parameters
    .filter((p) => p.id.startsWith(indication) || p.id.startsWith('kela') || p.id === 'commute_threshold_km' || p.id === 'planning_visit')
    .flatMap((p) => p.source_ids);
  const thresholdParam = data.parameters.find((p) => p.id === 'commute_threshold_km');
  const calcNote =
    `Per patient on a ${nLong}-session course vs a ${nShort}-session course, including one planning visit` +
    (indication === 'bone' ? ' and expected retreatment.' : '.') +
    ' Kela: own-car rate plus overnight allowance; taxis cost more, so this is a lower bound.';
  const plain =
    indication === 'bone'
      ? `One patient from ${m.name_fi}: ${nLong} sessions in ${weeks(nLong)}, or ${nShort === 1 ? 'a single session' : `${nShort} sessions`}.`
      : `One patient from ${m.name_fi}: ${nLong} sessions over ${weeks(nLong)}, or ${nShort} in ${weeks(nShort)}.`;
  const unitName = unit?.town === 'Helsinki' ? 'HUS, Helsinki' : (unit?.town ?? route.unit_id);
  const tripsFlat = indication === 'bone' && lever && before.roundTrips - after.roundTrips < 0.5;

  return (
    <section className="card" aria-label="Selected municipality" data-box="card" data-testid="card">
      <p className="kicker">Selected municipality</p>
      <h2 className="card-title" data-testid="card-title" data-box="card-title">
        {m.name_fi}
      </h2>
      <div className="card-sub">{m.county_name_en ?? m.county_name_fi}</div>
      <div className="route" data-box="route" data-testid="route-line">
        To <b>{unitName}</b> · <span className="num">{fmt(route.road_km)} km</span> · <span className="num">{fmtDrive(route.drive_min)}</span>
        <Prov
          kind="calculated"
          ids={routeIds}
          note={`${route.basis === 'county_catchment' ? 'Routed to the unit that serves this county, as its sources state.' : 'Routed to the nearest unit by drive time (an assumption, not a referral rule).'} ${data.routesMeta.note}${route.method === 'estimated' ? ' This route is ESTIMATED (OSRM unavailable).' : ''}`}
        />
      </div>
      <p className="plain" data-box="plain" data-testid="plain-line">
        {plain}
      </p>
      <p className="stay" data-box="stay">
        {commuter
          ? `Within ${params.commute_threshold_km} km by road, so travels in for every session.`
          : `More than ${params.commute_threshold_km} km by road, so stays near the unit on treatment weeknights.`}
        <Prov kind="assumption" ids={thresholdParam?.source_ids ?? []} note={thresholdParam?.rationale} />
      </p>
      <table className={`ba${lever ? ' on' : ''}`} data-box="ba-table" data-testid="ba-table">
        <colgroup>
          <col />
          <col className="vcol" />
          <col className="vcol" />
        </colgroup>
        <thead>
          <tr>
            <th>
              Per patient
              <Prov kind="calculated" ids={Array.from(new Set(paramIds))} note={calcNote} />
            </th>
            <th>
              <span className="th-n">{nLong}</span>
              <span className="th-u">sessions</span>
            </th>
            <th>
              <span className="th-n">{nShort === 1 ? '1' : nShort}</span>
              <span className="th-u">{nShort === 1 ? 'session' : 'sessions'}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => {
            const up = after[r.key] - before[r.key] > 0.05;
            return [
              <tr key={r.key}>
                <td className="l">{r.label}</td>
                <td className="v before">
                  <Tweened v={before[r.key]} format={r.format} />
                  {r.suffix && <small>{r.suffix}</small>}
                </td>
                <td className={`v after${up ? ' up' : ''}`}>
                  <Tweened v={after[r.key]} format={r.format} />
                  {r.suffix && <small>{r.suffix}</small>}
                </td>
              </tr>,
              r.key === 'nights' ? (
                <tr key="icons" className="icons">
                  <td colSpan={3}>
                    <NightIcons before={before.nights} after={after.nights} lever={lever} />
                  </td>
                </tr>
              ) : null,
            ];
          })}
        </tbody>
      </table>
      {tripsFlat && (
        <p className="ba-note" data-testid="bone-note">
          Fewer nights away; trips about the same, because some patients need a second session.
        </p>
      )}
    </section>
  );
}
