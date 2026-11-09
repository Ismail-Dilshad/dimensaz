"""Text and layout measurements of a reference video, for learned looks (src/engine/looks.ts).

Finds text-like lines in sampled frames (dense, short edges joined horizontally) and measures how
big the lines are, how heavy their strokes are, where on the frame they sit, how much of the frame
they cover, and how busy the whole frame is. Fonts and words are not read.
"""
from .common import existing_file, rounded

WIDTH = 540


def text_lines(gray):
    import cv2
    import numpy as np
    h, w = gray.shape
    grad = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    joined = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (max(5, w // 30), 3)))
    contours, _ = cv2.findContours(joined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    lines = []
    for c in contours:
        x, y, cw, ch = cv2.boundingRect(c)
        if ch < h * 0.012 or ch > h * 0.16 or cw < ch * 1.6 or cw > w * 0.98:
            continue
        fill = float(np.count_nonzero(bw[y:y + ch, x:x + cw])) / (cw * ch)
        if fill < 0.22 or fill > 0.85:
            continue
        # Stroke width: twice the typical distance from a stroke pixel to the stroke's edge.
        patch = gray[y:y + ch, x:x + cw]
        _, ink = cv2.threshold(patch, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        if np.count_nonzero(ink) > ink.size / 2:
            ink = 255 - ink
        dist = cv2.distanceTransform(ink, cv2.DIST_L2, 3)
        stroke = float(np.percentile(dist[dist > 0], 90) * 2) if np.count_nonzero(dist) else 0.0
        lines.append({'y': (y + ch / 2) / h, 'height': ch / h, 'width': cw / w, 'area': cw * ch / (w * h), 'stroke': stroke / ch if ch else 0.0})
    return lines


def measure(path, samples=18):
    import cv2
    import numpy as np
    file = existing_file(path)
    cap = cv2.VideoCapture(str(file))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total <= 0:
        raise RuntimeError('Cannot read video: ' + str(file))
    picks = sorted(set(int(total * (i + 0.5) / samples) for i in range(samples)))
    all_lines, coverage, busy, frames = [], [], [], 0
    for index in picks:
        cap.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = cap.read()
        if not ok:
            continue
        frames += 1
        h, w = frame.shape[:2]
        small = cv2.resize(frame, (WIDTH, max(1, int(h * WIDTH / w))), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        lines = text_lines(gray)
        all_lines += lines
        coverage.append(sum(l['area'] for l in lines))
        edges = cv2.Canny(gray, 60, 160)
        busy.append(float(np.count_nonzero(edges)) / edges.size)
    cap.release()
    if not frames:
        raise RuntimeError('No frames could be read from ' + str(file))
    heights = sorted(l['height'] for l in all_lines)
    big = heights[int(len(heights) * 0.75):] if heights else []
    pos = {'top': 0, 'center': 0, 'bottom': 0}
    for l in all_lines:
        pos['top' if l['y'] < 0.38 else 'bottom' if l['y'] > 0.66 else 'center'] += l['area']
    total_area = sum(pos.values()) or 1
    return {'tool': 'look', 'file': str(file), 'frames': frames,
            'text': {'linesPerFrame': rounded(len(all_lines) / frames, 2),
                     'lineHeight': rounded(float(np.median(heights)), 4) if heights else None,
                     'headlineHeight': rounded(float(np.median(big)), 4) if big else None,
                     'stroke': rounded(float(np.median([l['stroke'] for l in all_lines])), 3) if all_lines else None,
                     'coverage': rounded(float(np.mean(coverage)), 4),
                     'position': {k: rounded(v / total_area, 2) for k, v in pos.items()}},
            'busy': rounded(float(np.mean(busy)), 4)}
