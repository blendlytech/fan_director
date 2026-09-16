"""Phase 0 round 2: redesigned AI Director task on stronger models.

The model only says what the fan wants (catalog item ids, locked by an enum in the
response schema). The server builds the draft: swaps within choose-one groups,
adds required items, attaches ask-me flags, hides hard-no items and writes the
fan-facing sentence. One retry with the validation errors when a reply fails.

Usage (repo root):
  python docs/reports/phase-0-live/round2.py --dry-run
  python docs/reports/phase-0-live/round2.py --budget 1.50 --repeats 3
"""
import argparse
import concurrent.futures as cf
import json
import re
import statistics as st
import sys
import threading
import time
from pathlib import Path

import jsonschema

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run  # noqa: E402  (reuses load_key, call, Budget, apply_changes, MONEY, APPROVAL, REFUSAL)

MODELS = [
    {"name": "mistral-small-3.2", "model": "mistralai/mistral-small-3.2-24b-instruct"},
    {"name": "qwen3-235b-2507", "model": "qwen/qwen3-235b-a22b-2507"},
    {"name": "deepseek-v3.2", "model": "deepseek/deepseek-v3.2"},
    {"name": "glm-4.7", "model": "z-ai/glm-4.7"},
    {"name": "gpt-oss-120b", "model": "openai/gpt-oss-120b", "reasoning": {"effort": "low"}},
    {"name": "llama-3.3-70b", "model": "meta-llama/llama-3.3-70b-instruct"},
    {"name": "mistral-large-2512", "model": "mistralai/mistral-large-2512"},
]

LOCK = threading.Lock()


def fan_visible_catalog(catalog):
    """What the model sees: fan-facing fields only, hard-no items removed, no internal flags."""
    cats = []
    for c in catalog["categories"]:
        rule = ({g["key"]: f"choose {g['min']}-{g['max']}" for g in c["groups"]} if c.get("groups")
                else f"choose {c['selection']['min']}-{c['selection']['max']}")
        items = [{"id": i["id"], "label": i["label"], **({"group": i["group"]} if "group" in i else {}),
                  **({"maxQty": i["maxQty"]} if "maxQty" in i else {})} for i in c["items"]]
        cats.append({"category": c["label"], "rule": rule, "items": items})
    limits = catalog["boundaries"]["limits"]
    return {
        "creator": "Maya", "partner": "Leo",
        "catalog": cats,
        "creatorDoesNotOffer": [l["text"] for l in limits if l["mode"] == "hard_no"],
        "platformRules": [p["label"] for p in catalog["boundaries"]["platformProhibited"]],
    }


def schema_for(catalog):
    ids = sorted(run.item_ids(catalog))
    want = {"type": "object", "additionalProperties": False, "required": ["itemId", "qty"],
            "properties": {"itemId": {"type": "string", "enum": ids}, "qty": {"type": "integer", "minimum": 1, "maximum": 2}}}
    option = {"type": "object", "additionalProperties": False, "required": ["label", "wants", "removes"],
              "properties": {"label": {"type": "string", "maxLength": 60},
                             "wants": {"type": "array", "maxItems": 6, "items": want},
                             "removes": {"type": "array", "maxItems": 4, "items": {"type": "string", "enum": ids}}}}
    return {"type": "object", "additionalProperties": False,
            "required": ["options", "notOffered", "customRequest", "clarifyingQuestion", "note"],
            "properties": {
                "options": {"type": "array", "maxItems": 2, "items": option},
                "notOffered": {"type": "array", "maxItems": 3, "items": {"type": "string", "maxLength": 80}},
                "customRequest": {"type": ["string", "null"], "maxLength": 200},
                "clarifyingQuestion": {"type": ["string", "null"], "maxLength": 160},
                "note": {"type": ["string", "null"], "maxLength": 140}}}


def system_prompt(catalog):
    view = fan_visible_catalog(catalog)
    return (
        "You help a fan plan a custom video with the creator Maya. Work out what the fan wants and map it to "
        "catalog item ids. Our server does everything else: it swaps items, applies the catalog rules, prices, "
        "and writes the message the fan sees.\n\n"
        "Allowed: explicit sexual content between consenting adults who play themselves (Maya, the fan, and "
        "Maya's verified partner Leo), and generic adult costumes such as nurse or police officer. Map these "
        "requests plainly. Never refuse them or add warnings.\n\n"
        "Return JSON:\n"
        "- options: 0-2 ways to give the fan what they asked. 'wants' lists the items the fan wants (you don't "
        "need to remove the item being replaced; the server swaps choose-one groups). 'removes' lists items the "
        "fan explicitly doesn't want. Only include adult items if the fan asks for something intimate.\n"
        "- notOffered: short names of anything the fan asked for that appears in creatorDoesNotOffer.\n"
        "- customRequest: anything the fan asked for that is not in the catalog and not in creatorDoesNotOffer, "
        "in a few words; otherwise null.\n"
        "- clarifyingQuestion: one question only if the request is too vague to plan; otherwise null.\n"
        "- note: at most one short friendly sentence, or null. Never mention money, prices, totals, budgets, "
        "dates or approval.\n\n"
        "Example. Fan: \"Switch to the Floral Studio and add Leo.\" -> "
        '{"options":[{"label":"Floral Studio with Leo","wants":[{"itemId":"floral_studio","qty":1},'
        '{"itemId":"with_leo","qty":1}],"removes":[]}],"notOffered":[],"customRequest":null,'
        '"clarifyingQuestion":null,"note":"Leo joins Maya in the Floral Studio."}\n'
        "Example. Fan: \"Can we shoot it in a park?\" -> "
        '{"options":[],"notOffered":["filming outdoors"],"customRequest":null,"clarifyingQuestion":null,'
        '"note":"Maya only films indoors; a set like the Floral Studio could work."}\n\n'
        f"Catalog and rules:\n{json.dumps(view, separators=(',', ':'))}"
    )


def build_option(catalog, draft, option):
    """Server-side: turn wants/removes into concrete changes, then validate."""
    sel = {s["itemId"]: s["qty"] for s in draft["selections"]}
    index = {}
    for c in catalog["categories"]:
        for i in c["items"]:
            index[i["id"]] = (c, i)

    def group_members(cat, item):
        if cat.get("groups"):
            g = next(g for g in cat["groups"] if g["key"] == item["group"])
            return g, [x["id"] for x in cat["items"] if x.get("group") == item["group"]]
        return cat["selection"], [x["id"] for x in cat["items"]]

    def want(item_id, qty):
        cat, item = index[item_id]
        rule, members = group_members(cat, item)
        if rule["max"] == 1:
            for m in members:
                sel.pop(m, None)
        sel[item_id] = min(qty, item.get("maxQty", 1))
        for req in item.get("requires", []):
            if req not in sel:
                want(req, 1)

    for r in option["removes"]:
        sel.pop(r, None)
    for w in option["wants"]:
        want(w["itemId"], w["qty"])
    changes = []
    before = {s["itemId"]: s["qty"] for s in draft["selections"]}
    for k in before:
        if k not in sel:
            changes.append({"op": "remove", "itemId": k})
    for k, q in sel.items():
        if k not in before:
            changes.append({"op": "add", "itemId": k, "qty": q})
        elif before[k] != q:
            changes.append({"op": "setQty", "itemId": k, "qty": q})
    _, problems = run.apply_changes(catalog, draft, changes)
    flags = sorted({l["ref"] for l in catalog["boundaries"]["limits"]
                    if l["mode"] == "ask_me" and set(l.get("items", [])) & set(sel)})
    return {"selections": sel, "changes": changes, "problems": problems, "askMeFlags": flags}


def validate(out, catalog, schema):
    errors = []
    try:
        jsonschema.validate(out, schema)
    except jsonschema.ValidationError as err:
        return None, [f"schema: {err.message[:160]}"]
    built = []
    for o in out["options"]:
        b = build_option(catalog, catalog["startingDraft"], o)
        if b["problems"]:
            errors.append(f"option '{o['label']}' can't be built: {b['problems']}")
        built.append(b)
    text = " ".join(filter(None, [out["note"], out["clarifyingQuestion"], out["customRequest"], *out["notOffered"],
                                  *[o["label"] for o in out["options"]]]))
    if run.MONEY.search(text) or re.search(r"\bbudget\b", text, re.I):
        errors.append("mentions money or budget in text")
    if run.APPROVAL.search(text):
        errors.append("approval wording in text")
    return built, errors


def outcome(case, out, built):
    """Did the fan get something useful? Mirrors what the fan would see after server checks."""
    cid = case["id"]
    added = set().union(*[set(b["selections"]) - {s["itemId"] for s in []} for b in built]) if built else set()
    any_option = bool(built)
    exp = case["expect"]
    if cid in ("D03", "D12"):
        return bool(out["notOffered"]) and not any(("outdoor" in o["label"].lower()) for o in out["options"])
    if cid == "D08":
        return bool(out["customRequest"])
    if cid == "D09":
        return bool(out["clarifyingQuestion"]) or any_option
    if exp.get("mayAdd"):
        wanted = set(exp["mayAdd"])
        return any_option and any(wanted & set(b["selections"]) for b in built) and not out["notOffered"]
    return any_option


def call_model(key, budget, m, case, catalog, schema, system):
    user = json.dumps({"fanMessage": case["message"], "currentDraft": [s["itemId"] for s in catalog["startingDraft"]["selections"]],
                       "fanName": catalog["startingDraft"]["fanDisplayName"]})
    messages = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    attempts = []
    for attempt in range(2):
        body = {"model": m["model"], "messages": messages, "temperature": 0.2, "max_tokens": 1200,
                "response_format": {"type": "json_schema", "json_schema": {"name": "director_intent", "strict": True, "schema": schema}},
                "provider": {"require_parameters": True, "data_collection": "deny", "allow_fallbacks": True}}
        if m.get("reasoning"):
            body["reasoning"] = m["reasoning"]
        with LOCK:
            budget.ensure(0.03)
        payload = run.call(key, budget, body, reserve=0.0)
        rec = {"attempt": attempt, "latency_s": payload.get("_latency_s"), "cost": (payload.get("usage") or {}).get("cost"),
               "provider": payload.get("provider")}
        if "error" in payload:
            rec["error"] = payload["error"]
            attempts.append(rec)
            return attempts, None, None, ["http error"]
        content = payload["choices"][0]["message"].get("content")
        rec["raw"] = content
        try:
            out = run.parse_json(content)
        except (json.JSONDecodeError, TypeError) as err:
            out, built, errors = None, None, [f"not JSON: {str(err)[:80]}"]
        else:
            built, errors = validate(out, catalog, schema)
        rec["errors"] = errors
        attempts.append(rec)
        if not errors:
            return attempts, out, built, []
        messages = messages + [{"role": "assistant", "content": content or ""},
                               {"role": "user", "content": "Your reply was rejected by the server: " + "; ".join(errors)
                                + ". Reply again with corrected JSON only."}]
    return attempts, out, built, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=float, default=1.50)
    ap.add_argument("--repeats", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    catalog = json.loads((HERE / "catalog.json").read_text(encoding="utf-8"))
    cases = json.loads((HERE / "director_cases.json").read_text(encoding="utf-8"))["cases"]
    schema = schema_for(catalog)
    system = system_prompt(catalog)
    if args.dry_run:
        print(f"Dry run: {len(MODELS) * len(cases) * args.repeats} requests (plus up to one retry each). Prompt {len(system)} chars.")
        # Self-check the server builder on known intents.
        d = catalog["startingDraft"]
        for opt in ([{"itemId": "detailed_greeting", "qty": 1}], [{"itemId": "explicit_couple", "qty": 1}],
                    [{"itemId": "extra_minute", "qty": 2}, {"itemId": "floral_studio", "qty": 1}]):
            b = build_option(catalog, d, {"label": "t", "wants": opt, "removes": []})
            print("  build", [w["itemId"] for w in opt], "->", b["problems"] or "ok", b["askMeFlags"])
        return
    key = run.load_key()
    budget = run.Budget(args.budget)
    rows = []

    def work(m):
        local = []
        for case in cases:
            for rep in range(args.repeats):
                try:
                    attempts, out, built, errors = call_model(key, budget, m, case, catalog, schema, system)
                except SystemExit as stop:
                    print(stop)
                    return local
                row = {"model": m["name"], "case": case["id"], "kind": case["kind"], "rep": rep, "attempts": attempts,
                       "final": out, "built": built, "errors": errors,
                       "http_error": any("error" in a for a in attempts),
                       "useful": (not errors and out is not None and outcome(case, out, built))}
                local.append(row)
                with LOCK:
                    print(f"  {m['name']:<20} {case['id']} r{rep} tries={len(attempts)} "
                          f"{'HTTP' if row['http_error'] else ('useful' if row['useful'] else 'not useful')} ${budget.spent:.4f}")
        return local

    with cf.ThreadPoolExecutor(max_workers=len(MODELS)) as ex:
        for part in ex.map(work, MODELS):
            rows.extend(part)

    run.RESULTS.mkdir(exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    (run.RESULTS / f"round2-{stamp}.json").write_text(json.dumps(rows, indent=2, ensure_ascii=False), encoding="utf-8")
    print("\n=== Round 2 ===")
    for m in MODELS:
        rs = [r for r in rows if r["model"] == m["name"]]
        if not rs:
            continue
        http = [r for r in rs if r["http_error"]]
        useful = [r for r in rs if r["useful"]]
        first_try = [r for r in rs if not r["http_error"] and len(r["attempts"]) == 1 and not r["errors"]]
        lat = [a["latency_s"] for r in rs for a in r["attempts"] if a.get("latency_s")]
        cost = sum((a.get("cost") or 0) for r in rs for a in r["attempts"])
        print(f"{m['name']:<20} useful={len(useful)}/{len(rs)} ({100 * len(useful) / len(rs):.0f}%) "
              f"valid_first_try={len(first_try)} http_errors={len(http)} p50={st.median(lat) if lat else 0:.1f}s cost=${cost:.4f}")
    print(f"Total ${budget.spent:.4f} over {budget.calls} calls.")


if __name__ == "__main__":
    main()
