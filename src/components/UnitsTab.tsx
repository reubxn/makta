import { ExternalLink } from 'lucide-react';
import { useData } from '../context';
import type { UnitStatement } from '../data';
import { Prov } from './Prov';
import { ParamSlider } from './LeftPanel';
import type { Params } from '../model/metrics';

const clean = (s: string | null) => (s ?? '').replace(/­/g, '');

function altText(s: UnitStatement): string | null {
  const a = s.stated_alternatives;
  if (!a) return null;
  return Array.isArray(a) ? a.join(' or ').replace(/ sessions or (\d+) sessions/g, ' or $1 sessions') : a;
}

function Stated({ list, pagesFound, docIndex }: { list: UnitStatement[]; pagesFound: boolean; docIndex: (url: string) => number }) {
  if (!pagesFound) return <span className="small-note">No page found</span>;
  if (list.length === 0) return <span className="small-note">Not discussed</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {list.map((s, i) => {
        const alt = altText(s);
        return (
          <div key={i}>
            {s.stated_default_fractions != null ? (
              <b className="num">
                {s.stated_default_fractions} {s.stated_default_fractions === 1 ? 'session' : 'sessions'}
              </b>
            ) : alt ? (
              <b className="num">{alt}</b>
            ) : (
              <span className="small-note">No number stated</span>
            )}
            <Prov kind="sourced" ids={s.source_id ? [s.source_id] : []} note={`Page ${docIndex(s.url)}: what the unit's public page states (verbatim quote checked against the saved page).`} />
            {list.length > 1 && <div className="small-note">Page {docIndex(s.url)}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Quote({ s }: { s: UnitStatement }) {
  if (!s.quote_fi) return null;
  return (
    <div style={{ marginBottom: 8 }} title={`FI: ${clean(s.quote_fi)}\n\nEN: ${s.quote_en ?? ''}`}>
      <span className="pill">{s.indication === 'breast' ? 'Breast' : 'Bone / palliative'}</span>{' '}
      <span className="quote">“{s.quote_en ?? clean(s.quote_fi)}”</span>
      <div className="small-note" lang="fi">
        FI: “{clean(s.quote_fi)}”
      </div>
    </div>
  );
}

export function UnitsTab({ params, onParam }: { params: Params; onParam: (id: keyof Params, v: number) => void }) {
  const { data } = useData();
  const st = data.statements;
  if (!st) {
    return (
      <div className="page">
        <div className="page-inner">
          <h2>What units say</h2>
          <p className="lede">Unit statements have not been extracted yet.</p>
        </div>
      </div>
    );
  }
  const byParam = (id: keyof Params) => {
    const p = data.parameters.find((x) => x.id === id);
    return p ? <ParamSlider p={p} value={params[id]} onChange={(v) => onParam(id, v)} /> : null;
  };
  const byUnit: Record<string, UnitStatement[]> = {};
  for (const s of st.statements) (byUnit[s.unit_id] = byUnit[s.unit_id] ?? []).push(s);
  const nUnits = data.units.length;
  const unitsWith = (ind: 'breast' | 'bone', n: number) =>
    new Set(st.statements.filter((s) => s.indication === ind && s.stated_default_fractions === n).map((s) => s.unit_id)).size;
  const breast15 = unitsWith('breast', 15);
  const breast5 = unitsWith('breast', 5);
  const boneAny = new Set(st.statements.filter((s) => s.indication === 'bone' && s.stated_default_fractions != null).map((s) => s.unit_id)).size;
  const unitsWithPages = Object.keys(byUnit).length;
  // A unit "publishes which schedule it uses" if a public page states a usual session count for breast or bone.
  const publishing = new Set(st.statements.filter((s) => s.stated_default_fractions != null).map((s) => s.unit_id)).size;
  const breastConflict = st.statements.some(
    (s) => s.indication === 'breast' && s.stated_default_fractions == null && (Array.isArray(s.stated_alternatives) ? s.stated_alternatives.length > 1 : !!s.stated_alternatives),
  );
  const methodLabel = st.method === 'llm-api' ? `by AI (${st.model ?? 'Claude'}) via the API` : st.method === 'agent-extracted' ? 'by an AI agent in-session (no API key was available)' : st.method;
  const n = (k: number) => (k === 0 ? 'No' : String(k));

  return (
    <div className="page">
      <div className="page-inner">
        <div>
          <h2>What units say</h2>
          <p className="lede">
            Read {methodLabel} from {st.pages_read} public pages on {st.generated}. Quotes are verbatim and checked against the page text. Hover a row for the Finnish original.
          </p>
        </div>
        <div className="units-headline" data-testid="units-headline">
          <h3>
            {publishing} of {nUnits} units {publishing === 1 ? "publishes" : "publish"} which schedule they use.
          </h3>
          <p>
            The ask: every unit publishes its schedule mix, and radiotherapy use by distance band, every year.
            <Prov kind="calculated" ids={Array.from(new Set(st.statements.map((x) => x.source_id ?? '').filter(Boolean)))} note="Counted from the verified statements below: a unit counts if one of its public pages states a usual number of sessions for breast or bone radiotherapy. Units = the 12 public radiotherapy units." />
          </p>
        </div>
        <p className="summary-line" data-testid="units-summary">
          {breast15} of {nUnits} units state 15 sessions as the usual breast schedule{breastConflict ? ' (its own leaflet also says 5 or 15)' : ''}; {n(breast5).toLowerCase() === 'no' ? 'none' : breast5} state 5 as standard.{' '}
          {n(boneAny)} unit{boneAny === 1 ? '' : 's'} state a session count for painful bone metastases.
          <Prov kind="calculated" ids={Array.from(new Set(st.statements.map((x) => x.source_id ?? '').filter(Boolean)))} note="Counted from the verified statements below; units = the 12 public radiotherapy units." />
        </p>
        <div className="panel" style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <p className="section-label" style={{ marginBottom: 4 }}>So the current mix stays an assumption you can set:</p>
            {byParam('breast_share_already_short')}
          </div>
          <div style={{ paddingTop: 22 }}>{byParam('bone_share_single_now')}</div>
        </div>
        <p className="lede" style={{ marginTop: -8 }}>
          For {nUnits - unitsWithPages} of {nUnits} units, Matka found no public page stating a breast or bone schedule. That is why Matka shows the current mix as an adjustable assumption, and why the ask includes publishing the schedule mix every year.
        </p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Breast default as stated</th>
                <th>Bone default as stated</th>
                <th>Distance mentioned</th>
                <th style={{ width: '42%' }}>Quote</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {data.units.filter((u) => byUnit[u.id]).map((u) => {
                const all = byUnit[u.id] ?? [];
                const found = all.length > 0;
                const urls = Array.from(new Set(all.map((s) => s.url)));
                const dist = all.some((s) => s.distance_mentioned);
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.town}</b>
                      <div className="small-note">{u.hospital}</div>
                    </td>
                    <td>
                      <Stated list={all.filter((s) => s.indication === 'breast')} pagesFound={found} docIndex={(url) => urls.indexOf(url) + 1} />
                    </td>
                    <td>
                      <Stated list={all.filter((s) => s.indication === 'bone')} pagesFound={found} docIndex={(url) => urls.indexOf(url) + 1} />
                    </td>
                    <td>{found ? <span className={`pill${dist ? ' yes' : ''}`}>{dist ? 'Yes' : 'No'}</span> : '–'}</td>
                    <td>{all.map((s, i) => <Quote key={i} s={s} />)}</td>
                    <td>
                      {urls.map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginRight: 6, whiteSpace: 'nowrap' }}>
                          Page {i + 1} <ExternalLink size={11} />
                        </a>
                      ))}
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={6} style={{ background: 'var(--bg)' }}>
                  <b>No page found stating a breast or bone schedule ({data.units.filter((u) => !byUnit[u.id]).length} units):</b>{' '}
                  {data.units.filter((u) => !byUnit[u.id]).map((u) => u.town).join(', ')}.{' '}
                  <span className="small-note">Turku and Tampere are not verified: their patient-instruction sites could not be reached when Matka searched (see Sources &amp; limitations).</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
