"""Phase 1.7: write public/data/parameters.json (every model assumption, SPEC section 8) and
public/data/facts.json (the sourced statements the UI shows, Goal 3 indicators, limitations).

Values come from data/raw/facts.json (verified by the research step) where a source exists;
otherwise they are labelled assumptions. Source references use source keys; the app and the data
check resolve them to S-ids through sources.json.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
F = json.loads((ROOT / "data/raw/facts.json").read_text())
cases = json.loads((ROOT / "public/data/cases.json").read_text())
units = json.loads((ROOT / "public/data/rt_units.json").read_text())
routes = json.loads((ROOT / "public/data/routes.json").read_text())
munis = json.loads((ROOT / "public/data/municipalities.json").read_text())["municipalities"]
sources = {s["key"]: s for s in json.loads((ROOT / "public/data/sources.json").read_text())["sources"]}


def v(key):
    return F[key]["value"]


def check(keys):
    for k in keys:
        assert k in sources, f"unknown source key {k}"
    return keys


P = [
    dict(id="commute_threshold_km", label="Commuting threshold", default=100, min=30, max=300, step=10, unit="km", kind="assumption",
         source_ids=check(["roadmap_100km"]),
         rationale="Within this road distance the patient travels daily; beyond it they stay near the unit on treatment weeknights and go home at weekends. Framed by the roadmap's 100 km fact."),
    dict(id="planning_visit", label="Planning visits before treatment", default=1, min=0, max=3, step=1, unit="trips", kind="assumption",
         source_ids=[], rationale="One round trip for planning (CT simulation) before treatment starts, the same for every schedule."),
    dict(id="breast_fractions_long", label="Breast: long schedule", default=15, min=15, max=25, step=1, unit="sessions", kind="sourced",
         source_ids=check(["fastforward_2020", "rcr_nodal"]), rationale="40 Gy in 15 fractions over 3 weeks, the FAST-Forward control arm and the schedule that stays standard with nodal radiotherapy."),
    dict(id="breast_fractions_short", label="Breast: short schedule", default=5, min=5, max=10, step=1, unit="sessions", kind="sourced",
         source_ids=check(["fastforward_2020", "rcr_whole_breast"]), rationale="26 Gy in 5 fractions over 1 week, non-inferior in FAST-Forward."),
    dict(id="breast_share_rt", label="Breast: share treated with radiotherapy", default=0.7, min=0.4, max=0.9, step=0.05, unit="share", kind="assumption",
         source_ids=[], rationale="No citable Finnish or Nordic population figure was found for the share of new breast cancers that get adjuvant radiotherapy, so this is an assumption."),
    dict(id="breast_share_eligible_short", label="Breast: share eligible for 5 sessions", default=0.6, min=0.3, max=0.9, step=0.05, unit="share", kind="assumption",
         source_ids=check(["rcr_whole_breast", "rcr_nodal"]), rationale="Eligible = whole breast or chest wall without nodal radiotherapy (RCR). No citable share was found, so the value is an assumption."),
    dict(id="breast_share_already_short", label="Breast: share already on 5 sessions", default=0.2, min=0, max=1, step=0.05, unit="share", kind="assumption",
         source_ids=[], rationale="The real current schedule mix in Finland is not public. This dial says how many eligible patients already get 5 sessions; see What units say."),
    dict(id="bone_fractions_multi", label="Bone: multi-session course", default=5, min=2, max=10, step=1, unit="sessions", kind="assumption",
         source_ids=check(["rautakorpi_thesis_8gy"]), rationale="Common multi-fraction comparators include 20 Gy in 5 fractions and 30 Gy in 10 fractions; 5 is the conservative choice."),
    dict(id="bone_fractions_single", label="Bone: single session", default=1, min=1, max=2, step=1, unit="sessions", kind="sourced",
         source_ids=check(["rautakorpi_thesis_8gy", "rich_2018_bone_pain", "chow_2012_bone"]), rationale="A single 8 Gy fraction gives pain relief equal to multi-fraction courses."),
    dict(id="bone_retreat_single", label="Bone: retreatment after single session", default=v("bone_retreat_single"), min=0, max=0.4, step=0.01, unit="share", kind="sourced",
         source_ids=check(["rich_2018_bone_retreat"]), rationale="Systematic review of randomised trials: 20% retreated after a single fraction."),
    dict(id="bone_retreat_multi", label="Bone: retreatment after multi-session course", default=v("bone_retreat_multi"), min=0, max=0.3, step=0.01, unit="share", kind="sourced",
         source_ids=check(["rich_2018_bone_retreat"]), rationale="Same review: 8% retreated after multiple fractions."),
    dict(id="bone_share_single_now", label="Bone: share already single session", default=v("bone_share_single_now"), min=0, max=1, step=0.01, unit="share", kind="assumption",
         source_ids=check(["rautakorpi_2017"]), rationale="The current mix is not public. Anchored on Turku University Hospital 2005-2013, where 7% of all radiotherapy courses in the last year of life were single-fraction: single centre, old and not bone-specific."),
    dict(id="kela_car_eur_per_km", label="Kela own-car rate", default=v("kela_car_eur_per_km"), min=0.2, max=0.6, step=0.01, unit="€/km", kind="sourced",
         source_ids=check(["kela_car_per_km"]), rationale="Kela's own-car rate, used to value the trip cost. It is a lower bound on the cost of travel (taxis cost more); what Kela actually reimburses is less, because the patient pays up to 25 € per one-way trip, capped at 300 € a year."),
    dict(id="kela_overnight_eur", label="Kela overnight allowance", default=v("kela_overnight_eur"), min=0, max=60, step=0.01, unit="€", kind="sourced",
         source_ids=check(["kela_overnight"]), rationale="Kela's overnight allowance, at most 20.18 € a night."),
]
for p in P:
    assert p["min"] <= p["default"] <= p["max"], p["id"]

n_units = len(units["units"])
r = routes["routes"]
pop = {m["code"]: m["population"] for m in munis}
n_over = sum(1 for x in r.values() if x["road_km"] > 100)
pop_over = sum(pop[c] for c, x in r.items() if x["road_km"] > 100)

FACTS = [
    dict(id="story_distance", kind="sourced", source_ids=check(["roadmap_100km", "roadmap_50km", "asli_2018"]),
         text="The national cancer roadmap notes that palliative radiotherapy is used less by patients living more than 100 km from the nearest unit, and that outcomes are worse beyond 50 km.",
         note="Roadmap p. 13. The 100 km finding cites Norwegian data (Åsli 2018); the 50 km finding cites one Ostrobothnia lung cancer study."),
    dict(id="evidence_bone", kind="sourced", source_ids=check(["rich_2018_bone_pain", "rich_2018_bone_retreat", "chow_2012_bone", "rautakorpi_thesis_8gy"]),
         text="A systematic review of 29 randomised trials in uncomplicated painful bone metastases: a single session relieves pain as well as a multi-session course (61% vs 62% respond), at the cost of more retreatment (20% vs 8%). Guidelines name 8 Gy as the single dose."),
    dict(id="evidence_breast", kind="sourced", source_ids=check(["fastforward_2020", "fastforward_2020_n", "fastforward_10y_2026", "healthday_ff10", "rcr_whole_breast", "rcr_nodal"]),
         text="FAST-Forward (4,096 patients): 5 sessions in one week is non-inferior to 15 sessions over three weeks, with a similar level of cancer control at 10 years (breast recurrence 2.1% vs 3.6%). Applies to whole breast or chest wall without nodal radiotherapy."),
    dict(id="evidence_bone_short", kind="sourced", source_ids=check(["rich_2018_bone_pain", "rich_2018_bone_retreat", "rautakorpi_thesis_8gy"]),
         text="A single 8 Gy session relieves pain as well as a multi-session course, with more retreatment."),
    dict(id="evidence_breast_short", kind="sourced", source_ids=check(["fastforward_2020", "fastforward_10y_2026", "rcr_whole_breast"]),
         text="5 sessions in one week is non-inferior to 15 sessions over three weeks for eligible patients."),
    dict(id="turku_baseline", kind="sourced", source_ids=check(["rautakorpi_2017"]),
         text="At Turku University Hospital in 2005-2013, only 7% of radiotherapy courses in patients' last year of life were single-session.",
         note="Single centre, old and covering all courses, not only bone metastases."),
    dict(id="distance_meta", kind="sourced", source_ids=check(["distance_meta_2022"]),
         text="Meta-analysis: living 50 km or more from a radiotherapy centre goes with 16% lower odds of receiving palliative radiotherapy (OR 0.84)."),
    dict(id="daily_weeks", kind="sourced", source_ids=check(["lahti_daily_weeks"]),
         text="Radiotherapy patients often attend daily for several weeks."),
    dict(id="kela_spend", kind="sourced", source_ids=check(["kela_spend_2025", "kela_regional_2025"]),
         text="Kela paid 364 million euros of travel reimbursement in 2025 for 4.6 million trips; per resident it was highest in Kainuu (157 €) and lowest in Helsinki (23 €)."),
    dict(id="kela_rules", kind="sourced", source_ids=check(["kela_copay_trip", "kela_annual_cap", "kela_car_per_km", "kela_overnight"]),
         text="Patients pay up to 25 € per one-way trip and at most 300 € a year; own-car travel is valued at 0.33 €/km and the overnight allowance is up to 20.18 €."),
    dict(id="units_count", kind="sourced", source_ids=check(["rovaniemi_no_unit", "national_13_units", "unit_oulu"]),
         text=f"{n_units} public radiotherapy units serve mainland Finland. Lapland has none: its patients are treated in Oulu.",
         note="Unit list verified from each unit's public pages; the private Docrates clinic in Helsinki is excluded."),
    dict(id="over_100km", kind="calculated", source_ids=check(["osrm_table", "statfin_population", "wikidata_coords"]),
         text=f"{n_over} municipalities, home to {pop_over:,} people, are more than 100 km by road from their nearest unit.",
         note="Road distance from each municipality's centre point; population 31 Dec 2025."),
    dict(id="roadmap_far", kind="sourced", source_ids=check(["roadmap_400_700km"]),
         text="For part of the population the nearest central hospital is more than 400 km away and the nearest university hospital more than 700 km.",
         note="Roadmap p. 13."),
    dict(id="breast_cases", kind="sourced", source_ids=check(["fcr_breast_2024", "fcr_breast_2024_counties"]),
         text=f"{cases['national_cases']:,} women were diagnosed with breast cancer in Finland in {cases['year']} ({cases['mainland_cases']:,} on the mainland, excluding Åland)."),
]

GOAL3 = [
    dict(id="g3_target_times", short="Goal 3: treatment within target times", fi="Potilaat pääsevät hoitoon tavoiteaikojen puitteissa",
         en="Patients receive treatment within target times", source_ids=check(["strategy_goal3", "roadmap_goal3_access"])),
    dict(id="g3_effectiveness", short="Goal 3.1: indicators for agreed cancers", fi="Kansalliset ja yhtenäiset tavoitteet ja keskeisimmät vaikuttavuuden seurantamittarit määritetty sovittuihin syöpiin.",
         en="National targets and key effectiveness indicators defined for agreed cancers", source_ids=check(["strategy_goal3_1"])),
    dict(id="g_equity", short="Regional differences monitored", fi=sources["strategy_equity"]["quote"],
         en="Regional differences in treatment are available and used to steer services (cross-cutting indicator)", source_ids=check(["strategy_equity"])),
]

def _split(county_code):
    from collections import Counter

    u = {x["id"]: x["town"] for x in units["units"]}
    c = Counter(u[routes["routes"][m["code"]]["unit_id"]] for m in munis if m["county_code"] == county_code)
    return ", ".join(f"{t} {n}" for t, n in c.most_common())


_catch = sorted({m["county_code"] for m in munis if routes["routes"][m["code"]]["basis"] == "county_catchment"})
_nearest_only = [m for m in munis if routes["routes"][m["code"]]["basis"] != "county_catchment"]
ROUTING_LIMIT = (
    "Helsinki and Uusimaa are routed to HUS, Pirkanmaa to Tays and Lapland to OYS in Oulu, as their sources state. "
    f"The other {len(_nearest_only)} municipalities are routed to the nearest unit by drive time, which is Matka's assumption, not a referral rule. "
    f"It matters most in Kanta-Häme (municipalities split {_split('07')}, although Tays says it treats most of Kanta-Häme) "
    f"and Kainuu (split {_split('20')}; no catchment source found). Real referral paths can differ elsewhere too, for example some Satakunta patients are treated in Turku."
)

LIMITS = [
    dict(title="Current schedule mix unknown", text="How many patients already get the short schedules in Finland is not public. Matka shows it as an adjustable assumption next to what units say on their own pages."),
    dict(title="Centre-point distances", text="Distances run from each municipality's centre point (Wikidata coordinate), not from where patients live. In large municipalities real trips can be much longer or shorter."),
    dict(title="Population allocation", text="Breast cases per municipality are allocated from county counts by female population weighted by age-specific incidence. They are calculated, not registry counts.", source_ids=["fcr_breast_2024_counties", "fcr_breast_age5"]),
    dict(title="Bone counts not public", text="No citable yearly count of palliative bone radiotherapy courses was found, so the bone lever is shown per patient only."),
    dict(title="Routing: sourced catchments, otherwise nearest by drive", text=ROUTING_LIMIT, source_ids=["osrm_table", "tays_catchment", "rovaniemi_no_unit"]),
    dict(title="Unit pages not all reachable", text="Matka searched each unit's public site for pages stating a breast or bone schedule. The Tyks (Turku) and Pirkanmaa (Tampere) patient-instruction sites and the shared hoito-ohjeet.fi library (used in Satakunta, Ostrobothnia and Southwest Finland) could not be reached from the build environment, so for Turku and Tampere \"no page found\" means not verified, not that none exists. Some units keep breast pathways behind patient logins."),
    dict(title="Private units excluded", text="Private clinics (for example Docrates in Helsinki) are excluded; Matka covers the public units only."),
    dict(title="Åland excluded", text="Åland has a separate health system and is left out of the map and totals."),
    dict(title="OSRM road data", text="Drive times come from the public OSRM server on OpenStreetMap data: free-flow driving with no traffic, weather or ferry waits.", source_ids=["osrm_table"]),
    dict(title="Kela cost is a lower bound", text="Trips are valued at Kela's own-car rate plus the overnight allowance. Taxis cost more, and Kela pays the own-car rate only above the 25 € copayment.", source_ids=["kela_car_per_km", "kela_copay_trip"]),
    dict(title="Commuting model", text="Within the threshold the patient travels daily; beyond it they stay near the unit on weeknights and go home at weekends. Real choices vary (patient hotels, transport by ambulance, family help)."),
    dict(title="Roadmap distance facts", text="The roadmap's 100 km finding cites Norwegian data and its 50 km finding one Finnish lung study; they frame the threshold but were not measured for these schedules.", source_ids=["roadmap_100km", "asli_2018", "paakkola_2024"]),
    dict(title="Turku baseline", text="The 7% single-session figure is from one hospital in 2005-2013 and covers all courses in the last year of life, not only bone metastases.", source_ids=["rautakorpi_2017"]),
    dict(title="Eligibility and treatment shares", text="The shares of breast patients treated with radiotherapy (70%) and eligible for 5 sessions (60%) are assumptions; no citable Finnish figure was found."),
    dict(title="Clinical decision", text="Schedule choice is a clinical decision for each patient. Matka proposes options for clinical teams to evaluate; it does not prescribe."),
]

(ROOT / "public/data/parameters.json").write_text(json.dumps({"generated": "2026-11-14", "parameters": P}, ensure_ascii=False, indent=1))
(ROOT / "public/data/facts.json").write_text(json.dumps({"generated": "2026-11-14", "facts": FACTS, "goal3": GOAL3, "limitations": LIMITS}, ensure_ascii=False, indent=1))
print(f"wrote {len(P)} parameters, {len(FACTS)} facts, {len(GOAL3)} goal-3 indicators, {len(LIMITS)} limitations")
for f in FACTS:
    print(" -", f["text"])
