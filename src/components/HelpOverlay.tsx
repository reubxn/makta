const KEYS: [string, string][] = [
  ['1', 'Reset to all of Finland'],
  ['2', 'Select Utsjoki and zoom in'],
  ['3', 'Bone metastases: switch on a single 8 Gy session'],
  ['4', 'Breast: switch on 5 sessions for eligible patients'],
  ['5', 'Fly out to Finland and highlight the national totals'],
  ['6', 'Open What units say'],
  ['7', 'Open the Lapland county memo and write it'],
  ['0', 'Reset everything'],
  ['?', 'Show or hide this list'],
];

export function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="help" onClick={onClose}>
      <div className="help-card" onClick={(e) => e.stopPropagation()}>
        <h3>Keyboard shortcuts</h3>
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
