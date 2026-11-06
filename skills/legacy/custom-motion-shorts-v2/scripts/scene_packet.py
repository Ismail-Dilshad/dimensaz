"""Compile a layer plan for review and queue only missing standalone assets."""
import argparse
import hashlib
import json
import math
import os
import re
from pathlib import Path
from urllib.parse import quote

from check_board import inside, key, overlap, rect, require


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def document(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def table(columns, rows):
    def row(items):
        return "| " + " | ".join(str(x).replace("|", "\\|").replace("\n", "<br>") for x in items) + " |"
    return "\n".join([row(columns), row(["---"] * len(columns)), *(row(items) for items in rows)])


def frames(start, end):
    return f"[{start}, {end}) · {start / 60:.3f}–{end / 60:.3f} s"


def scene_frames(scene, plan):
    # Packets published before per-scene pacing had an implicit 360-frame score.
    count = scene.get("scoreFrames", 360 if plan.get("version",1)==1 else None)
    require(type(count) is int and count > 0, "Scene scoreFrames must be a positive integer")
    return count


def verify_manifest(plan, project):
    """Compare editable object placements and action windows to authoritative project.json."""
    c = project["config"]
    require((c["width"], c["height"], c["fps"]) == (1080, 1920, 60), "Manifest format differs from the score")
    require(c["referenceStyle"]["card"] == plan.get("baseCard", plan["style"]), "Manifest style differs")
    require(project["script"] == plan["script"] and len(project["scenes"]) == len(plan["scenes"]),
            "Manifest scene count or source differs")
    locks = {lock["id"] for lock in project["assetLocks"]}
    def windows(track, saved, start_frame):
        def local_frame(t):
            return math.ceil((saved["start"] + t)*60 - 1e-8) - start_frame
        keys = track.get("keyframes", [])
        result = []
        for a,b in zip(keys,keys[1:]):
            if any(a[k] != b[k] for k in ("x","y","rotation","scale","opacity")):
                result.append((local_frame(a["at"]*saved["duration"]), local_frame(b["at"]*saved["duration"])))
        if "beat" in track:
            beat = track["beat"]
            result.append((local_frame(beat["start"]), local_frame(beat["start"]+beat["duration"])))
        return result
    start_frame = 0
    for scene, saved in zip(plan["scenes"],project["scenes"]):
        label = saved["id"]
        r = saved["referenceMotion"]
        count = scene_frames(scene, plan)
        require(math.ceil(saved["start"]*60-1e-8) == start_frame
                and math.ceil((saved["start"]+saved["duration"])*60-1e-8) == start_frame + count
                and r.get("scoreFrames") == count
                and saved["text"] == scene["copy"], f"{label}: manifest score or text differs")
        require(scene["anchor"] in r["evidence"], f"{label}: style anchor differs")
        layers = [x for x in plan.get("baseLayers",[]) + scene["layers"] if x["type"] == "asset"]
        h = r["composition"]["hero"]
        objects = [(saved["asset"],[h["x"],h["y"],h["w"],h["h"]],r.get("heroMotion",{}),r["rotation"],2)]
        for obj in r["layers"]:
            w,h = obj["width"],obj["height"]
            objects.append((obj["asset"],[obj["x"]-w/2,obj["y"]-h/2,w,h],obj,obj["rotation"],
                            1 if obj["depth"]=="behind" else 3))
        require(len(layers)==len(objects), f"{label}: different number of editable objects")
        for layer,(asset,box,track,rotation,_) in zip(sorted(layers,key=lambda x:x["z"]),sorted(objects,key=lambda x:x[4])):
            tag = f"{label}/{layer['id']}"
            require(asset in locks and asset == plan["registry"][layer["source"]].get("assetId"),
                    f"{tag}: asset missing, unpinned or stacked in a different order")
            require(all(abs(a-b*n)<=1 for a,b,n in zip(layer["box"],box,[1080,1920,1080,1920])),
                    f"{tag}: settled placement differs")
            origin = track.get("origin",{"x":.5,"y":.5})
            require(layer["pivot"] == [origin["x"],origin["y"]] and rotation == layer["rotation"],
                    f"{tag}: pivot or rotation differs")
            moves = sorted((m["start"],m["end"]) for m in scene["moves"] if m["layer"]==layer["id"])
            actual = windows(track, saved, start_frame)
            require(len(moves)==len(actual) and all(abs(v-w)<1e-5 for a,b in zip(moves,actual) for v,w in zip(a,b)),
                    f"{tag}: action windows differ")
        start_frame += count


def resolve_registry(entries, root, look):
    library = {m["id"]: m for m in (read(f) for f in (root / "assets/library").glob("*/*/metadata.json"))}
    known_names = {key(n) for m in library.values() for n in
                   (m["name"], m.get("referenceIdentity", {}).get("subject", "")) if n}
    registry, prompts, identities = {}, {}, set()
    for name, item in entries.items():
        if item.get("assetId"):
            asset_id = item["assetId"]
            require(asset_id in library, f"{name}: unknown library ID")
            m = library[asset_id]
            file = root / m["path"]
            require(m.get("renderable") and m["evaluation"]["reviewed"] and m["provenance"]["verified"]
                    and file.is_file() and digest(file.read_bytes()) == m["hash"], f"{name}: unverified asset")
            identity = m["hash"]
            record = {"assetId": asset_id, "file": m["path"], "sha256": identity}
        else:
            subject = item["subject"].strip()
            identity = key(subject)
            require(identity and identity not in known_names, f"{name}: resolve existing library candidate first")
            require(identity not in {"grid", "dots", "background", "gradient", "flat color", "highlight chip", "text"}
                    and not re.search(r"\b(?:full scene|whole scene|scene master|assembled scene|sprite sheet|asset sheet|contact sheet)\b", identity),
                    f"{name}: only standalone objects belong in the generation queue")
            width, height = item["size"]
            require(all(type(v) is int and v > 0 for v in (width, height)), f"{name}: invalid asset size")
            require(item["pose"].strip() and item["registration"].strip(), f"{name}: missing fit instructions")
            prompts[name] = (f"Create only the {subject}, centered on a transparent {width}×{height} px canvas. "
                             f"{look} Pose: {item['pose']}. Registration: {item['registration']}. "
                             "Show the whole object with clear padding. No other objects, text, scene, floor or cast shadow.")
            record = {"subject": subject, "status": "reserved"}
        require(identity not in identities, f"{name}: duplicate registry entry; reuse the original key")
        identities.add(identity)
        registry[name] = {**record, "instances": []}
    return registry, prompts


def compile_plan(plan, root, folder, reviewed=False, destination=None):
    scenes = plan["scenes"]
    require(scenes and "".join(s["copy"] for s in scenes) == plan["script"], "Script coverage differs")
    for field in ("title", "style", "rationale", "look", "assetLook", "easing", "timingNote"):
        require(plan[field].strip(), f"Missing {field}")
    registry, prompts = resolve_registry(plan["registry"], root, plan["assetLook"])
    sections = [f"# {plan['title']}", f"**{plan['style']}** · {plan['rationale']}", plan["timingNote"]]
    queue, summary, used_copy, review_keys = [], [], set(), {}
    start_frame = 0
    for i, scene in enumerate(scenes):
        count = scene_frames(scene, plan)
        label = f"S{i + 1:02}"
        for field in ("title", "anchor", "image", "motion", "first", "last", "cut", "contact"):
            require(scene[field].strip(), f"{label}: missing {field}")
        require((root / scene["anchor"]).is_file(), f"{label}: missing style evidence")
        phrase = scene.get("headline", scene["copy"].strip())
        require(phrase.strip() and re.search(r"(?<!\S)" + re.escape(phrase) + r"(?!\S)", scene["copy"]),
                f"{label}: select complete source words")
        require(key(phrase) not in used_copy or scene.get("copyCallback","").strip(), f"{label}: repeated wording")
        used_copy.add(key(phrase))
        layers = plan.get("baseLayers", []) + scene["layers"]
        ids = {p["id"]: p for p in layers}
        require(len(ids) == len(layers), f"{label}: duplicate layer ID")
        require(any(p["type"] == "text" for p in layers), f"{label}: reserve a real phrase layer")
        safe, art, caption = (rect(scene[k]) for k in ("safe", "art", "text"))
        require(inside(safe, (0, 0, 1080, 1920)) and inside(art, safe) and inside(caption, safe)
                and not overlap(art, caption), f"{label}: invalid safe zones")
        inventory, assembly, scene_assets, new = [], [], [], []
        for p in sorted(layers, key=lambda layer: layer["z"]):
            name, kind, source = p["id"], p["type"], p["source"]
            require(name.strip() and source.strip() and kind in {"background","color","shape","asset","text"},
                    f"{label}: invalid layer")
            box = rect(p["box"])
            require(all(len(p[k]) == 2 and all(0 <= v <= 1 for v in p[k]) for k in ("anchor","pivot"))
                    and math.isfinite(p["rotation"]) and math.isfinite(p["scale"]) and p["scale"] > 0
                    and type(p["z"]) is int, f"{label}/{name}: invalid placement")
            available, generate = source, "No"
            if kind == "asset":
                require(source in registry and inside(box, art), f"{label}/{name}: missing asset or outside art zone")
                entry = registry[source]
                previous = entry["instances"]
                if previous and previous[-1].split("/")[0] != label:
                    require(p.get("callback","").strip(), f"{label}/{name}: explain callback to {previous[-1]}")
                scene_assets.append(source)
                if source in prompts and not previous:
                    available, generate = "Missing", "Yes · one isolated object"
                    queue.append({"scene": label, "asset": source, "prompt": prompts[source]})
                    new.append(prompts[source])
                elif source in prompts:
                    available = "Reserved in " + previous[0]
                else:
                    available = "Library · " + source
                previous.append(label + "/" + name)
            elif kind == "text":
                require(inside(box, caption), f"{label}/{name}: outside text zone")
            inventory.append([name, kind, available, generate])
            assembly.append([name, source, p["box"], p["anchor"], p["pivot"], p["scale"], p["rotation"], p["z"]])
        require(len(set(scene_assets)) >= 2, f"{label}: supply separate hero and companion")
        moves = sorted(scene["moves"], key=lambda m: (m["start"], m["end"]))
        motion_rows, timeline, active_until = [], [], {}
        dominant_end = 0
        entrances, exits = [], []
        for m in moves:
            a, b, target = m["start"], m["end"], m["layer"]
            require(target in ids and m["prompt"].strip() and type(a) is int and type(b) is int
                    and 0 <= a < b <= count and 24 <= b - a <= 36, f"{label}: invalid motion for {target}")
            require(ids[target]["type"] not in {"background","color"}, f"{label}/{target}: keep the background fixed")
            require(a >= active_until.get(target, 0), f"{label}/{target}: overlapping actions")
            active_until[target] = b
            phase = m.get("phase", "action")
            require(phase in {"enter", "action", "exit"}, f"{label}/{target}: unknown motion phase")
            if phase == "enter":
                entrances.append((a,b))
            if phase == "exit":
                exits.append((a,b))
            if m.get("dominant", True):
                require(a >= dominant_end, f"{label}: competing dominant motions")
                dominant_end = b
            motion_rows.append([target, "Yes", m["prompt"], frames(a,b), plan["easing"], ids[target]["pivot"]])
        require(not any(a < d and c < b for a,b in exits for c,d in entrances),
                f"{label}: outgoing and incoming layers overlap in time")
        bounds = sorted({0, count, *(m[k] for m in moves for k in ("start", "end"))})
        for a,b in zip(bounds, bounds[1:]):
            moving = [m["layer"] for m in moves if m["start"] <= a < m["end"]]
            timeline.append([frames(a,b), ", ".join(moving) or "All layers hold"])
        callbacks = [p["callback"] for p in layers if p.get("callback")]
        sections.extend([f"## Scene {i+1} — {scene['title']}", scene["copy"].strip(),
                         f"**Displayed phrase** · {phrase}", f"**Style anchor** · {scene['anchor']}",
                         "### 1. Master image prompt · blueprint only", plan["look"] + " " + scene["image"],
                         "### 2. Layer table", table(["Layer","Type","Already available?","Generate?"],inventory),
                         "### 3. Asset prompts", "\n\n".join(new) or "None — all sources resolved or previously reserved.",
                         "### 4. Assembly prompt",
                         f"1080×1920. Safe rectangle {scene['safe']}, art {scene['art']}, text {scene['text']}. "
                         "Boxes are [left, top, width, height] px at rest. Anchor and pivot are local fractions.",
                         table(["Layer","Source","Box px","Anchor","Pivot","Scale","Rotation °","Z"],assembly),
                         scene["contact"], *callbacks, scene.get("copyCallback",""),
                         "### 5. Master motion prompt · blueprint only", f"{count/60:.3f} s at 60 fps. " + scene["motion"],
                         "### 6. Motion table", table(["Layer","Moves?","Motion","Start–end","Easing family","Pivot"],motion_rows),
                         "### 7. Final motion assembly timeline","**Frame 0** · "+scene["first"],
                         table(["Frames / time","Moving layers · every other layer holds"],timeline),
                         f"**Frame {count-1}** · "+scene["last"], f"**Cut at {count}** · "+scene["cut"]])
        evidence = scene.get("still")
        if evidence or reviewed:
            require(evidence and scene.get("inspection","").strip(), f"{label}: missing still inspection")
            file = folder / evidence
            require(file.is_file() and digest(file.read_bytes()) == scene.get("stillHash"), f"{label}: stale still")
            review_context = {
                "scene": {k:v for k,v in scene.items() if k != "reviewKey"},
                "style": [plan[k] for k in ("style","look","assetLook","easing")],
                "layers": layers, "anchor": digest((root / scene["anchor"]).read_bytes()),
                "assets": [registry[k].get("sha256") for k in scene_assets],
            }
            review_keys[label] = digest(json.dumps(review_context, sort_keys=True, ensure_ascii=False).encode())
            if reviewed:
                require(scene.get("reviewKey") == review_keys[label], f"{label}: review no longer matches the plan")
            try:
                link = quote(Path(os.path.relpath(file, destination or folder)).as_posix())
            except ValueError:  # The review folder can live on a different Windows drive.
                link = file.resolve().as_uri()
            sections.append(f"**Still inspection** · {scene['inspection']} [View the assembled still]({link}).")
        summary.append([label, scene["title"], ", ".join(scene_assets), frames(start_frame,start_frame+count),
                        ", ".join(f"{m['layer']} {m['start']}–{m['end']}" for m in moves) or "Hold"])
        start_frame += count
    require(all(r["instances"] for r in registry.values()), "Unused registry item")
    require(not reviewed or not queue, "Resolve outstanding asset reservations before review")
    sections.extend(["## All scenes, assets and timings",table(["Scene","Idea","Asset keys","Global frames / time","Local action frames"],summary)])
    return "\n\n".join(x for x in sections if x) + "\n", {"assets": registry, "reviewKeys": review_keys}, queue


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("plan", type=Path)
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--reviewed", action="store_true")
    parser.add_argument("--project", type=Path, help="Verify against the host's saved project.json")
    args = parser.parse_args()
    plan = read(args.plan)
    packet, registry, queue = compile_plan(plan, args.root, args.plan.parent, args.reviewed, args.out)
    if args.project:
        verify_manifest(plan, read(args.project))
    args.out.mkdir(parents=True, exist_ok=False)
    for name, data in [("scenes.md",packet), ("asset-registry.json",document(registry)),
                       ("image-generation-queue.json",document(queue))]:
        (args.out / name).write_text(data, encoding="utf-8")


if __name__ == "__main__":
    main()
