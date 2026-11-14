"""Phase 3: offline basemap (lakes, land, borders) from Natural Earth 10m.

Downloads four GeoJSON files from the natural-earth-vector repository (public domain),
caches them in data/raw/naturalearth/ (gitignored, ~18 MB) and writes a small clipped,
simplified basemap to public/data/basemap.json for the map to draw without any tile server.
"""
import json
import time
from pathlib import Path

import requests
from shapely.geometry import box, mapping, shape

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "naturalearth"
OUT = ROOT / "public" / "data" / "basemap.json"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
HEADERS = {"User-Agent": "matka-hackathon-data-script/0.1 (Junction 2026; cached, low volume)"}
CLIP = box(3.0, 54.5, 48.0, 74.0)  # wider than Finland so 1920-wide and tilted views never show the edge
MIN_LAKE_DEG2 = 0.0028  # ~8 km2 at Finnish latitudes


def load(name):
    RAW.mkdir(parents=True, exist_ok=True)
    p = RAW / f"{name}.geojson"
    if not p.exists():
        print(f"  fetching {name}")
        r = requests.get(BASE + f"{name}.geojson", headers=HEADERS, timeout=180)
        r.raise_for_status()
        p.write_bytes(r.content)
        time.sleep(1)
    return json.loads(p.read_text(encoding="utf-8"))


def rnd(obj):
    if isinstance(obj, (list, tuple)):
        if obj and isinstance(obj[0], (int, float)):
            return [round(obj[0], 3), round(obj[1], 3)]
        return [rnd(o) for o in obj]
    return obj


def features(fc, tol, min_area=0.0, polygons=True):
    out = []
    for f in fc["features"]:
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        if not g.intersects(CLIP):
            continue
        g = g.intersection(CLIP)
        if polygons and g.area < min_area:
            continue
        g = g.simplify(tol, preserve_topology=True)
        if g.is_empty:
            continue
        if polygons and g.geom_type not in ("Polygon", "MultiPolygon"):
            polys = [p for p in getattr(g, "geoms", []) if p.geom_type in ("Polygon", "MultiPolygon")]
            if not polys:
                continue
        if not polygons and g.geom_type not in ("LineString", "MultiLineString"):
            continue
        gm = mapping(g)
        out.append({"type": "Feature", "properties": {}, "geometry": {"type": gm["type"], "coordinates": rnd(gm["coordinates"])}})
    return {"type": "FeatureCollection", "features": out}


def main():
    lakes = features(load("ne_10m_lakes"), 0.003, MIN_LAKE_DEG2)
    lakes_eu = features(load("ne_10m_lakes_europe"), 0.003, MIN_LAKE_DEG2)
    lakes["features"] += lakes_eu["features"]
    land = features(load("ne_10m_land"), 0.004)
    borders = features(load("ne_10m_admin_0_boundary_lines_land"), 0.004, polygons=False)
    OUT.write_text(json.dumps({
        "note": ("Natural Earth 10m (public domain): lakes (+ Europe supplement), land and land borders, "
                 "clipped to 3-48E, 54.5-74N, simplified, lakes under ~8 km2 dropped. Drawn as a "
                 "static offline basemap; no tile server."),
        "source": "https://github.com/nvkelso/natural-earth-vector (v5, geojson/)",
        "lakes": lakes, "land": land, "borders": borders,
    }, separators=(",", ":")))
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} kB): {len(lakes['features'])} lakes, "
          f"{len(land['features'])} land, {len(borders['features'])} border lines")


if __name__ == "__main__":
    main()
