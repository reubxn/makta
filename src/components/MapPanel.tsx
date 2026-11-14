import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator, MapView, WebMercatorViewport, type MapViewState, type PickingInfo } from '@deck.gl/core';
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { Box, Square, Shrink } from 'lucide-react';
import { useData } from '../context';
import { currentBurden, equivalentDistanceFraction, perPatient, type Indication, type MetricKey, type Params } from '../model/metrics';
import { easeInOut, fmt } from '../hooks';
import { Prov } from './Prov';
import { FactText } from './FactText';

export interface FlyRequest {
  target: 'finland' | 'muni';
  code?: string;
  nonce: number;
}

const FINLAND: MapViewState = { longitude: 26.3, latitude: 63.75, zoom: 4.5, pitch: 45, bearing: -8 };

type BBox = [number, number, number, number];
function bboxOf(features: GeoJSON.Feature[]): BBox {
  const b: BBox = [180, 90, -180, -90];
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const [x, y] = c as number[];
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    } else if (Array.isArray(c)) c.forEach(visit);
  };
  for (const f of features) visit((f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);
  return b;
}

/** Fit a bbox into the map, leaving room for the overlays (headline top-left, legend bottom-left). */
function fitView(bbox: BBox, size: { width: number; height: number }, pitched: boolean): MapViewState {
  const fallback: MapViewState = pitched ? FINLAND : { ...FINLAND, pitch: 0, bearing: 0 };
  // Tiny or unmeasured map area (small windows, first layout pass): keep a safe default view.
  if (!(size.width >= 80 && size.height >= 80)) return fallback;
  // fitBounds throws if the padding leaves no room, so scale the overlay margins down to fit,
  // always leaving at least half of each dimension for the map itself.
  const pad = { top: 64, bottom: 36, left: Math.min(290, size.width * 0.38), right: 44 };
  const hScale = Math.min(1, (size.width * 0.5) / (pad.left + pad.right));
  const vScale = Math.min(1, (size.height * 0.5) / (pad.top + pad.bottom));
  pad.left *= hScale; pad.right *= hScale; pad.top *= vScale; pad.bottom *= vScale;
  let fit: { longitude: number; latitude: number; zoom: number };
  try {
    const vp = new WebMercatorViewport({ width: size.width, height: size.height });
    fit = vp.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: pad });
  } catch {
    return fallback;
  }
  const { longitude, latitude, zoom } = fit;
  if (![longitude, latitude, zoom].every(Number.isFinite)) return fallback;
  if (!pitched) return { longitude, latitude, zoom, pitch: 0, bearing: 0 };
  // Pitching compresses the far (north) side: move the centre south and zoom in slightly.
  const latSpan = bbox[3] - bbox[1];
  return { longitude, latitude: latitude - latSpan * 0.2, zoom: zoom + 0.3, pitch: 45, bearing: -8 };
}

const RAMP_LO = [0xe8, 0xee, 0xf5];
const RAMP_HI = [0x0b, 0x3d, 0x6e];
function ramp(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  const g = x;
  return [0, 1, 2].map((i) => Math.round(RAMP_LO[i] + (RAMP_HI[i] - RAMP_LO[i]) * g)) as [number, number, number];
}

const METRICS: [MetricKey, string][] = [
  ['nights', 'Nights away'],
  ['hours', 'Hours on the road'],
  ['roundTrips', 'Round trips'],
];
const MAX_COLUMN_M = 190_000;

interface Props {
  indication: Indication;
  lever: boolean;
  params: Params;
  metric: MetricKey;
  onMetric: (m: MetricKey) => void;
  selected: string;
  onSelect: (code: string) => void;
  pitched: boolean;
  onPitch: (p: boolean) => void;
  fly: FlyRequest;
  fold: boolean;
  onFold: (f: boolean) => void;
}

export function MapPanel(props: Props) {
  const { indication, lever, params, metric, selected, pitched, fly, fold } = props;
  const { data } = useData();
  const [viewState, setViewState] = useState<MapViewState>(FINLAND);
  const [hover, setHover] = useState<{ x: number; y: number; name: string } | null>(null);
  const wrapRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const finlandBox = useMemo(() => bboxOf(data.geo.features), [data]);
  const currentTarget = useRef<{ target: FlyRequest['target']; code?: string }>({ target: 'finland' });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const targetView = (target: FlyRequest['target'], code: string | undefined, pitch: boolean): MapViewState | null => {
    if (!size || size.width < 50) return null;
    if (target === 'muni' && code) {
      const m = data.muniByCode[code];
      const county = data.counties.features.filter((f) => f.properties!.county_code === m?.county_code);
      if (county.length) return fitView(bboxOf(county), size, pitch);
    }
    return fitView(finlandBox, size, pitch);
  };

  // Fly requests (demo keys), the flatten button and the first layout.
  useEffect(() => {
    currentTarget.current = { target: fly.target, code: fly.code };
    const v = targetView(fly.target, fly.code, pitched);
    if (v) setViewState({ ...v, transitionDuration: fly.nonce === 0 ? 0 : 1500, transitionInterpolator: new FlyToInterpolator({ curve: 1.2 }), transitionEasing: easeInOut } as MapViewState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly.nonce, size === null]);

  useEffect(() => {
    const v = targetView(currentTarget.current.target, currentTarget.current.code, pitched);
    if (v) setViewState({ ...v, transitionDuration: 800, transitionEasing: easeInOut } as MapViewState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pitched]);

  const rows = useMemo(
    () =>
      data.municipalities
        .filter((m) => data.routes[m.code])
        .map((m) => {
          const route = data.routes[m.code];
          const b = currentBurden(route, indication, lever, params);
          const frac = fold ? equivalentDistanceFraction(route, indication, params) : 1;
          const unit = data.unitById[route.unit_id];
          const lon = unit ? unit.lon + (m.lon - unit.lon) * frac : m.lon;
          const lat = unit ? unit.lat + (m.lat - unit.lat) * frac : m.lat;
          return { code: m.code, name: m.name_fi, lon, lat, value: b[metric] };
        }),
    [data, indication, lever, params, metric, fold],
  );

  // Stable scale per metric: the largest long-schedule value across both indications,
  // so bone columns sit below breast columns and switching lever shows the drop.
  const maxLong = useMemo(() => {
    let mx = 0;
    for (const m of data.municipalities) {
      const r = data.routes[m.code];
      if (!r) continue;
      for (const ind of ['bone', 'breast'] as Indication[]) mx = Math.max(mx, perPatient(r, ind, 'long', params)[metric]);
    }
    return mx || 1;
  }, [data, params, metric]);

  const valueByCode = useMemo(() => Object.fromEntries(rows.map((r) => [r.code, r.value])), [rows]);
  const transition = { duration: 800, easing: easeInOut };

  const layers = [
    new GeoJsonLayer({
      id: 'municipalities',
      data: data.geo,
      filled: true,
      stroked: true,
      getFillColor: (f: GeoJSON.Feature) => ramp((valueByCode[f.properties!.code] ?? 0) / maxLong),
      getLineColor: [255, 255, 255, 200],
      lineWidthMinPixels: 0.5,
      pickable: true,
      autoHighlight: true,
      highlightColor: [11, 95, 165, 70],
      updateTriggers: { getFillColor: [valueByCode, maxLong] },
      transitions: { getFillColor: transition },
      onClick: (info: PickingInfo) => {
        const code = (info.object as GeoJSON.Feature)?.properties?.code;
        if (code) props.onSelect(code);
      },
      onHover: (info: PickingInfo) => {
        const f = info.object as GeoJSON.Feature | undefined;
        setHover(f ? { x: info.x, y: info.y, name: f.properties!.name_fi } : null);
      },
    }),
    new GeoJsonLayer({
      id: 'counties',
      data: data.counties,
      filled: false,
      stroked: true,
      getLineColor: [21, 25, 30, 150],
      lineWidthMinPixels: 1.3,
    }),
    new GeoJsonLayer({
      id: 'selected',
      data: { type: 'FeatureCollection', features: data.geo.features.filter((f) => f.properties!.code === selected) } as GeoJSON.FeatureCollection,
      filled: false,
      stroked: true,
      getLineColor: [14, 124, 102, 255],
      lineWidthMinPixels: 3,
    }),
    new ColumnLayer({
      id: 'columns',
      data: rows,
      diskResolution: 14,
      radius: 4800,
      extruded: true,
      getPosition: (d: (typeof rows)[number]) => [d.lon, d.lat],
      getElevation: (d: (typeof rows)[number]) => (d.value / maxLong) * MAX_COLUMN_M,
      elevationScale: Math.pow(2, 4.6 - (viewState.zoom ?? 4.6)),
      getFillColor: (d: (typeof rows)[number]) => (d.code === selected ? [14, 124, 102, 255] : [...ramp(0.35 + 0.65 * (d.value / maxLong)), d.value > 0.01 ? 235 : 0]),
      material: { ambient: 0.55, diffuse: 0.55, shininess: 16, specularColor: [40, 40, 40] },
      pickable: true,
      updateTriggers: { getElevation: [rows, maxLong], getFillColor: [rows, maxLong, selected], getPosition: [rows] },
      transitions: { getElevation: transition, getFillColor: transition, getPosition: transition },
      onClick: (info: PickingInfo) => {
        const d = info.object as (typeof rows)[number] | undefined;
        if (d) props.onSelect(d.code);
      },
      onHover: (info: PickingInfo) => {
        const d = info.object as (typeof rows)[number] | undefined;
        setHover(d ? { x: info.x, y: info.y, name: d.name } : null);
      },
    }),
    new ScatterplotLayer({
      id: 'units',
      data: data.units,
      getPosition: (u: (typeof data.units)[number]) => [u.lon, u.lat],
      getRadius: 7,
      radiusUnits: 'pixels',
      getFillColor: [255, 255, 255],
      getLineColor: [11, 95, 165],
      lineWidthUnits: 'pixels',
      getLineWidth: 3,
      stroked: true,
      parameters: { depthTest: false } as never,
    }),
    new TextLayer({
      id: 'unit-labels',
      data: data.units,
      getPosition: (u: (typeof data.units)[number]) => [u.lon, u.lat],
      getText: (u: (typeof data.units)[number]) => u.town,
      getSize: 13,
      getColor: [21, 25, 30],
      getPixelOffset: [10, 0],
      getTextAnchor: 'start',
      getAlignmentBaseline: 'center',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 600,
      background: true,
      getBackgroundColor: [255, 255, 255, 225],
      backgroundPadding: [4, 2],
      characterSet: 'auto',
      parameters: { depthTest: false } as never,
    }),
  ];

  const metricLabel = METRICS.find(([k]) => k === metric)![1].toLowerCase();
  const metricWord = metric === 'nights' ? 'nights away' : metric === 'hours' ? 'hours on the road' : 'round trips';
  const fmtMetric = (v: number) => fmt(v, Math.abs(v - Math.round(v)) > 0.05 ? 1 : 0);
  const farStats = useMemo(() => {
    const far = data.municipalities.filter((m) => data.routes[m.code] && data.routes[m.code].road_km > params.commute_threshold_km);
    return { n: far.length, pop: far.reduce((a, m) => a + m.population, 0) };
  }, [data, params.commute_threshold_km]);
  const headline = useMemo(() => {
    const val = (code: string) => {
      const r = data.routes[code];
      return r ? currentBurden(r, indication, lever, params)[metric] : 0;
    };
    const longVal = (code: string) => {
      const r = data.routes[code];
      return r ? perPatient(r, indication, 'long', params)[metric] : 0;
    };
    const HELSINKI = '091';
    const farCode = selected === HELSINKI ? '890' : selected;
    return {
      far: { name: data.muniByCode[farCode]?.name_fi ?? '', value: val(farCode), before: longVal(farCode) },
      near: { name: data.muniByCode[HELSINKI]?.name_fi ?? 'Helsinki', value: val(HELSINKI) },
    };
  }, [data, indication, lever, params, metric, selected]);

  return (
    <section className="panel map-wrap" aria-label="Map" ref={wrapRef}>
      <div className="map-controls">
        <div className="metric-switch" role="group" aria-label="Metric">
          {METRICS.map(([k, label]) => (
            <button key={k} aria-pressed={metric === k} onClick={() => props.onMetric(k)}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" onClick={() => props.onFold(!fold)} aria-pressed={fold} title="Finland folds inward">
            <Shrink size={15} /> {fold ? 'Unfold' : 'Fold inward'}
          </button>
          <button className="icon-btn" onClick={() => props.onPitch(!pitched)} aria-pressed={!pitched}>
            {pitched ? <Square size={15} /> : <Box size={15} />} {pitched ? 'Flatten' : '3D'}
          </button>
        </div>
      </div>
      <div className="map-headline">
        <p className="map-tagline">Same cancer, same treatment. Different distance.</p>
        <h2 data-testid="map-headline">
          {headline.far.name}:{' '}
          {lever && Math.abs(headline.far.before - headline.far.value) > 0.05 ? (
            <>
              <span className="dimtxt">{fmtMetric(headline.far.before)}</span> → <span className={headline.far.value < headline.far.before ? 'aftertxt' : ''}>{fmtMetric(headline.far.value)}</span>
            </>
          ) : (
            fmtMetric(headline.far.value)
          )}{' '}
        </h2>
        <p className="map-near">
          {metricWord} · {headline.near.name}: {fmtMetric(headline.near.value)}
        </p>
        <p className="map-subline">
          Per patient, {indication === 'bone' ? 'one course for painful bone metastases' : 'one breast radiotherapy course'}{lever ? ', short schedule' : ''}{' '}
          <Prov kind="calculated" ids={[...data.routesMeta.source_ids, ...data.parameters.filter((p) => p.id.startsWith(indication)).flatMap((p) => p.source_ids)]} note={data.routesMeta.note} />
        </p>
        {indication === 'bone' && lever && metric !== 'nights' && (
          <p className="metric-note">Retreatment adds trips for patients who stay near the unit; the gain is nights away.</p>
        )}
      </div>
      <div className="map-story">
        {indication === 'bone' ? (
          <FactText id="story_distance" />
        ) : (
          <span>
            {farStats.n} municipalities, home to {farStats.pop.toLocaleString('en-GB')} people, are more than {params.commute_threshold_km} km by road from their unit.{' '}
            <Prov kind="calculated" ids={['osrm_table', 'statfin_population', 'wikidata_coords']} note="Road distance from each municipality's centre point; population 31 Dec 2025. Follows the commuting-threshold slider." />
          </span>
        )}
      </div>
      {fold && <div className="fold-banner">We can't move the hospital. The schedule can.</div>}
      <DeckGL
        views={new MapView({ repeat: false })}
        viewState={viewState}
        onViewStateChange={({ viewState: v }) => setViewState(v as MapViewState)}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
        style={{ position: 'absolute', inset: '0' }}
      />
      {hover && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          {hover.name}
        </div>
      )}
      <div className="legend">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
          <span>
            {metricLabel[0].toUpperCase() + metricLabel.slice(1)} per patient, {indication === 'bone' ? 'bone metastases' : 'breast'}
          </span>
          <Prov kind="calculated" ids={data.routesMeta.source_ids} note={`${data.routesMeta.note} Ringed dots: radiotherapy units.`} />
        </div>
        <div className="legend-bar" />
        <div className="legend-scale num">
          <span>0</span>
          <span>{fmt(maxLong / 2, maxLong < 10 ? 1 : 0)}</span>
          <span>{fmt(maxLong, maxLong < 10 ? 1 : 0)}</span>
        </div>
      </div>
    </section>
  );
}
