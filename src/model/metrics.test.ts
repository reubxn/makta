import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  breastStillLong,
  breastTotals,
  breastYear,
  gridHours,
  tripDots,
  equivalentDistanceFraction,
  courseBurden,
  isCommuter,
  perPatient,
  type MunicipalityInput,
  type Params,
} from './metrics';

const P: Params = {
  commute_threshold_km: 100,
  planning_visit: 1,
  breast_fractions_long: 15,
  breast_fractions_short: 5,
  breast_share_rt: 0.7,
  breast_share_eligible_short: 0.6,
  breast_share_already_short: 0.2,
  bone_fractions_multi: 5,
  bone_fractions_single: 1,
  bone_retreat_single: 0.2,
  bone_retreat_multi: 0.08,
  bone_share_single_now: 0.07,
  kela_car_eur_per_km: 0.33,
  kela_overnight_eur: 20.18,
};

const far = { road_km: 480, drive_min: 400 };
const near = { road_km: 12, drive_min: 18 };

describe('courseBurden', () => {
  it('commuter: round trips = n + planning, no nights', () => {
    const b = courseBurden(near, 15, P);
    expect(b.roundTrips).toBe(16);
    expect(b.nights).toBe(0);
    expect(b.km).toBeCloseTo(16 * 2 * 12);
    expect(b.hours).toBeCloseTo(16 * 2 * 0.3);
    expect(b.kelaEur).toBeCloseTo(16 * 2 * 12 * 0.33);
  });

  it('stayer: weekly trips plus planning, nights = n + planning', () => {
    const b = courseBurden(far, 15, P);
    expect(b.roundTrips).toBe(3 + 1);
    expect(b.nights).toBe(16);
    expect(b.kelaEur).toBeCloseTo(4 * 2 * 480 * 0.33 + 16 * 20.18);
  });

  it('threshold boundary: exactly at threshold commutes, just above stays', () => {
    expect(isCommuter({ road_km: 100, drive_min: 80 }, P)).toBe(true);
    expect(isCommuter({ road_km: 100.01, drive_min: 80 }, P)).toBe(false);
    expect(courseBurden({ road_km: 100, drive_min: 80 }, 5, P).nights).toBe(0);
    expect(courseBurden({ road_km: 100.01, drive_min: 80 }, 5, P).nights).toBe(6);
  });

  it('a 5-session course is one treatment week', () => {
    expect(courseBurden(far, 5, P).roundTrips).toBe(2);
    expect(courseBurden(far, 6, P).roundTrips).toBe(3);
  });
});

describe('perPatient', () => {
  it('far-north breast patient loses most nights away', () => {
    const long = perPatient(far, 'breast', 'long', P);
    const short = perPatient(far, 'breast', 'short', P);
    expect(long.nights).toBe(16);
    expect(short.nights).toBe(6);
    expect(short.nights / long.nights).toBeLessThan(0.5);
  });

  it('bone includes retreatment expectation', () => {
    const multi = perPatient(far, 'bone', 'long', P);
    const single = perPatient(far, 'bone', 'short', P);
    // multi: 5 + 1 nights + 0.08 * (1 + 1)
    expect(multi.nights).toBeCloseTo(6 + 0.08 * 2);
    // single: 1 + 1 nights + 0.2 * (1 + 1)
    expect(single.nights).toBeCloseTo(2 + 0.2 * 2);
    expect(single.nights).toBeLessThan(multi.nights);
  });

  it('near patient has zero nights either way', () => {
    expect(perPatient(near, 'breast', 'long', P).nights).toBe(0);
    expect(perPatient(near, 'bone', 'short', P).nights).toBe(0);
  });
});

describe('breastTotals', () => {
  const rows: MunicipalityInput[] = [
    { code: 'a', county_code: 'X', route: far, cases: 3.2 },
    { code: 'b', county_code: 'X', route: near, cases: 40 },
    { code: 'c', county_code: 'Y', route: { road_km: 150, drive_min: 120 }, cases: 7 },
    { code: 'd', county_code: 'Y', route: { road_km: 0, drive_min: 0 }, cases: 0 },
  ];

  it('national equals sum of counties', () => {
    const t = breastTotals(rows, P, true);
    const keys = ['roundTrips', 'nights', 'km', 'hours', 'kelaEur', 'patients', 'machineSessions'] as const;
    for (const k of keys) {
      const sum = Object.values(t.byCounty).reduce((s, r) => s + r[k], 0);
      expect(t.national[k]).toBeCloseTo(sum, 6);
      const sumM = Object.values(t.byMunicipality).reduce((s, r) => s + r[k], 0);
      expect(t.national[k]).toBeCloseTo(sumM, 6);
    }
  });

  it('machine sessions freed = affected x (15 - 5)', () => {
    const t = breastTotals(rows, P, true);
    const affected = (3.2 + 40 + 7) * 0.7 * 0.6 * 0.8;
    expect(t.national.patients).toBeCloseTo(affected);
    expect(t.national.machineSessions).toBeCloseTo(affected * 10);
  });

  it('lever off removes nothing', () => {
    const t = breastTotals(rows, P, false);
    expect(t.national.nights).toBe(0);
    expect(t.national.machineSessions).toBe(0);
  });

  it('no NaN anywhere', () => {
    const t = breastTotals(rows, P, true);
    for (const r of [t.national, ...Object.values(t.byCounty), ...Object.values(t.byMunicipality)]) {
      for (const v of Object.values(r)) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('breastYear (totals block: never zeros)', () => {
  const rows: MunicipalityInput[] = [
    { code: 'a', county_code: 'X', route: far, cases: 3.2 },
    { code: 'b', county_code: 'X', route: near, cases: 40 },
    { code: 'c', county_code: 'Y', route: { road_km: 150, drive_min: 120 }, cases: 7 },
  ];
  const affected = (3.2 + 40 + 7) * 0.7 * 0.6 * 0.8;

  it('lever off: yearly burden of eligible patients still on 15 sessions', () => {
    const y = breastYear(rows, P);
    expect(y.current.patients).toBeCloseTo(affected);
    expect(y.current.machineSessions).toBeCloseTo(affected * 15);
    // Only the stayers (a, c) have nights: 16 per patient on 15 sessions.
    expect(y.current.nights).toBeCloseTo((3.2 + 7) * 0.7 * 0.6 * 0.8 * 16);
    expect(y.current.nights).toBeGreaterThan(0);
    expect(y.current.roundTrips).toBeGreaterThan(0);
  });

  it('lever on: removed equals breastTotals national and is smaller than the current burden', () => {
    const y = breastYear(rows, P);
    const t = breastTotals(rows, P, true).national;
    for (const k of ['nights', 'roundTrips', 'hours', 'km', 'machineSessions', 'patients'] as const) {
      expect(y.removed[k]).toBeCloseTo(t[k], 6);
      if (k !== 'patients') expect(y.removed[k]).toBeLessThan(y.current[k]);
    }
    expect(y.removed.machineSessions).toBeCloseTo(affected * 10);
  });

  it('current minus removed equals the same patients on 5 sessions', () => {
    const r = { road_km: 300, drive_min: 240 };
    const cur = breastStillLong(r, 10, P);
    const rem = breastTotals([{ code: 'x', county_code: 'X', route: r, cases: 10 }], P, true).national;
    const n = 10 * 0.7 * 0.6 * 0.8;
    expect(cur.nights - rem.nights).toBeCloseTo(n * perPatient(r, 'breast', 'short', P).nights);
    expect(cur.machineSessions - rem.machineSessions).toBeCloseTo(n * 5);
  });

  it('trip dots: 4 round trips on 15 sessions, 2 on 5, at least 1', () => {
    expect(tripDots(perPatient(far, 'breast', 'long', P))).toBe(4);
    expect(tripDots(perPatient(far, 'breast', 'short', P))).toBe(2);
    expect(tripDots(perPatient(far, 'bone', 'short', P))).toBe(2);
    expect(tripDots({ roundTrips: 0, nights: 0, km: 0, hours: 0, kelaEur: 0 })).toBe(1);
  });
});

describe('gridHours (burden terrain)', () => {
  const g = { lon0: 20, lat0: 60, dlon: 1, dlat: 1, cols: 3, rows: 1, km: [12, null, 480], min: [18, null, 400] };
  it('matches perPatient hours point by point; outside is -1', () => {
    const h = gridHours(g, 'breast', 'long', P);
    expect(h[0]).toBeCloseTo(perPatient(near, 'breast', 'long', P).hours);
    expect(h[1]).toBe(-1);
    expect(h[2]).toBeCloseTo(perPatient(far, 'breast', 'long', P).hours);
  });
  it('the lever lowers every point', () => {
    const a = gridHours(g, 'breast', 'long', P);
    const b = gridHours(g, 'breast', 'short', P);
    expect(b[0]).toBeLessThan(a[0]);
    expect(b[2]).toBeLessThan(a[2]);
  });
});

describe('real routes (public/data/routes.json)', () => {
  const routes = JSON.parse(fs.readFileSync('public/data/routes.json', 'utf8')).routes;
  const params = Object.fromEntries(
    JSON.parse(fs.readFileSync('public/data/parameters.json', 'utf8')).parameters.map((p: { id: string; default: number }) => [p.id, p.default]),
  ) as unknown as Params;

  it('Utsjoki (890) patients are stayers and lose most of their nights away', () => {
    const r = routes['890'];
    expect(r.road_km).toBeGreaterThan(400);
    expect(isCommuter(r, params)).toBe(false);
    const long = perPatient(r, 'breast', 'long', params);
    const short = perPatient(r, 'breast', 'short', params);
    expect(short.nights).toBeLessThan(long.nights / 2);
    expect(perPatient(r, 'bone', 'short', params).nights).toBeLessThan(perPatient(r, 'bone', 'long', params).nights / 2);
  });

  it('Helsinki (091) commutes', () => {
    const r = routes['091'];
    expect(r.road_km).toBeLessThan(20);
    expect(isCommuter(r, params)).toBe(true);
    expect(perPatient(r, 'breast', 'long', params).nights).toBe(0);
  });

  it('no NaN for any municipality, indication or schedule', () => {
    for (const r of Object.values(routes) as { road_km: number; drive_min: number }[]) {
      for (const ind of ['bone', 'breast'] as const)
        for (const sch of ['long', 'short'] as const)
          for (const v of Object.values(perPatient(r, ind, sch, params))) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('equivalentDistanceFraction (fold inward)', () => {
  it('a commuter on 15 vs 5 sessions folds to about a third of the distance', () => {
    // short: 6 trips x 2 x 30 km = 360 km; long at x: 16 x 2 x x = 360 -> x = 11.25
    expect(equivalentDistanceFraction({ road_km: 30, drive_min: 30 }, 'breast', P)).toBeCloseTo(11.25 / 30);
  });
  it('a far-north stayer folds inward but never past the unit, never outward', () => {
    const f = equivalentDistanceFraction(far, 'breast', P);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(1);
  });
  it('long and short burdens match at the folded distance', () => {
    const r = { road_km: 300, drive_min: 240 };
    const f = equivalentDistanceFraction(r, 'breast', P);
    const folded = { road_km: 300 * f, drive_min: 240 * f };
    expect(perPatient(folded, 'breast', 'long', P).km).toBeCloseTo(perPatient(r, 'breast', 'short', P).km, 6);
  });
});
