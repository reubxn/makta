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
                "source_ids": [sid(x) for x in cases["source_ids"]] + [sid("osrm_table")],
            }
        )
    unit_ids = sorted({routes[m["code"]]["unit_id"] for m in ms})
    unit_facts = []
    for u in unit_ids:
        served = [m for m in ms if routes[m["code"]]["unit_id"] == u]
        basis = {routes[m["code"]]["basis"] for m in served}
        st = [
            {k: s.get(k) for k in ("indication", "stated_default_fractions", "stated_alternatives", "distance_mentioned", "quote_en", "source_id")}
            for s in statements
            if s["unit_id"] == u
        ]
        unit_facts.append(
            {
                "unit": units[u]["name"],
                "town": units[u]["town"],
                "municipalities_routed_here": len(served),
                "routing_basis": "the county's sourced catchment" if basis == {"county_catchment"} else "nearest unit by drive time (Matka's assumption, not a referral rule)",
                "unit_exists_source_id": sid(units[u].get("source_id") or units[u]["source_key"]),
                "public_schedule_pages_found": len(st) > 0,
                "statements_from_public_pages": st,
                "note": "If no public page was found, write that Matka found no public page stating a schedule; never claim the unit publishes nothing.",
            }
        )
    CATCH = {
        "01": ["unit_hus"], "02": ["unit_hus"], "03": ["unit_hus"], "04": ["unit_hus"], "90": ["unit_hus"],
        "07": ["tays_catchment"], "08": ["tays_catchment"], "16": ["tays_catchment", "seinajoki_no_unit"],
        "12": ["kys_catchment", "nova_catchment"], "13": ["kys_catchment"], "15": ["nova_catchment"], "21": ["rovaniemi_no_unit"],
    }
    catchments = [{"source_id": sid(k), "says": src_by_key[k]["supports"]} for k in CATCH.get(county_code, [])]
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
        "units_patients_are_routed_to": unit_facts,
        "sourced_catchments_for_this_county": catchments,
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
        "citation_guide": {
            "bone_evidence (equal pain relief, more retreatment, 8 Gy)": [sid(x) for x in ("rich_2018_bone_pain", "rich_2018_bone_retreat", "chow_2012_bone", "rautakorpi_thesis_8gy")],
            "breast_evidence (non-inferior, eligibility, nodal stays 15)": [sid(x) for x in ("fastforward_2020", "fastforward_10y_2026", "rcr_whole_breast", "rcr_nodal")],
            "per_patient_numbers (distance, nights, trips, hours for a municipality)": [sid(x) for x in ("osrm_table", "wikidata_coords", "rich_2018_bone_retreat")],
            "county_yearly_breast_totals": [sid(x) for x in cases["source_ids"]] + [sid("osrm_table")],
            "distance_and_access (roadmap)": [sid(x) for x in ("roadmap_100km", "roadmap_50km", "distance_meta_2022")],
            "current_schedule_mix_unknown": [sid("rautakorpi_2017")],
            "limitations": [sid(x) for x in ("wikidata_coords", "statfin_population", "osrm_table")],
        },
    }
    used = set()

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("source_ids", "calculated_source_ids") and isinstance(v, list):
                    used.update(x for x in v if x in src_by_id)
                elif k.endswith("source_id") and v in src_by_id:
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
- Then three proposals, each a short paragraph starting "1.", "2.", "3.". Each names an owner ROLE (no personal names), a first step within 30 days that is a review or decision by the clinical team (not a publication or a change to patient pages), and the Goal 3 indicator it serves (use the indicator wording from the facts).
  - Lead with painful bone metastases: a single 8 Gy session as the default for uncomplicated cases (equal pain relief, more retreatment).
  - Then breast: 5 sessions as the default for eligible patients (whole breast or chest wall without nodal radiotherapy), naming distance as a reason to choose it. Say "at least as good" or "non-inferior", never "better".
  - Then: publish schedule mix and radiotherapy use by distance band every year.
- Final paragraph: one sentence on limitations.

Rules:
- Every sentence ends with the source ids that support it in square brackets, e.g. [S4] or [S4, S7]. Cite only sources that support that sentence; follow citation_guide. A statement about what a unit's page says cites that statement's own source_id. Proposal sentences cite the evidence for the proposal. Use only ids that appear in the facts.
- Which unit serves which municipality: use routing_basis. Only say a unit "treats" or "serves" the county when the basis is the county's sourced catchment or sourced_catchments_for_this_county says so; otherwise say "the nearest unit by drive time".
- If public_schedule_pages_found is false for a unit, you may say Matka found no public page stating its schedule; never say the unit publishes nothing.
- Use only numbers that appear in the facts JSON, with the meaning they have there. You may round a number if you say so ("about 1,200"). Do not compute new numbers (no sums, differences or percentages that are not in the facts).
- Frame proposals as options for clinical teams to evaluate; schedule choice is a clinical decision. No survival claims for shorter schedules.
- Write numbers with digits (e.g. "15 sessions"), use a comma as thousands separator.
{feedback}
Facts JSON:
{facts}"""


CASE_TABLE_IDS = {s["id"] for s in sources if s["key"].startswith("fcr_")}
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
        # One-decimal rounding of a fact is fine; dropping decimals needs an explicit "about".
        if abs(round(f, 1) - val) < 1e-9:
            return True
    approx = re.search(r"(about|around|roughly|approximately|some)\s*$", context, re.I)
    above = re.search(r"(over|more than)\s*$", context, re.I)
    below = re.search(r"(nearly|almost|under|less than)\s*$", context, re.I)
    if above and any(f > val and (f - val) / max(val, 1) < 0.1 for f in nums):
        return True
    if below and any(f < val and (val - f) / max(val, 1) < 0.1 for f in nums):
        return True
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
        sentences = re.split(r"(?<=[.!?])\s+", para)
        for s in sentences:
            s2 = s.strip()
            if not s2 or re.fullmatch(r"\d\.", s2):
                continue
            if not re.search(r"\[S\d+(?:\s*,\s*S\d+)*\]\.?$", s2):
                problems.append(f"sentence without source ids: {s2[:60]}")
    words = len(strip_ids(text).split())
    spelled = re.findall(r"\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|hundred|thousand)\b", strip_ids(text), re.I)
    if spelled:
        problems.append(f"spelled-out numbers are not checked; use digits: {sorted(set(w.lower() for w in spelled))}")
    for para in [p.strip() for p in text.split("\n") if p.strip()][1:4]:
        if not re.match(r"^[123]\. ", para):
            problems.append("proposals must be three paragraphs starting 1., 2., 3.")
            break
    if words > 250:
        problems.append(f"{words} words (max 250)")
    # Audit rules (2026-11-15): citations, overclaims, first steps.
    case_ids = {s["id"] for s in facts["sources"] if s["id"] in CASE_TABLE_IDS}
    paras = [p.strip() for p in text.split("\n") if p.strip()]
    for para in paras:
        for s in re.split(r"(?<=[.!?])\s+", para):
            cited = set(re.findall(r"S\d+", s))
            body_s = strip_ids(s)
            if cited & case_ids and re.search(r"bone|8 Gy|single|retreat", body_s, re.I):
                problems.append(f"bone sentence cites breast case tables {sorted(cited & case_ids)}: {body_s[:60]}")
            if re.match(r"^1\. ", para) and cited & case_ids:
                problems.append(f"bone proposal cites breast case tables {sorted(cited & case_ids)}: {body_s[:60]}")
            if re.search(r"within 30 days", body_s, re.I):
                if not re.search(r"\b(team|lead|head|clinic)", body_s, re.I) or not re.search(r"review|decide|evaluat|assess|agree", body_s, re.I):
                    problems.append(f"first step must be a clinical-team review or decision: {body_s[:60]}")
                if re.search(r"\b(updat|chang|edit|rewrit|revis|add)\w*\b.{0,40}\b(page|leaflet|website|instructions)|\bpublish", body_s, re.I):
                    problems.append(f"first step must not be a patient-page or publication change: {body_s[:60]}")
    for pat in (r"\bonly\b", r"\bnone of the units\b", r"\bno unit publishes\b", r"\bpublish(es)? (nothing|no schedule)\b", r"\bdoes not publish\b"):
        if re.search(pat, strip_ids(text), re.I):
            problems.append(f"overclaim wording /{pat}/")
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
    ap.add_argument("--check-only", action="store_true", help="with --agent: validate and print, do not write memos.json")
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
            if c not in texts:
                print(f"{c}: no memo in {args.agent}")
                failed.append(c)
                continue
            text = texts[c].strip()
            checked, passed, problems = validate(text, all_facts[c])
            print(f"{c}: {passed}/{checked} numbers ok; problems: {problems}")
            if problems:
                failed.append(c)
            memos.append(
                {"county_code": c, "county_name": all_facts[c]["county_name_fi"], "text": text, "numbers_checked": checked, "numbers_passed": passed, "source_ids": sorted(set(re.findall(r"S\d+", text)), key=lambda x: int(x[1:])), "problems": problems, "validated": not problems}
            )
        if not args.check_only:
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
            {"county_code": c, "county_name": facts["county_name_fi"], "text": text, "numbers_checked": checked, "numbers_passed": passed, "attempts": attempt, "source_ids": sorted(set(re.findall(r"S\d+", text)), key=lambda x: int(x[1:])), "problems": problems, "validated": not problems}
        )
    write_out(memos, "llm-api")
    if failed:
        print("FAILED validation:", failed)
        sys.exit(1)


if __name__ == "__main__":
    main()
