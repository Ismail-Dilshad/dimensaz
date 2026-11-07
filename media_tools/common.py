"""Shared helpers: project paths, model cache, safe output files."""
import hashlib
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def model_dir(*parts):
    base = Path(os.environ.get('VIDEO_MEDIA_MODEL_DIR') or ROOT / 'workspace/cache/media-models').resolve()
    folder = base.joinpath(*parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def existing_file(value):
    file = Path(value).resolve()
    if not file.is_file():
        raise FileNotFoundError('Input not found: ' + str(value))
    return file


def write_new(file, value):
    """Write JSON to a new file. Never overwrites an earlier result."""
    target = Path(file)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('x', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write('\n')
    return str(target.resolve())


def sha256(file):
    digest = hashlib.sha256()
    with open(file, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def rounded(value, places=3):
    return round(float(value), places)


def merge_ranges(ranges, gap=0.0):
    """Sort and merge [start, end] ranges that overlap or are closer than gap."""
    merged = []
    for start, end in sorted(ranges):
        if merged and start - merged[-1][1] <= gap:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged
