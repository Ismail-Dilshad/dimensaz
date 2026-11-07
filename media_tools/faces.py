"""Face-aware reframing with MediaPipe: where to keep the speaker when cropping 16:9 to 9:16."""
import json
import statistics
import urllib.request
from .common import existing_file, model_dir, rounded, sha256

MODEL_URL = ('https://storage.googleapis.com/mediapipe-models/face_detector/'
             'blaze_face_short_range/float16/latest/blaze_face_short_range.tflite')
MODEL_NAME = 'blaze_face_short_range.tflite'
MODEL_BYTES = 230_000  # about 0.2 MB


def model_path(allow_download=False):
    folder = model_dir('mediapipe')
    model, record = folder / MODEL_NAME, folder / (MODEL_NAME + '.json')
    if model.is_file() and record.is_file():
        expected = json.loads(record.read_text(encoding='utf-8'))['sha256']
        if sha256(model) != expected:
            raise ValueError('Face model changed since download; delete it and run with --allow-download')
        return model
    if not allow_download:
        raise FileNotFoundError('Face model not installed (about 0.2 MB). Run again with --allow-download.')
    partial = folder / (MODEL_NAME + '.part')
    with urllib.request.urlopen(MODEL_URL, timeout=60) as response, open(partial, 'wb') as handle:
        handle.write(response.read())
    partial.replace(model)
    record.write_text(json.dumps({'source': MODEL_URL, 'sha256': sha256(model), 'license': 'Apache-2.0'}, indent=2), encoding='utf-8')
    return model


def focus_from_track(track, movement_limit=0.08):
    """Median face position, and whether the subject moves too much for one static crop."""
    found = [p for p in track if p['face']]
    if not found:
        return None
    xs, ys = [p['x'] for p in found], [p['y'] for p in found]
    spread = statistics.pstdev(xs) if len(xs) > 1 else 0.0
    return {'focusX': rounded(statistics.median(xs)), 'focusY': rounded(statistics.median(ys)),
            'horizontalSpread': rounded(spread), 'static': spread <= movement_limit}


def track_faces(path, aspect='9:16', samples_per_second=4.0, allow_download=False, min_confidence=0.5):
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import FaceDetector, FaceDetectorOptions, RunningMode
    file = existing_file(path)
    options = FaceDetectorOptions(base_options=BaseOptions(model_asset_path=str(model_path(allow_download))),
                                  running_mode=RunningMode.IMAGE, min_detection_confidence=min_confidence)
    capture = cv2.VideoCapture(str(file))
    if not capture.isOpened():
        raise RuntimeError('Cannot open video: ' + str(file))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    step = max(1, int(round(fps / samples_per_second)))
    track = []
    with FaceDetector.create_from_options(options) as detector:
        index = 0
        while True:
            ok = capture.grab()
            if not ok:
                break
            if index % step == 0:
                ok, frame = capture.retrieve()
                if ok:
                    height, width = frame.shape[:2]
                    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    faces = detector.detect(image).detections
                    if faces:
                        box = max(faces, key=lambda d: d.bounding_box.width * d.bounding_box.height).bounding_box
                        track.append({'time': rounded(index / fps), 'face': True,
                                      'x': rounded((box.origin_x + box.width / 2) / width),
                                      'y': rounded((box.origin_y + box.height / 2) / height),
                                      'size': rounded(box.height / height)})
                    else:
                        track.append({'time': rounded(index / fps), 'face': False})
            index += 1
    capture.release()
    focus = focus_from_track(track)
    detected = sum(1 for p in track if p['face'])
    return {
        'tool': 'mediapipe-face-detector', 'input': str(file), 'fps': rounded(fps),
        'durationSeconds': rounded(frames / fps) if frames else None, 'aspect': aspect,
        'samples': len(track), 'faceRatio': rounded(detected / len(track)) if track else 0.0,
        'focus': focus,
        'edlOperation': {'op': 'reframe', 'aspect': aspect, 'focusX': focus['focusX'], 'focusY': focus['focusY']} if focus else None,
        'track': track,
        'note': None if not focus or focus['static'] else
        'The speaker moves a lot: split the video into shots (scenes tool) and reframe each shot separately.',
    }
