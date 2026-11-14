import { describe, expect, it } from 'vitest';
import {
  breastTotals,
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
