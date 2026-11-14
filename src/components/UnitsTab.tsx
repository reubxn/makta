import { ExternalLink } from 'lucide-react';
import { useData } from '../context';
import type { UnitStatement } from '../data';

function stated(s: UnitStatement | undefined) {
  if (!s) return <span className="small-note">No public page found</span>;
  if (s.stated_default_fractions == null) return <span className="small-note">Not stated</span>;
  return <b className="num">{s.stated_default_fractions} {s.stated_default_fractions === 1 ? 'session' : 'sessions'}</b>;
}

function Quote({ s }: { s: UnitStatement }) {
  if (!s.quote_fi) return null;
  return (
    <div style={{ marginBottom: 6 }} title={`FI: ${s.quote_fi}\n\nEN: ${s.quote_en ?? ''}`}>
      <span className="pill">{s.indication === 'breast' ? 'Breast' : 'Bone'}</span>{' '}
      <span className="quote">“{s.quote_en ?? s.quote_fi}”</span>
      <div className="small-note" lang="fi">
        FI: “{s.quote_fi}”
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
  const byUnit: Record<string, { breast?: UnitStatement; bone?: UnitStatement }> = {};
  for (const s of st.statements) {
    byUnit[s.unit_id] = byUnit[s.unit_id] ?? {};
    byUnit[s.unit_id][s.indication] = s;
  }
  const breastStated = st.statements.filter((s) => s.indication === 'breast' && s.stated_default_fractions != null);
  const breast15 = breastStated.filter((s) => s.stated_default_fractions === 15).length;
  const breast5 = breastStated.filter((s) => s.stated_default_fractions === 5).length;
  const boneStated = st.statements.filter((s) => s.indication === 'bone' && s.stated_default_fractions != null);
  const bone1 = boneStated.filter((s) => s.stated_default_fractions === 1).length;
  const methodLabel = st.method === 'llm-api' ? `by AI (${st.model ?? 'Claude'})` : st.method === 'agent-extracted' ? 'by an AI agent in-session' : st.method;

  return (
    <div className="page">
      <div className="page-inner">
        <div>
          <h2>What units say</h2>
          <p className="lede">
            Read {methodLabel} from {st.pages_read} public pages on {st.generated}. Quotes are verbatim and checked against the page text. Hover a quote for the Finnish original.
          </p>
        </div>
        <p className="summary-line" data-testid="units-summary">
          {breast15} of {data.units.length} units state 15 sessions as the standard breast schedule
          {breast5 > 0 ? `, ${breast5} state 5 sessions` : ''}. {bone1} of {data.units.length} state a single session for painful bone metastases.
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
              {data.units.map((u) => {
                const r = byUnit[u.id] ?? {};
                const all = [r.breast, r.bone].filter(Boolean) as UnitStatement[];
                const dist = all.some((s) => s.distance_mentioned);
                return (
                  <tr key={u.id}>
                    <td>
                      <b>{u.town}</b>
                      <div className="small-note">{u.hospital}</div>
                    </td>
                    <td>{stated(r.breast)}</td>
                    <td>{stated(r.bone)}</td>
                    <td>{all.length ? <span className={`pill${dist ? ' yes' : ''}`}>{dist ? 'Yes' : 'No'}</span> : '–'}</td>
                    <td>{all.map((s) => <Quote key={s.indication} s={s} />)}</td>
                    <td>
                      {Array.from(new Set(all.map((s) => s.url))).map((url, i) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 3, alignItems: 'center', marginRight: 6 }}>
                          Page {i + 1} <ExternalLink size={11} />
                        </a>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
