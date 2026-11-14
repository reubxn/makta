export type Tab = 'map' | 'units' | 'memo' | 'sources';

const TABS: [Tab, string][] = [
  ['map', 'Map'],
  ['units', 'What units say'],
  ['memo', 'County memo'],
  ['sources', 'Sources & limitations'],
];

export function TopBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <header className="topbar">
      <div className="wordmark">
        <span className="wordmark-mark" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 32 32">
            <path d="M5 25V8l11 11L27 8v17" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </span>
        Matka
      </div>
      <div className="tagline">Same cancer, same treatment. Different distance.</div>
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
