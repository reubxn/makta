"""Phase 4: AI writes each wellbeing services county a sourced action memo.

For each county: build a facts JSON (aggregates, 3 hardest-hit municipalities, nearest units, their
statements, every parameter with its kind, relevant sources), prompt for a <= 250-word memo, then
validate: every number in the memo must appear in the facts (stated rounding such as "about 1,200"
is allowed), every sentence ends with source ids like [S4], and every cited id exists. On failure,
regenerate up to 3 times.

Output: public/data/memos.json (method "llm-api"). No-key fallback: --agent <file.json> validates memos
written in-session ({county_code: text}); method "agent-written". --facts-only writes the facts files
to data/raw/memo_facts/ for the in-session writer.
"""
import argparse
import json
import math
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm import MODEL, client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "public" / "data"
FACTS_DIR = ROOT / "data" / "raw" / "memo_facts"
FACTS_DIR.mkdir(parents=True, exist_ok=True)


def load(n):
    return json.loads((D / n).read_text())


munis = load("municipalities.json")["municipalities"]
routes = load("routes.json")["routes"]
units = {u["id"]: u for u in load("rt_units.json")["units"]}
cases = load("cases.json")
params = load("parameters.json")["parameters"]
facts_file = load("facts.json")
sources = load("sources.json")["sources"]
src_by_key = {s["key"]: s for s in sources}
src_by_id = {s["id"]: s for s in sources}
statements_path = D / "unit_statements.json"
statements = json.loads(statements_path.read_text())["statements"] if statements_path.exists() else []
P = {p["id"]: p["default"] for p in params}


def sid(k):
    """Resolve a source key or id to its S-id."""
    if k in src_by_id:
        return k
    return src_by_key[k]["id"]


def course(r, n):
    if r["road_km"] <= P["commute_threshold_km"]:
        trips, nights = n + P["planning_visit"], 0
    else:
        trips, nights = math.ceil(n / 5) + P["planning_visit"], n + P["planning_visit"]
    km = trips * 2 * r["road_km"]
    return {
        "round_trips": trips,
        "nights_away": nights,
        "hours_on_road": trips * 2 * r["drive_min"] / 60,
        "km": km,
        "kela_lower_bound_eur": km * P["kela_car_eur_per_km"] + nights * P["kela_overnight_eur"],
    }


def bone(r, schedule):
    n = P["bone_fractions_multi"] if schedule == "long" else P["bone_fractions_single"]
    p = P["bone_retreat_multi"] if schedule == "long" else P["bone_retreat_single"]
    c, rt = course(r, n), course(r, P["bone_fractions_single"])
    return {k: c[k] + p * rt[k] for k in c}


def r1(x):
    return round(x, 1)


def build_facts(county_code):
    ms = [m for m in munis if m["county_code"] == county_code]
    name = ms[0]["county_name_fi"]
    name_en = ms[0].get("county_name_en")
    agg = {"nights_away": 0, "round_trips": 0, "hours_on_road": 0, "km": 0, "kela_lower_bound_eur": 0}
    patients = 0
    rows = []
    for m in ms:
        r = routes[m["code"]]
        aff = cases["municipalities"][m["code"]] * P["breast_share_rt"] * P["breast_share_eligible_short"] * (1 - P["breast_share_already_short"])
        lo, sh = course(r, P["breast_fractions_long"]), course(r, P["breast_fractions_short"])
        for k in agg:
            agg[k] += aff * (lo[k] - sh[k])
        patients += aff
        rows.append((m, r, lo, sh))
    rows.sort(key=lambda x: (-x[1]["road_km"]))
    hardest = []
    for m, r, lo, sh in rows[:3]:
        bl, bs = bone(r, "long"), bone(r, "short")
        hardest.append(
            {
                "municipality": m["name_fi"],
                "nearest_unit_town": units[r["unit_id"]]["town"],
                "road_km": round(r["road_km"]),
                "drive_hours": r1(r["drive_min"] / 60),
                "breast_15_sessions": {"nights_away": lo["nights_away"], "round_trips": lo["round_trips"], "hours_on_road": round(lo["hours_on_road"])},
                "breast_5_sessions": {"nights_away": sh["nights_away"], "round_trips": sh["round_trips"], "hours_on_road": round(sh["hours_on_road"])},
                "bone_multi_fraction_expected": {"nights_away": r1(bl["nights_away"]), "round_trips": r1(bl["round_trips"])},
                "bone_single_8gy_expected": {"nights_away": r1(bs["nights_away"]), "round_trips": r1(bs["round_trips"])},
                "source_ids": ["calculated"],
            }
        )
    unit_ids = sorted({routes[m["code"]]["unit_id"] for m in ms})
    unit_facts = []
    for u in unit_ids:
        n_m = sum(1 for m in ms if routes[m["code"]]["unit_id"] == u)
        st = [
            {k: s[k] for k in ("indication", "stated_default_fractions", "distance_mentioned", "quote_en", "url")}
            for s in statements
            if s["unit_id"] == u
        ]
        unit_facts.append({"unit": units[u]["name"], "town": units[u]["town"], "municipalities_served_in_county": n_m, "statements": st, "source_id": sid(units[u].get("source_id") or units[u]["source_key"])})
    n_stayers = sum(1 for m in ms if routes[m["code"]]["road_km"] > P["commute_threshold_km"])
    facts = {
        "county_code": county_code,
        "county_name_fi": name,
        "county_name_en": name_en,
        "n_municipalities": len(ms),
        "n_municipalities_beyond_commute_threshold": n_stayers,
        "breast_lever_yearly_removed_for_county": {
            "affected_patients_per_year": r1(patients),
            "nights_away_removed": round(agg["nights_away"]),
            "round_trips_removed": round(agg["round_trips"]),
            "hours_on_road_removed": round(agg["hours_on_road"]),
            "km_removed": round(agg["km"]),
            "kela_lower_bound_eur_removed": round(agg["kela_lower_bound_eur"]),
            "machine_sessions_freed": round(patients * (P["breast_fractions_long"] - P["breast_fractions_short"])),
            "kind": "calculated",
            "note": "Breast only; bone yearly counts are not public. Kela cost is a lower bound (own-car rate; taxis cost more).",
        },
        "hardest_hit_municipalities": hardest,
        "nearest_units": unit_facts,
        "parameters": [
            {"id": p["id"], "label": p["label"], "value": p["default"], "unit": p["unit"], "kind": p["kind"], "source_ids": [sid(x) for x in p["source_ids"]]}
            for p in params
        ],
        "evidence": [
            {"id": f["id"], "text": f["text"], "kind": f["kind"], "source_ids": [sid(x) for x in f["source_ids"]]} for f in facts_file["facts"]
        ],
        "goal3_indicators": [{"text_en": g["en"], "source_ids": [sid(x) for x in g["source_ids"]]} for g in facts_file["goal3"]],
        "memo_constants": {"first_step_within_days": 30, "goal_number": 3},
        "calculated_source_ids": [sid(x) for x in cases["source_ids"]] + [sid("osrm_table")],
    }
    used = set()

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("source_ids", "calculated_source_ids") and isinstance(v, list):
                    used.update(x for x in v if x in src_by_id)
                elif k == "source_id" and v in src_by_id:
                    used.add(v)
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(facts)
    facts["sources"] = [
        {"id": s["id"], "title": s["title"], "publisher": s["publisher"], "year": s["year"], "supports": s["supports"]}
        for s in sources
        if s["id"] in used
    ]
    return facts


PROMPT = """Write a short action memo for the director of cancer services of {county} ({county_en}), using ONLY the facts JSON below.

Format (plain text, no markdown headings, at most 250 words):
- Paragraph 1: a one-sentence finding about the travel burden radiotherapy schedules put on this county's patients.
- Then three proposals, each a short paragraph starting "1.", "2.", "3.". Each names an owner ROLE (no personal names), a concrete first step within 30 days, and the Goal 3 indicator it serves (use the indicator wording from the facts).
  - Lead with painful bone metastases: a single 8 Gy session as the default for uncomplicated cases (equal pain relief, more retreatment).
  - Then breast: 5 sessions as the default for eligible patients (whole breast or chest wall without nodal radiotherapy), naming distance as a reason to choose it. Say "at least as good" or "non-inferior", never "better".
  - Then: publish schedule mix and radiotherapy use by distance band every year.
- Final paragraph: one sentence on limitations.

Rules:
- Every sentence ends with the source ids that support it in square brackets, e.g. [S4] or [S4, S7]. For calculated numbers, cite the calculated_source_ids. Use only ids that appear in the facts.
- Use only numbers that appear in the facts JSON. You may round a number if you say so ("about 1,200"). Do not compute new numbers (no sums, differences or percentages that are not in the facts).
- Frame proposals as options for clinical teams to evaluate; schedule choice is a clinical decision. No survival claims for shorter schedules.
- Write numbers with digits (e.g. "15 sessions"), use a comma as thousands separator.
{feedback}
Facts JSON:
{facts}"""


NUM_RE = re.compile(r"(?<![\w.])(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?")


def strip_ids(text):
    return re.sub(r"\[S\d+(?:\s*,\s*S\d+)*\]", "", text)


def fact_numbers(facts):
    nums = []

    def walk(o):
        if isinstance(o, bool):
            return
        if isinstance(o, (int, float)):
            nums.append(float(o))
        elif isinstance(o, str):
            for m in NUM_RE.finditer(strip_ids(o)):
                nums.append(float(m.group(1).replace(",", "") + ("." + m.group(2) if m.group(2) else "")))
        elif isinstance(o, dict):
            for k, v in o.items():
                if k in ("source_ids", "calculated_source_ids", "source_id", "url", "id"):
                    continue
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    walk(facts)
    # Shares are stored as fractions; allow their percentage form.
    nums += [round(x * 100, 1) for x in list(nums) if 0 < x < 1]
    return nums


def number_ok(val, raw, context, nums):
    for f in nums:
        if abs(f - val) < 1e-9:
            return True
        if abs(round(f, 1) - val) < 1e-9 or abs(round(f) - val) < 1e-9:
            return True
    approx = re.search(r"(about|around|roughly|approximately|nearly|almost|over|more than|some)\s*$", context, re.I)
    if approx and val >= 10:
        # Rounded figure: accept if some fact rounds to it at the precision implied by trailing zeros.
        digits = raw.replace(",", "")
        zeros = len(digits) - len(digits.rstrip("0"))
        step = 10 ** max(zeros, 0)
        for f in nums:
            if abs(f - val) <= step / 2 + 1e-9 and abs(f - val) / max(f, 1) < 0.1:
                return True
    return False


def validate(text, facts):
    problems = []
    nums = fact_numbers(facts)
    allowed_ids = {s["id"] for s in facts["sources"]}
    body = strip_ids(text)
    checked = passed = 0
    for m in NUM_RE.finditer(body):
        raw = m.group(0)
        # Skip list markers "1." "2." "3." at paragraph start.
        start = m.start()
        line_start = body.rfind("\n", 0, start) + 1
        if body[line_start:start].strip() == "" and body[m.end() : m.end() + 1] == "." and raw in ("1", "2", "3"):
            continue
        val = float(m.group(1).replace(",", "") + ("." + m.group(2) if m.group(2) else ""))
        checked += 1
        ctx = body[max(0, start - 20) : start]
        if number_ok(val, m.group(1), ctx, nums):
            passed += 1
        else:
            problems.append(f"number {raw} is not in the facts")
    for cid in re.findall(r"S\d+", text):
        if cid not in allowed_ids:
            problems.append(f"cites {cid}, which is not in the facts' sources")
    # Every sentence ends with source ids.
    for para in [p.strip() for p in text.split("\n") if p.strip()]:
        sentences = re.split(r"(?<=[.!?\]])\s+(?=[A-Z0-9])", para)
        for s in sentences:
            s2 = s.strip()
            if not s2 or re.fullmatch(r"\d\.", s2):
                continue
            if not re.search(r"\[S\d+(?:\s*,\s*S\d+)*\]\.?$", s2):
                problems.append(f"sentence without source ids: {s2[:60]}")
    words = len(strip_ids(text).split())
    if words > 260:
        problems.append(f"{words} words (max 250)")
    if re.search(r"\bbetter\b", text, re.I):
        problems.append('uses "better"')
    if re.search(r"surviv", text, re.I):
        problems.append("mentions survival")
    return checked, passed, problems


def write_out(memos, method):
    out = {"method": method, "model": MODEL if method == "llm-api" else None, "generated": time.strftime("%Y-%m-%d"), "memos": memos}
    (D / "memos.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"wrote memos.json ({len(memos)} memos, method {method})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", help="JSON {county_code: memo text} written in-session (no-key fallback)")
    ap.add_argument("--facts-only", action="store_true")
    ap.add_argument("--only", help="comma-separated county codes")
    args = ap.parse_args()

    codes = sorted({m["county_code"] for m in munis})
    if args.only:
        codes = args.only.split(",")
    all_facts = {c: build_facts(c) for c in codes}
    for c, f in all_facts.items():
        (FACTS_DIR / f"{c}.json").write_text(json.dumps(f, ensure_ascii=False, indent=1))
    if args.facts_only:
        print(f"wrote facts for {len(codes)} counties to {FACTS_DIR}")
        return

    memos, failed = [], []
    if args.agent:
        texts = json.loads(Path(args.agent).read_text())
        for c in codes:
            text = texts[c].strip()
            checked, passed, problems = validate(text, all_facts[c])
            print(f"{c}: {passed}/{checked} numbers ok; problems: {problems}")
            if problems:
                failed.append(c)
            memos.append(
                {"county_code": c, "county_name": all_facts[c]["county_name_fi"], "text": text, "numbers_checked": checked, "numbers_passed": passed, "source_ids": sorted(set(re.findall(r"S\d+", text)), key=lambda x: int(x[1:])), "problems": problems}
            )
        write_out(memos, "agent-written")
        sys.exit(1 if failed else 0)

    c_api = client()
    if c_api is None:
        print("ANTHROPIC_API_KEY missing: use --facts-only, write memos in-session, then --agent <file>")
        sys.exit(2)
    for c in codes:
        facts = all_facts[c]
        feedback = ""
        for attempt in range(1, 4):
            msg = c_api.messages.create(
                model=MODEL,
                max_tokens=8000,
                messages=[{"role": "user", "content": PROMPT.format(county=facts["county_name_fi"], county_en=facts["county_name_en"], facts=json.dumps(facts, ensure_ascii=False), feedback=feedback)}],
            )
            text = "".join(b.text for b in msg.content if b.type == "text").strip()
            checked, passed, problems = validate(text, facts)
            print(f"{c} attempt {attempt}: {passed}/{checked} numbers ok; problems: {problems}")
            if not problems:
                break
            feedback = "\nYour previous draft failed validation. Fix these problems:\n- " + "\n- ".join(problems) + "\n"
            time.sleep(1)
        if problems:
            failed.append(c)
        memos.append(
            {"county_code": c, "county_name": facts["county_name_fi"], "text": text, "numbers_checked": checked, "numbers_passed": passed, "attempts": attempt, "source_ids": sorted(set(re.findall(r"S\d+", text)), key=lambda x: int(x[1:])), "problems": problems}
        )
    write_out(memos, "llm-api")
    if failed:
        print("FAILED validation:", failed)
        sys.exit(1)


if __name__ == "__main__":
    main()
