"""Build the browsable working library from the audited, read-only sources."""
import csv
import hashlib
import html
import json
import re
import runpy
import shutil
from collections import Counter
from pathlib import Path
from urllib.parse import quote

OUT = Path(__file__).resolve().parents[1]
ROOT = OUT.parent
REVIEW = ROOT / "references" / "style-library-review"
LIB = ROOT / "references" / "style-library"
SOURCE = ROOT / "NewSkillReference"
picker = runpy.run_path(str(REVIEW / "pick_style.py"))
cards = picker["CARDS"]
aliases = {alias: card for card, (names, _, _) in cards.items() for alias in names}
subjects = {
    1: ["Gift pedestals", "Identity badge", "Product and price scale", "Locked cart", "Hourglass and phone", "Rocket launch", "Message and plane"],
    2: ["Gift boxes", "Identity badge", "Price scale", "Locked storefront", "Hourglass", "Megaphone", "Key and nameplate", "Map pin", "Chat bubble"],
    3: ["Sale tag", "Striped storefront", "Video phone", "Shoppers and offer", "Megaphone rings", "Message and plane"],
    4: ["Unrolling film", "Box of price tags", "Hand swiping card", "Product pedestal", "Magnet and beads", "Clay rocket", "Sealed envelope"],
    5: ["Phone and shoppers", "Kraft shopping bag", "Magnifying glass and portrait", "Question mark", "Megaphone and product cards", "People on staircase", "Miniature storefront", "Expert portrait", "Hand and dominoes", "Chat phone"],
}
subjects[6] = subjects[2]
slug = lambda s: re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
esc = html.escape
link = lambda s: quote(str(s).replace("\\", "/"), safe="/.")
digest = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()

def copy_checked(src, dest, expected):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        with dest.open("xb") as out, src.open("rb") as inp:
            shutil.copyfileobj(inp, out)
    if digest(dest) != expected:
        raise ValueError(f"Existing working file differs from audited source: {dest}")

def classify(src):
    if src.suffix == ".skill":
        return "Shared", "original-packages", "Original prompt workflow"
    folder = src.parent.name
    card = aliases[folder]
    typ = {".jpg":"posters", ".mp4":"motion-clips", ".md":"image-briefs" if "each-image-reference" in src.name else "motion-briefs"}[src.suffix]
    scene = re.fullmatch(r"S-?(\d+)_[a-f0-9]+", src.stem)
    if scene and folder.startswith("styles-with-video-"):
        label = subjects[int(folder.rsplit("-",1)[1])][int(scene[1])-1]
    else:
        label = re.sub(r"_(?:\d{14}|[0-9a-f]{8})$", "", src.stem).replace("_"," ").replace("…","").strip()
    return card, typ, label

def main():
    manifest = json.loads((REVIEW / "evidence/inventory.json").read_text("utf8"))
    paths = {r["path"] for r in manifest}
    if paths != {p.relative_to(SOURCE).as_posix() for p in SOURCE.rglob("*")}:
        raise ValueError("Source inventory changed. Re-audit before filing.")
    records, omitted, by_hash = [], [], {}
    for row in manifest:
        if row["type"] == "folder":
            continue
        src = SOURCE / row["path"]
        if digest(src) != row["sha256"]:
            raise ValueError(f"Source bytes changed: {src}")
        if not row["bytes"]:
            omitted.append({"source":row["path"], "reason":"zero bytes"})
            continue
        card, typ, label = classify(src)
        previous = by_hash.get(row["sha256"])
        if previous:
            previous["sources"].append(row["path"])
            continue
        parent = Path("styles")/slug(card) if card != "Shared" else Path("shared")
        name = src.name if typ == "original-packages" else f"{src.parent.name}--{slug(label)[:55]}--{row['sha256'][:8]}{src.suffix}"
        rel = parent / typ / name
        copy_checked(src, LIB/rel, row["sha256"])
        item = {"style":card, "type":typ, "subject":label, "file":rel.as_posix(), "bytes":row["bytes"], "sha256":row["sha256"], "sources":[row["path"]]}
        records.append(item)
        by_hash[row["sha256"]] = item
    classic = picker["CLASSIC_VIDEO"]
    rel = Path("styles/classic/finished-examples") / classic.name
    hash_value = digest(classic)
    copy_checked(classic, LIB / rel, hash_value)
    records.append({"style":"Classic","type":"finished-examples","subject":"Why customers buy elsewhere","file":rel.as_posix(),"bytes":classic.stat().st_size,"sha256":hash_value,"sources":["project:"+classic.relative_to(ROOT).as_posix()]})
    # Archive members are useful as individually browsable documents, with their provenance.
    extracted = REVIEW/"evidence/archive-inspection/custom-motion-shorts"
    for source in sorted(extracted.rglob("*.md")):
        member = source.relative_to(extracted)
        rel = Path("shared/original-guides")/member
        h = digest(source)
        copy_checked(source, LIB/rel, h)
        records.append({"style":"Shared","type":"original-guides","subject":source.stem.replace("-"," "),
                        "file":rel.as_posix(),"bytes":source.stat().st_size,"sha256":h,
                        "sources":["archive:custom-motion-shorts.skill!/custom-motion-shorts/"+member.as_posix()]})
    metadata = LIB/"catalog"; metadata.mkdir(exist_ok=True)
    (metadata/"files.json").write_text(json.dumps({"files":records,"omitted":omitted}, ensure_ascii=False, indent=2),"utf8")
    with (metadata/"files.csv").open("w",encoding="utf-8-sig",newline="") as f:
        writer=csv.DictWriter(f,fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows({**r,"sources":" | ".join(r["sources"])} for r in records)
    styles=(REVIEW/"Styles.md").read_text("utf8").split("## Selection and remix")[0].split("### ")[1:]
    for section in styles:
        name, body=section.split("\n",1)
        body=body.replace("(evidence/","(../../../style-library-review/evidence/").replace("(../../mp2/60fps/vertical/sponsor-short/why-customers-buy-elsewhere_60fps_v3.mp4)","(finished-examples/"+classic.name+")")
        (LIB/"styles"/slug(name)/"Card.md").write_text("# "+name+"\n"+body,"utf8")
    css="body{max-width:1200px;margin:auto;padding:4vw;font:16px/1.5 system-ui;background:#f6f5ef;color:#192c31}h1{font-size:clamp(34px,4vw,58px);margin:.2em 0}header{padding-bottom:1rem;border-bottom:1px solid #d2d9cf}.controls{display:flex;flex-wrap:wrap;gap:1rem;margin:1.3rem 0}select,input{font:inherit;padding:.4em}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}article{background:white;border:1px solid #d2d9cf;border-radius:8px;padding:12px;overflow-wrap:anywhere}article img{width:100%;height:150px;object-fit:contain}a{color:#165e5a}small{color:#42575b}article[hidden],section[hidden]{display:none}"
    page=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Motion style library</title><style>'+css+'</style><body><header><small>MOTION REFERENCE LIBRARY</small><h1>Find a reference</h1><p>Browse by style, file type or subject. Open any item to see the full file.</p><a href="../style-library-review/Review.html">Visual review</a> · <a href="catalog/files.csv">File index</a> · <a href="../../SKILL.md">Production skill</a></header>']
    def select(key, values):
        return f'<label>{key.title()} <select id="{key}"><option value="">All</option>'+''.join(f'<option>{esc(v)}</option>' for v in values)+'</select></label>'
    page+=['<div class="controls">'+select("style",[*cards,"Shared"])+select("type",sorted({r["type"] for r in records}))+'<label>Search <input id="q" placeholder="e.g. badge"></label></div><p id="count" aria-live="polite"></p>']
    for name in [*cards,"Shared"]:
        page.append('<section><h2>'+esc(name)+'</h2>')
        if name in cards:page.append(f'<p><a href="styles/{slug(name)}/Card.md">Style card</a> · '+esc(", ".join(cards[name][1]))+'</p>')
        page.append('<div class="grid">')
        for r in (r for r in records if r["style"]==name):
            url=link(r["file"]);pic=f'<img loading="lazy" alt="" src="{url}">' if r['type']=='posters' else ''
            page.append(f'<article data-style="{name}" data-type="{r["type"]}" data-search="{esc(" ".join([r["subject"],*r["sources"]]).lower(),quote=True)}"><a href="{url}">{pic}{esc(r["subject"])}</a><br><small>{r["type"]} · {esc(Path(r["file"]).suffix[1:].upper())}</small></article>')
        page.append('</div></section>')
    page.append("""<script>const el=id=>document.getElementById(id);function filter(){let n=0;for(const a of document.querySelectorAll('article')){a.hidden=(el('style').value&&a.dataset.style!==el('style').value)||(el('type').value&&a.dataset.type!==el('type').value)||!a.dataset.search.includes(el('q').value.toLowerCase());if(!a.hidden)n++}for(const s of document.querySelectorAll('section'))s.hidden=!s.querySelector('article:not([hidden])');el('count').textContent=n+' matching files'}document.addEventListener('input',filter);filter()</script></body></html>""")
    (LIB/"index.html").write_text("".join(page),"utf8")
    print(json.dumps({"canonicalFiles":len(records),"types":dict(Counter(r["type"] for r in records)),"skippedEmpty":len(omitted),"duplicateAliases":sum(len(r["sources"])-1 for r in records)}))
if __name__=="__main__": main()
