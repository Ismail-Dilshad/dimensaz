"""Reference style extraction: turns reference videos and images into a written style brief.

Measured: palette with roles, brightness and contrast, cut rhythm, motion energy over time,
motion bursts and their easing (ease-out, ease-in, ease-in-out, linear). Not measured:
font identity and design intent, which the agent fills in by looking at the saved frames.
"""
import json
from pathlib import Path
from .common import existing_file, rounded

IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}
ANALYSIS_WIDTH = 320


def hex_colour(bgr):
    b, g, r = (int(round(v)) for v in bgr)
    return '#{:02X}{:02X}{:02X}'.format(r, g, b)


def luminance(bgr):
    def channel(v):
        v = v / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    b, g, r = bgr
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def saturation(bgr):
    b, g, r = (v / 255 for v in bgr)
    hi, lo = max(r, g, b), min(r, g, b)
    return 0.0 if hi == 0 else (hi - lo) / hi


def palette(frames, k=6):
    """Dominant colours across frames (k-means in Lab space) with roles."""
    import cv2
    import numpy as np
    pixels = np.concatenate([f.reshape(-1, 3) for f in frames]).astype(np.float32)
    if len(pixels) > 200_000:
        pixels = pixels[np.random.default_rng(7).choice(len(pixels), 200_000, replace=False)]
    lab = cv2.cvtColor(pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_BGR2LAB).reshape(-1, 3).astype(np.float32)
    k = min(k, len(np.unique(lab, axis=0)))
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
    _, labels, centres = cv2.kmeans(lab, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.ravel(), minlength=k) / len(labels)
    bgr = cv2.cvtColor(centres.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2BGR).reshape(-1, 3)
    colours = sorted(({'bgr': c.tolist(), 'share': float(s)} for c, s in zip(bgr, counts)), key=lambda c: -c['share'])
    background = colours[0]
    rest = colours[1:]
    accent = max(rest, key=lambda c: saturation(c['bgr']) * (c['share'] ** 0.3), default=None)
    text = max((c for c in rest if c is not accent), key=lambda c: contrast(c['bgr'], background['bgr']), default=None)
    roles = {'background': background, 'accent': accent, 'text': text}
    out = {'colours': [{'hex': hex_colour(c['bgr']), 'share': rounded(c['share'], 3), 'saturation': rounded(saturation(c['bgr']), 2)} for c in colours],
           'roles': {name: hex_colour(c['bgr']) for name, c in roles.items() if c is not None}}
    if text is not None:
        out['textContrast'] = rounded(contrast(text['bgr'], background['bgr']), 2)
    return out


def classify_easing(curve):
    """Easing of one motion burst from its speed curve: where the peak sits and how it decays."""
    import numpy as np
    curve = np.asarray(curve, dtype=float)
    if len(curve) < 4 or curve.max() <= 0:
        return 'too-short'
    peak = int(np.argmax(curve)) / (len(curve) - 1)
    flat = curve.std() / (curve.mean() + 1e-9) < 0.25
    if flat:
        return 'linear'
    if peak <= 0.3:
        return 'ease-out'
    if peak >= 0.7:
        return 'ease-in'
    return 'ease-in-out'


def bursts(energy, fps, threshold=None, min_frames=4):
    """Contiguous stretches of motion in the per-frame energy curve."""
    import numpy as np
    e = np.asarray(energy, dtype=float)
    if not len(e):
        return []
    level = threshold if threshold is not None else max(0.6, float(np.percentile(e, 60)))
    on = e > level
    out, start = [], None
    for i, flag in enumerate(list(on) + [False]):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            if i - start >= min_frames:
                curve = e[start:i]
                out.append({'start': rounded(start / fps, 2), 'duration': rounded((i - start) / fps, 2), 'easing': classify_easing(curve),
                            'peak': rounded(float(curve.max()), 2)})
            start = None
    return out


def read_video(file, frames_dir, stills=8):
    import cv2
    import numpy as np
    capture = cv2.VideoCapture(str(file))
    if not capture.isOpened():
        raise RuntimeError('Cannot open video: ' + str(file))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    keep = set(int(i) for i in np.linspace(0, max(total - 1, 0), stills)) if total else set()
    previous, energy, samples, saved, index = None, [], [], [], 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        h, w = frame.shape[:2]
        small = cv2.resize(frame, (ANALYSIS_WIDTH, max(1, int(h * ANALYSIS_WIDTH / w))), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
        energy.append(0.0 if previous is None else float(np.abs(gray - previous).mean()))
        previous = gray
        if index % max(1, int(fps // 2)) == 0:
            samples.append(small)
        if index in keep and frames_dir:
            target = Path(frames_dir) / f'{file.stem}-{index / fps:06.2f}s.jpg'
            cv2.imwrite(str(target), frame, [cv2.IMWRITE_JPEG_QUALITY, 88])
            saved.append(str(target))
        index += 1
    capture.release()
    return {'fps': fps, 'frames': index, 'width': w if index else 0, 'height': h if index else 0, 'energy': energy, 'samples': samples, 'saved': saved}


def analyse_video(file, frames_dir):
    import numpy as np
    data = read_video(file, frames_dir)
    fps, energy = data['fps'], data['energy']
    duration = data['frames'] / fps
    rhythm = None
    try:
        from .scenes import detect as scenes
        result = scenes(file)
        rhythm = {'cutTimes': result['cutTimes'], **result['rhythm']}
    except Exception as error:  # PySceneDetect missing or unreadable file: rhythm stays unknown
        rhythm = {'error': str(error)[:200]}
    motion = bursts(energy, fps)
    counts = {}
    for b in motion:
        counts[b['easing']] = counts.get(b['easing'], 0) + 1
    cuts = set(round(t * fps) for t in (rhythm or {}).get('cutTimes', []))
    calm = [e for i, e in enumerate(energy) if i not in cuts and i - 1 not in cuts]
    per_second = [rounded(float(np.mean(energy[i:i + int(fps)])), 2) for i in range(0, len(energy), max(1, int(fps)))]
    lum = [float(s.mean()) / 255 for s in data['samples']]
    return {'file': str(file), 'kind': 'video', 'width': data['width'], 'height': data['height'], 'fps': rounded(fps, 2),
            'durationSeconds': rounded(duration, 2), 'palette': palette(data['samples']),
            'brightness': rounded(float(np.mean(lum)), 3) if lum else None,
            'rhythm': rhythm,
            'motion': {'energyMean': rounded(float(np.mean(calm)), 2) if calm else 0.0, 'energyPerSecond': per_second,
                       'bursts': motion, 'burstsPerSecond': rounded(len(motion) / duration, 2) if duration else 0.0,
                       'easing': counts, 'dominantEasing': max(counts, key=counts.get) if counts else None,
                       'averageBurstSeconds': rounded(float(np.mean([b['duration'] for b in motion])), 2) if motion else None},
            'frames': data['saved']}


def analyse_image(file, frames_dir):
    import cv2
    image = cv2.imread(str(file), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError('Cannot read image: ' + str(file))
    h, w = image.shape[:2]
    small = cv2.resize(image, (ANALYSIS_WIDTH, max(1, int(h * ANALYSIS_WIDTH / w))), interpolation=cv2.INTER_AREA)
    return {'file': str(file), 'kind': 'image', 'width': w, 'height': h, 'palette': palette([small]),
            'brightness': rounded(float(small.mean()) / 255, 3), 'frames': [str(file)]}


def describe_energy(mean):
    if mean is None:
        return 'unknown'
    return 'calm' if mean < 2 else 'smooth' if mean < 5 else 'energetic' if mean < 10 else 'frantic'


def brief_markdown(name, items, merged):
    lines = [f'# Style brief: {name}', '', 'Measured from the references by `media style`. Fill in the sections marked',
             '*(by eye)* after looking at the saved frames. Recreate the style with the user\'s brand: map the',
             'reference colour roles onto `config/brand.json` and pick an allowed font of the same character.', '',
             '## Palette', '']
    roles = merged['palette']['roles']
    for role in ('background', 'text', 'accent'):
        if role in roles:
            lines.append(f'- **{role.capitalize()}:** `{roles[role]}`')
    lines.append('- **All colours (share):** ' + ', '.join(f"`{c['hex']}` {round(c['share'] * 100)}%" for c in merged['palette']['colours']))
    if 'textContrast' in merged['palette']:
        lines.append(f"- **Text contrast:** {merged['palette']['textContrast']}:1")
    videos = [i for i in items if i['kind'] == 'video']
    if videos:
        lines += ['', '## Rhythm and cuts', '']
        for v in videos:
            r = v.get('rhythm') or {}
            if 'shotCount' in r:
                lines.append(f"- `{Path(v['file']).name}`: {v['durationSeconds']} s, {r['shotCount']} shots, average shot "
                             f"{r['averageShotSeconds']} s ({r['shortestShotSeconds']}–{r['longestShotSeconds']} s), {r['cutsPerMinute']} cuts per minute.")
            else:
                lines.append(f"- `{Path(v['file']).name}`: {v['durationSeconds']} s, cut detection unavailable.")
        lines += ['', '## Motion', '']
        for v in videos:
            m = v['motion']
            easing = ', '.join(f'{k} {n}' for k, n in sorted(m['easing'].items(), key=lambda x: -x[1])) or 'none detected'
            lines.append(f"- `{Path(v['file']).name}`: {describe_energy(m['energyMean'])} (energy {m['energyMean']}), "
                         f"{m['burstsPerSecond']} motion bursts per second, average burst {m['averageBurstSeconds']} s; easing: {easing}.")
        lines += ['', 'Easing is estimated from where each burst reaches peak speed: early peak = ease-out,',
                  'late = ease-in, middle = ease-in-out, even speed = linear. Confirm on the clips.']
    lines += ['', '## Typography *(by eye)*', '', '- Family character (geometric, grotesque, serif, rounded, display):',
              '- Weight and case:', '- Size relative to frame width, words per line:', '- Reveal style (by word, by line, mask, scale):',
              '', '## Composition and design *(by eye)*', '', '- Grid, margins and focal placement:', '- Shapes, depth, shadows, textures:',
              '- Transitions between scenes:', '', '## Frames to look at', '']
    for item in items:
        for f in item['frames']:
            lines.append(f'- `{f}`')
    return '\n'.join(lines) + '\n'


def extract(paths, name=None, out_dir=None):
    import cv2
    from .common import ROOT
    files = [existing_file(p) for p in paths]
    name = name or files[0].stem
    base = Path(out_dir) if out_dir else ROOT / 'workspace' / 'styles'
    target, n = base / name, 2
    while target.exists():  # never overwrite an earlier brief
        target, n = base / f'{name}-{n}', n + 1
    frames_dir = target / 'frames'
    frames_dir.mkdir(parents=True)
    items = [analyse_image(f, frames_dir) if f.suffix.lower() in IMAGE_TYPES else analyse_video(f, frames_dir) for f in files]
    stills = []
    for item in items:
        for f in item['frames']:
            image = cv2.imread(f)
            if image is not None:
                h, w = image.shape[:2]
                stills.append(cv2.resize(image, (ANALYSIS_WIDTH, max(1, int(h * ANALYSIS_WIDTH / w)))))
    merged = {'palette': palette(stills) if stills else items[0]['palette']}
    style = {'version': 1, 'name': name, 'sources': [str(f) for f in files], 'merged': merged, 'items': items,
             'notMeasured': ['font family', 'design intent', 'layout grid'], 'reviewed': False}
    (target / 'style.json').write_text(json.dumps(style, indent=1, ensure_ascii=False), encoding='utf-8')
    (target / 'brief.md').write_text(brief_markdown(name, items, merged), encoding='utf-8')
    return {'tool': 'style-extract', 'folder': str(target.resolve()), 'brief': str((target / 'brief.md').resolve()),
            'style': str((target / 'style.json').resolve()), 'palette': merged['palette']['roles'],
            'videos': [{'file': i['file'], 'rhythm': {k: v for k, v in (i.get('rhythm') or {}).items() if k != 'cutTimes'},
                        'dominantEasing': i['motion']['dominantEasing'], 'energy': describe_energy(i['motion']['energyMean'])}
                       for i in items if i['kind'] == 'video'],
            'note': 'Fonts and design intent are not measured; look at the saved frames and finish the brief.'}


def motion_sheet(videos, out, per_row=6, height=300):
    """One row per clip: frames at even intervals, so motion reads without the video."""
    import cv2
    from PIL import Image, ImageDraw
    rows = []
    for video in videos:
        capture = cv2.VideoCapture(str(video))
        count, fps = int(capture.get(cv2.CAP_PROP_FRAME_COUNT)), capture.get(cv2.CAP_PROP_FPS) or 30
        thumbs = []
        for k in range(per_row):
            capture.set(cv2.CAP_PROP_POS_FRAMES, int((k + .5) / per_row * max(count - 1, 1)))
            ok, frame = capture.read()
            if ok:
                image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)); image.thumbnail((height * 2, height)); thumbs.append(image)
        capture.release()
        if not thumbs:
            continue
        row = Image.new('RGB', (sum(t.width + 6 for t in thumbs), height + 24), (240, 240, 240))
        ImageDraw.Draw(row).text((6, 5), f'{Path(video).name}  ({count / fps:.1f} s, frames left to right)', fill=(20, 20, 20))
        x = 0
        for t in thumbs:
            row.paste(t, (x, 24)); x += t.width + 6
        rows.append(row)
    if not rows:
        return None
    sheet = Image.new('RGB', (max(r.width for r in rows), sum(r.height + 8 for r in rows)), 'white')
    y = 0
    for r in rows:
        sheet.paste(r, (0, y)); y += r.height + 8
    sheet.save(out, quality=82, optimize=True)
    return out


def add_style(paths, name, title=None, max_frames=6):
    """Turn reference videos and images into a reusable style folder in references/styles and the catalog.

    Keeps at most `max_frames` images (in the order given), replaces videos with one motion sheet,
    writes style.md (measured brief plus by-eye sections) and style.json, and registers the style.
    """
    import hashlib
    import re
    import shutil
    from .common import ROOT
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    if not slug:
        raise ValueError('Give the style a name, for example --name "Coral Studio"')
    folder = ROOT / 'references' / 'styles' / slug
    if folder.exists():
        raise FileExistsError('A style with this name already exists: ' + str(folder))
    files = [existing_file(p) for p in paths]
    images = [f for f in files if f.suffix.lower() in IMAGE_TYPES][:max_frames]
    videos = [f for f in files if f.suffix.lower() not in IMAGE_TYPES]
    (folder / 'frames').mkdir(parents=True)
    frames = []
    for image in images:
        target = folder / 'frames' / (re.sub(r'[^a-z0-9.]+', '-', image.name.lower()).strip('-'))
        shutil.copy2(image, target)
        frames.append({'path': target.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                       'alias': slug, 'subject': target.stem.replace('-', ' ')})
    sheet = motion_sheet(videos, folder / 'motion-sheet.jpg') if videos else None
    measured = extract([str(f) for f in images] + [str(v) for v in videos], slug, out_dir=ROOT / 'workspace' / 'styles')
    data = json.loads(Path(measured['style']).read_text(encoding='utf-8'))
    brief = Path(measured['brief']).read_text(encoding='utf-8')
    display = title or name.strip().title()
    body = brief.split('\n## Palette', 1)[1] if '\n## Palette' in brief else ''
    body = body.split('## Frames to look at')[0]
    md = [f'# {display}', '', f'Reusable reference style. Folder `references/styles/{slug}`.', '',
          '**Feel.** *(by eye: one sentence on the mood and idea)*', '', '**Use for.** *(by eye: audiences and topics)*', '',
          '## Palette' + body.rstrip(), '', '## Frames', '']
    md += [f"- [`{Path(f['path']).name}`](frames/{Path(f['path']).name})" for f in frames]
    if sheet:
        md += ['', f'Motion: [`motion-sheet.jpg`](motion-sheet.jpg), {len(videos)} clip(s) as frames over time. The videos are not kept.']
    (folder / 'style.md').write_text('\n'.join(md) + '\n', encoding='utf-8')
    entry = {'id': slug, 'name': display, 'kind': 'card', 'folder': f'references/styles/{slug}', 'aliases': [], 'frames': frames,
             'motionSheet': f'references/styles/{slug}/motion-sheet.jpg' if sheet else None}
    (folder / 'style.json').write_text(json.dumps({**entry, 'measured': data['merged'], 'items': [{k: v for k, v in i.items() if k != 'frames'} for i in data['items']]}, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    catalog_file = ROOT / 'references' / 'catalog.json'
    catalog = json.loads(catalog_file.read_text(encoding='utf-8'))
    catalog['styles'].append(entry)
    catalog_file.write_text(json.dumps(catalog, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    return {'tool': 'style-add', 'style': slug, 'folder': str(folder), 'frames': len(frames), 'motionSheet': bool(sheet),
            'skippedImages': max(0, len([f for f in files if f.suffix.lower() in IMAGE_TYPES]) - len(images)),
            'next': 'Open style.md, fill in the by-eye sections from the frames, and delete any frame that is not essential.'}
