import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useData } from '../context';
import type { Source } from '../data';

/** The whole memo streams in this long, whatever its length. */
const STREAM_MS = 4000;
const CITE = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;

/** Citation ids in order of first use. */
function citeOrder(text: string): string[] {
  const order: string[] = [];
  for (const m of text.matchAll(CITE)) for (const id of m[1].split(/\s*,\s*/)) if (!order.includes(id)) order.push(id);
  return order;
}

export function MemoTab({ county, run, onCounty, onRun }: { county: string; run: number; onCounty: (c: string) => void; onRun: () => void }) {
  const { data } = useData();
  const memos = data.memos;
  const memo = memos?.memos.find((m) => m.county_code === county);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!memo || run === 0) {
      setShown(memo ? memo.text.length : 0);
      return;
    }
    setShown(0);
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / STREAM_MS);
      setShown(Math.round(u * memo.text.length));
      if (u < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [memo, run]);

  const counties = useMemo(() => Object.entries(data.countyNames).sort((a, b) => a[1].localeCompare(b[1], 'fi')), [data.countyNames]);
  const order = useMemo(() => (memo ? citeOrder(memo.text) : []), [memo]);
  const done = !!memo && shown >= memo.text.length;
  // Hide a half-typed citation; list sources as they are first cited.
  const visible = memo ? memo.text.slice(0, shown).replace(/\[[^\]]*$/, '') : '';
  const citedSoFar = citeOrder(visible);
  const sources = citedSoFar.map((id) => ({ id, n: order.indexOf(id) + 1, s: data.sourceById[id] as Source | undefined }));

  return (
    <div className="page">
      <div className="page-inner">
        <div>
          <h2>County memo</h2>
          <p className="lede">
            A short action memo for each wellbeing services county's director of cancer services. Pre-generated; every number is checked against the facts given to the writer.
          </p>
        </div>
        <div className="memo-layout">
          <div className="panel memo-controls">
            <label htmlFor="county" className="section-label" style={{ margin: 0 }}>
              Wellbeing services county
            </label>
            <select id="county" value={county} onChange={(e) => onCounty(e.target.value)}>
              {counties.map(([code, name]) => (
                <option key={code} value={code}>
                  {name.replace(/ wellbeing services county$/i, '')}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={onRun} disabled={!memo}>
              Write memo
            </button>
            {memos && (
              <div className="small-note" data-testid="memo-method">
                Written {memos.method === 'llm-api' ? `by ${memos.model ?? 'Claude'} via the API` : 'by an AI agent in-session (no API key was available), with the same prompt and validator'} on {memos.generated}. Proposals for clinical teams to evaluate.
              </div>
            )}
          </div>
          <article className="memo-paper" data-testid="memo">
            {!memo && <p className="small-note">No memo has been generated for this county yet.</p>}
            {memo && (
              <>
                <div className="memo-head">
                  <span>To: Director of cancer services, {data.countyNames[memo.county_code] ?? memo.county_name}</span>
                  {done && memo.validated === true && memo.numbers_passed === memo.numbers_checked && (
                    <span className="trace-badge" data-testid="trace-badge">
                      <CheckCircle2 size={14} /> {memo.numbers_passed} of {memo.numbers_checked} numbers traced to the sourced facts
                    </span>
                  )}
                </div>
                {done && memo.validated !== true && (
                  <div className="small-note" data-testid="memo-unvalidated">
                    This memo did not pass the number and citation check on its last run, so it is shown without the traced badge.
                  </div>
                )}
                <div className="memo-body">
                  {renderMemo(visible, order)}
                  {!done && <span className="caret" />}
                </div>
                {sources.length > 0 && (
                  <div className="memo-sources" data-testid="memo-sources">
                    <p className="section-label">Sources</p>
                    <ol>
                      {sources.map(({ id, n, s }) => (
                        <li key={id} value={n}>
                          {s ? (
                            <>
                              <b>{s.title}</b>. {s.publisher}
                              {s.year ? `, ${s.year}` : ''}.{' '}
                              <a href={s.url} target="_blank" rel="noreferrer">
                                Open
                              </a>{' '}
                              <span style={{ color: 'var(--ink-3)' }}>[{id}]</span>
                            </>
                          ) : (
                            <>[{id}]</>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

function renderMemo(text: string, order: string[]): ReactNode {
  const paras = text.split(/\n\n+/);
  return paras.map((para, pi) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const m of para.matchAll(CITE)) {
      // Drop the space before a citation so the superscript sits on the word.
      parts.push(para.slice(last, m.index).replace(/\s+$/, ''));
      const nums = m[1].split(/\s*,\s*/).map((id) => order.indexOf(id) + 1);
      parts.push(
        <sup key={`${pi}-${m.index}`} title={m[1]}>
          {nums.join(',')}
        </sup>,
      );
      last = m.index! + m[0].length;
    }
    parts.push(para.slice(last));
    return <p key={pi}>{parts}</p>;
  });
}
