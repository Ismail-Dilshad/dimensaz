"""Private details in footage, found only when the user asks: faces (OpenCV's YuNet detector, about
0.2 MB) and text (RapidOCR, its models come with the package), sampled through the video. It
reports what it sees with where and when; the editor decides what to blur. Nothing is uploaded."""
import json
import urllib.request
from .common import existing_file, model_dir, rounded, sha256

FACE_URL = ('https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/'
            'face_detection_yunet/face_detection_yunet_2023mar.onnx')
FACE_NAME = 'face_detection_yunet_2023mar.onnx'
FACE_SHA256 = '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'


def face_model(allow_download=False):
    folder = model_dir('opencv')
    model = folder / FACE_NAME
    if model.is_file():
        if sha256(model) != FACE_SHA256:
            raise ValueError('The face model changed since it was downloaded; delete it and download it again')
        return model
    if not allow_download:
        raise FileNotFoundError('The face model is not installed (about 0.2 MB, MIT). Run: pnpm tempoloom media download private')
    partial = folder / (FACE_NAME + '.part')
    with urllib.request.urlopen(FACE_URL, timeout=60) as response, open(partial, 'wb') as handle:
        handle.write(response.read())
    if sha256(partial) != FACE_SHA256:
        partial.unlink()
        raise ValueError('The downloaded face model is not the expected file')
    partial.replace(model)
    (folder / (FACE_NAME + '.json')).write_text(json.dumps({'source': FACE_URL, 'sha256': FACE_SHA256, 'license': 'MIT'}, indent=2), encoding='utf-8')
    return model


def ocr_engine():
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception:
        return None
    return RapidOCR()


def find(path, faces=True, text=True, step=0.25, allow_download=False, max_width=1280):
    import cv2
    file = existing_file(path)
    detector = None
    notes = []
    if faces:
        detector = cv2.FaceDetectorYN.create(str(face_model(allow_download)), '', (320, 320), 0.7, 0.3, 5000)
    ocr = ocr_engine() if text else None
    if text and ocr is None:
        notes.append('Text (number plates, phone numbers) needs RapidOCR: pnpm tempoloom media setup')
    capture = cv2.VideoCapture(str(file))
    if not capture.isOpened():
        raise RuntimeError('Cannot open video: ' + str(file))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    scale = min(1.0, max_width / width) if width else 1.0
    size = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))
    every = max(1, int(round(fps * step)))
    samples = []
    index = 0
    while True:
        ok = capture.grab()
        if not ok:
            break
        if index % every == 0:
            ok, frame = capture.retrieve()
            if ok:
                small = cv2.resize(frame, size, interpolation=cv2.INTER_AREA) if scale < 1 else frame
                w, h = size
                sample = {'time': rounded(index / fps, 3), 'faces': [], 'texts': []}
                if detector is not None:
                    detector.setInputSize((w, h))
                    _, found = detector.detect(small)
                    for f in (found if found is not None else []):
                        x, y, bw, bh, score = float(f[0]), float(f[1]), float(f[2]), float(f[3]), float(f[-1])
                        sample['faces'].append({'box': [rounded(x / w, 4), rounded(y / h, 4), rounded(bw / w, 4), rounded(bh / h, 4)], 'score': rounded(score, 3)})
                if ocr is not None:
                    result, _ = ocr(small)
                    for box, words, score in (result or []):
                        xs, ys = [p[0] for p in box], [p[1] for p in box]
                        sample['texts'].append({'box': [rounded(min(xs) / w, 4), rounded(min(ys) / h, 4), rounded((max(xs) - min(xs)) / w, 4), rounded((max(ys) - min(ys)) / h, 4)],
                                                'text': str(words), 'score': rounded(float(score), 3)})
                samples.append(sample)
        index += 1
    capture.release()
    return {'tool': 'private-details', 'input': str(file), 'fps': rounded(fps), 'durationSeconds': rounded(frames / fps) if frames else None,
            'width': width, 'height': height, 'step': step, 'faces': detector is not None, 'text': ocr is not None,
            'samples': samples, 'notes': notes}
