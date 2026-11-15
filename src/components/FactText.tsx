import { useData } from '../context';
import { Prov } from './Prov';

/** Renders a sourced statement from public/data/facts.json with its provenance badge. */
export function FactText({ id, className }: { id: string; className?: string }) {
  const { data } = useData();
  const f = data.facts[id];
  if (!f) return null;
  // Keep the last word and its marker together, and never break "non-inferior".
  const text = f.text.replace(/non-/g, 'non\u2011');
  const cut = text.lastIndexOf(' ');
  return (
    <span className={className}>
      {text.slice(0, cut + 1)}
      <span className="nowrap">
        {text.slice(cut + 1)}
        <Prov kind={f.kind} ids={f.source_ids} note={f.note} />
      </span>
    </span>
  );
}
