"""Camera motion with OpenCV optical flow: pans, zoom and shake, frame to frame."""
from .common import existing_file, rounded

ANALYSIS_WIDTH = 640
SHAKE_LIMIT = 1.5  # px of jitter at 640 px width; above this, stabilizing helps


def frame_transforms(path, max_frames=None):
    """Per-frame camera transform (dx, dy in full-resolution px, rotation in radians, scale)."""
    import cv2
    import numpy as np
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise RuntimeError('Cannot open video: ' + str(path))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ratio = width / ANALYSIS_WIDTH if width > ANALYSIS_WIDTH else 1.0
    size = (int(round(width / ratio)), int(round(height / ratio)))
    ok, frame = capture.read()
    if not ok:
        raise RuntimeError('Video has no frames: ' + str(path))
    previous = cv2.cvtColor(cv2.resize(frame, size, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
    transforms = []
    while max_frames is None or len(transforms) < max_frames:
        ok, frame = capture.read()
        if not ok:
            break
        gray = cv2.cvtColor(cv2.resize(frame, size, interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2GRAY)
        dx = dy = da = 0.0
        ds = 1.0
        points = cv2.goodFeaturesToTrack(previous, maxCorners=200, qualityLevel=0.01, minDistance=20, blockSize=3)
        if points is not None and len(points) >= 8:
            moved, status, _ = cv2.calcOpticalFlowPyrLK(previous, gray, points, None)
            good = status.reshape(-1) == 1
            if good.sum() >= 8:
                matrix, _ = cv2.estimateAffinePartial2D(points[good], moved[good], method=cv2.RANSAC)
                if matrix is not None:
                    dx, dy = float(matrix[0, 2]) * ratio, float(matrix[1, 2]) * ratio
                    da = float(np.arctan2(matrix[1, 0], matrix[0, 0]))
                    ds = float(np.hypot(matrix[0, 0], matrix[1, 0]))
        transforms.append((dx, dy, da, ds))
        previous = gray
    capture.release()
    return transforms, fps, width, height, ratio


def smooth(values, radius):
    import numpy as np
    values = np.asarray(values, dtype=np.float64)
    if radius < 1 or len(values) < 3:
        return values.copy()
    kernel = np.ones(2 * radius + 1) / (2 * radius + 1)
    padded = np.pad(values, ((radius, radius), (0, 0)), mode='edge')
    return np.stack([np.convolve(padded[:, i], kernel, mode='valid') for i in range(values.shape[1])], axis=1)


def jitter(transforms, fps, ratio=1.0, seconds=0.5):
    """High-frequency camera movement: distance between the path and its smoothed version."""
    import numpy as np
    if not transforms:
        return 0.0
    path = np.cumsum(np.asarray(transforms)[:, :2], axis=0)
    residual = path - smooth(path, max(1, int(fps * seconds)))
    return float(np.sqrt((residual ** 2).sum(axis=1)).mean() / ratio)


def analyze(path):
    import numpy as np
    file = existing_file(path)
    transforms, fps, width, height, ratio = frame_transforms(file)
    if not transforms:
        return {'tool': 'opencv-motion', 'input': str(file), 'frames': 1, 'note': 'Single frame: no motion.'}
    t = np.asarray(transforms)
    shake = jitter(transforms, fps, ratio)
    pan = np.abs(t[:, :2]).mean(axis=0) * fps / np.array([width, height])  # frame widths per second
    zoom = float(np.prod(t[:, 3]))
    per_second = []
    step = max(1, int(round(fps)))
    for start in range(0, len(transforms), step):
        part = transforms[start:start + step]
        per_second.append({'time': rounded(start / fps, 2), 'shake': rounded(jitter(part, fps, ratio, 0.25), 2),
                           'motion': rounded(float(np.hypot(*np.asarray(part)[:, :2].mean(axis=0))) * fps / width, 3)})
    return {
        'tool': 'opencv-motion', 'input': str(file), 'fps': rounded(fps), 'frames': len(transforms) + 1,
        'shake': rounded(shake, 2), 'shaky': shake > SHAKE_LIMIT, 'shakeLimit': SHAKE_LIMIT,
        'panPerSecond': {'x': rounded(pan[0], 3), 'y': rounded(pan[1], 3)},
        'zoomChange': rounded(zoom, 3), 'perSecond': per_second,
        'suggestion': 'Stabilize with `media stabilize`.' if shake > SHAKE_LIMIT else None,
    }
