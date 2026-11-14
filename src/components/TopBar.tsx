export type Tab = 'map' | 'units' | 'memo' | 'sources';

const TABS: [Tab, string][] = [
  ['map', 'Map'],
  ['units', 'What units say'],
  ['memo', 'County memo'],
  ['sources', 'Sources & limitations'],
];

export function TopBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <header className="topbar" data-box="header">
      <div className="wordmark">
        <span className="wordmark-mark" aria-hidden />
        Matka
      </div>
      <div className="hero">Same cancer, same treatment. Different distance.</div>
      <nav className="tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" className="tab" aria-selected={tab === id} onClick={() => onTab(id)}>
            {label}
          </button>
        ))}
      </nav>
    </header>
  );
}
