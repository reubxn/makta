import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, PenLine } from 'lucide-react';
import { useData } from '../context';

const CHARS_PER_TICK = 3;
const TICK_MS = 16;

export function MemoTab({ county, run, onCounty, onRun }: { county: string; run: number; onCounty: (c: string) => void; onRun: () => void }) {
  const { data } = useData();
  const memos = data.memos;
  const memo = memos?.memos.find((m) => m.county_code === county);
  const [shown, setShown] = useState(0);
  const [openSrc, setOpenSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!memo || run === 0) {
      setShown(memo ? memo.text.length : 0);
      return;
    }
    setShown(0);
    let i = 0;
    const t = setInterval(() => {
      i += CHARS_PER_TICK;
      setShown(Math.min(i, memo.text.length));
      if (i >= memo.text.length) clearInterval(t);
    }, TICK_MS);
    return () => clearInterval(t);
  }, [memo, run]);

  const counties = useMemo(
    () => Object.entries(data.countyNames).sort((a, b) => a[1].localeCompare(b[1], 'fi')),
    [data.countyNames],
  );

  const body = memo ? renderMemo(memo.text.slice(0, shown), (id) => setOpenSrc(id)) : null;
  const src = openSrc ? data.sourceById[openSrc] : null;

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
                  {name}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={onRun} disabled={!memo}>
              <PenLine size={16} /> Write memo
            </button>
            {memos && (
              <div className="small-note">
                Written {memos.method === 'llm-api' ? `by ${memos.model ?? 'Claude'} via the API` : 'by an AI agent in-session'} on {memos.generated}. Proposals for clinical teams to evaluate.
              </div>
            )}
            {src && (
              <div className="src" style={{ borderTop: '1px solid var(--line)', paddingTop: 10, fontSize: 13.5 }}>
                <b>[{src.id}]</b> {src.title}
                <div className="small-note">
                  {src.publisher}
                  {src.year ? `, ${src.year}` : ''}
                </div>
                {src.quote && <div className="quote" style={{ margin: '4px 0' }}>“{src.quote}”</div>}
                <a href={src.url} target="_blank" rel="noreferrer">
                  Open source
                </a>
              </div>
            )}
          </div>
          <article className="panel memo-paper" data-testid="memo">
            {!memo && <p className="small-note">No memo has been generated for this county yet.</p>}
            {memo && (
              <>
                <div className="memo-head">
                  <div className="small-note">To: Director of cancer services, {memo.county_name}</div>
                  {shown >= memo.text.length && (
                    <span className="trace-badge">
                      <CheckCircle2 size={15} /> {memo.numbers_passed} of {memo.numbers_checked} numbers traced to sources
                    </span>
                  )}
                </div>
                {body}
                {shown < memo.text.length && <span className="caret" />}
              </>
            )}
          </article>
        </div>
      </div>
    </div>
  );
}

function renderMemo(text: string, onSrc: (id: string) => void): ReactNode {
  return text.split(/\n\n+/).map((para, pi) => {
    const parts: ReactNode[] = [];
    const re = /\[(S\d+(?:\s*,\s*S\d+)*)\]/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(para))) {
      parts.push(para.slice(last, m.index));
      for (const id of m[1].split(/\s*,\s*/)) {
        parts.push(
          <button key={`${pi}-${m.index}-${id}`} className="src-chip" onClick={() => onSrc(id)}>
            {id}
          </button>,
        );
      }
      last = m.index + m[0].length;
    }
    parts.push(para.slice(last));
    return <p key={pi}>{parts}</p>;
  });
}
