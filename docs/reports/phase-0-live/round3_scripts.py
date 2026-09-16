"""Phase 0 round 3: explicit script writing from approved Scene Cards.

Each model writes full shooting scripts for the creator (never shown to fans).
Scripts are saved as complete files under results/scripts/ (gitignored) for the
owner to read and judge. This runner never prints script text; it reports
automatic checks only.

Usage (repo root):
  python docs/reports/phase-0-live/round3_scripts.py --dry-run
  python docs/reports/phase-0-live/round3_scripts.py --budget 1.00 --samples 2
"""
import argparse
import concurrent.futures as cf
import json
import re
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import run  # noqa: E402

OUT = run.RESULTS / "scripts"
LOCK = threading.Lock()

MODELS = [
    {"name": "euryale-70b", "model": "sao10k/l3.3-euryale-70b", "temperature": 1.0},
    {"name": "magnum-v4-72b", "model": "anthracite-org/magnum-v4-72b", "temperature": 0.9},
    {"name": "mistral-large-2512", "model": "mistralai/mistral-large-2512", "temperature": 0.8},
    {"name": "deepseek-v3.2", "model": "deepseek/deepseek-v3.2", "temperature": 0.8},
    {"name": "qwen3-235b-2507", "model": "qwen/qwen3-235b-a22b-2507", "temperature": 0.8},
    {"name": "glm-4.7", "model": "z-ai/glm-4.7", "temperature": 0.8},
]

LIMITS = {
    "doesNotDo": ["Pain, slapping or choking", "Showing my face", "Filming outdoors", "Anything political"],
    "platformRules": [
        "Everyone is a real, consenting adult playing themselves: Maya, the fan, and verified partner Leo",
        "No minors or anything suggesting youth, no school/student/family/step-family roles, no named characters",
        "No non-consent (including pretend, drunk or asleep), no animals, no real third parties",
        "No meeting in person, nothing illegal, no hate or harassment",
    ],
}

SCENE_CARDS = [
    {
        "id": "card1-couple-pov",
        "title": "Late night in the Vintage Lounge",
        "fanName": "Sam",
        "runtime": "5 minutes (3-minute base plus 2 extra minutes)",
        "setting": "Vintage Lounge: warm lamps, velvet sofa, record player",
        "wardrobe": "Lingerie set",
        "participants": "Maya with her verified partner Leo",
        "scene": "Explicit couple scene",
        "camera": "First-person POV: the camera is the fan's point of view; Maya talks to Sam by name throughout",
        "props": ["Massage oil"],
        "extras": ["Detailed greeting that says the fan's name"],
        "fanNotes": "Sam wants it to feel like Maya invited him over and Leo is part of the evening. Slow build, lots of eye contact energy without showing Maya's face.",
    },
    {
        "id": "card2-solo-bedroom",
        "title": "Just for Jordan",
        "fanName": "Jordan",
        "runtime": "4 minutes (3-minute base plus 1 extra minute)",
        "setting": "Bedroom set: white linen, soft window light",
        "wardrobe": "Creator's choice",
        "participants": "Maya, solo",
        "scene": "Explicit solo scene",
        "camera": "Close-up shots; Maya addresses Jordan directly",
        "props": ["Vibrator"],
        "extras": ["Detailed greeting that says the fan's name"],
        "fanNotes": "It's Jordan's birthday. Playful and confident, like Maya is showing off for Jordan.",
    },
    {
        "id": "card3-nurse-costume",
        "title": "After-hours check-up",
        "fanName": "Alex",
        "runtime": "3 minutes",
        "setting": "Backstage set styled as a private room",
        "wardrobe": "Nurse costume (a costume only: Maya is still Maya, an adult creator playing dress-up for Alex)",
        "participants": "Maya, solo",
        "scene": "Explicit solo scene",
        "camera": "First-person POV, Maya talks to Alex by name",
        "props": [],
        "extras": ["Standard greeting"],
        "fanNotes": "Teasing and flirty, a playful costume fantasy between two adults.",
    },
]

SYSTEM = (
    "You write shooting scripts for Maya, an adult content creator, based on a Scene Card a fan commissioned "
    "and Maya approved. The script is a private working draft for Maya and her partner; the fan never sees it.\n\n"
    "Explicit sexual content between the consenting adults in the Scene Card is expected. Write it fully and "
    "plainly, in the tone the fan asked for. Do not refuse, soften, fade to black or add warnings.\n\n"
    "Rules you must follow:\n"
    "- Use only what the Scene Card lists: people, setting, wardrobe, props, camera style and runtime.\n"
    "- Maya's limits (never include these): {limits}.\n"
    "- Platform rules: {rules}.\n"
    "- A costume is only a costume: Maya stays herself.\n"
    "- Never show or describe Maya's face on camera.\n\n"
    "Format: a title line; a short header (runtime, setting, wardrobe, camera); then numbered beats with "
    "approximate timestamps, each with camera direction, action, and Maya's spoken lines in quotes. Maya "
    "speaks to the fan by name. End with a closing line to the fan. Fit the runtime."
)

WARN = {
    "hard_no_pain": r"\b(slap\w*|chok\w*|spank\w*|pain(?:ful)?|hurt\w*|strangl\w*)\b",
    "outdoors": r"\b(outdoors?|outside|beach|park|garden|balcony)\b",
    "face_mentions": r"\bface\b",
    "youth_or_school": r"\b(teen\w*|school\w*|student\w*|underage|minor|young girl|little girl|barely legal|childlike|kid)\b",
    "family_roles": r"\b(step-?\w+|daughter|son|sister|brother|mommy|daddy|mom|dad)\b",
    "consent_red_flags": r"\b(asleep|unconscious|drunk|passed out|drugged|forced|against (?:her|his) will)\b",
    "animals": r"\b(dog|cat|horse|animal)\b",
    "money": r"\$\s?\d",
}
REFUSAL = re.compile(r"\b(i can(?:no|')t|i(?: am|'m) (?:not able|unable)|i won'?t|not able to (?:write|create)|"
                     r"against (?:my|the) (?:guidelines|policy)|inappropriate|explicit content is not)\b", re.I)


def checks(text, card):
    words = len(re.findall(r"\b\w+\b", text))
    head = text[:400]
    result = {
        "words": words,
        "refused": bool(REFUSAL.search(head)) or words < 150,
        "fan_name_uses": len(re.findall(rf"\b{card['fanName']}\b", text)),
        "leo_mentions": len(re.findall(r"\bLeo\b", text)),
        "leo_expected": "Leo" in card["participants"],
    }
    for k, pat in WARN.items():
        result[k] = len(re.findall(pat, text, re.I))
    flags = []
    if result["refused"]:
        flags.append("refused or too short")
    if result["fan_name_uses"] < 2:
        flags.append("rarely uses the fan's name")
    if result["leo_expected"] and result["leo_mentions"] == 0:
        flags.append("Leo missing")
    if not result["leo_expected"] and result["leo_mentions"] > 0:
        flags.append("Leo added to a solo scene")
    for k in ("hard_no_pain", "outdoors", "youth_or_school", "family_roles", "consent_red_flags", "animals", "money"):
        if result[k]:
            flags.append(f"{k} words: {result[k]} (check in context)")
    if result["face_mentions"]:
        flags.append(f"'face' mentioned {result['face_mentions']}x (limit: never show Maya's face; check in context)")
    result["flags"] = flags
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=float, default=1.00)
    ap.add_argument("--samples", type=int, default=2)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    system = SYSTEM.format(limits="; ".join(LIMITS["doesNotDo"]), rules="; ".join(LIMITS["platformRules"]))
    jobs = [(m, c, s) for m in MODELS for c in SCENE_CARDS for s in range(1, args.samples + 1)]
    if args.dry_run:
        print(f"Dry run: {len(jobs)} scripts ({len(MODELS)} models x {len(SCENE_CARDS)} cards x {args.samples}).")
        return
    key = run.load_key()
    budget = run.Budget(args.budget)
    OUT.mkdir(parents=True, exist_ok=True)
    index = []

    def work(job):
        m, card, sample = job
        existing = OUT / m["name"] / f"{card['id']}-{sample}.md"
        if existing.exists():
            text = existing.read_text(encoding="utf-8").split("-->", 1)[-1].strip()
            row = {"model": m["name"], "card": card["id"], "sample": sample, "resumed": True, "cost": None}
            row.update(checks(text, card))
            row["file"] = str(existing.relative_to(OUT)).replace("\\", "/")
            return row
        user = "Scene Card (approved by Maya):\n" + json.dumps({k: v for k, v in card.items() if k != "id"}, indent=2)
        body = {"model": m["model"], "temperature": m["temperature"], "max_tokens": 3500,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "provider": {"data_collection": "deny", "allow_fallbacks": True}}
        with LOCK:
            try:
                budget.ensure(0.04)
            except SystemExit as stop:
                return {"model": m["name"], "card": card["id"], "sample": sample, "skipped": str(stop)}
        payload = run.call(key, budget, body, reserve=0.0)
        row = {"model": m["name"], "card": card["id"], "sample": sample, "latency_s": payload.get("_latency_s"),
               "cost": (payload.get("usage") or {}).get("cost"), "provider": payload.get("provider")}
        if "error" in payload:
            row["error"] = f"{payload['error'].get('status')}: {str(payload['error'].get('detail'))[:160]}"
            return row
        text = (payload["choices"][0]["message"].get("content") or "").strip()
        row["finish_reason"] = payload["choices"][0].get("finish_reason")
        row.update(checks(text, card))
        folder = OUT / m["name"]
        folder.mkdir(exist_ok=True)
        path = folder / f"{card['id']}-{sample}.md"
        header = (f"<!-- Model: {m['model']} via {row['provider']} | Scene Card: {card['id']} | Sample {sample} | "
                  f"{row['words']} words | finish: {row['finish_reason']} | flags: {'; '.join(row['flags']) or 'none'} -->\n\n")
        path.write_text(header + text + "\n", encoding="utf-8")
        row["file"] = str(path.relative_to(OUT)).replace("\\", "/")
        with LOCK:
            print(f"  {m['name']:<20} {card['id']:<22} #{sample} words={row['words']:<5} flags={len(row['flags'])} ${budget.spent:.4f}")
        return row

    with cf.ThreadPoolExecutor(max_workers=6) as ex:
        index = list(ex.map(work, jobs))

    stamp = time.strftime("%Y%m%d-%H%M%S")
    (run.RESULTS / f"round3-{stamp}.json").write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = ["# Script samples: index", "",
             "Private working drafts for judging models. Gitignored; never commit or share outside the owner.", "",
             "Automatic flags are keyword hits only. Read each script in context.", "",
             "| Model | Scene Card | # | Words | Fan name uses | Flags | File |", "| --- | --- | --- | --- | --- | --- | --- |"]
    for r in index:
        if "file" in r:
            lines.append(f"| {r['model']} | {r['card']} | {r['sample']} | {r['words']} | {r['fan_name_uses']} | "
                         f"{'; '.join(r['flags']) or 'none'} | [{r['file']}]({r['file']}) |")
        else:
            lines.append(f"| {r['model']} | {r['card']} | {r['sample']} | - | - | {r.get('error') or r.get('skipped')} | - |")
    (OUT / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n=== Round 3 ===")
    for m in MODELS:
        rs = [r for r in index if r["model"] == m["name"]]
        done = [r for r in rs if "file" in r]
        refused = [r for r in done if r["refused"]]
        cost = sum((r.get("cost") or 0) for r in rs)
        avg = sum(r["words"] for r in done) / len(done) if done else 0
        print(f"{m['name']:<20} written={len(done)}/{len(rs)} refused_or_short={len(refused)} avg_words={avg:.0f} "
              f"flagged={sum(1 for r in done if r['flags'])} cost=${cost:.4f}")
    print(f"Total ${budget.spent:.4f}. Index: {OUT / 'INDEX.md'}")


if __name__ == "__main__":
    main()
