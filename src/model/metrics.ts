// Pure calculation functions for Matka (SPEC section 8). No I/O, no globals.

export type Indication = 'bone' | 'breast';

/** Parameter values keyed by parameter id (see public/data/parameters.json). */
export interface Params {
  commute_threshold_km: number;
  planning_visit: number;
  breast_fractions_long: number;
  breast_fractions_short: number;
  breast_share_rt: number;
  breast_share_eligible_short: number;
  breast_share_already_short: number;
  bone_fractions_multi: number;
  bone_fractions_single: number;
  bone_retreat_single: number;
  bone_retreat_multi: number;
  bone_share_single_now: number;
  kela_car_eur_per_km: number;
  kela_overnight_eur: number;
}

export interface Route {
  road_km: number;
  drive_min: number;
}

export interface Burden {
  roundTrips: number;
  nights: number;
  km: number;
  hours: number;
  /** Kela reimbursement, lower bound: own-car rate plus overnight allowance. */
  kelaEur: number;
}

export const ZERO: Burden = { roundTrips: 0, nights: 0, km: 0, hours: 0, kelaEur: 0 };

export function isCommuter(route: Route, p: Params): boolean {
  return route.road_km <= p.commute_threshold_km;
}

/** Burden of one course of n sessions for a patient with this route. */
export function courseBurden(route: Route, n: number, p: Params): Burden {
  const sessions = Math.max(0, n);
  const planning = Math.max(0, p.planning_visit);
  let roundTrips: number;
  let nights: number;
  if (isCommuter(route, p)) {
    roundTrips = sessions + planning;
    nights = 0;
  } else {
    const weeks = Math.ceil(sessions / 5);
    roundTrips = weeks + planning;
    nights = sessions + planning;
  }
  const km = roundTrips * 2 * route.road_km;
  const hours = roundTrips * 2 * (route.drive_min / 60);
  const kelaEur = km * p.kela_car_eur_per_km + nights * p.kela_overnight_eur;
  return { roundTrips, nights, km, hours, kelaEur };
}

export function add(a: Burden, b: Burden): Burden {
  return {
    roundTrips: a.roundTrips + b.roundTrips,
    nights: a.nights + b.nights,
    km: a.km + b.km,
    hours: a.hours + b.hours,
    kelaEur: a.kelaEur + b.kelaEur,
  };
}

export function sub(a: Burden, b: Burden): Burden {
  return add(a, scale(b, -1));
}

export function scale(a: Burden, k: number): Burden {
  return {
    roundTrips: a.roundTrips * k,
    nights: a.nights * k,
    km: a.km * k,
    hours: a.hours * k,
    kelaEur: a.kelaEur * k,
  };
}

/**
 * Expected burden per patient for an indication on its long ("before") or
 * short ("after") schedule. Bone includes retreatment: expected = course +
 * retreatment probability x one single-session retreatment course.
 */
export function perPatient(
  route: Route,
  indication: Indication,
  schedule: 'long' | 'short',
  p: Params,
): Burden {
  if (indication === 'breast') {
    const n = schedule === 'long' ? p.breast_fractions_long : p.breast_fractions_short;
    return courseBurden(route, n, p);
  }
  const n = schedule === 'long' ? p.bone_fractions_multi : p.bone_fractions_single;
  const retreatP = schedule === 'long' ? p.bone_retreat_multi : p.bone_retreat_single;
  const course = courseBurden(route, n, p);
  const retreat = courseBurden(route, p.bone_fractions_single, p);
  return add(course, scale(retreat, retreatP));
}

/** Burden shown for the current settings: the lever switches the default to the short schedule. */
export function currentBurden(
  route: Route,
  indication: Indication,
  leverOn: boolean,
  p: Params,
): Burden {
  return perPatient(route, indication, leverOn ? 'short' : 'long', p);
}

/** Yearly breast patients affected by the lever in one municipality. */
export function affectedBreastPatients(cases: number, p: Params): number {
  return cases * p.breast_share_rt * p.breast_share_eligible_short * (1 - p.breast_share_already_short);
}

export interface Removed extends Burden {
  patients: number;
  machineSessions: number;
}

export const ZERO_REMOVED: Removed = { ...ZERO, patients: 0, machineSessions: 0 };

/** Yearly breast burden removed in one municipality when the lever is on. */
export function breastRemoved(route: Route, cases: number, p: Params): Removed {
  const patients = affectedBreastPatients(cases, p);
  const diff = sub(perPatient(route, 'breast', 'long', p), perPatient(route, 'breast', 'short', p));
  return {
    ...scale(diff, patients),
    patients,
    machineSessions: patients * (p.breast_fractions_long - p.breast_fractions_short),
  };
}

export function addRemoved(a: Removed, b: Removed): Removed {
  return {
    ...add(a, b),
    patients: a.patients + b.patients,
    machineSessions: a.machineSessions + b.machineSessions,
  };
}

export interface MunicipalityInput {
  code: string;
  county_code: string;
  route: Route;
  cases: number;
}

export interface Totals {
  byMunicipality: Record<string, Removed>;
  byCounty: Record<string, Removed>;
  national: Removed;
}

/** Breast lever totals. With the lever off, nothing is removed. */
export function breastTotals(rows: MunicipalityInput[], p: Params, leverOn: boolean): Totals {
  const byMunicipality: Record<string, Removed> = {};
  const byCounty: Record<string, Removed> = {};
  for (const r of rows) {
    const rem = leverOn ? breastRemoved(r.route, r.cases, p) : ZERO_REMOVED;
    byMunicipality[r.code] = rem;
    byCounty[r.county_code] = addRemoved(byCounty[r.county_code] ?? ZERO_REMOVED, rem);
  }
  const national = Object.values(byCounty).reduce(addRemoved, ZERO_REMOVED);
  return { byMunicipality, byCounty, national };
}

/**
 * Yearly burden carried today by the eligible breast patients still on the long schedule in one
 * municipality: affected patients x one long course. Machine sessions are the treatment sessions
 * those courses use (patients x long fractions). This is what the lever acts on.
 */
export function breastStillLong(route: Route, cases: number, p: Params): Removed {
  const patients = affectedBreastPatients(cases, p);
  return {
    ...scale(perPatient(route, 'breast', 'long', p), patients),
    patients,
    machineSessions: patients * p.breast_fractions_long,
  };
}

export interface BreastYear {
  /** Lever off: yearly burden of the eligible patients still on the long schedule. */
  current: Removed;
  /** Lever on: what switching them to the short schedule removes. */
  removed: Removed;
}

/** National yearly breast figures for the totals block. Never all zero while there are cases. */
export function breastYear(rows: MunicipalityInput[], p: Params): BreastYear {
  let current = ZERO_REMOVED;
  let removed = ZERO_REMOVED;
  for (const r of rows) {
    current = addRemoved(current, breastStillLong(r.route, r.cases, p));
    removed = addRemoved(removed, breastRemoved(r.route, r.cases, p));
  }
  return { current, removed };
}

/** Number of evenly spaced trip dots to draw on a route: round trips per patient, at least 1. */
export function tripDots(b: Burden): number {
  return Math.max(1, Math.round(b.roundTrips));
}

export type MetricKey = 'nights' | 'hours' | 'roundTrips';

export function metricValue(b: Burden, m: MetricKey): number {
  return b[m];
}

/**
 * Stretch ("Finland folds inward"): the road distance x at which a patient on the LONG
 * schedule would travel the same km as a patient on the SHORT schedule travels from the
 * real distance d. Km on the long course is linear in distance within each branch
 * (commuter up to the threshold, stayer beyond it), so each branch is solved directly.
 * Returns x / d (1 = stays put; smaller = folds towards the unit).
 */
export function equivalentDistanceFraction(route: Route, indication: Indication, p: Params): number {
  const d = route.road_km;
  if (d <= 0) return 1;
  const target = perPatient(route, indication, 'short', p).km;
  const T = p.commute_threshold_km;
  const kmPerRoadKm = (x: number) => perPatient({ road_km: x, drive_min: 0 }, indication, 'long', p).km / x;
  const commuterRate = kmPerRoadKm(Math.min(T, 1)); // any x <= T
  const stayerRate = kmPerRoadKm(T + 1); // any x > T
  const candidates: number[] = [];
  if (commuterRate > 0) {
    const x = target / commuterRate;
    if (x <= T) candidates.push(x);
  }
  if (stayerRate > 0) {
    const x = target / stayerRate;
    if (x > T) candidates.push(x);
  }
  const x = candidates.length ? Math.max(...candidates) : T;
  return Math.max(0, Math.min(1, x / d));
}
