"""Phase 1.6: merge source fragments into public/data/sources.json with stable ids S1, S2, ...

Fragments: data/sources_fragments/{literature,units,geo,derived}.json, written by the data scripts and
research agents. Entries marked verified=false are dropped (and logged). Ids are assigned in a fixed
order so they stay stable between runs: literature, units, geo, derived.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAG = ROOT / "data" / "sources_fragments"

# Data sources produced by this project's scripts that are not in the other fragments.
DERIVED = [
    {
        "key": "osrm_table",
        "title": "OSRM table service (Open Source Routing Machine, OpenStreetMap road network)",
        "publisher": "Project OSRM / OpenStreetMap contributors",
        "year": 2026,
        "url": "https://router.project-osrm.org/",
        "accessed": "2026-11-14",
        "supports": "Road km and drive minutes from each municipality centre point to the 3 nearest radiotherapy units",
        "quote": None,
        "note": "Public demo server, driving profile; responses cached in data/raw/osrm/. Drive times are free-flow estimates.",
        "kind": "data",
    },
    {
        "key": "strategy_goal3_1",
        "title": "Kansallinen syöpästrategia 2026–2035 (sub-goal 3.1 indicators)",
        "publisher": "Sosiaali- ja terveysministeriö",
        "year": 2026,
        "url": "https://files.hackjunction.app/resources/Kansallinen_syopastrategia_2026_2035_FINAL.pdf",
        "accessed": "2026-11-14",
        "supports": "Goal 3.1 indicator: national targets and key effectiveness monitoring indicators defined for agreed cancers",
        "quote": "Kansalliset ja yhtenäiset tavoitteet ja keskeisimmät vaikuttavuuden seurantamittarit määritetty sovittuihin syöpiin.",
        "note": "Strategy PDF page 33 (printed 33). EN: National, uniform targets and key effectiveness monitoring indicators defined for agreed cancers.",
        "kind": "report",
    },
]


def main():
    entries, dropped = [], []
    for name in ("literature", "units", "geo"):
        for e in json.loads((FRAG / f"{name}.json").read_text()):
            if e.get("verified") is False:
                dropped.append(e["key"])
                continue
            entries.append(e)
    entries += DERIVED
    keys = set()
    out = []
    for i, e in enumerate(entries, 1):
        assert e["key"] not in keys, f"duplicate key {e['key']}"
        keys.add(e["key"])
        q = e.get("quote") or None
        if q and len(q.split()) > 25:
            raise SystemExit(f"quote too long for {e['key']}")
        out.append(
            {
                "id": f"S{i}",
                "key": e["key"],
                "title": e["title"],
                "publisher": e.get("publisher", ""),
                "year": e.get("year", ""),
                "url": e["url"],
                "accessed": e.get("accessed", "2026-11-14"),
                "supports": e["supports"],
                "quote": q,
                "note": e.get("note") or "",
                "kind": e.get("kind", "web"),
            }
        )
    (ROOT / "public/data/sources.json").write_text(json.dumps({"generated": "2026-11-14", "sources": out}, ensure_ascii=False, indent=1))
    print(f"wrote {len(out)} sources; dropped (unverified): {dropped}")

    # Point units at their S-ids.
    up = ROOT / "public/data/rt_units.json"
    units = json.loads(up.read_text())
    by_key = {s["key"]: s["id"] for s in out}
    for u in units["units"]:
        u["source_id"] = by_key[u["source_key"]]
    up.write_text(json.dumps(units, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
