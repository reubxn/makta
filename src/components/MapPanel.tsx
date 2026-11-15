import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { AmbientLight, DirectionalLight, FlyToInterpolator, LightingEffect, MapView, WebMercatorViewport, type MapViewState, type PickingInfo } from '@deck.gl/core';
import { GeoJsonLayer, PathLayer } from '@deck.gl/layers';
import { useData } from '../context';
import { currentBurden, equivalentDistanceFraction, perPatient, tripDots, type Indication, type MetricKey, type Params } from '../model/metrics';
import { easeInOut, fmt, useTween } from '../hooks';
import { Prov } from './Prov';
import { fmtDrive } from './MunicipalityCard';

export interface FlyRequest {
  /** finland: flat national view; terrain: national view tilted 45°; flight: follow the selected route. */
  target: 'finland' | 'terrain' | 'flight';
  code?: string;
  nonce: number;
}

type LonLat = [number, number];
type BBox = [number, number, number, number];
type Mode = 'flat' | 'tilt45' | 'tilt40';

const FINLAND: MapViewState = { longitude: 25.8, latitude: 65.0, zoom: 4.4, pitch: 0, bearing: 0 };
const ELEV_PER_NIGHT = 6_500; // metres of "burden terrain" per night away per patient
const FLIGHT_ZOOM = 7.0;
const FLIGHT_PITCH = 55;
const FLY_IN_MS = 1200;
const FOLLOW_MS = 5000;
const TRIP_PERIOD_MS = 3600;

const WATER: [number, number, number] = [214, 226, 230];
const LAND: [number, number, number] = [238, 238, 235];
const RAMP_LO = [247, 246, 242];
const RAMP_HI = [180, 171, 154];
const TERRAIN_HI = [170, 160, 142];
function ramp(t: number, hi = RAMP_HI): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  return [0, 1, 2].map((i) => Math.round(RAMP_LO[i] + (hi[i] - RAMP_LO[i]) * x)) as [number, number, number];
}

// Stable layer props: new objects on every render would make deck.gl redraw on every React render.
const MAP_VIEW = new MapView({ repeat: false });
const CONTROLLER = { dragRotate: true, touchRotate: true };
const DECK_STYLE = { position: 'absolute', inset: '0' } as const;
const DEPTH_ALWAYS = { depthCompare: 'always' } as never;
const LAKES_TERRAIN = { depthCompare: 'less-equal', depthBias: -1, depthBiasSlopeScale: -4 } as never;
const MATERIAL = { ambient: 0.85, diffuse: 0.25, shininess: 4, specularColor: [0, 0, 0] as [number, number, number] };
// Soft, neutral light: tops stay close to the legend colour, walls a little darker.
const LIGHTING = [
  new LightingEffect({
    ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }),
    key: new DirectionalLight({ color: [255, 255, 255], intensity: 0.75, direction: [-1, -2, -3] }),
  }),
];
const MUNI_LINE: [number, number, number, number] = [255, 255, 255, 210];
const BORDER: [number, number, number] = [178, 184, 184];
const COUNTY_LINE: [number, number, number, number] = [60, 66, 66, 70];
const ROUTE_LINE: [number, number, number, number] = [60, 66, 66, 140];
const TEAL_A: [number, number, number, number] = [0, 98, 106, 255];
const CASING: [number, number, number, number] = [255, 255, 255, 230];
const GHOST: [number, number, number, number] = [0, 98, 106, 90];
const HIGHLIGHT: [number, number, number, number] = [0, 98, 106, 55];

const METRICS: [MetricKey, string][] = [
  ['nights', 'Nights away'],
  ['hours', 'Hours on the road'],
  ['roundTrips', 'Round trips'],
];

/* ---------- route geometry ---------- */
interface Geom {
  path: LonLat[];
  cum: number[];
  total: number;
}
function prep(path: LonLat[]): Geom {
  const cum = [0];
  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = path[i - 1];
    const [x2, y2] = path[i];
    const k = Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
    cum.push(cum[i - 1] + Math.hypot((x2 - x1) * k, y2 - y1));
  }
  return { path, cum, total: cum[cum.length - 1] || 1e-9 };
}
function locate(g: Geom, f: number): [number, number] {
  const d = Math.max(0, Math.min(1, f)) * g.total;
  let lo = 0;
  let hi = g.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g.cum[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = g.cum[hi] - g.cum[lo] || 1e-9;
  return [lo, (d - g.cum[lo]) / seg];
}
function pointAt(g: Geom, f: number): LonLat {
  if (g.path.length < 2) return g.path[0];
  const [i, t] = locate(g, f);
  const a = g.path[i];
  const b = g.path[Math.min(i + 1, g.path.length - 1)];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
function subPath(g: Geom, f0: number, f1: number): LonLat[] {
  if (f0 <= 0 && f1 >= 1) return g.path;
  const [i0] = locate(g, f0);
  const [i1] = locate(g, f1);
  return [pointAt(g, f0), ...g.path.slice(i0 + 1, i1 + 1), pointAt(g, f1)];
}
/** Compass heading of travel at fraction f (0 = north, clockwise), looking a little ahead. */
function headingAt(g: Geom, f: number, ahead = 0.035): number {
  const a = pointAt(g, Math.min(f, 1 - ahead));
  const b = pointAt(g, Math.min(1, Math.max(f, 0) + ahead));
  const k = Math.cos((a[1] * Math.PI) / 180);
  return (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI;
}
const wrap180 = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

function bboxOf(coords: unknown[]): BBox {
  const b: BBox = [180, 90, -180, -90];
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as number[];
      b[0] = Math.min(b[0], x);
      b[1] = Math.min(b[1], y);
      b[2] = Math.max(b[2], x);
      b[3] = Math.max(b[3], y);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  coords.forEach(visit);
  return b;
}

/** Fit a bbox into the map canvas. Never throws: tiny or unmeasured canvases fall back to a safe view. */
export function fitView(bbox: BBox, size: { width: number; height: number }, mode: Mode): MapViewState {
  const pitch = mode === 'flat' ? 0 : mode === 'tilt45' ? 45 : 40;
  const bearing = mode === 'tilt45' ? -12 : 0;
  const fallback: MapViewState = { ...FINLAND, pitch, bearing };
  if (!(size.width >= 80 && size.height >= 80)) return fallback;
  // fitBounds throws if the padding leaves no room: keep at least half of each dimension for the map.
  const pv = Math.min(28, size.height * 0.2);
  const ph = Math.min(28, size.width * 0.2);
  let fit: { longitude: number; latitude: number; zoom: number };
  try {
    const vp = new WebMercatorViewport({ width: size.width, height: size.height });
    fit = vp.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: { top: pv, bottom: pv, left: ph, right: ph } },
    );
  } catch {
    return fallback;
  }
  const { longitude, latitude, zoom } = fit;
  if (![longitude, latitude, zoom].every(Number.isFinite)) return fallback;
  if (!pitch) return { longitude, latitude, zoom, pitch: 0, bearing: 0 };
  // Pitching compresses the far (north) side: move the centre south and zoom in slightly.
  const latSpan = bbox[3] - bbox[1];
  return { longitude, latitude: latitude - latSpan * (mode === 'tilt45' ? 0.14 : 0.1), zoom: zoom + (mode === "tilt45" ? 0.2 : 0.15), pitch, bearing };
}

/* ---------- label placement ---------- */
interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const hit = (a: Box, b: Box, m = 2) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(s: string, px = 12): number {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return s.length * px * 0.6;
  measureCtx.font = `700 ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  return measureCtx.measureText(s).width;
}

/** Trip dots loop along the selected route (N = round trips per patient). DOM, so deck.gl does not redraw per frame. */
function RouteDots({ geom, viewState, size, n, flightS }: { geom: Geom; viewState: MapViewState; size: { width: number; height: number }; n: number; flightS: number | null }) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (flightS !== null) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 33) {
        last = t;
        setNow(t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [flightS]);
  const vp = useMemo(() => {
    try {
      return new WebMercatorViewport({ ...viewState, width: size.width, height: size.height });
    } catch {
      return null;
    }
  }, [viewState, size]);
  if (!vp) return null;
  const fr = flightS !== null ? [flightS] : Array.from({ length: n }, (_, i) => ((now % TRIP_PERIOD_MS) / TRIP_PERIOD_MS + i / n) % 1);
  return (
    <span data-testid="trip-dots" data-count={fr.length}>
      {fr.map((f, i) => {
        const [x, y] = vp.project(pointAt(geom, f));
        const r = flightS !== null ? 7 : 5;
        return <span key={i} className="tripdot" style={{ left: x - r, top: y - r, width: 2 * r, height: 2 * r }} />;
      })}
    </span>
  );
}

interface Props {
  indication: Indication;
  lever: boolean;
  params: Params;
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
  selected: string;
  onSelect: (code: string) => void;
  fly: FlyRequest;
  fold: boolean;
  onFold: (f: boolean) => void;
  terrain: boolean;
  onTerrain: (t: boolean) => void;
}

export function MapPanel(props: Props) {
  const { indication, lever, params, metric, selected, fly, fold, terrain } = props;
  const { data } = useData();
  const [viewState, setViewState] = useState<MapViewState>(FINLAND);
  const [hover, setHover] = useState<{ x: number; y: number; code: string } | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [flight, setFlight] = useState<{ code: string; s: number; flying: boolean } | null>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const anim = useRef<{ raf: number; timers: number[] }>({ raf: 0, timers: [] });
  const flightHeld = useRef<number | null>(null);
  const finlandBox = useMemo(() => bboxOf(data.geo.features.map((f) => (f.geometry as GeoJSON.Polygon).coordinates)), [data]);
  const geoms = useMemo(() => Object.fromEntries(Object.entries(data.routeLines).map(([c, r]) => [c, prep(r.path)])), [data]);
  const terrainK = useTween(terrain ? 1 : 0, 1400);
  const terrainOn = terrainK > 0.002;

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const cancelAnim = () => {
    cancelAnimationFrame(anim.current.raf);
    anim.current.timers.forEach((t) => clearTimeout(t));
    anim.current = { raf: 0, timers: [] };
  };
  useEffect(() => () => cancelAnim(), []);

  const flyTo = (v: MapViewState, ms: number) =>
    setViewState({ ...v, transitionDuration: ms, transitionInterpolator: new FlyToInterpolator({ curve: 1.25 }), transitionEasing: easeInOut } as MapViewState);

  const runFlight = (code: string) => {
    const g = geoms[code];
    if (!g || !size) return;
    const start = g.path[0];
    let bearing = headingAt(g, 0);
    setFlight({ code, s: 0, flying: true });
    flyTo({ longitude: start[0], latitude: start[1], zoom: FLIGHT_ZOOM, pitch: FLIGHT_PITCH, bearing }, FLY_IN_MS);
    anim.current.timers.push(
      window.setTimeout(() => {
        const t0 = performance.now();
        const step = (t: number) => {
          // Tests may hold the flight at a fraction to screenshot it: window.__matkaFlightHold = 0.45.
          const hold = (window as unknown as { __matkaFlightHold?: number }).__matkaFlightHold;
          const raw = Math.min(1, (t - t0) / FOLLOW_MS);
          const held = hold !== undefined && hold < 1 && raw >= hold;
          const u = held ? hold : raw;
          if (!(held && flightHeld.current === hold)) {
            const s = easeInOut(u);
            const p = pointAt(g, s);
            bearing += wrap180(headingAt(g, s) - bearing) * (held ? 1 : 0.07);
            setViewState({ longitude: p[0], latitude: p[1], zoom: FLIGHT_ZOOM, pitch: FLIGHT_PITCH, bearing });
            setFlight({ code, s, flying: u < 1 });
            flightHeld.current = held ? hold : null;
          }
          if (u < 1 || held) anim.current.raf = requestAnimationFrame(step);
          else flyTo(fitView(bboxOf(g.path), size, 'tilt40'), 1600);
        };
        anim.current.raf = requestAnimationFrame(step);
      }, FLY_IN_MS + 50),
    );
  };

  // Fly requests (demo keys) and the first layout.
  useEffect(() => {
    if (!size) return;
    cancelAnim();
    if (fly.target === 'flight' && fly.code) {
      runFlight(fly.code);
      return;
    }
    setFlight(null);
    const v = fitView(finlandBox, size, fly.target === 'terrain' ? 'tilt45' : 'flat');
    if (fly.nonce === 0) setViewState(v);
    else flyTo(v, fly.target === 'terrain' ? 1800 : 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly.nonce, size === null]);

  // Selecting another municipality drops the flight label.
  useEffect(() => {
    setFlight((f) => (f && f.code !== selected ? null : f));
  }, [selected]);

  /* ---------- per-municipality values ---------- */
  const valueByCode = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of data.municipalities) {
      const r = data.routes[m.code];
      if (r) out[m.code] = currentBurden(r, indication, lever, params)[metric];
    }
    return out;
  }, [data, indication, lever, params, metric]);
  // Terrain height = nights away per patient. Attribute transitions force slow GPU read-backs, so the
  // lever's "sink" is a uniform: every stayer has the same nights (sessions + planning [+ retreatment]),
  // commuters have none, so long -> short is one exact ratio for all municipalities.
  const longNightsByCode = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of data.municipalities) {
      const r = data.routes[m.code];
      if (r) out[m.code] = perPatient(r, indication, 'long', params).nights;
    }
    return out;
  }, [data, indication, params]);
  const terrainData = useMemo(
    () => ({ type: 'FeatureCollection', features: data.geo.features.filter((f) => (longNightsByCode[f.properties!.code] ?? 0) > 0) }) as GeoJSON.FeatureCollection,
    [data, longNightsByCode],
  );
  const sinkRatio = useMemo(() => {
    const stayer = { road_km: params.commute_threshold_km + 1, drive_min: 60 };
    const long = perPatient(stayer, indication, 'long', params).nights;
    return long > 0 ? perPatient(stayer, indication, 'short', params).nights / long : 1;
  }, [indication, params]);
  const sinkK = useTween(lever ? sinkRatio : 1, terrain ? 1600 : 1);
  // Stable colour scale per metric: the largest long-schedule value across both indications.
  const maxLong = useMemo(() => {
    let mx = 0;
    for (const m of data.municipalities) {
      const r = data.routes[m.code];
      if (!r) continue;
      for (const ind of ['bone', 'breast'] as Indication[]) mx = Math.max(mx, perPatient(r, ind, 'long', params)[metric]);
    }
    return mx || 1;
  }, [data, params, metric]);

  const foldFrac = useMemo(() => {
    const out: Record<string, number> = {};
    for (const code of Object.keys(data.routeLines)) {
      const r = data.routes[code];
      out[code] = fold && r ? equivalentDistanceFraction(r, indication, params) : 1;
    }
    return out;
  }, [data, fold, indication, params]);
  const routePaths = useMemo(
    () =>
      Object.entries(geoms).map(([code, g]) => ({
        code,
        path: (foldFrac[code] < 1 ? subPath(g, 1 - foldFrac[code], 1) : g.path).map((p) => [p[0], p[1]] as LonLat),
      })),
    [geoms, foldFrac],
  );
  const selGeom = useMemo(() => {
    const g = geoms[selected];
    if (!g) return null;
    const f = foldFrac[selected] ?? 1;
    return f < 1 ? prep(subPath(g, 1 - f, 1)) : g;
  }, [geoms, selected, foldFrac]);
  const selBurden = data.routes[selected] ? currentBurden(data.routes[selected], indication, lever, params) : null;
  const nDots = selBurden ? tripDots(selBurden) : 0;
  const selPathData = useMemo(() => (selGeom ? [selGeom.path] : []), [selGeom]);
  const ghostData = useMemo(() => (fold && geoms[selected] ? [geoms[selected].path.map((p) => [p[0], p[1]] as LonLat)] : []), [fold, geoms, selected]);

  const selFeature = useMemo(
    () => ({ type: 'FeatureCollection', features: data.geo.features.filter((f) => f.properties!.code === selected) }) as GeoJSON.FeatureCollection,
    [data, selected],
  );

  const onMuniClick = (info: PickingInfo) => {
    const code = (info.object as GeoJSON.Feature)?.properties?.code;
    if (code && data.routes[code]) props.onSelect(code);
  };
  const onMuniHover = (info: PickingInfo) => {
    const f = info.object as GeoJSON.Feature | undefined;
    setHover(f ? { x: info.x, y: info.y, code: f.properties!.code } : null);
  };

  const layers = [
    new GeoJsonLayer({
      id: 'land',
      data: data.basemap.land,
      filled: true,
      stroked: false,
      getFillColor: LAND,
      parameters: DEPTH_ALWAYS,
    }),
    new GeoJsonLayer({
      id: 'borders',
      data: data.basemap.borders,
      stroked: true,
      filled: false,
      getLineColor: BORDER,
      lineWidthMinPixels: 1,
      parameters: DEPTH_ALWAYS,
    }),
    // Flat choropleth and the extruded "burden terrain" are separate layers, so neither ever changes
    // its vertex layout mid-transition (toggling `extruded` on one layer garbles attribute transitions).
    // The flat choropleth stays under the terrain, so zero-height municipalities keep their fill and borders.
    new GeoJsonLayer({
      id: 'municipalities',
      data: data.geo,
      filled: true,
      stroked: true,
      getFillColor: (f: GeoJSON.Feature) => ramp((valueByCode[f.properties!.code] ?? 0) / maxLong),
      getLineColor: MUNI_LINE,
      lineWidthMinPixels: 0.5,
      pickable: true,
      autoHighlight: true,
      highlightColor: HIGHLIGHT,
      updateTriggers: { getFillColor: [valueByCode, maxLong] },
      onClick: onMuniClick,
      onHover: onMuniHover,
    }),
    // Only built while terrain is on, so the flat views never pay for the extruded geometry.
    (terrain || terrainOn) &&
    new GeoJsonLayer({
      id: 'terrain',
      data: terrainData,
      visible: terrainOn,
      filled: true,
      stroked: false,
      extruded: true,
      getFillColor: (f: GeoJSON.Feature) => ramp((valueByCode[f.properties!.code] ?? 0) / maxLong, TERRAIN_HI),
      getElevation: (f: GeoJSON.Feature) => (longNightsByCode[f.properties!.code] ?? 0) * ELEV_PER_NIGHT,
      elevationScale: terrainOn ? terrainK * sinkK : 0,
      material: MATERIAL,
      pickable: true,
      autoHighlight: true,
      highlightColor: HIGHLIGHT,
      updateTriggers: { getFillColor: [valueByCode, maxLong], getElevation: [longNightsByCode] },
      onClick: onMuniClick,
      onHover: onMuniHover,
    }),
    new GeoJsonLayer({
      id: 'counties',
      data: data.counties,
      filled: false,
      stroked: true,
      // County outlines ring every skerry in the south-west archipelago: only draw them zoomed in.
      visible: !terrainOn && (viewState.zoom ?? 0) >= 6,
      getLineColor: COUNTY_LINE,
      lineWidthMinPixels: 1,
    }),
    // Lakes after the municipalities so flat (zero-height) terrain never z-fights with them.
    new GeoJsonLayer({
      id: 'lakes',
      data: data.basemap.lakes,
      filled: true,
      stroked: false,
      getFillColor: WATER,
      parameters: terrainOn ? LAKES_TERRAIN : DEPTH_ALWAYS,
      updateTriggers: { parameters: terrainOn },
    }),
    new PathLayer({
      id: 'routes',
      data: routePaths,
      visible: !terrainOn,
      getPath: (d: (typeof routePaths)[number]) => d.path,
      getColor: ROUTE_LINE,
      getWidth: 1,
      widthUnits: 'pixels',
      widthMinPixels: 1,
      jointRounded: false,
      parameters: DEPTH_ALWAYS,
      updateTriggers: { getPath: [foldFrac] },
    }),
    new GeoJsonLayer({
      id: 'selected-outline',
      data: selFeature,
      visible: !terrainOn,
      filled: false,
      stroked: true,
      getLineColor: TEAL_A,
      lineWidthMinPixels: 2,
      parameters: DEPTH_ALWAYS,
    }),
    // With fold on, the folded-away part of the selected route stays as a faint ghost.
    new PathLayer({
      id: 'selected-route-ghost',
      visible: !terrainOn && fold,
      data: ghostData,
      getPath: (d: LonLat[]) => d,
      getColor: GHOST,
      getWidth: 1.5,
      widthUnits: 'pixels',
      parameters: DEPTH_ALWAYS,
    }),
    new PathLayer({
      id: 'selected-route-casing',
      visible: !terrainOn,
      data: selPathData,
      getPath: (d: LonLat[]) => d,
      getColor: CASING,
      getWidth: 6,
      widthUnits: 'pixels',
      jointRounded: true,
      capRounded: true,
      parameters: DEPTH_ALWAYS,
    }),
    new PathLayer({
      id: 'selected-route',
      visible: !terrainOn,
      data: selPathData,
      getPath: (d: LonLat[]) => d,
      getColor: TEAL_A,
      getWidth: 3,
      widthUnits: 'pixels',
      jointRounded: true,
      capRounded: true,
      parameters: DEPTH_ALWAYS,
    }),
  ];

  /* ---------- DOM overlay: hospital squares + collision-free labels + flight label ---------- */
  const overlay = useMemo(() => {
    if (!size || size.width < 40 || size.height < 40) return null;
    let vp: WebMercatorViewport;
    try {
      vp = new WebMercatorViewport({ ...viewState, width: size.width, height: size.height });
    } catch {
      return null;
    }
    const inset = 4;
    const inside = (b: Box) => b.x >= inset && b.y >= inset && b.x + b.w <= size.width - inset && b.y + b.h <= size.height - inset;
    const selUnit = data.routes[selected]?.unit_id;
    const served: Record<string, number> = {};
    for (const r of Object.values(data.routes)) served[r.unit_id] = (served[r.unit_id] ?? 0) + 1;
    const marks = data.units
      .map((u) => {
        const [x, y] = vp.project([u.lon, u.lat]);
        return { u, x, y, on: u.id === selUnit };
      })
      .filter((m) => Number.isFinite(m.x) && m.x > -10 && m.y > -10 && m.x < size.width + 10 && m.y < size.height + 10);
    const obstacles: Box[] = marks.map((m) => ({ x: m.x - 6, y: m.y - 6, w: 12, h: 12 }));
    let travel: { x: number; y: number; text: string } | null = null;
    if (flight && flight.code === selected && geoms[selected]) {
      const r = data.routes[selected];
      const p = pointAt(geoms[selected], flight.s);
      const [x, y] = vp.project(p);
      const text = `${fmt(flight.s * r.road_km)} km · ${fmtDrive(flight.s * r.drive_min)}`;
      const w = textWidth(text, 16) + 18;
      const h = 26;
      const cands: Box[] = [
        { x: x + 12, y: y - h - 6, w, h },
        { x: x - w - 12, y: y - h - 6, w, h },
        { x: x + 12, y: y + 8, w, h },
        { x: x - w - 12, y: y + 8, w, h },
      ];
      const b = cands.find((c) => inside(c) && !obstacles.some((o) => hit(c, o))) ?? cands.find(inside);
      if (b) {
        travel = { x: b.x, y: b.y, text };
        obstacles.push(b);
      }
    }
    const order = [...marks].sort((a, b) => Number(b.on) - Number(a.on) || (served[b.u.id] ?? 0) - (served[a.u.id] ?? 0));
    const labels: { id: string; x: number; y: number; text: string; on: boolean }[] = [];
    for (const m of order) {
      const text = m.u.town === 'Helsinki' ? 'HUS Helsinki' : m.u.town;
      const w = textWidth(text) + 6;
      const h = 16;
      const cands: Box[] = [
        { x: m.x + 9, y: m.y - h / 2, w, h },
        { x: m.x - 9 - w, y: m.y - h / 2, w, h },
        { x: m.x - w / 2, y: m.y - 9 - h, w, h },
        { x: m.x - w / 2, y: m.y + 9, w, h },
        { x: m.x + 7, y: m.y - 7 - h, w, h },
        { x: m.x + 7, y: m.y + 7, w, h },
        { x: m.x - 7 - w, y: m.y - 7 - h, w, h },
        { x: m.x - 7 - w, y: m.y + 7, w, h },
      ];
      const b = cands.find((c) => inside(c) && !obstacles.some((o) => hit(c, o)));
      if (!b) continue; // skip a label rather than overlap
      obstacles.push(b);
      labels.push({ id: m.u.id, x: b.x, y: b.y, text, on: m.on });
    }
    return { marks, labels, travel };
  }, [size, viewState, data, selected, flight, geoms]);

  /* ---------- caption ---------- */
  const metricWord = metric === 'nights' ? 'nights away' : metric === 'hours' ? 'hours on the road' : 'round trips';
  const farStats = useMemo(() => {
    const far = data.municipalities.filter((m) => data.routes[m.code] && data.routes[m.code].road_km > params.commute_threshold_km);
    return { n: far.length, pop: far.reduce((a, m) => a + m.population, 0) };
  }, [data, params.commute_threshold_km]);
  const hoverM = hover ? data.muniByCode[hover.code] : null;
  const fmtV = (v: number) => fmt(v, Math.abs(v - Math.round(v)) > 0.05 ? 1 : 0);

  return (
    <section className="mapcol" aria-label="Map" data-box="mapcol">
      <div className="mapbar" data-box="mapbar">
        <div className="texttabs" role="group" aria-label="Metric">
          {METRICS.map(([k, label]) => (
            <button key={k} className="texttab" aria-pressed={metric === k} onClick={() => props.onMetric(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="toggles">
          <button className="toggle" aria-pressed={terrain} onClick={() => props.onTerrain(!terrain)} title="Extrude each municipality by nights away per patient" data-testid="terrain-toggle">
            Terrain
          </button>
          <button className="toggle" aria-pressed={fold} onClick={() => props.onFold(!fold)} title="Shorten each route to the distance at which the long course would cost what the short one costs" data-testid="fold-toggle">
            Fold inward
          </button>
        </div>
      </div>
      <div className="mapcanvas" ref={holderRef} data-box="mapcanvas" data-testid="mapcanvas">
        <DeckGL
          views={MAP_VIEW}
          viewState={viewState}
          onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
          controller={CONTROLLER}
          layers={layers}
          effects={LIGHTING}
          getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
          style={DECK_STYLE}
        />
        {overlay && (
          <div className="maplabels" data-layer="map-labels" aria-hidden>
            {overlay.marks.map((m) => (
              <span key={m.u.id} className={`hmark${m.on ? ' on' : ''}`} style={{ left: m.x - 5, top: m.y - 5 }} data-box="hmark" title={m.u.hospital} />
            ))}
            {overlay.labels.map((l) => (
              <span key={l.id} className={`hlabel${l.on ? ' on' : ''}`} style={{ left: l.x, top: l.y }} data-box="hlabel" data-testid="hospital-label">
                {l.text}
              </span>
            ))}
            {selGeom && size && !terrainOn && (
              <RouteDots geom={selGeom} viewState={viewState} size={size} n={nDots} flightS={flight?.flying && flight.code === selected ? flight.s : null} />
            )}
            {overlay.travel && (
              <span className="travel num" style={{ left: overlay.travel.x, top: overlay.travel.y }} data-box="travel" data-testid="travel-label">
                {overlay.travel.text}
              </span>
            )}
          </div>
        )}
        {hover && hoverM && (
          <div className="tooltip" style={{ left: hover.x, top: hover.y }} data-layer="tooltip">
            <b>{hoverM.name_fi}</b> · {fmtV(valueByCode[hover.code] ?? 0)} {metricWord}
          </div>
        )}
      </div>
      <div className="mapcaption" data-box="mapcaption" data-testid="map-caption">
        <div className="legend" data-box="legend">
          <span className="legend-title">
            {METRICS.find(([k]) => k === metric)![1]} per patient, {indication === 'bone' ? 'bone' : 'breast'}
            <Prov kind="calculated" ids={data.routesMeta.source_ids} note={`${data.routesMeta.note} Squares: radiotherapy units. Grey lines: each municipality's road route to its unit (OSRM, OpenStreetMap). Lakes and coastline: Natural Earth 10m, bundled locally.`} />
          </span>
          <span className="num">0</span>
          <span className="legend-bar" />
          <span className="num">{fmt(maxLong, maxLong < 10 ? 1 : 0)}</span>
        </div>
        <div className="caption-text">
          {fold ? (
            <span className="fold-line">We can't move the hospital. The schedule can.</span>
          ) : terrain ? (
            <span>
              Height: nights away per patient on the current schedule. {farStats.n} municipalities are more than {params.commute_threshold_km} km by road from their unit.
              <Prov kind="calculated" ids={['osrm_table', 'statfin_population', 'wikidata_coords']} note="Road distance from each municipality's centre point. Follows the commuting-threshold slider." />
            </span>
          ) : (
            <span>
              {farStats.n} municipalities, home to {farStats.pop.toLocaleString('en-GB')} people, are more than {params.commute_threshold_km} km by road from their unit.
              <Prov kind="calculated" ids={['osrm_table', 'statfin_population', 'wikidata_coords']} note="Road distance from each municipality's centre point; population 31 Dec 2025. Follows the commuting-threshold slider." />
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
