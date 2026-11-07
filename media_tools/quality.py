"""Image and video quality with OpenCV: sharpness, exposure, contrast, noise and black frames."""
from pathlib import Path
from .common import existing_file, rounded

IMAGE_TYPES = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tif', '.tiff'}
LIMITS = {'blurry': 60.0, 'dark': 0.18, 'bright': 0.85, 'clipped': 0.05, 'black': 0.03, 'noisy': 6.0}


def measure(frame):
    """Quality numbers for one BGR frame, measured at a fixed 720 px width so files compare fairly."""
    import cv2
    import numpy as np
    height, width = frame.shape[:2]
    if width > 720:
        frame = cv2.resize(frame, (720, max(1, int(height * 720 / width))), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    noise = float(np.median(np.abs(gray.astype(np.float32) - cv2.medianBlur(gray, 3).astype(np.float32))) * 1.4826)
    values = {
        'sharpness': rounded(sharpness, 1), 'brightness': rounded(gray.mean() / 255), 'contrast': rounded(gray.std() / 255),
        'clippedHighlights': rounded((gray >= 250).mean(), 4), 'crushedShadows': rounded((gray <= 5).mean(), 4),
        'noise': rounded(noise, 2),
    }
    values['flags'] = flags(values)
    return values


def flags(v):
    out = []
    if v['brightness'] < LIMITS['black']:
        return ['black']
    if v['sharpness'] < LIMITS['blurry']: out.append('blurry')
    if v['brightness'] < LIMITS['dark']: out.append('dark')
    if v['brightness'] > LIMITS['bright']: out.append('bright')
    if v['clippedHighlights'] > LIMITS['clipped']: out.append('clipped-highlights')
    if v['crushedShadows'] > LIMITS['clipped']: out.append('crushed-shadows')
    if v['noise'] > LIMITS['noisy']: out.append('noisy')
    return out


def summary(samples):
    import statistics
    keys = ['sharpness', 'brightness', 'contrast', 'clippedHighlights', 'crushedShadows', 'noise']
    medians = {k: rounded(statistics.median(s[k] for s in samples), 4) for k in keys}
    counts = {}
    for s in samples:
        for f in s['flags']:
            counts[f] = counts.get(f, 0) + 1
    return {'median': medians, 'flagCounts': counts,
            'flaggedRatio': rounded(sum(1 for s in samples if s['flags']) / len(samples)) if samples else 0.0}


def check(path, samples_per_second=1.0, max_samples=120):
    import cv2
    file = existing_file(path)
    if file.suffix.lower() in IMAGE_TYPES:
        image = cv2.imread(str(file), cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError('Cannot read image: ' + str(file))
        result = measure(image)
        return {'tool': 'opencv-quality', 'input': str(file), 'kind': 'image', 'width': image.shape[1], 'height': image.shape[0],
                **result, 'limits': LIMITS}
    capture = cv2.VideoCapture(str(file))
    if not capture.isOpened():
        raise RuntimeError('Cannot open video: ' + str(file))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    step = max(1, int(round(fps / samples_per_second)))
    if total and total / step > max_samples:
        step = max(step, total // max_samples)
    samples, index = [], 0
    while True:
        if not capture.grab():
            break
        if index % step == 0:
            ok, frame = capture.retrieve()
            if ok:
                samples.append({'time': rounded(index / fps), **measure(frame)})
        index += 1
    capture.release()
    worst = sorted((s for s in samples if s['flags']), key=lambda s: s['sharpness'])[:5]
    return {'tool': 'opencv-quality', 'input': str(file), 'kind': 'video', 'width': width, 'height': height,
            'fps': rounded(fps), 'durationSeconds': rounded(index / fps), 'samples': len(samples),
            'summary': summary(samples) if samples else None, 'worst': worst, 'frames': samples, 'limits': LIMITS,
            'note': 'Sharpness depends on content; compare clips of the same scene rather than across scenes.'}
