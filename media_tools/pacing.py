"""Pacing and liveliness check for a rendered video (OpenCV).

Finds stretches where nothing moves and frames that are only text on a plain
background, the two failures the motion rules forbid. Heuristic: confirm by looking.
"""
from .common import existing_file, rounded

SAMPLE_FPS = 10
WIDTH = 270
MOTION_DIFF = 0.35       # mean absolute change (0-255) between samples that counts as movement
MOTION_PIXELS = 0.002    # or this share of pixels changing by more than 12 levels
PLAIN_SHARE = 0.9        # a frame is plain when this share matches its dominant colour
MAX_STATIC = 1.5         # seconds without movement allowed
MAX_PLAIN = 1.0          # seconds of plain frames allowed


def dominant_share(gray_small, colour_small, tolerance=1):
    import numpy as np
    pixels = colour_small.reshape(-1, 3).astype(np.int16)
    quantized = (pixels // 8).astype(np.int32)
    keys = quantized[:, 0] * 1024 + quantized[:, 1] * 32 + quantized[:, 2]
    values, counts = np.unique(keys, return_counts=True)
    top = values[counts.argmax()]
    centre = np.array([top // 1024, (top // 32) % 32, top % 32]) * 8 + 4
    return float((np.abs(pixels - centre).max(axis=1) <= 4 + tolerance).mean())


def spans(flags, step, minimum):
    out, start = [], None
    for i, flag in enumerate(flags + [False]):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            length = (i - start) * step
            if length >= minimum:
                out.append({'start': rounded(start * step, 2), 'end': rounded(i * step, 2), 'seconds': rounded(length, 2)})
            start = None
    return out


def check(path, max_static=MAX_STATIC, max_plain=MAX_PLAIN):
    import cv2
    import numpy as np
    file = existing_file(path)
    capture = cv2.VideoCapture(str(file))
    if not capture.isOpened():
        raise RuntimeError('Cannot open video: ' + str(file))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    every = max(1, int(round(fps / SAMPLE_FPS)))
    step = every / fps
    previous, moving, plain, index = None, [], [], 0
    while True:
        if not capture.grab():
            break
        if index % every == 0:
            ok, frame = capture.retrieve()
            if not ok:
                break
            h, w = frame.shape[:2]
            small = cv2.resize(frame, (WIDTH, max(1, int(h * WIDTH / w))), interpolation=cv2.INTER_AREA)
            gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).astype(np.float32)
            if previous is not None:
                diff = np.abs(gray - previous)
                moving.append(bool(diff.mean() > MOTION_DIFF or (diff > 12).mean() > MOTION_PIXELS))
            plain.append(dominant_share(gray, small) >= PLAIN_SHARE)
            previous = gray
        index += 1
    capture.release()
    duration = index / fps
    still = spans([not m for m in moving], step, max_static)
    blank = spans(plain, step, max_plain)
    # A visual event is a sample where movement starts after a pause or changes strongly.
    events = sum(1 for i in range(1, len(moving)) if moving[i] and not moving[i - 1])
    problems = []
    if still:
        problems.append(f'{len(still)} stretch(es) with no movement longer than {max_static} s')
    if blank:
        problems.append(f'{len(blank)} stretch(es) of plain text-on-background frames longer than {max_plain} s')
    return {
        'tool': 'pacing-check', 'input': str(file), 'durationSeconds': rounded(duration, 2), 'sampleFps': rounded(1 / step, 2),
        'movingShare': rounded(sum(moving) / len(moving), 3) if moving else 0.0,
        'plainShare': rounded(sum(plain) / len(plain), 3) if plain else 0.0,
        'motionStartsPerSecond': rounded(events / duration, 2) if duration else 0.0,
        'staticSpans': still, 'plainSpans': blank,
        'pass': not problems, 'problems': problems,
        'note': 'Heuristic. A pass does not prove the design is good; look at the frames as well.',
    }
