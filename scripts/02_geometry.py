"""Phase 1 step 2: municipality and wellbeing services county geometry.

Source: Statistics Finland WFS (geo.stat.fi), layers kunta1000k_2026 and
hyvinvointialue1000k_2026, EPSG:4326. Åland excluded.

Outputs:
  public/data/municipalities.geojson  (code, name_fi, name_sv, county_code)
  public/data/counties.geojson        (county_code, name_fi, name_sv, name_en)

Municipalities are simplified as a coverage (shared borders stay shared);
counties are the union of their simplified municipalities, so county
borders line up exactly with municipality borders on the map.
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import shapely  # noqa: E402
from shapely.geometry import mapping, shape  # noqa: E402

from geo_common import (  # noqa: E402
    ALAND_COUNTY_CODE, ALAND_MUNI_CODES, COUNTY_LAYER, MUNI_LAYER, PUBLIC_DATA,
    county_by_municipality, wfs_capabilities, wfs_layer,
)

TOLERANCE_DEG = 0.004  # ~250-450 m; coverage-preserving simplification
DECIMALS = 4           # ~10 m
MAX_BYTES = 2_000_000


def check_layers_exist():
    caps = wfs_capabilities()
    for layer in (MUNI_LAYER, COUNTY_LAYER):
        if f"<Name>{layer}</Name>" not in caps:
            sys.exit(f"Layer {layer} not in WFS capabilities")
    years = sorted(int(y) for y in re.findall(r"<Name>tilastointialueet:kunta1000k_(\d{4})</Name>", caps))
    print(f"WFS municipality layer years available: {years[0]}..{years[-1]}; using {MUNI_LAYER}")


def rounded(geom):
    def rnd(obj):
        if isinstance(obj, (list, tuple)):
            if obj and isinstance(obj[0], (int, float)):
                return [round(obj[0], DECIMALS), round(obj[1], DECIMALS)]
            return [rnd(o) for o in obj]
        return obj
    m = mapping(geom)
    return {"type": m["type"], "coordinates": rnd(m["coordinates"])}


def write_fc(path: Path, features):
    fc = {"type": "FeatureCollection", "features": features}
    path.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    size = path.stat().st_size
    print(f"  wrote {path.relative_to(PUBLIC_DATA.parent.parent)}: {len(features)} features, {size/1e6:.2f} MB")
    if size >= MAX_BYTES:
        sys.exit(f"{path} is {size} bytes, over the 2 MB limit")


def main():
    check_layers_exist()
    munis = wfs_layer(MUNI_LAYER)
    counties = wfs_layer(COUNTY_LAYER)
    county_of = county_by_municipality(munis, counties)

    mfeats = sorted(
        (f for f in munis["features"] if f["properties"]["kunta"] not in ALAND_MUNI_CODES),
        key=lambda f: f["properties"]["kunta"],
    )
    aland_by_join = {c for c, cc in county_of.items() if cc == ALAND_COUNTY_CODE}
    assert aland_by_join == ALAND_MUNI_CODES, f"Åland mismatch: {aland_by_join ^ ALAND_MUNI_CODES}"

    geoms = [shapely.make_valid(shape(f["geometry"])) for f in mfeats]
    simple = shapely.coverage_simplify(geoms, TOLERANCE_DEG, simplify_boundary=True)

    out_m = []
    by_county = {}
    for f, g in zip(mfeats, simple):
        p = f["properties"]
        code = p["kunta"]
        cc = county_of[code]
        by_county.setdefault(cc, []).append(g)
        out_m.append({
            "type": "Feature",
            "properties": {"code": code, "name_fi": p["nimi"], "name_sv": p["namn"], "county_code": cc},
            "geometry": rounded(g),
        })
    write_fc(PUBLIC_DATA / "municipalities.geojson", out_m)

    out_c = []
    for f in sorted(counties["features"], key=lambda f: f["properties"]["hyvinvointialue"]):
        p = f["properties"]
        cc = p["hyvinvointialue"]
        if cc == ALAND_COUNTY_CODE:
            continue
        g = shapely.coverage_union_all(by_county[cc])
        out_c.append({
            "type": "Feature",
            "properties": {
                "county_code": cc,
                "name_fi": p["nimi"].strip(),
                "name_sv": p["namn"].strip(),
                "name_en": p["name"].strip(),
                "n_municipalities": len(by_county[cc]),
            },
            "geometry": rounded(g),
        })
    write_fc(PUBLIC_DATA / "counties.geojson", out_c)

    print(f"Municipalities (mainland): {len(out_m)}; counties: {len(out_c)}")
    for c in out_c:
        print(f"  {c['properties']['county_code']} {c['properties']['name_fi']}: {c['properties']['n_municipalities']}")


if __name__ == "__main__":
    main()
