import { useCallback, useEffect, useRef, useState } from 'react';
import { loadData, type AppData } from './data';
import { DataContext } from './context';
import type { Indication, MetricKey, Params } from './model/metrics';
import { TopBar, type Tab } from './components/TopBar';
import { AssumptionsDrawer, Rail } from './components/LeftPanel';
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
  terrain: boolean;
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
    indication: 'breast',
    levers: { bone: false, breast: false },
    params: { ...data.defaults },
    metric: 'nights',
    selected: data.muniByCode[DEFAULT_MUNI] ? DEFAULT_MUNI : data.municipalities[0].code,
    terrain: false,
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
        update({ help: false, drawerOpen: false });
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
          update({ tab: 'map', highlightTotals: false, help: false, terrain: false });
          flyTo('finland');
          break;
        case '2':
          // Utsjoki, breast, 15 sessions: fly the road route to Oulu with 16 nights away in the card.
          setS((p) => ({ ...p, tab: 'map', selected: DEFAULT_MUNI, indication: 'breast', levers: { ...p.levers, breast: false }, terrain: false, highlightTotals: false, help: false, drawerOpen: false }));
          flyTo('flight', DEFAULT_MUNI);
          break;
        case '3':
          // Lead lever: breast. Journeys 4 -> 2 on the route, nights 16 -> 6 in the card.
          setS((p) => ({ ...p, tab: 'map', indication: 'breast', levers: { ...p.levers, breast: false }, highlightTotals: false, help: false }));
          later(1200, () => setS((p) => ({ ...p, levers: { ...p.levers, breast: true } })));
          break;
        case '4':
          setS((p) => ({ ...p, tab: 'map', indication: 'bone', levers: { ...p.levers, bone: false }, highlightTotals: false, help: false }));
          later(1000, () => setS((p) => ({ ...p, levers: { ...p.levers, bone: true } })));
          break;
        case '5':
          // Burden terrain: fly out, tilt, terrain rises on 15 sessions; then the breast lever sinks it.
          setS((p) => ({ ...p, tab: 'map', indication: 'breast', levers: { ...p.levers, breast: false }, terrain: true, fold: false, highlightTotals: true, help: false, drawerOpen: false }));
          flyTo('terrain');
          later(3400, () => setS((p) => ({ ...p, levers: { ...p.levers, breast: true } })));
          later(9000, () => update({ highlightTotals: false }));
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

  return (
    <div className="app" data-testid="app-ready">
      <TopBar tab={s.tab} onTab={(tab) => update({ tab })} />
      {s.tab === 'map' && (
        <main className="mapview" data-layer="base">
          <Rail s={s} update={update} />
          <MapPanel
            indication={s.indication}
            lever={lever}
            params={s.params}
            metric={s.metric}
            onMetric={(metric) => update({ metric })}
            selected={s.selected}
            onSelect={select}
            fly={fly}
            fold={s.fold}
            onFold={(fold) => update({ fold })}
            terrain={s.terrain}
            onTerrain={(terrain) => update({ terrain })}
          />
          <div className="right" data-box="right">
            <MunicipalityCard code={s.selected} indication={s.indication} lever={lever} params={s.params} />
            <TotalsStrip params={s.params} leverOn={s.levers.breast} boneLever={s.levers.bone} indication={s.indication} highlight={s.highlightTotals} />
          </div>
          {s.drawerOpen && <AssumptionsDrawer s={s} update={update} />}
        </main>
      )}
      {s.tab === 'units' && <UnitsTab params={s.params} onParam={(id, v) => setS((p) => ({ ...p, params: { ...p.params, [id]: v } }))} />}
      {s.tab === 'memo' && (
        <MemoTab county={s.memoCounty} run={s.memoRun} onCounty={(memoCounty) => update({ memoCounty })} onRun={() => setS((p) => ({ ...p, memoRun: p.memoRun + 1 }))} />
      )}
      {s.tab === 'sources' && <SourcesTab />}
      <footer className="footer" data-box="footer">
        <span className="markers" data-testid="marker-key">
          <b>S</b> sourced · <b>C</b> calculated · <b>A</b> assumption: click a marker for its sources
        </span>
        <span>Built at Junction 2026 for the AstraZeneca challenge. Public aggregate data only. Proposals for clinical teams to evaluate, not clinical advice.</span>
      </footer>
      {s.help && <HelpOverlay onClose={() => update({ help: false })} />}
    </div>
  );
}
