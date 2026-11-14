"""Shared helpers for the Phase 1 geo scripts (01, 02).

Every download is cached under data/raw/ and never fetched twice.
"""

import json
import time
from pathlib import Path

import requests
from shapely.geometry import shape

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
PUBLIC_DATA = ROOT / "public" / "data"
ACCESSED = "2026-11-14"

WFS_URL = "https://geo.stat.fi/geoserver/wfs"
WFS_YEAR = 2026
MUNI_LAYER = f"tilastointialueet:kunta1000k_{WFS_YEAR}"
COUNTY_LAYER = f"tilastointialueet:hyvinvointialue1000k_{WFS_YEAR}"

# Åland: wellbeing-services code 91 in the WFS layer; its 16 municipalities.
ALAND_COUNTY_CODE = "91"
ALAND_MUNI_CODES = {
    "035", "043", "060", "062", "065", "076", "170", "295",
    "318", "417", "438", "478", "736", "766", "771", "941",
}

HEADERS = {"User-Agent": "matka-data-scripts/0.1 (research prototype)"}


def cached_get(path: Path, url: str, params=None, method="GET", json_body=None, timeout=120):
    """Return response text, from cache if present; else fetch, save, pause 1 s."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return path.read_text(encoding="utf-8")
    print(f"  fetching {url}")
    if method == "POST":
        r = requests.post(url, params=params, json=json_body, headers=HEADERS, timeout=timeout)
    else:
        r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    r.encoding = "utf-8"
    path.write_text(r.text, encoding="utf-8")
    time.sleep(1)
    return r.text


def wfs_layer(layer: str) -> dict:
    """GeoJSON FeatureCollection for a WFS layer in EPSG:4326 (lon, lat order)."""
    name = layer.split(":")[1]
    text = cached_get(
        RAW / "wfs" / f"{name}.json",
        WFS_URL,
        params={
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": layer,
            "outputFormat": "application/json",
            "srsName": "EPSG:4326",
        },
    )
    return json.loads(text)


def wfs_capabilities() -> str:
    return cached_get(
        RAW / "wfs" / "capabilities.xml",
        WFS_URL,
        params={"service": "WFS", "version": "2.0.0", "request": "GetCapabilities"},
    )


def county_by_municipality(munis: dict, counties: dict) -> dict:
    """Spatial join: municipality code -> county code by largest overlap area.

    The WFS municipality layer carries no county attribute and the
    Statistics Finland classification API is not reachable here, so the
    county is the wellbeing services county polygon that covers most of
    the municipality polygon (same source, same year, so borders coincide).
    """
    cgeoms = [(f["properties"]["hyvinvointialue"], shape(f["geometry"]).buffer(0)) for f in counties["features"]]
    out = {}
    for f in munis["features"]:
        code = f["properties"]["kunta"]
        g = shape(f["geometry"]).buffer(0)
        best = max(cgeoms, key=lambda cg: cg[1].intersection(g).area)
        share = best[1].intersection(g).area / g.area
        if share < 0.95:
            print(f"  WARNING: {code} only {share:.1%} inside county {best[0]}")
        out[code] = best[0]
    return out
