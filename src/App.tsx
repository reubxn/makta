import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadData, type AppData } from './data';
import { DataContext } from './context';
import type { Indication, MetricKey, Params } from './model/metrics';
import { TopBar, type Tab } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { MapPanel, type FlyRequest } from './components/MapPanel';
import { MunicipalityCard } from './components/MunicipalityCard';
import { TotalsStrip } from './components/TotalsStrip';
import { SourcesTab } from './components/SourcesTab';
import { UnitsTab } from './components/UnitsTab';
import { MemoTab } from './components/MemoTab';
import { HelpOverlay } from './components/HelpOverlay';

export const DEFAULT_MUNI = '890'; // Utsjoki: northernmost municipality, longest route (see MORNING.md)
export const DEMO_MEMO_COUNTY = '21'; // Lapland

export interface UiState {
  tab: Tab;
  indication: Indication;
  levers: Record<Indication, boolean>;
  params: Params;
  metric: MetricKey;
  selected: string;
  pitched: boolean;
  highlightTotals: boolean;
  drawerOpen: boolean;
  memoCounty: string;
  memoRun: number;
  help: boolean;
  fold: boolean;
}

function initialState(data: AppData): UiState {
  return {
    tab: 'map',
    indication: 'bone',
    levers: { bone: false, breast: false },
    params: { ...data.defaults },
    metric: 'nights',
    selected: data.muniByCode[DEFAULT_MUNI] ? DEFAULT_MUNI : data.municipalities[0].code,
    pitched: true,
    highlightTotals: false,
    drawerOpen: false,
    memoCounty: DEMO_MEMO_COUNTY,
    memoRun: 0,
    help: false,
    fold: false,
  };
}

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadData().then(setData, (e) => setError(String(e)));
  }, []);
  if (error) return <div className="loading">Could not load data: {error}</div>;
  if (!data) return <div className="loading">Loading Matka…</div>;
  return (
    <DataContext.Provider value={{ data }}>
      <Matka data={data} />
    </DataContext.Provider>
  );
}

function Matka({ data }: { data: AppData }) {
  const [s, setS] = useState<UiState>(() => initialState(data));
  const [fly, setFly] = useState<FlyRequest>({ target: 'finland', nonce: 0 });
  const timers = useRef<number[]>([]);
  const update = useCallback((patch: Partial<UiState>) => setS((prev) => ({ ...prev, ...patch })), []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };
  const flyTo = useCallback((target: FlyRequest['target'], code?: string) => {
    setFly((f) => ({ target, code, nonce: f.nonce + 1 }));
  }, []);

  const select = useCallback(
    (code: string) => {
      update({ selected: code });
    },
    [update],
  );

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === 'Escape') {
        update({ help: false });
        return;
      }
      if (k === '?') {
        setS((p) => ({ ...p, help: !p.help }));
        return;
      }
      if (!/^[0-7]$/.test(k)) return;
      clearTimers();
      switch (k) {
        case '1':
          update({ tab: 'map', highlightTotals: false, help: false, pitched: true });
          flyTo('finland');
          break;
        case '2':
          update({ tab: 'map', selected: DEFAULT_MUNI, highlightTotals: false, help: false });
          flyTo('muni', DEFAULT_MUNI);
          break;
        case '3':
          setS((p) => ({ ...p, tab: 'map', indication: 'bone', levers: { ...p.levers, bone: false }, highlightTotals: false, help: false }));
          later(1000, () => setS((p) => ({ ...p, levers: { ...p.levers, bone: true } })));
          break;
        case '4':
          setS((p) => ({ ...p, tab: 'map', indication: 'breast', levers: { ...p.levers, breast: false }, highlightTotals: false, help: false }));
          later(1200, () => setS((p) => ({ ...p, levers: { ...p.levers, breast: true } })));
          break;
        case '5':
          update({ tab: 'map', highlightTotals: true, help: false });
          flyTo('finland');
          later(6000, () => update({ highlightTotals: false }));
          break;
        case '6':
          update({ tab: 'units', help: false });
          break;
        case '7':
          setS((p) => ({ ...p, tab: 'memo', memoCounty: DEMO_MEMO_COUNTY, memoRun: p.memoRun + 1, help: false }));
          break;
        case '0':
          setS(initialState(data));
          flyTo('finland');
          break;
      }
    },
    [data, flyTo, update],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);
  useEffect(() => () => clearTimers(), []);

  const lever = s.levers[s.indication];
  const view = useMemo(() => s.tab, [s.tab]);

  return (
    <div className="app" data-testid="app-ready">
      <TopBar tab={s.tab} onTab={(tab) => update({ tab })} />
      {view === 'map' && (
        <div className="mapview">
          <div className="main">
            <LeftPanel s={s} update={update} />
            <MapPanel
              indication={s.indication}
              lever={lever}
              params={s.params}
              metric={s.metric}
              onMetric={(metric) => update({ metric })}
              selected={s.selected}
              onSelect={select}
              pitched={s.pitched}
              onPitch={(pitched) => update({ pitched })}
              fly={fly}
              fold={s.fold}
              onFold={(fold) => update({ fold })}
            />
            <MunicipalityCard code={s.selected} indication={s.indication} lever={lever} params={s.params} />
          </div>
          <TotalsStrip params={s.params} leverOn={s.levers.breast} indication={s.indication} highlight={s.highlightTotals} />
        </div>
      )}
      {view === 'units' && <UnitsTab />}
      {view === 'memo' && (
        <MemoTab county={s.memoCounty} run={s.memoRun} onCounty={(memoCounty) => update({ memoCounty })} onRun={() => setS((p) => ({ ...p, memoRun: p.memoRun + 1 }))} />
      )}
      {view === 'sources' && <SourcesTab />}
      <footer className="footer">
        Built at Junction 2026 for the AstraZeneca challenge. Public aggregate data only. Proposals for clinical teams to evaluate, not clinical advice.
      </footer>
      {s.help && <HelpOverlay onClose={() => update({ help: false })} />}
    </div>
  );
}
