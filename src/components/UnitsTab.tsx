import { ExternalLink } from 'lucide-react';
import { useData } from '../context';
import type { UnitStatement } from '../data';

const clean = (s: string | null) => (s ?? '').replace(/­/g, '');

function altText(s: UnitStatement): string | null {
  const a = s.stated_alternatives;
  if (!a) return null;
  return Array.isArray(a) ? a.join(', ') : a;
}

function Stated({ list, pagesFound }: { list: UnitStatement[]; pagesFound: boolean }) {
  if (!pagesFound) return <span className="small-note">No public page found</span>;
  if (list.length === 0) return <span className="small-note">Not discussed</span>;
  const withNum = list.filter((s) => s.stated_default_fractions != null);
  const alts = list.map(altText).filter(Boolean) as string[];
  return (
    <div>
      {withNum.length ? (
        <b className="num">
          {withNum[0].stated_default_fractions} {withNum[0].stated_default_fractions === 1 ? 'session' : 'sessions'}
        </b>
      ) : (
        <span className="small-note">No number stated</span>
      )}
      {alts.length > 0 && <div className="small-note">Also: {alts.join('; ')}</div>}
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

export function UnitsTab() {
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
  const byUnit: Record<string, UnitStatement[]> = {};
  for (const s of st.statements) (byUnit[s.unit_id] = byUnit[s.unit_id] ?? []).push(s);
  const nUnits = data.units.length;
  const unitsWith = (ind: 'breast' | 'bone', n: number) =>
    new Set(st.statements.filter((s) => s.indication === ind && s.stated_default_fractions === n).map((s) => s.unit_id)).size;
  const breast15 = unitsWith('breast', 15);
  const breast5 = unitsWith('breast', 5);
  const boneAny = new Set(st.statements.filter((s) => s.indication === 'bone' && s.stated_default_fractions != null).map((s) => s.unit_id)).size;
  const unitsWithPages = Object.keys(byUnit).length;
  const methodLabel = st.method === 'llm-api' ? `by AI (${st.model ?? 'Claude'})` : st.method === 'agent-extracted' ? 'by an AI agent' : st.method;
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
        <p className="summary-line" data-testid="units-summary">
          {breast15} of {nUnits} units state 15 sessions as the usual breast schedule; {n(breast5).toLowerCase() === 'no' ? 'none' : breast5} state 5 as standard.{' '}
          {n(boneAny)} unit{boneAny === 1 ? '' : 's'} state a session count for painful bone metastases.
        </p>
        <p className="lede" style={{ marginTop: -8 }}>
          {nUnits - unitsWithPages} of {nUnits} units have no reachable public patient page on these schedules. That is why Matka shows the current mix as an adjustable assumption, and why the ask includes publishing the schedule mix every year.
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
                const dist = all.some((s) => s.distance_mentioned);
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.town}</b>
                      <div className="small-note">{u.hospital}</div>
                    </td>
                    <td>
                      <Stated list={all.filter((s) => s.indication === 'breast')} pagesFound={found} />
                    </td>
                    <td>
                      <Stated list={all.filter((s) => s.indication === 'bone')} pagesFound={found} />
                    </td>
                    <td>{found ? <span className={`pill${dist ? ' yes' : ''}`}>{dist ? 'Yes' : 'No'}</span> : '–'}</td>
                    <td>{all.map((s, i) => <Quote key={i} s={s} />)}</td>
                    <td>
                      {Array.from(new Set(all.map((s) => s.url))).map((url, i) => (
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
                  <b>No reachable public page on these schedules ({data.units.filter((u) => !byUnit[u.id]).length} units):</b>{' '}
                  {data.units.filter((u) => !byUnit[u.id]).map((u) => u.town).join(', ')}.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
