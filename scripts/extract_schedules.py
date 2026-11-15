"""Phase 3: AI reads each radiotherapy unit's public patient pages and extracts the schedule it states.

Input: data/raw/pages/<unit_id>__<slug>.txt snapshots (first lines "URL: ...", "ACCESSED: ...", blank, then text).
For every snapshot and indication (breast, bone) the LLM fills a strict JSON schema. Nothing is inferred:
null when the page does not state something. Every quote_fi must be an exact substring of the snapshot
text, otherwise the statement's quote is dropped (and the statement too, if it has no quote).

Output: public/data/unit_statements.json with method "llm-api".
If ANTHROPIC_API_KEY is missing, run with --agent <file.json> to validate statements extracted
in-session by an agent (same schema), which are written with method "agent-extracted".
The output also lists every page read ("pages": unit, URL, snapshot), so the app can say how many
units the pages came from. --pages-only refreshes just that list in the existing output, without the model.
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from llm import MODEL, client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "data" / "raw" / "pages"
OUT = ROOT / "public" / "data" / "unit_statements.json"
CACHE = ROOT / "data" / "raw" / "llm_extract"
CACHE.mkdir(parents=True, exist_ok=True)

SCHEMA = {
    "type": "object",
    "properties": {
        "statements": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "indication": {"type": "string", "enum": ["breast", "bone"]},
                    "stated_default_fractions": {"type": ["integer", "null"]},
                    "stated_alternatives": {"type": ["array", "null"], "items": {"type": "string"}},
                    "criteria_for_short_course": {"type": ["string", "null"]},
                    "distance_mentioned": {"type": ["boolean", "null"]},
                    "quote_fi": {"type": ["string", "null"]},
                    "quote_en": {"type": ["string", "null"]},
                    "confidence": {"type": "string", "enum": ["high", "medium", "low"]},
                },
                "required": [
                    "indication",
                    "stated_default_fractions",
                    "stated_alternatives",
                    "criteria_for_short_course",
                    "distance_mentioned",
                    "quote_fi",
                    "quote_en",
                    "confidence",
                ],
                "additionalProperties": False,
            },
        }
    },
    "required": ["statements"],
    "additionalProperties": False,
}

PROMPT = """You read a Finnish hospital's public patient page about radiotherapy. Extract ONLY what the page explicitly states about the radiotherapy schedule (number of sessions / fractions, "hoitokertaa", "fraktiota") for:
- "breast": adjuvant radiotherapy after breast cancer surgery (rintasyöpä)
- "bone": palliative radiotherapy for painful bone metastases (luustoetäpesäkkeet / kipusädehoito / palliatiivinen sädehoito)

Rules:
- Return one statement per indication the page talks about. If the page does not discuss an indication, omit it.
- stated_default_fractions: the number of sessions the page presents as the usual/standard course, as an integer. If the page gives a range ("15-25 kertaa") or does not state a usual number, use null. Never infer from general knowledge.
- stated_alternatives: other session counts or schedules the page mentions (short strings, e.g. "5 kertaa viikon aikana"), else null.
- criteria_for_short_course: the page's stated criteria for a shorter course, in English, else null.
- distance_mentioned: true only if the page explicitly links travel distance, travelling or accommodation (e.g. potilashotelli) to the treatment; false if it does not; null if unclear.
- quote_fi: copy VERBATIM from the page, at most 2 sentences, the text that supports stated_default_fractions (or, if null, the most relevant schedule sentence). Copy characters exactly; do not fix typos or join separate lines. null if nothing relevant.
- quote_en: faithful English translation of quote_fi.
- confidence: high / medium / low.

Page URL: {url}

Page text:
<page>
{text}
</page>"""


def read_snapshot(p: Path):
    raw = p.read_text()
    head, _, body = raw.partition("\n\n")
    meta = dict(line.split(": ", 1) for line in head.splitlines() if ": " in line)
    return meta.get("URL"), meta.get("ACCESSED"), body


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def verify(statements, body):
    """Keep statements whose quote_fi is an exact substring of the page text (whitespace-normalised)."""
    kept, dropped = [], 0
    nb = norm(body)
    for st in statements:
        q = st.get("quote_fi")
        if q and norm(q) in nb:
            kept.append(st)
        elif q:
            dropped += 1
        elif st.get("stated_default_fractions") is None:
            dropped += 1  # nothing stated and no quote: no evidence to show
        else:
            dropped += 1  # a number without a verbatim quote is not shown
    return kept, dropped


def page_index(snapshots, units):
    """Every snapshot read, by unit: the app counts the units the pages came from."""
    pages = []
    for p in snapshots:
        unit_id = p.name.split("__")[0]
        if unit_id not in units:
            continue
        url, accessed, _ = read_snapshot(p)
        pages.append({"unit_id": unit_id, "url": url, "accessed": accessed, "snapshot": f"data/raw/pages/{p.name}"})
    return pages


def run_llm(c, url, body):
    import hashlib

    key = hashlib.sha256((MODEL + url + body).encode()).hexdigest()[:20]
    cache = CACHE / f"{key}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    text = body[:60000]
    msg = c.messages.create(
        model=MODEL,
        max_tokens=8000,
        messages=[{"role": "user", "content": PROMPT.format(url=url, text=text)}],
        output_config={"format": {"type": "json_schema", "schema": SCHEMA}},
    )
    if msg.stop_reason != "end_turn":
        print(f"  stop_reason={msg.stop_reason}; treating page as no statements")
        return {"statements": []}
    out = json.loads(next(b.text for b in msg.content if b.type == "text"))
    cache.write_text(json.dumps(out, ensure_ascii=False))
    time.sleep(0.5)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--agent", help="JSON file of agent-extracted statements to validate (no-key fallback)")
    ap.add_argument("--pages-only", action="store_true", help="only refresh the list of pages read in the existing output")
    args = ap.parse_args()

    snapshots = sorted(PAGES.glob("*.txt"))
    units = {u["id"] for u in json.loads((ROOT / "public/data/rt_units.json").read_text())["units"]}
    if args.pages_only:
        out = json.loads(OUT.read_text())
        out["pages"] = page_index(snapshots, units)
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
        print(f"wrote {OUT}: {len(out['pages'])} pages from {len({p['unit_id'] for p in out['pages']})} units")
        return
    statements, dropped = [], 0
    c = None if args.agent else client()
    if args.agent:
        method = "agent-extracted"
        agent = json.loads(Path(args.agent).read_text())
        by_file = {}
        for st in agent:
            by_file.setdefault(st["snapshot"], []).append(st)
    elif c is None:
        print("ANTHROPIC_API_KEY missing: run the in-session fallback and pass --agent <file>")
        sys.exit(2)
    else:
        method = "llm-api"

    for p in snapshots:
        unit_id = p.name.split("__")[0]
        if unit_id not in units:
            print("skip snapshot for unknown unit", p.name)
            continue
        url, accessed, body = read_snapshot(p)
        if args.agent:
            raw = by_file.get(p.name, [])
        else:
            raw = run_llm(c, url, body)["statements"]
        kept, d = verify(raw, body)
        dropped += d
        for st in kept:
            statements.append(
                {
                    "unit_id": unit_id,
                    "indication": st["indication"],
                    "stated_default_fractions": st["stated_default_fractions"],
                    "stated_alternatives": st.get("stated_alternatives"),
                    "criteria_for_short_course": st.get("criteria_for_short_course"),
                    "distance_mentioned": st.get("distance_mentioned"),
                    "quote_fi": st["quote_fi"],
                    "quote_en": st.get("quote_en"),
                    "url": url,
                    "accessed": accessed,
                    "confidence": st.get("confidence"),
                    "snapshot": f"data/raw/pages/{p.name}",
                }
            )
        print(f"{p.name}: kept {len(kept)} dropped {d}")

    # Keep every verified statement (units can publish conflicting documents); order by unit,
    # indication, then statements that state a number first.
    rank = {"high": 0, "medium": 1, "low": 2}
    final = sorted(statements, key=lambda s: (s["unit_id"], s["indication"], s["stated_default_fractions"] is None, rank.get(s["confidence"], 3)))

    out = {
        "method": method,
        "model": MODEL if method == "llm-api" else None,
        "generated": time.strftime("%Y-%m-%d"),
        "pages_read": len(snapshots),
        "statements_extracted": len(statements),
        "dropped": dropped,
        "statements": final,
        "note": "Each quote_fi was checked to be an exact (whitespace-normalised) substring of the saved page text; "
        "statements failing the check were dropped.",
        "pages": page_index(snapshots, units),
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    b = [s for s in final if s["indication"] == "breast" and s["stated_default_fractions"] is not None]
    print(f"wrote {OUT}: {len(final)} statements, {dropped} dropped")
    print("breast defaults:", {s["unit_id"]: s["stated_default_fractions"] for s in b})
    five = sum(1 for s in b if s["stated_default_fractions"] == 5)
    if five >= 2:
        print(f"PREMISE CHECK: {five} units state 5 sessions as standard breast schedule -> reframe lever")


if __name__ == "__main__":
    main()
