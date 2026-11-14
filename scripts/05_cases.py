"""Phase 1.5: allocate national new breast cancer cases to municipalities.

Input: data/raw/breast_cases.json (from the Cancer Registry, see sources) and public/data/municipalities.json.
Method: national cases x (municipality's age-weighted female population / national age-weighted female population).
Weights are age-specific incidence (cases or rates by 5-year band) if available; otherwise women aged 45+.
If county-level counts are available, municipality allocations are scaled to match each county total.
Output: public/data/cases.json (kind: calculated).
"""
import json
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
raw = json.loads((ROOT / "data/raw/breast_cases.json").read_text())
munis = json.loads((ROOT / "public/data/municipalities.json").read_text())["municipalities"]

national = raw["national_cases"]
age = raw.get("age_specific") or None
unit = raw.get("age_specific_unit")


def band_key(b):
    return b.replace("–", "-").replace(" ", "")


weights = {}
if age:
    # Convert to a per-woman rate by band. If given as cases, divide by national women in the band.
    nat_pop = {}
    for m in munis:
        for b, n in m["pop_female_by_age"].items():
            nat_pop[band_key(b)] = nat_pop.get(band_key(b), 0) + n
    rate = {}
    for b, v in age.items():
        k = band_key(b)
        if k not in nat_pop:
            continue
        rate[k] = v / nat_pop[k] if unit == "cases" else v / 1e5
    missing = set(nat_pop) - set(rate)
    method = f"age-specific incidence ({unit}) by 5-year band"
    if missing:
        print("bands without incidence (weight 0):", sorted(missing))
    for m in munis:
        weights[m["code"]] = sum(rate.get(band_key(b), 0) * n for b, n in m["pop_female_by_age"].items())
else:
    method = "women aged 45+"
    for m in munis:
        weights[m["code"]] = m["pop_female_45plus"]

total_w = sum(weights.values())
alloc = {c: national * w / total_w for c, w in weights.items()}

county_counts = raw.get("county_counts")
if county_counts:
    by_county = {}
    for m in munis:
        by_county.setdefault(m["county_code"], 0)
        by_county[m["county_code"]] += alloc[m["code"]]
    for m in munis:
        target = county_counts.get(m["county_code"])
        if target:
            alloc[m["code"]] *= target / by_county[m["county_code"]]
    method += ", scaled to county counts"

out = {
    "generated": time.strftime("%Y-%m-%d"),
    "year": raw["year"],
    "national_cases": national,
    "kind": "calculated",
    "method": method,
    "source_ids": [raw["source_key"], "statfin_population"],
    "note": f"National new breast cancer cases ({raw['year']}, Finnish Cancer Registry) allocated to municipalities by "
    f"female population weighted by {method}. Åland's share is removed. Calculated, not registry counts per municipality.",
    "municipalities": {c: round(v, 3) for c, v in alloc.items()},
}

# Åland is excluded from the municipality list; remove its share so totals reflect mainland only.
if raw.get("aland_cases"):
    scale = (national - raw["aland_cases"]) / national
    out["municipalities"] = {c: round(v * scale, 3) for c, v in alloc.items()}
    out["mainland_cases"] = national - raw["aland_cases"]
else:
    # No Åland count: approximate by excluding Åland women from the weights (already the case, since
    # munis has no Åland). Mainland share of national cases = mainland weight share.
    out["note"] += " Åland women are not in the weights, so the national total is allocated to the mainland (overstates mainland by Åland's share, about 0.5%)."

(ROOT / "public/data/cases.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
total = sum(out["municipalities"].values())
top = sorted(out["municipalities"].items(), key=lambda x: -x[1])[:3]
print(f"method={method} total={total:.1f} national={national} top={top}")
