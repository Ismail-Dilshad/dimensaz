"""Select a style from its brief and script. Standard library only."""
import argparse
import datetime
import hashlib
import json
import re
import uuid
from pathlib import Path

BASE = Path(__file__).resolve().parent
def project_root():
    for folder in [*BASE.parents, Path.cwd(), *Path.cwd().parents]:
        if (folder / "references/production-system.md").is_file() and (folder / "engine/production.ts").is_file():
            return folder
    return None

PROJECT = project_root()
HISTORY = (PROJECT / "references/style-library/catalog/selection-history") if PROJECT else BASE.parent / "selection-history"
CLASSIC_VIDEO = PROJECT / "references/style-library/styles/classic/finished-examples/why-customers-buy-elsewhere_60fps_v3.mp4" if PROJECT else None
CARDS = {
    # aliases, visual features for near-duplicate detection, multilingual brief/script cues
    "Classic": ([], ["blue", "light grid", "glossy 3d", "blue chip"], "narrated faq sponsor local business familiar دوکان سپۆنسەر"),
    "Blue Editorial": (["style-1", "style-2", "styles-with-video-1"], ["blue", "light grid", "glossy 3d", "blue chip"], "product walkthrough mechanism slider comparison learners demonstration tutorial ئامێر فێربوون"),
    "Red Signal": (["style-3", "style-6"], ["red", "dark grid", "glossy 3d", "red tab"], "warning risk alarm loss diagnostic fault metric fraud crisis urgent زیان ئاگاداری مەترسی"),
    "Apricot Miniatures": (["style-4"], ["orange", "light dots", "miniatures", "orange block"], "beginner welcoming neighbourhood first step practical habits action هەنگاو دەستپێک"),
    "Emerald Contrast": (["style-5"], ["lime", "dark grid", "pearl 3d", "lime band"], "tradeoff compare alternatives value balance distinction measure بەراورد جیاوازی هاوسەنگی"),
    "Lavender Glass": (["style-7"], ["violet", "light gradient", "frosted glass", "violet pill"], "trust reassuring onboarding progress wellbeing gentle care آرام دڵنیایی متمانە"),
    "Green Beacon": (["styles-with-video-2", "styles-with-video-6"], ["green", "dark grid", "glossy 3d", "green block"], "network navigation discovery signal route technology tracking map تۆڕ نەخشە ڕێگا"),
    "Tangerine Counter": (["styles-with-video-3"], ["orange", "light grid", "molded 3d", "orange block"], "sale discount deal shoppers retail price market offer نرخ داشکاندن بازاڕ"),
    "Citron Clay": (["styles-with-video-4"], ["lime", "dark grid", "matte clay", "lime band"], "maker craft build tool workshop gardening how-to hands-on plant assembly clay چاندن دەستکار"),
    "Violet Cutout": (["styles-with-video-5"], ["violet", "paper grid", "cutout collage", "grape band"], "human story mentor biography memories history people culture community teacher چیرۆک مێژوو مامۆستا"),
}

def tokens(s):
    return set(re.findall(r"[^\W_]+", s.casefold(), re.UNICODE))

def resolve(name):
    for card, (aliases, _, _) in CARDS.items():
        if name.casefold() in [card.casefold(), *(a.casefold() for a in aliases)]:
            return card
    raise ValueError("Unknown style name: " + name)

def history():
    records = [{"card": "Classic", "features": CARDS["Classic"][1], "record": "original Classic export"}]
    if HISTORY.exists():
        records += [json.loads(p.read_text(encoding="utf8")) for p in sorted(HISTORY.glob("*.json"))]
    return records[-8:]

def choose(brief, script, override=None, recent=()):
    required = ("topic", "industry", "audience", "emotion", "tone")
    if not all(isinstance(brief.get(k), str) and brief[k].strip() for k in required):
        raise ValueError("Supply topic, industry, audience, emotion and tone in the brief.")
    if not script.strip():
        raise ValueError("The source script is empty.")
    candidates = {}
    for card, (_, _, cues) in CARDS.items():
        vocabulary = tokens(cues)
        hits = {k: sorted(tokens(brief[k]) & vocabulary) for k in required}
        hits["script"] = sorted(tokens(script) & vocabulary)
        weights = {"topic": 4, "industry": 3, "audience": 2, "emotion": 2, "tone": 2, "script": 1}
        score = sum(weights[k] * len(v) for k, v in hits.items())
        candidates[card] = (score, hits)
    ranked = sorted(CARDS, key=lambda c: (-candidates[c][0],sum(r["card"] == c for r in recent[-3:]),c))
    automatic = bool(override and override.casefold() == "auto")
    primary = ranked[0] if automatic else resolve(override or "Blue Editorial")
    features = list(CARDS[primary][1])
    card = primary
    if not override:
        rationale = "Blue Editorial is the default for a new video without an explicit style."
    elif not automatic:
        rationale = f"The requested name {override!r} selects {primary}."
    elif candidates[primary][0] > 0:
        hits = candidates[primary][1]
        rationale = primary + " fits " + ", ".join(k + " (" + ", ".join(v) + ")" for k, v in hits.items() if v) + "."
    else:
        # An uncatalogued topic gets a coherent material/background pairing and explicit provenance.
        parents = ["Citron Clay", "Lavender Glass"]
        if any(r["card"] == "Remix · Pearl Workshop" for r in recent[-2:]):
            parents = ["Violet Cutout", "Apricot Miniatures"]
        paper = parents[0] == "Violet Cutout"
        primary = parents[0]
        card = "Remix · Apricot Paper" if paper else "Remix · Pearl Workshop"
        features = [CARDS[parents[1]][1][0], CARDS[parents[1]][1][1], CARDS[primary][1][2], CARDS[parents[1]][1][3]]
        rationale = f"The brief about {brief['topic']} has no recognized subject cue. Use the {features[2]} material from {primary} with the background, palette and highlight from {parents[1]}. Review the first still for {brief['audience']}."
    near = [{"prior":r["card"],"shared":sum(a == b for a,b in zip(features,r["features"]))}
            for r in recent if sum(a == b for a,b in zip(features,r["features"])) >= 3]
    return {"card":card,"alias":override,"features":features,"brief":brief,"rationale":rationale,
            "nearDuplicates":near,"scriptSHA256":hashlib.sha256(script.encode()).hexdigest(),
            "classicPlayback":str(CLASSIC_VIDEO) if card=="Classic" and CLASSIC_VIDEO and CLASSIC_VIDEO.is_file() else None}

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--brief", required=True, type=Path)
    parser.add_argument("--script", type=Path, help="UTF-8 script; alternatively include script in brief JSON.")
    parser.add_argument("--style",help="Named card or source folder. Takes precedence over automatic scoring.")
    parser.add_argument("--record",action="store_true",help="Record the selected style in this output library.")
    args=parser.parse_args()
    brief=json.loads(args.brief.read_text(encoding="utf-8-sig"))
    script=args.script.read_bytes().decode("utf-8-sig") if args.script else brief.pop("script","")
    pick=choose(brief,script,args.style,history())
    if args.record:
        HISTORY.mkdir(exist_ok=True)
        stamp=datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        target=HISTORY/(stamp+"-"+uuid.uuid4().hex+".json")
        with target.open("x",encoding="utf8") as f:
            json.dump(pick,f,ensure_ascii=False,indent=2)
    print(json.dumps(pick,ensure_ascii=False,indent=2))
