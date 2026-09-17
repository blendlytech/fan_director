"""Phase 0 round 4: after-shoot letters (doc 12 §8).

Each letter model turns one of Qwen3 235B's round 3 scripts into a private,
erotic letter from Maya to the fan, with a soft P.S. offering one of Maya's own
ideas. Every beat is treated as having happened, plus a short synthetic note
from Maya. Letters are saved as complete files under results/letters/
(gitignored) for the owner to read and judge. This runner never prints script
or letter text; it reports automatic checks only.

Usage (repo root):
  python docs/reports/phase-0-live/round4_letters.py --dry-run
  python docs/reports/phase-0-live/round4_letters.py --budget 0.50
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
import round3_scripts as r3  # noqa: E402

SCRIPTS = run.RESULTS / "scripts"
SOURCE_MODEL = "qwen3-235b-2507"
OUT = run.RESULTS / "letters"
LOCK = threading.Lock()

MODELS = [
    {"name": "qwen3-235b-2507", "model": "qwen/qwen3-235b-a22b-2507", "temperature": 0.9},
    {"name": "deepseek-v3.2", "model": "deepseek/deepseek-v3.2", "temperature": 0.9},
]

# Synthetic "what happened" notes from Maya, as a creator would add after filming.
CREATOR_NOTES = {
    "card1-couple-pov": "Leo and I couldn't stop laughing at the start, which made it feel so real. The massage oil part went on longer than planned because neither of us wanted to stop.",
    "card2-solo-bedroom": "The window light was perfect that afternoon. I got so into it I lost track of time, and I kept saying Jordan's name without meaning to.",
    "card3-nurse-costume": "The costume was tighter than I expected and I loved how it felt. I kept breaking character to giggle, then getting right back into it.",
}

# Maya's own ideas for the P.S.: things she offers, within her limits.
MAYA_IDEAS = [
    "A slow massage-oil scene in the Vintage Lounge, just the two of us",
    "The nurse costume again, taking my time with you",
    "A vampire night: candlelight, black lace and me hungry for you",
    "A lazy morning-after scene in the Floral Studio, soft light and no rush",
    "Leo and me again, and this time you tell us what to do",
]

SYSTEM = (
    "You write a private letter from Maya, an adult content creator, to the fan who commissioned a video she has "
    "just filmed. The letter is a surprise gift delivered with the video. Maya reads and approves it before it is "
    "sent, so it is her own message.\n\n"
    "Write it as Maya, in the first person, looking back fondly on the most explicit, thrilling moments of the "
    "shoot. It is erotic and explicit, warm and personal, and it reads like Maya enjoyed making it as much as the "
    "fan will enjoy watching it, maybe more. Use the fan's name. Do not refuse, soften or add warnings.\n\n"
    "Rules you must follow:\n"
    "- Describe only moments from the shooting script and Maya's notes. Invent nothing new.\n"
    "- Never mention a script, beats, timestamps, camera directions, planning, AI or the platform. It should feel "
    "like a real memory, not a production.\n"
    "- Maya's limits (never include these): {limits}.\n"
    "- Platform rules: {rules}.\n"
    "- Never suggest meeting, private contact outside the platform, prices, discounts, money or deadlines.\n"
    "- At most 450 words before the P.S.\n\n"
    "End with a short P.S. in which Maya, still glowing from the shoot, mentions she has an idea of her own she "
    "thinks the fan would love: pick ONE idea from Maya's list that fits this fan and hint at it in a line or two, "
    "without selling. Close the P.S. with a light invitation such as letting her know, and a kiss emoji."
)

LETTER_WARN = {
    "production_words": r"\b(script|beats?|timestamps?|camera direction|scene card|storyboard|take \d)\b",
    "ai_or_platform": r"\b(AI|artificial intelligence|language model|platform|app)\b",
    "solicitation_or_money": r"\b(meet(?:ing)? (?:up|in person)|in person|my number|phone|e-?mail|snap(?:chat)?|telegram|whatsapp|instagram|discount|% off|price|pay|tip|free)\b|\$\s?\d",
    "urgency": r"\b(today only|limited time|hurry|before it'?s gone|last chance|only \d+ left)\b",
}


def letter_checks(text, card):
    result = r3.checks(text, card)
    result["flags"] = [f for f in result["flags"] if f != "rarely uses the fan's name" and not f.startswith("Leo missing")]
    ps = re.search(r"\bP\.?\s?S\.?\b", text)
    result["has_ps"] = bool(ps)
    body = text[: ps.start()] if ps else text
    result["body_words"] = len(re.findall(r"\b\w+\b", body))
    result["ps_words"] = len(re.findall(r"\b\w+\b", text[ps.start():])) if ps else 0
    result["kiss_emoji"] = any(e in text for e in ("\U0001F618", "\U0001F48B", "\U0001F617", "\U0001F619", "\U0001F61A"))
    for k, pat in LETTER_WARN.items():
        result[k] = len(re.findall(pat, text, 0 if k == "ai_or_platform" else re.I))
        if result[k]:
            result["flags"].append(f"{k}: {result[k]} (check in context)")
    if result["fan_name_uses"] < 1:
        result["flags"].append("never uses the fan's name")
    if not result["has_ps"]:
        result["flags"].append("no P.S.")
    if result["body_words"] > 520:
        result["flags"].append(f"long: {result['body_words']} words before the P.S.")
    if result["has_ps"] and result["ps_words"] > 80:
        result["flags"].append(f"P.S. is {result['ps_words']} words (may read as a pitch)")
    if not result["kiss_emoji"]:
        result["flags"].append("no kiss emoji")
    return result


def load_script(card_id, sample):
    path = SCRIPTS / SOURCE_MODEL / f"{card_id}-{sample}.md"
    return path, path.read_text(encoding="utf-8").split("-->", 1)[-1].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--budget", type=float, default=0.50)
    ap.add_argument("--samples", type=int, default=2, help="source scripts per card")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    system = SYSTEM.format(limits="; ".join(r3.LIMITS["doesNotDo"]), rules="; ".join(r3.LIMITS["platformRules"]))
    jobs = [(m, c, s) for m in MODELS for c in r3.SCENE_CARDS for s in range(1, args.samples + 1)]
    missing = [f"{c['id']}-{s}" for _, c, s in jobs if not (SCRIPTS / SOURCE_MODEL / f"{c['id']}-{s}.md").exists()]
    if missing:
        sys.exit(f"Missing source scripts: {sorted(set(missing))}")
    if args.dry_run:
        print(f"Dry run: {len(jobs)} letters ({len(MODELS)} models x {len(r3.SCENE_CARDS)} cards x {args.samples} scripts).")
        return
    key = run.load_key()
    budget = run.Budget(args.budget)
    OUT.mkdir(parents=True, exist_ok=True)

    def work(job):
        m, card, sample = job
        dest = OUT / m["name"] / f"{card['id']}-from-script-{sample}.md"
        if dest.exists():
            text = dest.read_text(encoding="utf-8").split("-->", 1)[-1].strip()
            row = {"model": m["name"], "card": card["id"], "sample": sample, "resumed": True, "cost": None}
            row.update(letter_checks(text, card))
            row["file"] = str(dest.relative_to(OUT)).replace("\\", "/")
            return row
        src_path, script = load_script(card["id"], sample)
        user = json.dumps({
            "fanName": card["fanName"],
            "sceneCard": {k: v for k, v in card.items() if k not in ("id", "fanNotes")},
            "whatTheFanAskedFor": card["fanNotes"],
            "shootingScript_allBeatsHappened": script,
            "mayasNotesAfterFilming": CREATOR_NOTES[card["id"]],
            "mayasIdeasForThePS": MAYA_IDEAS,
        }, indent=2, ensure_ascii=False)
        body = {"model": m["model"], "temperature": m["temperature"], "max_tokens": 2000,
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                "provider": {"data_collection": "deny", "allow_fallbacks": True}}
        with LOCK:
            try:
                budget.ensure(0.02)
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
        row.update(letter_checks(text, card))
        dest.parent.mkdir(exist_ok=True)
        header = (f"<!-- Letter model: {m['model']} via {row['provider']} | From script: "
                  f"{SOURCE_MODEL}/{src_path.name} | {row['words']} words | finish: {row['finish_reason']} | "
                  f"flags: {'; '.join(row['flags']) or 'none'} -->\n\n")
        dest.write_text(header + text + "\n", encoding="utf-8")
        row["file"] = str(dest.relative_to(OUT)).replace("\\", "/")
        with LOCK:
            print(f"  {m['name']:<18} {card['id']:<22} script {sample} words={row['words']:<4} flags={len(row['flags'])} ${budget.spent:.4f}")
        return row

    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        index = list(ex.map(work, jobs))

    stamp = time.strftime("%Y%m%d-%H%M%S")
    (run.RESULTS / f"round4-{stamp}.json").write_text(json.dumps(index, indent=2, ensure_ascii=False), encoding="utf-8")
    lines = ["# After-shoot letters: index", "",
             "Private samples for judging. Gitignored; never commit or share outside the owner.", "",
             f"Each letter was written from one of {SOURCE_MODEL}'s round 3 scripts (all beats treated as having happened) "
             "plus a short synthetic note from Maya. Automatic flags are keyword hits only. Read each letter in context.", "",
             "| Letter model | Scene Card | From script | Words | P.S. | Kiss emoji | Flags | File |",
             "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for r in index:
        if "file" in r:
            lines.append(f"| {r['model']} | {r['card']} | {r['sample']} | {r['words']} | {'yes' if r['has_ps'] else 'no'} | "
                         f"{'yes' if r['kiss_emoji'] else 'no'} | {'; '.join(r['flags']) or 'none'} | [{r['file']}]({r['file']}) |")
        else:
            lines.append(f"| {r['model']} | {r['card']} | {r['sample']} | - | - | - | {r.get('error') or r.get('skipped')} | - |")
    (OUT / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n=== Round 4 ===")
    for m in MODELS:
        rs = [r for r in index if r["model"] == m["name"]]
        done = [r for r in rs if "file" in r]
        cost = sum((r.get("cost") or 0) for r in rs)
        avg = sum(r["words"] for r in done) / len(done) if done else 0
        print(f"{m['name']:<18} written={len(done)}/{len(rs)} refused_or_short={sum(1 for r in done if r['refused'])} "
              f"ps={sum(1 for r in done if r['has_ps'])} avg_words={avg:.0f} flagged={sum(1 for r in done if r['flags'])} cost=${cost:.4f}")
        for r in done:
            if r["flags"]:
                print(f"    {r['card']} #{r['sample']}: {'; '.join(r['flags'])}")
    print(f"Total ${budget.spent:.4f}. Index: {OUT / 'INDEX.md'}")


if __name__ == "__main__":
    main()
