import { useEffect, useMemo, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator, MapView, type MapViewState, type PickingInfo } from '@deck.gl/core';
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
const FINLAND_FLAT: MapViewState = { ...FINLAND, latitude: 65.1, zoom: 4.5, pitch: 0, bearing: 0 };

const RAMP_LO = [0xe8, 0xee, 0xf5];
const RAMP_HI = [0x0b, 0x3d, 0x6e];
function ramp(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  const g = Math.pow(x, 0.75);
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

  // Fly requests (demo keys) and the flatten button.
  useEffect(() => {
    if (fly.target === 'finland') {
      setViewState({ ...(pitched ? FINLAND : FINLAND_FLAT), transitionDuration: 1400, transitionInterpolator: new FlyToInterpolator({ curve: 1.2 }), transitionEasing: easeInOut } as MapViewState);
    } else if (fly.code) {
      const m = data.muniByCode[fly.code];
      if (m) {
        setViewState({ longitude: m.lon - 0.8, latitude: m.lat - 2.6, zoom: 4.95, pitch: pitched ? 45 : 0, bearing: -8, transitionDuration: 1600, transitionInterpolator: new FlyToInterpolator({ curve: 1.3 }), transitionEasing: easeInOut } as MapViewState);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fly.nonce]);

  useEffect(() => {
    setViewState((v) => ({ ...v, pitch: pitched ? 45 : 0, transitionDuration: 700, transitionEasing: easeInOut } as MapViewState));
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
      radius: 6500,
      extruded: true,
      getPosition: (d: (typeof rows)[number]) => [d.lon, d.lat],
      getElevation: (d: (typeof rows)[number]) => (d.value / maxLong) * MAX_COLUMN_M,
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

  return (
    <section className="panel map-wrap" aria-label="Map">
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
      <div className="story-caption">
        <FactText id="story_distance" />
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
