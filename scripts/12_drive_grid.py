"""Drive-time grid for the burden terrain: OSRM road distance and drive time from points on a
regular lon/lat grid (~10 km) to the radiotherapy unit of the municipality each point lies in
(the same unit routes.json uses for that municipality).

OSRM table service (router.project-osrm.org), batches of <= 99 sources + 1 destination, each
response cached in data/raw/osrm_grid/ and never fetched twice. Points are snapped by OSRM to the
nearest road, so the off-road part of a trip from wilderness is not counted. Points outside the
mainland municipalities (sea, Åland, other countries) are null.
Output: public/data/drive_grid.json (row-major from the south-west corner).
"""
import hashlib
import json
import time
from pathlib import Path

import requests
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "osrm_grid"
OUT = ROOT / "public" / "data" / "drive_grid.json"
RAW.mkdir(parents=True, exist_ok=True)
OSRM = "https://router.project-osrm.org/table/v1/driving/"
HEADERS = {"User-Agent": "matka-hackathon-data-script/0.1 (Junction 2026; cached, low volume)"}

LON0, LAT0 = 19.40, 59.70
DLON, DLAT = 0.18, 0.09  # ~10 km north-south; 6-10 km east-west across Finland
COLS, ROWS = 70, 118


def table(sources, dest):
    coords = sources + [dest]
    coord_str = ";".join(f"{lon:.5f},{lat:.5f}" for lon, lat in coords)
    src = ";".join(str(i) for i in range(len(sources)))
    url = f"{OSRM}{coord_str}?sources={src}&destinations={len(sources)}&annotations=duration,distance"
    cache = RAW / f"{hashlib.sha256(url.encode()).hexdigest()[:20]}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    data = None
    for attempt in range(5):
        try:
            r = requests.get(url, headers=HEADERS, timeout=90)
            if r.status_code == 200:
                data = r.json()
                break
            print(f"  OSRM HTTP {r.status_code}, retry {attempt + 1}")
        except requests.RequestException as e:
            print(f"  OSRM error {e}, retry {attempt + 1}")
        time.sleep(2 * (attempt + 1))
    time.sleep(1.0)
    if data is None or data.get("code") != "Ok":
        raise SystemExit(f"OSRM table failed: {data and data.get('code')}")
    cache.write_text(json.dumps({"url": url, "accessed": time.strftime("%Y-%m-%d"), **data}))
    return data


def main():
    geo = json.loads((ROOT / "public/data/municipalities.geojson").read_text())
    routes = json.loads((ROOT / "public/data/routes.json").read_text())["routes"]
    units = {u["id"]: u for u in json.loads((ROOT / "public/data/rt_units.json").read_text())["units"]}
    polys, codes = [], []
    for f in geo["features"]:
        c = f["properties"]["code"]
        if c in routes:
            polys.append(shape(f["geometry"]))
            codes.append(c)
    tree = STRtree(polys)
    cells = {}  # index -> (code, lon, lat)
    for j in range(ROWS):
        for i in range(COLS):
            lon, lat = LON0 + i * DLON, LAT0 + j * DLAT
            p = Point(lon, lat)
            for k in tree.query(p):
                if polys[k].contains(p):
                    cells[j * COLS + i] = (codes[k], lon, lat)
                    break
    print(f"{len(cells)} grid points inside mainland municipalities")
    by_unit = {}
    for idx, (code, lon, lat) in cells.items():
        by_unit.setdefault(routes[code]["unit_id"], []).append((idx, lon, lat))
    km = [None] * (COLS * ROWS)
    mins = [None] * (COLS * ROWS)
    n_req = 0
    for uid, pts in sorted(by_unit.items()):
        u = units[uid]
        for s in range(0, len(pts), 99):
            chunk = pts[s : s + 99]
            data = table([(lon, lat) for _, lon, lat in chunk], (u["lon"], u["lat"]))
            n_req += 1
            for (idx, _, _), dur, dist in zip(chunk, data["durations"], data["distances"]):
                if dur[0] is not None and dist[0] is not None:
                    mins[idx] = round(dur[0] / 60, 1)
                    km[idx] = round(dist[0] / 1000, 1)
        print(f"  {uid}: {len(pts)} points")
    # Plausibility: a point whose route is far longer than its own municipality's centre route was
    # snapped onto the wrong road network (eastern Lapland points snap to roads in Russia) or hit a long
    # ferry wait. Drop those and fill every inside point without a value from its routed neighbours.
    dropped = 0
    for idx, (code, _, _) in cells.items():
        r = routes[code]
        if mins[idx] is not None and (km[idx] > 1.5 * r["road_km"] + 60 or mins[idx] > 1.5 * r["drive_min"] + 60):
            km[idx] = mins[idx] = None
            dropped += 1
    filled = 0
    for _ in range(20):
        todo = [i for i in cells if mins[i] is None]
        if not todo:
            break
        updates = {}
        for idx in todo:
            i, j = idx % COLS, idx // COLS
            nb = [(j + dj) * COLS + (i + di) for dj in (-1, 0, 1) for di in (-1, 0, 1)
                  if (di or dj) and 0 <= i + di < COLS and 0 <= j + dj < ROWS]
            vals = [(km[n], mins[n]) for n in nb if mins[n] is not None]
            if vals:
                updates[idx] = (round(sum(v[0] for v in vals) / len(vals), 1), round(sum(v[1] for v in vals) / len(vals), 1))
        for idx, (k, m) in updates.items():
            km[idx], mins[idx] = k, m
            filled += 1
    print(f"dropped {dropped} implausible points; filled {filled} inside points from neighbours")
    valid = sum(v is not None for v in mins)
    OUT.write_text(json.dumps({
        "generated": time.strftime("%Y-%m-%d"),
        "kind": "calculated",
        "source_ids": ["osrm_table", "statfi_wfs"],
        "note": ("Road km and drive minutes from points on a regular grid (0.18° x 0.09°, about 10 km) to the "
                 "radiotherapy unit of the municipality each point lies in (the unit routes.json uses). OSRM snaps "
                 "each point to the nearest road; the off-road part is not counted. Used only to draw the burden "
                 "terrain; every number in the cards and totals still comes from municipality centre points. "
                 f"{dropped} points whose route was implausibly long for their municipality (snapped to roads in Russia "
                 "or long ferry waits) were dropped, and points without a route were filled with the mean of their "
                 "routed neighbours."),
        "lon0": LON0, "lat0": LAT0, "dlon": DLON, "dlat": DLAT, "cols": COLS, "rows": ROWS,
        "km": km, "min": mins,
    }, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} kB): {valid} routed points, {n_req} OSRM requests; "
          f"max drive {max(v for v in mins if v is not None):.0f} min")


if __name__ == "__main__":
    main()
