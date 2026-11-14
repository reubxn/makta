const KEYS: [string, string][] = [
  ['1', 'All of Finland: every municipality joined to its unit by road'],
  ['2', 'Utsjoki: fly the 676 km road route to Oulu'],
  ['3', 'Breast: switch on 5 sessions for eligible patients (trips 4 → 2, nights 16 → 6)'],
  ['4', 'Bone metastases: switch on a single 8 Gy session'],
  ['5', 'Burden terrain: fly out and tilt, then switch on the breast lever'],
  ['6', 'Open What units say'],
  ['7', 'Open the Lapland county memo and write it'],
  ['0', 'Reset everything'],
  ['?', 'Show or hide this list'],
];

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="help" onClick={onClose} data-layer="help">
      <div className="help-card" onClick={(e) => e.stopPropagation()} data-box="help">
        <h3>Demo keys</h3>
        <dl>
          {KEYS.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>
                <kbd>{k}</kbd>
              </dt>
              <dd style={{ margin: 0 }}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
