"""Silence detection with auto-editor. Returns the ranges to cut, ready for the editor's `cut` op."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from .common import ROOT, existing_file, rounded

TIMEBASE = 100  # 10 ms resolution
CUT_SPEED = 99999.0  # auto-editor's marker for removed sections


def ranges_from_chunks(chunks, timebase=TIMEBASE, min_cut=0.0):
    """Convert auto-editor v1 chunks [start, end, speed] (timeline frames) to second ranges."""
    cuts, keep = [], []
    for start, end, speed in chunks:
        span = [start / timebase, end / timebase]
        (cuts if float(speed) >= CUT_SPEED else keep).append(span)
    short = [c for c in cuts if c[1] - c[0] < min_cut]
    cuts = [c for c in cuts if c[1] - c[0] >= min_cut]
    keep = sorted(keep + short)
    merged = []
    for start, end in keep:
        if merged and abs(start - merged[-1][1]) < 1e-9:
            merged[-1][1] = end
        else:
            merged.append([start, end])
    return cuts, merged


def run_auto_editor(file, threshold, margin, timebase=TIMEBASE):
    temp = ROOT / 'workspace/cache/temp'
    temp.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=temp) as folder:
        out = Path(folder) / 'timeline.json'
        command = [sys.executable, '-m', 'auto_editor', str(file), '--export', 'v1', '-o', str(out),
                   '-tb', str(timebase), '--edit', f'audio:threshold={threshold}', '--margin', f'{margin}s']
        result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace',
                                timeout=60 * 60, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        if result.returncode != 0 or not out.is_file():
            raise RuntimeError('auto-editor failed: ' + (result.stderr or result.stdout)[-2000:])
        return json.loads(out.read_text(encoding='utf-8'))


def detect(path, threshold=0.04, margin=0.2, min_cut=0.3):
    file = existing_file(path)
    timeline = run_auto_editor(file, threshold, margin)
    chunks = timeline.get('chunks') or []
    duration = chunks[-1][1] / TIMEBASE if chunks else 0.0
    cuts, keep = ranges_from_chunks(chunks, TIMEBASE, min_cut)
    cut_list = [{'start': rounded(a), 'end': rounded(b)} for a, b in cuts]
    removed = sum(b - a for a, b in cuts)
    return {
        'tool': 'auto-editor', 'input': str(file), 'durationSeconds': rounded(duration),
        'settings': {'threshold': threshold, 'marginSeconds': margin, 'minCutSeconds': min_cut},
        'cuts': cut_list,
        'keep': [{'start': rounded(a), 'end': rounded(b)} for a, b in keep],
        'removedSeconds': rounded(removed), 'resultSeconds': rounded(duration - removed),
        'edlOperation': {'op': 'cut', 'ranges': cut_list} if cut_list else None,
        'note': 'Loudness-based: review cuts near soft words or breaths before applying.',
    }
