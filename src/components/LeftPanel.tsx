import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import type { UiState } from '../App';
import { useData } from '../context';
import type { Parameter } from '../data';
import type { Indication, Params } from '../model/metrics';
import { Prov } from './Prov';
import { FactText } from './FactText';

const INDICATIONS: [Indication, string][] = [
  ['bone', 'Painful bone metastases'],
  ['breast', 'Breast cancer'],
];

function fmtParam(p: Parameter, v: number): string {
  if (p.unit === 'share') return `${Math.round(v * 100)}%`;
  if (p.unit === '€/km') return `${v.toFixed(2)} €/km`;
  if (p.unit === '€') return `${v.toFixed(2)} €`;
  if (p.unit === 'km') return `${Math.round(v)} km`;
  return `${Math.round(v * 100) / 100}${p.unit ? ' ' + p.unit : ''}`;
}

export function ParamSlider({ p, value, onChange, highlight }: { p: Parameter; value: number; onChange: (v: number) => void; highlight?: boolean }) {
  return (
    <div className={`slider-row${highlight ? ' highlight' : ''}`}>
      <label htmlFor={`param-${p.id}`}>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {p.label} <Prov kind={p.kind} ids={p.source_ids} note={p.rationale} />
        </span>
        <span className="val num">{fmtParam(p, value)}</span>
      </label>
      <input
        id={`param-${p.id}`}
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function LeftPanel({ s, update }: { s: UiState; update: (p: Partial<UiState>) => void }) {
  const { data } = useData();
  const setParam = (id: keyof Params, v: number) => update({ params: { ...s.params, [id]: v } });
  const byId = Object.fromEntries(data.parameters.map((p) => [p.id, p]));
  const dial: keyof Params = s.indication === 'breast' ? 'breast_share_already_short' : 'bone_share_single_now';
  const lever = s.levers[s.indication];
  const leverLabel = s.indication === 'bone' ? 'Single 8 Gy session as default' : '5 sessions as default for eligible patients';
  const leverSub =
    s.indication === 'bone'
      ? `Instead of ${s.params.bone_fractions_multi} sessions. Retreatment included.`
      : `Instead of ${s.params.breast_fractions_long} sessions over three weeks.`;

  return (
    <aside className="panel left" aria-label="Controls">
      <div>
        <p className="section-label">Indication</p>
        <div className="segmented">
          {INDICATIONS.map(([id, label]) => (
            <button key={id} aria-pressed={s.indication === id} onClick={() => update({ indication: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="section-label">Lever</p>
        <button
          className="lever"
          role="switch"
          aria-checked={lever}
          data-testid="lever"
          onClick={() => update({ levers: { ...s.levers, [s.indication]: !lever } })}
        >
          <span className="lever-switch" aria-hidden />
          <span>
            <div className="lever-text">{leverLabel}</div>
            <div className="lever-sub">{leverSub}</div>
          </span>
        </button>
      </div>

      <div className="evidence">
        {s.indication === 'bone' ? <FactText id="evidence_bone" /> : <FactText id="evidence_breast" />}
      </div>

      {byId[dial] && (
        <ParamSlider p={byId[dial]} value={s.params[dial]} onChange={(v) => setParam(dial, v)} highlight />
      )}

      <div>
        <button className="drawer-toggle" onClick={() => update({ drawerOpen: !s.drawerOpen })} aria-expanded={s.drawerOpen}>
          Assumptions {s.drawerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {s.drawerOpen && (
        <div className="assumptions">
          {data.parameters
            .filter((p) => p.id !== dial)
            .map((p) => (
              <ParamSlider key={p.id} p={p} value={s.params[p.id]} onChange={(v) => setParam(p.id, v)} />
            ))}
          <button className="reset" onClick={() => update({ params: { ...data.defaults } })}>
            <RotateCcw size={14} /> Reset to defaults
          </button>
        </div>
      )}
    </aside>
  );
}
