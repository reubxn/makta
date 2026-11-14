import { ExternalLink } from 'lucide-react';
import { useData } from '../context';
import { Prov } from './Prov';

function fmtDefault(unit: string, v: number) {
  if (unit === 'share') return `${Math.round(v * 100)}%`;
  return `${v}${unit ? ' ' + unit : ''}`;
}

export function SourcesTab() {
  const { data } = useData();
  return (
    <div className="page">
      <div className="page-inner">
        <div>
          <h2>Sources & limitations</h2>
          <p className="lede">
            Every number in Matka comes from a file in the app's data folder and is labelled sourced, calculated or assumption. Sources were accessed in November 2026.
          </p>
        </div>

        <section>
          <h3>Limitations</h3>
          <ul className="limits">
            {data.limitations.map((l) => (
              <li key={l.title}>
                <b>{l.title}</b>
                <span className="small-note" style={{ fontSize: 14 }}>
                  {l.text}
                </span>
                {l.source_ids && l.source_ids.length > 0 && (
                  <span className="meta" style={{ fontSize: 12.5, color: 'var(--muted)' }}> [{l.source_ids.map((id) => data.sourceById[id]?.id ?? id).join(', ')}]</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Parameters</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Default</th>
                  <th>Range</th>
                  <th>Kind</th>
                  <th>Rationale</th>
                  <th>Sources</th>
                </tr>
              </thead>
              <tbody>
                {data.parameters.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <b>{p.label}</b>
                      <div className="small-note">{p.id}</div>
                    </td>
                    <td className="num">{fmtDefault(p.unit, p.default)}</td>
                    <td className="num">
                      {fmtDefault(p.unit, p.min)} – {fmtDefault(p.unit, p.max)}
                    </td>
                    <td>
                      <Prov kind={p.kind} ids={p.source_ids} note={p.rationale} />
                    </td>
                    <td style={{ maxWidth: 420 }}>{p.rationale}</td>
                    <td>{p.source_ids.map((id) => data.sourceById[id]?.id ?? id).join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3>Sources</h3>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Id</th>
                  <th>Source</th>
                  <th>Supports</th>
                  <th>Quote</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map((s) => (
                  <tr key={s.id} id={`src-${s.id}`}>
                    <td>
                      <b>{s.id}</b>
                    </td>
                    <td style={{ maxWidth: 340 }}>
                      <a href={s.url} target="_blank" rel="noreferrer">
                        {s.title} <ExternalLink size={11} />
                      </a>
                      <div className="small-note">
                        {s.publisher}
                        {s.year ? `, ${s.year}` : ''} · accessed {s.accessed}
                      </div>
                    </td>
                    <td style={{ maxWidth: 300 }}>{s.supports}</td>
                    <td style={{ maxWidth: 360 }}>
                      {s.quote ? <span className="quote">“{s.quote}”</span> : <span className="small-note">Data source</span>}
                      {s.note && <div className="small-note">{s.note}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
