"""Phase 1.4: road distance and drive time from each municipality centre to its nearest radiotherapy unit.

For each municipality: take the 3 nearest units by straight line, query OSRM table service
(router.project-osrm.org, batches <= 100 coordinates, cached in data/raw/osrm/), pick the
nearest by drive time. If OSRM fails, fall back to straight-line km x 1.3 at 70 km/h and flag
method "estimated".
"""
import hashlib
import json
import math
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "osrm"
OUT = ROOT / "public" / "data" / "routes.json"
RAW.mkdir(parents=True, exist_ok=True)

OSRM = "https://router.project-osrm.org/table/v1/driving/"
HEADERS = {"User-Agent": "matka-hackathon-data-script/0.1 (Junction 2026; cached, low volume)"}


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def osrm_table(sources, destinations):
    """sources/destinations: lists of (lon, lat). Returns (durations_s, distances_m) matrices or None."""
    coords = sources + destinations
    assert len(coords) <= 100
    coord_str = ";".join(f"{lon:.5f},{lat:.5f}" for lon, lat in coords)
    src_idx = ";".join(str(i) for i in range(len(sources)))
    dst_idx = ";".join(str(len(sources) + i) for i in range(len(destinations)))
    url = f"{OSRM}{coord_str}?sources={src_idx}&destinations={dst_idx}&annotations=duration,distance"
    key = hashlib.sha256(url.encode()).hexdigest()[:20]
    cache = RAW / f"{key}.json"
    if cache.exists():
        data = json.loads(cache.read_text())
    else:
        data = None
        for attempt in range(4):
            try:
                r = requests.get(url, headers=HEADERS, timeout=60)
                if r.status_code == 200:
                    data = r.json()
                    break
                print(f"  OSRM HTTP {r.status_code}, retry {attempt + 1}")
            except requests.RequestException as e:
                print(f"  OSRM error {e}, retry {attempt + 1}")
            time.sleep(2 * (attempt + 1))
        time.sleep(1.2)  # be polite
        if data is None:
            return None
        cache.write_text(json.dumps({"url": url, "accessed": time.strftime("%Y-%m-%d"), **data}))
    if data.get("code") != "Ok":
        return None
    return data["durations"], data["distances"]


# Sourced single-unit catchments: route these counties to the unit that serves them,
# not the nearest by drive time. Other counties use the nearest unit (labelled so).
CATCHMENT = {
    "01": ("hus", "unit_hus"),  # HUS handles all external radiotherapy in Uusimaa
    "02": ("hus", "unit_hus"),
    "03": ("hus", "unit_hus"),
    "04": ("hus", "unit_hus"),
    "90": ("hus", "unit_hus"),
    "08": ("tampere", "tays_catchment"),  # Tays: all of Pirkanmaa
    "21": ("oulu", "rovaniemi_no_unit"),  # Lapland patients are treated at OYS
}


def main():
    munis = json.loads((ROOT / "public/data/municipalities.json").read_text())["municipalities"]
    units = json.loads((ROOT / "public/data/rt_units.json").read_text())["units"]
    unit_ids = [u["id"] for u in units]
    unit_coords = [(u["lon"], u["lat"]) for u in units]

    # All units are destinations; batch municipalities so sources + destinations <= 100.
    batch = 100 - len(units)
    results = {}
    n_osrm = n_est = 0
    for start in range(0, len(munis), batch):
        chunk = munis[start : start + batch]
        print(f"batch {start}-{start + len(chunk)}")
        table = osrm_table([(m["lon"], m["lat"]) for m in chunk], unit_coords)
        for i, m in enumerate(chunk):
            straight = [
                (haversine_km(m["lat"], m["lon"], u["lat"], u["lon"]), j) for j, u in enumerate(units)
            ]
            straight.sort()
            nearest3 = [j for _, j in straight[:3]]
            candidates = []
            for j in nearest3:
                sl = haversine_km(m["lat"], m["lon"], units[j]["lat"], units[j]["lon"])
                dur = dist = None
                if table is not None:
                    dur = table[0][i][j]
                    dist = table[1][i][j]
                if dur is not None and dist is not None:
                    candidates.append(
                        {
                            "unit_id": unit_ids[j],
                            "straight_km": round(sl, 1),
                            "road_km": round(dist / 1000, 1),
                            "drive_min": round(dur / 60, 1),
                            "method": "osrm",
                        }
                    )
                else:
                    candidates.append(
                        {
                            "unit_id": unit_ids[j],
                            "straight_km": round(sl, 1),
                            "road_km": round(sl * 1.3, 1),
                            "drive_min": round(sl * 1.3 / 70 * 60, 1),
                            "method": "estimated",
                        }
                    )
            best = min(candidates, key=lambda c: c["drive_min"])
            basis, basis_source = "nearest_drive_time", None
            if m["county_code"] in CATCHMENT:
                uid, skey = CATCHMENT[m["county_code"]]
                j = unit_ids.index(uid)
                sl = haversine_km(m["lat"], m["lon"], units[j]["lat"], units[j]["lon"])
                if table is not None and table[0][i][j] is not None:
                    best = {"unit_id": uid, "straight_km": round(sl, 1), "road_km": round(table[1][i][j] / 1000, 1), "drive_min": round(table[0][i][j] / 60, 1), "method": "osrm"}
                else:
                    best = {"unit_id": uid, "straight_km": round(sl, 1), "road_km": round(sl * 1.3, 1), "drive_min": round(sl * 1.3 / 70 * 60, 1), "method": "estimated"}
                basis, basis_source = "county_catchment", skey
            if best["method"] == "osrm":
                n_osrm += 1
            else:
                n_est += 1
            results[m["code"]] = {
                "code": m["code"],
                "unit_id": best["unit_id"],
                "road_km": best["road_km"],
                "drive_min": best["drive_min"],
                "method": best["method"],
                "basis": basis,
                "basis_source": basis_source,
                "candidates": candidates,
            }

    out = {
        "generated": time.strftime("%Y-%m-%d"),
        "kind": "calculated",
        "source_ids": ["osrm_table", "wikidata_coords"],
        "note": "Road km and drive minutes from each municipality's centre point (not where patients live). "
        "Uusimaa and Helsinki route to HUS, Pirkanmaa to Tays and Lapland to OYS, as their sources state; "
        "other municipalities route to the unit with the shortest drive among the 3 nearest by straight line. "
        "OpenStreetMap data via the public OSRM demo server; 'estimated' = straight line x 1.3 at 70 km/h.",
        "counts": {"osrm": n_osrm, "estimated": n_est},
        "routes": results,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"wrote {OUT} osrm={n_osrm} estimated={n_est}")

    by_name = {m["name_fi"]: m["code"] for m in munis}
    for name, cond in [("Helsinki", lambda r: r["road_km"] < 20), ("Utsjoki", lambda r: r["road_km"] > 400)]:
        r = results[by_name[name]]
        status = "OK" if cond(r) else "FAILED"
        print(f"sanity {name}: {r['unit_id']} {r['road_km']} km {r['drive_min']} min -> {status}")
        assert cond(r), f"sanity check failed for {name}"


if __name__ == "__main__":
    main()
