"""Video stabilization with OpenCV: smooth the camera path, warp each frame, keep the audio."""
import os
import shutil
import subprocess
from pathlib import Path
from .common import existing_file, rounded
from .motion import frame_transforms, jitter, smooth


def ffmpeg_path():
    exe = os.environ.get('FFMPEG_PATH') or shutil.which('ffmpeg')
    if not exe:
        raise RuntimeError('FFmpeg not found; set FFMPEG_PATH')
    return exe


def output_for(source, out):
    if out:
        target = Path(out)
        if target.exists():
            raise FileExistsError('Output already exists; never overwriting: ' + str(target))
        return target
    target, n = source.with_name(source.stem + '-stabilized.mp4'), 2
    while target.exists():
        target, n = source.with_name(f'{source.stem}-stabilized-{n}.mp4'), n + 1
    return target


def corrections(transforms, fps, smoothing):
    """Per-frame shift (dx, dy, angle) that moves each frame from the shaky camera path onto
    its smoothed path. Frame 0 is the reference; one row per frame."""
    import numpy as np
    t = np.asarray(transforms, dtype=np.float64).reshape(-1, 4)[:, :3]
    path = np.vstack([np.zeros((1, 3)), np.cumsum(t, axis=0)])
    wanted = smooth(path, max(1, int(fps * smoothing)))
    return wanted - path


def stabilize(path, out=None, smoothing=1.0, zoom=1.06, crf=16):
    import cv2
    import numpy as np
    file = existing_file(path)
    target = output_for(file, out)
    transforms, fps, width, height, ratio = frame_transforms(file)
    before = jitter(transforms, fps, ratio)
    fixed = corrections(transforms, fps, smoothing)
    capture = cv2.VideoCapture(str(file))
    ffmpeg = ffmpeg_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    command = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-n', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
               '-s', f'{width}x{height}', '-r', f'{fps:.6f}', '-i', '-', '-i', str(file),
               '-map', '0:v', '-map', '1:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', str(crf),
               '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-shortest', '-movflags', '+faststart', str(target)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE,
                               creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    center = (width / 2, height / 2)
    written = 0
    try:
        index = 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            dx, dy, da = fixed[min(index, len(fixed) - 1)]
            m = cv2.getRotationMatrix2D(center, -float(np.degrees(da)), zoom)  # OpenCV angles turn the other way
            m[0, 2] += dx
            m[1, 2] += dy
            frame = cv2.warpAffine(frame, m, (width, height), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            encoder.stdin.write(frame.tobytes())
            written += 1
            index += 1
    finally:
        capture.release()
        encoder.stdin.close()
        error = encoder.stderr.read().decode('utf-8', 'replace')
        code = encoder.wait()
    if code != 0:
        raise RuntimeError('FFmpeg failed while writing the stabilized video: ' + error[-2000:])
    after_transforms, _, _, _, after_ratio = frame_transforms(target)
    after = jitter(after_transforms, fps, after_ratio)
    return {'tool': 'opencv-stabilize', 'input': str(file), 'output': str(target.resolve()), 'frames': written,
            'fps': rounded(fps), 'smoothingSeconds': smoothing, 'zoom': zoom,
            'shakeBefore': rounded(before, 2), 'shakeAfter': rounded(after, 2),
            'note': 'The frame is zoomed in slightly to hide moving edges; raise --zoom if edges still show.'}
