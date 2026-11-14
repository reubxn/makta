import { useData } from '../context';
import { Prov } from './Prov';

/** Renders a sourced statement from public/data/facts.json with its provenance badge. */
export function FactText({ id, className }: { id: string; className?: string }) {
  const { data } = useData();
  const f = data.facts[id];
  if (!f) return null;
  return (
    <span className={className}>
      {f.text} <Prov kind={f.kind} ids={f.source_ids} note={f.note} />
    </span>
  );
}
