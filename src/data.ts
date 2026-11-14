import type { Params } from './model/metrics';

export type Kind = 'sourced' | 'calculated' | 'assumption';

export interface Municipality {
  code: string;
  name_fi: string;
  name_sv: string;
  county_code: string;
  county_name_fi: string;
  county_name_en?: string;
  lon: number;
  lat: number;
  centre_method: string;
  population: number;
}

export interface RouteRow {
  code: string;
  unit_id: string;
  road_km: number;
  drive_min: number;
  method: 'osrm' | 'estimated';
  basis?: 'county_catchment' | 'nearest_drive_time';
  basis_source?: string | null;
}

export interface Unit {
  id: string;
  name: string;
  hospital: string;
  town: string;
  lat: number;
  lon: number;
  source_url: string;
  source_key?: string;
  source_id?: string;
}

export interface Source {
  id: string;
  key: string;
  title: string;
  publisher: string;
  year: string | number;
  url: string;
  accessed: string;
  supports: string;
  quote: string | null;
  note?: string;
  kind?: string;
}

export interface Parameter {
  id: keyof Params;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  kind: Kind;
  source_ids: string[];
  rationale: string;
}

export interface Fact {
  id: string;
  value: number | string;
  unit?: string;
  text: string;
  kind: Kind;
  source_ids: string[];
  note?: string;
}

export interface Goal3Indicator {
  id: string;
  en: string;
  fi: string;
  short: string;
  source_ids: string[];
}

export interface Cases {
  year: number | string;
  national_cases: number;
  mainland_cases: number;
  kind: Kind;
  source_ids: string[];
  note: string;
  municipalities: Record<string, number>;
}

export interface UnitStatement {
  unit_id: string;
  indication: 'breast' | 'bone';
  stated_default_fractions: number | null;
  stated_alternatives: string[] | string | null;
  criteria_for_short_course: string | null;
  distance_mentioned: boolean | null;
  quote_fi: string | null;
  quote_en: string | null;
  url: string;
  accessed: string;
  confidence: string | number | null;
  source_id?: string;
}

export interface UnitStatements {
  method: string;
  generated: string;
  model?: string;
  pages_read: number;
  statements: UnitStatement[];
  dropped?: number;
  summary?: Record<string, unknown>;
}

export interface Memo {
  county_code: string;
  county_name: string;
  text: string;
  numbers_checked: number;
  numbers_passed: number;
  source_ids: string[];
  attempts?: number;
  /** True only if the memo passed the full validator (numbers, citations, wording) on its last run. */
  validated?: boolean;
  problems?: string[];
}

export interface Memos {
  method: string;
  generated: string;
  model?: string | null;
  memos: Memo[];
}

export interface AppData {
  municipalities: Municipality[];
  muniByCode: Record<string, Municipality>;
  geo: GeoJSON.FeatureCollection;
  counties: GeoJSON.FeatureCollection;
  routes: Record<string, RouteRow>;
  routesMeta: { kind: Kind; source_ids: string[]; note: string };
  units: Unit[];
  unitById: Record<string, Unit>;
  sources: Source[];
  sourceById: Record<string, Source>;
  parameters: Parameter[];
  defaults: Params;
  facts: Record<string, Fact>;
  goal3: Goal3Indicator[];
  cases: Cases;
  limitations: { title: string; text: string; source_ids?: string[] }[];
  statements: UnitStatements | null;
  memos: Memos | null;
  countyNames: Record<string, string>;
}

async function get<T>(name: string, optional = false): Promise<T | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`Failed to load ${name}: ${res.status}`);
  }
  try {
    return (await res.json()) as T;
  } catch (e) {
    // Static servers may answer a missing file with index.html.
    if (optional) return null;
    throw new Error(`Failed to parse ${name}: ${e}`);
  }
}

export async function loadData(): Promise<AppData> {
  const [m, geo, counties, routes, units, sources, params, facts, cases, statements, memos] =
    await Promise.all([
      get<{ municipalities: Municipality[] }>('municipalities.json'),
      get<GeoJSON.FeatureCollection>('municipalities.geojson'),
      get<GeoJSON.FeatureCollection>('counties.geojson'),
      get<{ routes: Record<string, RouteRow>; kind: Kind; source_ids: string[]; note: string }>('routes.json'),
      get<{ units: Unit[] }>('rt_units.json'),
      get<{ sources: Source[] }>('sources.json'),
      get<{ parameters: Parameter[] }>('parameters.json'),
      get<{ facts: Fact[]; goal3: Goal3Indicator[]; limitations: AppData['limitations'] }>('facts.json'),
      get<Cases>('cases.json'),
      get<UnitStatements>('unit_statements.json', true),
      get<Memos>('memos.json', true),
    ]);
  const municipalities = m!.municipalities;
  const muniByCode = Object.fromEntries(municipalities.map((x) => [x.code, x]));
  const unitList = units!.units;
  const sourceList = sources!.sources;
  const sourceById: Record<string, Source> = {};
  for (const s of sourceList) {
    sourceById[s.id] = s;
    sourceById[s.key] = s;
  }
  const defaults = Object.fromEntries(params!.parameters.map((p) => [p.id, p.default])) as unknown as Params;
  const countyNames: Record<string, string> = {};
  for (const x of municipalities) countyNames[x.county_code] = x.county_name_en ?? x.county_name_fi;
  return {
    municipalities,
    muniByCode,
    geo: geo!,
    counties: counties!,
    routes: routes!.routes,
    routesMeta: { kind: routes!.kind, source_ids: routes!.source_ids, note: routes!.note },
    units: unitList,
    unitById: Object.fromEntries(unitList.map((u) => [u.id, u])),
    sources: sourceList,
    sourceById,
    parameters: params!.parameters,
    defaults,
    facts: Object.fromEntries(facts!.facts.map((f) => [f.id, f])),
    goal3: facts!.goal3,
    limitations: facts!.limitations,
    cases: cases!,
    statements,
    memos,
    countyNames,
  };
}
