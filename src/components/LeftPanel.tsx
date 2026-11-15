import type { UiState } from '../App';
import { useData } from '../context';
import type { Parameter } from '../data';
import { add, perPatient, scale, type Indication, type Params } from '../model/metrics';
import { fmt } from '../hooks';
import { Prov } from './Prov';
import { FactText } from './FactText';

const INDICATIONS: [Indication, string][] = [
  ['breast', 'Breast'],
  ['bone', 'Bone metastases'],
];

function fmtParam(p: Parameter, v: number): string {
  if (p.unit === 'share') return `${Math.round(v * 100)}%`;
  if (p.unit === '€/km') return `${v.toFixed(2)} €/km`;
  if (p.unit === '€') return `${v.toFixed(2)} €`;
  if (p.unit === 'km') return `${Math.round(v)} km`;
  const n = Math.round(v * 100) / 100;
  const unit = n === 1 && p.unit.endsWith('s') ? p.unit.slice(0, -1) : p.unit;
  return `${n}${unit ? ' ' + unit : ''}`;
}

export function ParamSlider({ p, value, onChange, className }: { p: Parameter; value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <div className={`slider-row${className ? ' ' + className : ''}`}>
      <label htmlFor={`param-${p.id}`}>
        <span>
          {p.label}
          <Prov kind={p.kind} ids={p.source_ids} note={p.rationale} />
        </span>
        <span className="val num">{fmtParam(p, value)}</span>
      </label>
      <input id={`param-${p.id}`} type="range" min={p.min} max={p.max} step={p.step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function leverCopy(indication: Indication, params: Params) {
  return indication === 'bone'
    ? { label: 'Single 8 Gy session as default', sub: `Instead of ${params.bone_fractions_multi} sessions. Uncomplicated painful bone metastases.` }
    : { label: '5 sessions as default for eligible patients', sub: `Instead of ${params.breast_fractions_long} over three weeks. Whole breast or chest wall, no nodes.` };
}

/** Narrow left rail: indication, the lever, one line of evidence, the drawer toggle. */
export function Rail({ s, update }: { s: UiState; update: (p: Partial<UiState>) => void }) {
  const lever = s.levers[s.indication];
  const copy = leverCopy(s.indication, s.params);
  return (
    <aside className="rail" aria-label="Controls" data-box="rail">
      <div className="rail-block">
        <p className="kicker">Indication</p>
        <div className="texttabs" role="group" aria-label="Indication">
          {INDICATIONS.map(([id, label]) => (
            <button key={id} className="texttab" aria-pressed={s.indication === id} onClick={() => update({ indication: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rail-block">
        <p className="kicker">The lever</p>
        <button className="lever" role="switch" aria-checked={lever} data-testid="lever" onClick={() => update({ levers: { ...s.levers, [s.indication]: !lever } })}>
          <span className="lever-track" aria-hidden />
          <span>
            <span className="lever-text" style={{ display: 'block' }}>{copy.label}</span>
            <span className="lever-sub" style={{ display: 'block' }}>{copy.sub}</span>
          </span>
        </button>
        <p className="evidence" data-box="evidence">
          <FactText id={s.indication === 'bone' ? 'evidence_bone_short' : 'evidence_breast_short'} />
        </p>
      </div>

      <button className="drawer-open" aria-expanded={s.drawerOpen} onClick={() => update({ drawerOpen: !s.drawerOpen })} data-testid="assumptions-toggle">
        <span>Assumptions</span>
        <span>{s.drawerOpen ? 'Close' : 'Open'}</span>
      </button>

      <div className="rail-foot">
        Press <kbd>?</kbd> for the demo keys
      </div>
    </aside>
  );
}

/** All sliders, the "today" line and Reset, as an overlay over the map edge. */
export function AssumptionsDrawer({ s, update }: { s: UiState; update: (p: Partial<UiState>) => void }) {
  const { data } = useData();
  const setParam = (id: keyof Params, v: number) => update({ params: { ...s.params, [id]: v } });
  const byId = Object.fromEntries(data.parameters.map((p) => [p.id, p]));
  const dial: keyof Params = s.indication === 'breast' ? 'breast_share_already_short' : 'bone_share_single_now';
  const route = data.routes[s.selected];
  const m = data.muniByCode[s.selected];
  const shareNow = s.params[dial];
  const today = route
    ? add(scale(perPatient(route, s.indication, 'long', s.params), 1 - shareNow), scale(perPatient(route, s.indication, 'short', s.params), shareNow))
    : null;
  const keyIds: (keyof Params)[] = s.indication === 'breast' ? [dial, 'breast_share_eligible_short'] : [dial];
  return (
    <section className="drawer" aria-label="Assumptions" data-layer="drawer" data-box="drawer" data-testid="drawer">
      <div className="drawer-head">
        <h3>Assumptions</h3>
        <button className="drawer-close" onClick={() => update({ drawerOpen: false })}>
          Close
        </button>
      </div>
      {today && m && (
        <p className="today" data-testid="today-line">
          Today, if {Math.round(shareNow * 100)}% already get the short schedule
          <Prov kind="assumption" ids={byId[dial]?.source_ids ?? []} note="The real current schedule mix in Finland is not public." />, a patient from {m.name_fi} spends{' '}
          <b className="num">{fmt(today.nights, 1)}</b> nights away on average.
          <Prov kind="calculated" ids={data.routesMeta.source_ids} note="Weighted average of the long and short schedule for this municipality, using the share already on the short schedule." />
        </p>
      )}
      {keyIds.map((id) => byId[id] && <ParamSlider key={id} p={byId[id]} value={s.params[id]} onChange={(v) => setParam(id, v)} className="key" />)}
      {data.parameters
        .filter((p) => !keyIds.includes(p.id))
        .map((p) => (
          <ParamSlider key={p.id} p={p} value={s.params[p.id]} onChange={(v) => setParam(p.id, v)} />
        ))}
      <button className="reset" onClick={() => update({ params: { ...data.defaults } })}>
        Reset to defaults
      </button>
    </section>
  );
}
