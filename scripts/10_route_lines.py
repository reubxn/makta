"""Phase 3: road route geometry from each municipality centre to its radiotherapy unit.

For every municipality code in public/data/routes.json, fetch the OSRM route service
(router.project-osrm.org, overview=full, geojson geometry). Each raw response is cached in
data/raw/osrm_routes/<code>.json and never fetched twice. Lines are simplified (0.0025 deg),
rounded to 4 decimals, and the first/last points are snapped to the exact municipality centre
and unit coordinates. km/min stay those of routes.json (the OSRM table values the app uses);
the geometry is for drawing only.
"""
import json
import time
from pathlib import Path

import requests
from shapely.geometry import LineString

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "osrm_routes"
OUT = ROOT / "public" / "data" / "route_lines.json"
RAW.mkdir(parents=True, exist_ok=True)

OSRM = "https://router.project-osrm.org/route/v1/driving/"
HEADERS = {"User-Agent": "matka-hackathon-data-script/0.1 (Junction 2026; cached, low volume)"}


def fetch(code, a, b):
    cache = RAW / f"{code}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    url = f"{OSRM}{a[0]:.5f},{a[1]:.5f};{b[0]:.5f},{b[1]:.5f}?overview=full&geometries=geojson"
    data = None
    for attempt in range(5):
        try:
            r = requests.get(url, headers=HEADERS, timeout=60)
            if r.status_code == 200:
                data = r.json()
                break
            print(f"  {code}: OSRM HTTP {r.status_code}, retry {attempt + 1}")
        except requests.RequestException as e:
            print(f"  {code}: OSRM error {e}, retry {attempt + 1}")
        time.sleep(2 * (attempt + 1))
    time.sleep(0.6)  # be polite
    if data is None or data.get("code") != "Ok":
        raise SystemExit(f"OSRM route failed for {code}: {data and data.get('code')}")
    cache.write_text(json.dumps({"url": url, "accessed": time.strftime("%Y-%m-%d"), **data}))
    return data


def main():
    routes = json.loads((ROOT / "public/data/routes.json").read_text())["routes"]
    munis = {m["code"]: m for m in json.loads((ROOT / "public/data/municipalities.json").read_text())["municipalities"]}
    units = {u["id"]: u for u in json.loads((ROOT / "public/data/rt_units.json").read_text())["units"]}
    out = {}
    worst = (0.0, None)
    for i, (code, r) in enumerate(sorted(routes.items())):
        m, u = munis[code], units[r["unit_id"]]
        a, b = (m["lon"], m["lat"]), (u["lon"], u["lat"])
        data = fetch(code, a, b)
        route = data["routes"][0]
        coords = route["geometry"]["coordinates"]
        if len(coords) < 2:
            coords = [list(a), list(b)]
        line = LineString(coords).simplify(0.0025, preserve_topology=False)
        path = [[round(x, 4), round(y, 4)] for x, y in line.coords]
        path[0] = [round(a[0], 5), round(a[1], 5)]
        path[-1] = [round(b[0], 5), round(b[1], 5)]
        osrm_km = route["distance"] / 1000
        diff = abs(osrm_km - r["road_km"])
        if diff > worst[0]:
            worst = (diff, code)
        out[code] = {
            "unit_id": r["unit_id"],
            "km": r["road_km"],
            "min": r["drive_min"],
            "osrm_route_km": round(osrm_km, 1),
            "path": path,
        }
        if i % 25 == 0:
            print(f"  {i}/{len(routes)} {code} {m['name_fi']} -> {r['unit_id']} {len(path)} pts")
    missing = set(routes) - set(out)
    assert not missing, f"missing routes: {sorted(missing)}"
    OUT.write_text(json.dumps({
        "generated": time.strftime("%Y-%m-%d"),
        "kind": "calculated",
        "source_ids": ["osrm_table", "wikidata_coords"],
        "note": ("Road route geometry from each municipality's centre point to its radiotherapy unit "
                 "(OSRM route service, OpenStreetMap data), simplified for drawing. km and min are the "
                 "routes.json values used everywhere else in the app; the drawn line is for orientation."),
        "routes": out,
    }, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} kB, {len(out)} routes)")
    print(f"largest |OSRM route km - routes.json road_km|: {worst[0]:.1f} km at {worst[1]}")


if __name__ == "__main__":
    main()
