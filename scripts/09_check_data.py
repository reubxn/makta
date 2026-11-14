"""Data checks (SPEC section 12): every displayed number has a kind and source ids, every
municipality has a route, every source id resolves, and the totals add up.

Run: .venv/bin/python -I scripts/09_check_data.py   (exit code 1 on failure)
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "public" / "data"
errors, notes = [], []


def load(name):
    return json.loads((D / name).read_text())


sources = load("sources.json")["sources"]
ids = {s["id"] for s in sources} | {s["key"] for s in sources}
for s in sources:
    for f in ("id", "key", "title", "url", "accessed", "supports"):
        if not s.get(f):
            errors.append(f"source {s.get('id')} missing {f}")
    if s.get("quote") and len(s["quote"].split()) > 25:
        errors.append(f"source {s['id']} quote longer than 25 words")


def check_ids(where, lst):
    if not lst:
        errors.append(f"{where}: no source ids")
    for i in lst or []:
        if i not in ids:
            errors.append(f"{where}: unknown source id {i}")


KINDS = {"sourced", "calculated", "assumption"}

params = load("parameters.json")["parameters"]
for p in params:
    if p.get("kind") not in KINDS:
        errors.append(f"parameter {p['id']} bad kind {p.get('kind')}")
    if not (p["min"] <= p["default"] <= p["max"]):
        errors.append(f"parameter {p['id']} default outside range")
    if p["kind"] == "sourced":
        check_ids(f"parameter {p['id']}", p["source_ids"])
    for i in p["source_ids"]:
        if i not in ids:
            errors.append(f"parameter {p['id']}: unknown source id {i}")
    if not p.get("rationale"):
        errors.append(f"parameter {p['id']} has no rationale")

facts = load("facts.json")
for f in facts["facts"]:
    if f.get("kind") not in KINDS:
        errors.append(f"fact {f['id']} bad kind")
    check_ids(f"fact {f['id']}", f["source_ids"])
for g in facts["goal3"]:
    check_ids(f"goal3 {g['id']}", g["source_ids"])

munis = load("municipalities.json")["municipalities"]
routes = load("routes.json")
check_ids("routes.json", routes["source_ids"])
for m in munis:
    r = routes["routes"].get(m["code"])
    if not r:
        errors.append(f"no route for {m['code']} {m['name_fi']}")
        continue
    for k in ("road_km", "drive_min"):
        if not (isinstance(r[k], (int, float)) and math.isfinite(r[k]) and r[k] >= 0):
            errors.append(f"route {m['code']} bad {k}")
est = [c for c, r in routes["routes"].items() if r["method"] == "estimated"]
if est:
    notes.append(f"{len(est)} routes estimated (straight line x 1.3)")

units = load("rt_units.json")["units"]
uids = {u["id"] for u in units}
for u in units:
    if not u.get("source_url"):
        errors.append(f"unit {u['id']} has no source url")
    check_ids(f"unit {u['id']}", [u.get("source_id") or u.get("source_key")])
for c, r in routes["routes"].items():
    if r["unit_id"] not in uids:
        errors.append(f"route {c} points to unknown unit {r['unit_id']}")

cases = load("cases.json")
check_ids("cases.json", cases["source_ids"])
tot = sum(cases["municipalities"].values())
target = cases.get("mainland_cases", cases["national_cases"])
if abs(tot - target) > 0.5:
    errors.append(f"cases sum {tot:.1f} != {target}")
missing_cases = [m["code"] for m in munis if m["code"] not in cases["municipalities"]]
if missing_cases:
    errors.append(f"{len(missing_cases)} municipalities without cases")

# Totals add up: recompute breast removed nationally and by county with default parameters.
P = {p["id"]: p["default"] for p in params}


def course(road_km, drive_min, n):
    if road_km <= P["commute_threshold_km"]:
        trips, nights = n + P["planning_visit"], 0
    else:
        trips, nights = math.ceil(n / 5) + P["planning_visit"], n + P["planning_visit"]
    return {"nights": nights, "roundTrips": trips, "hours": trips * 2 * drive_min / 60, "km": trips * 2 * road_km}


county = {}
national = {"nights": 0, "roundTrips": 0, "hours": 0, "km": 0}
for m in munis:
    r = routes["routes"][m["code"]]
    aff = cases["municipalities"][m["code"]] * P["breast_share_rt"] * P["breast_share_eligible_short"] * (1 - P["breast_share_already_short"])
    lo = course(r["road_km"], r["drive_min"], P["breast_fractions_long"])
    sh = course(r["road_km"], r["drive_min"], P["breast_fractions_short"])
    c = county.setdefault(m["county_code"], {k: 0 for k in national})
    for k in national:
        d = aff * (lo[k] - sh[k])
        c[k] += d
        national[k] += d
for k in national:
    s = sum(c[k] for c in county.values())
    if abs(s - national[k]) > 1e-6 * max(1, national[k]):
        errors.append(f"national {k} != sum of counties")
    if not math.isfinite(national[k]):
        errors.append(f"national {k} not finite")
notes.append("national breast removed (defaults): " + ", ".join(f"{k}={v:,.0f}" for k, v in national.items()))

# Optional AI outputs.
for name in ("unit_statements.json", "memos.json"):
    p = D / name
    if not p.exists():
        notes.append(f"{name} not present yet")
        continue
    j = json.loads(p.read_text())
    if not j.get("method"):
        errors.append(f"{name} has no method")
    if name == "memos.json":
        # Re-run the memo validator live against current data; never trust the stored counts.
        import re

        sys.path.insert(0, str(ROOT / "scripts"))
        from generate_memos import build_facts, validate  # noqa: E402

        for mm in j["memos"]:
            checked, passed, problems = validate(mm["text"], build_facts(mm["county_code"]))
            if problems or passed != checked:
                errors.append(f"memo {mm['county_code']} fails live validation ({passed}/{checked} numbers): {problems[:3]}")
            if (checked, passed) != (mm["numbers_checked"], mm["numbers_passed"]):
                errors.append(f"memo {mm['county_code']}: stored counts {mm['numbers_passed']}/{mm['numbers_checked']} differ from live {passed}/{checked}")
            if mm.get("validated") is not (not problems):
                errors.append(f"memo {mm['county_code']}: stored validated flag {mm.get('validated')} differs from live result")

            for sid in re.findall(r"S\d+", mm["text"]):
                if sid not in ids:
                    errors.append(f"memo {mm['county_code']} cites unknown {sid}")
        codes = {m["county_code"] for m in munis}
        have = {mm["county_code"] for mm in j["memos"]}
        if codes - have:
            errors.append(f"memos missing for counties {sorted(codes - have)}")
    if name == "unit_statements.json":
        for st in j["statements"]:
            if st["unit_id"] not in uids:
                errors.append(f"statement for unknown unit {st['unit_id']}")

for n in notes:
    print("note:", n)
if errors:
    print(f"FAILED: {len(errors)} problems")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("OK: all data checks passed")
