"""Phase 1 step 1: municipalities with county, centre point and population.

Sources (all cached in data/raw/):
  - Statistics Finland WFS kunta1000k_2026 / hyvinvointialue1000k_2026:
    municipality list, Finnish/Swedish names, county by spatial join,
    fallback centre point (polygon representative point).
  - Wikidata SPARQL: P625 coordinate matched on P1203 (Finnish municipality
    number), current municipalities only.
  - StatFin PxWeb table 11re (population 31.12. by 1-year age and sex,
    2026-01-01 area division), latest year, aggregated to 5-year bands.

Åland (16 municipalities, wellbeing-services code 91) is excluded.
Output: public/data/municipalities.json
"""

import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shapely.geometry import shape  # noqa: E402

from geo_common import (  # noqa: E402
    ALAND_MUNI_CODES, COUNTY_LAYER, MUNI_LAYER, PUBLIC_DATA, RAW,
    cached_get, county_by_municipality, wfs_layer,
)

PX_BASE = "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/vaerak/11re.px"
SPARQL = "https://query.wikidata.org/sparql"

WIKIDATA_QUERY = """
SELECT ?item ?code ?coord ?dissolved ?isMuni WHERE {
  ?item wdt:P1203 ?code .
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P576 ?dissolved . }
  BIND(EXISTS { ?item wdt:P31 wd:Q856076 } AS ?isMuni)
}
"""

BANDS = [(lo, lo + 4) for lo in range(0, 85, 5)] + [(85, None)]


def band_label(lo, hi):
    return f"{lo}+" if hi is None else f"{lo}-{hi}"


# ---------------------------------------------------------------- population
def fetch_population():
    meta = json.loads(cached_get(RAW / "statfin" / "11re_meta.json", PX_BASE))
    var = {v["code"]: v for v in meta["variables"]}
    area_code = next(c for c in var if c.startswith("alue_"))
    age_code = next(c for c in var if c.startswith("ikaryhma_"))
    sex_code = next(c for c in var if c.startswith("sukupuoli_"))
    year = max(var["timeperiod_y"]["values"])
    areas = [v for v in var[area_code]["values"] if v.startswith("KU")]
    ages = [v for v in var[age_code]["values"] if v != "SSS"]
    query = {
        "query": [
            {"code": area_code, "selection": {"filter": "item", "values": areas}},
            {"code": age_code, "selection": {"filter": "item", "values": ages}},
            {"code": sex_code, "selection": {"filter": "item", "values": ["1", "2"]}},
            {"code": "timeperiod_y", "selection": {"filter": "item", "values": [year]}},
        ],
        "response": {"format": "json-stat2"},
    }
    data = json.loads(cached_get(RAW / "statfin" / f"11re_{year}_{area_code}.json", PX_BASE,
                                 method="POST", json_body=query))
    dims = data["id"]
    sizes = data["size"]
    idx = {d: data["dimension"][d]["category"]["index"] for d in dims}
    values = data["value"]

    def flat(**kw):
        i = 0
        for d, s in zip(dims, sizes):
            i = i * s + idx[d][kw[d]]
        return i

    pop = {}
    for a in areas:
        code = a[2:]
        rec = {"male": [0] * len(BANDS), "female": [0] * len(BANDS)}
        for age in ages:
            n_age = int(age.rstrip("-"))
            b = min(n_age // 5, len(BANDS) - 1)
            for sx, key in (("1", "male"), ("2", "female")):
                v = values[flat(**{area_code: a, age_code: age, sex_code: sx,
                                   "timeperiod_y": year, "contentscode": "vaerak-vaesto"})]
                rec[key][b] += int(v or 0)
        pop[code] = rec
    return int(year), area_code, meta["title"], pop


# ---------------------------------------------------------------- wikidata
def fetch_wikidata():
    text = cached_get(RAW / "wikidata" / "p1203_p625.json", SPARQL,
                      params={"query": WIKIDATA_QUERY, "format": "json"})
    rows = json.loads(text)["results"]["bindings"]
    by_code = {}
    for r in rows:
        code = r["code"]["value"].zfill(3)
        if "coord" not in r:
            continue
        lit = r["coord"]["value"]  # "Point(lon lat)"
        if not lit.startswith("Point("):
            continue
        lon, lat = (float(x) for x in lit[6:-1].split())
        cand = {
            "item": r["item"]["value"].rsplit("/", 1)[1],
            "lon": lon, "lat": lat,
            "dissolved": "dissolved" in r,
            "is_muni": r["isMuni"]["value"] == "true",
        }
        by_code.setdefault(code, []).append(cand)
    return by_code


def pick_wikidata(cands, polygon):
    """Current municipality item whose P625 lies inside (or near) its polygon."""
    good = [c for c in cands if not c["dissolved"] and c["is_muni"]]
    # de-duplicate identical items (multiple coordinate statements -> multiple rows)
    items = {c["item"] for c in good}
    if len(items) != 1:
        return None, f"{len(items)} current municipality items"
    pts = [c for c in good]
    from shapely.geometry import Point
    for c in pts:
        if polygon.buffer(0.02).contains(Point(c["lon"], c["lat"])):
            return c, None
    return None, "P625 outside municipality polygon"


# ---------------------------------------------------------------- main
def main():
    munis = wfs_layer(MUNI_LAYER)
    counties = wfs_layer(COUNTY_LAYER)
    county_of = county_by_municipality(munis, counties)
    cprops = {f["properties"]["hyvinvointialue"]: f["properties"] for f in counties["features"]}

    year, area_code, px_title, pop = fetch_population()
    wd = fetch_wikidata()

    wfs_codes = {f["properties"]["kunta"] for f in munis["features"]}
    if wfs_codes != set(pop):
        sys.exit(f"WFS vs PxWeb municipality mismatch: {sorted(wfs_codes ^ set(pop))}")

    out = []
    fallbacks = []
    for f in sorted(munis["features"], key=lambda f: f["properties"]["kunta"]):
        p = f["properties"]
        code = p["kunta"]
        if code in ALAND_MUNI_CODES:
            continue
        poly = shape(f["geometry"])
        chosen, why = pick_wikidata(wd.get(code, []), poly)
        if chosen:
            lon, lat, method, qid = chosen["lon"], chosen["lat"], "wikidata_P625", chosen["item"]
        else:
            rp = poly.representative_point()
            lon, lat, method, qid = rp.x, rp.y, "polygon_representative_point", None
            fallbacks.append((code, p["nimi"], why or "no Wikidata match"))
        cc = county_of[code]
        cp = cprops[cc]
        pr = pop[code]
        rec = {
            "code": code,
            "name_fi": p["nimi"],
            "name_sv": p["namn"],
            "county_code": cc,
            "county_name_fi": cp["nimi"].strip(),
            "county_name_sv": cp["namn"].strip(),
            "county_name_en": cp["name"].strip(),
            "lon": round(lon, 5),
            "lat": round(lat, 5),
            "centre_method": method,
            "wikidata": qid,
            "population": sum(pr["male"]) + sum(pr["female"]),
            "pop_female": sum(pr["female"]),
            "pop_male": sum(pr["male"]),
            "pop_female_by_age": {band_label(*b): n for b, n in zip(BANDS, pr["female"])},
            "pop_male_by_age": {band_label(*b): n for b, n in zip(BANDS, pr["male"])},
        }
        rec["pop_female_45plus"] = sum(n for (lo, _), n in zip(BANDS, pr["female"]) if lo >= 45)
        out.append(rec)

    doc = {
        "generated": date.today().isoformat(),
        "year_population": year,
        "population_reference_date": f"{year}-12-31",
        "area_division": f"{area_code} (municipalities 2026-01-01); WFS {MUNI_LAYER}",
        "excluded": "Åland (16 municipalities, wellbeing services code 91): separate health system",
        "centre_point_note": "Distances are measured from each municipality's centre point.",
        "source_ids": ["statfin_population", "wikidata_coords", "statfi_wfs"],
        "municipalities": out,
    }
    path = PUBLIC_DATA / "municipalities.json"
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")

    # ------------------------------------------------------------ sanity
    print(f"PxWeb table: {px_title}; year {year}")
    print(f"Municipalities (mainland): {len(out)}")
    tot = sum(m["population"] for m in out)
    print(f"Total population {year}: {tot:,} (women {sum(m['pop_female'] for m in out):,}, "
          f"women 45+ {sum(m['pop_female_45plus'] for m in out):,})")
    whole_country = sum(sum(v["male"]) + sum(v["female"]) for v in pop.values())
    print(f"  incl. Åland: {whole_country:,}")
    counts = {}
    for m in out:
        counts.setdefault((m["county_code"], m["county_name_fi"]), [0, 0])
        counts[(m["county_code"], m["county_name_fi"])][0] += 1
        counts[(m["county_code"], m["county_name_fi"])][1] += m["population"]
    print(f"Counties/areas: {len(counts)}")
    for (cc, n), (k, ppl) in sorted(counts.items()):
        print(f"  {cc} {n}: {k} municipalities, {ppl:,} people")
    for code in ("091", "890"):
        m = next(x for x in out if x["code"] == code)
        print(f"  {code} {m['name_fi']}: lon {m['lon']}, lat {m['lat']} ({m['centre_method']}), pop {m['population']:,}")
    print(f"Centre point fallbacks: {len(fallbacks)}")
    for fb in fallbacks:
        print(f"  {fb}")
    print(f"Wrote {path.relative_to(PUBLIC_DATA.parent.parent)} ({path.stat().st_size/1e3:.0f} kB)")


if __name__ == "__main__":
    main()
