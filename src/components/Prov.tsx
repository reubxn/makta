import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink } from 'lucide-react';
import type { Kind } from '../data';
import { useData } from '../context';

const LABEL: Record<Kind, string> = { sourced: 'Sourced', calculated: 'Calc', assumption: 'Assumption' };
const LONG: Record<Kind, string> = {
  sourced: 'Sourced: taken directly from a cited source.',
  calculated: 'Calculated: derived by Matka from sourced data and the parameters shown.',
  assumption: 'Assumption: a modelling choice you can adjust in the Assumptions drawer.',
};

export function Prov({ kind, ids, note, children }: { kind: Kind; ids: string[]; note?: string; children?: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const { data } = useData();
  const sources = Array.from(new Set(ids.map((id) => data.sourceById[id]).filter(Boolean)));
  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const h = Math.min(400, window.innerHeight * 0.6);
    const x = Math.min(window.innerWidth - 396, Math.max(16, r.left - 180));
    const y = r.bottom + 6 + h > window.innerHeight - 40 ? Math.max(16, r.top - h - 6) : r.bottom + 6;
    setPos({ x, y });
  };
  return (
    <>
      <button
        type="button"
        className={`prov ${kind}`}
        data-testid="prov-badge"
        aria-label={`${LABEL[kind]}: show sources`}
        onClick={open}
      >
        {LABEL[kind]}
      </button>
      {pos &&
        createPortal(
        <>
          <div className="popover-backdrop" onClick={() => setPos(null)} />
          <div className="popover" style={{ left: pos.x, top: pos.y }} role="dialog">
            <h4>{LONG[kind]}</h4>
            {children}
            {note && <p className="meta" style={{ margin: '6px 0 0' }}>{note}</p>}
            {sources.map((s) => (
              <div className="src" key={s.id}>
                <div>
                  <b>[{s.id}]</b> {s.title}
                </div>
                <div className="meta">
                  {s.publisher}
                  {s.year ? `, ${s.year}` : ''} · accessed {s.accessed}
                </div>
                {s.quote && <blockquote>“{s.quote}”</blockquote>}
                {s.note && <div className="meta">{s.note}</div>}
                <a href={s.url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 13 }}>
                  Open source <ExternalLink size={12} />
                </a>
              </div>
            ))}
            {sources.length === 0 && <p className="meta">No external source: see the parameter rationale in Sources & limitations.</p>}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
