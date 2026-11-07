"""Shot and cut detection with PySceneDetect. Gives the editing rhythm of a reference or footage."""
from .common import existing_file, rounded


def seconds(timecode):
    value = getattr(timecode, 'seconds', None)
    return float(value) if value is not None else float(timecode.get_seconds())


def summarize(shots, duration):
    lengths = [end - start for start, end in shots]
    cuts = max(len(shots) - 1, 0)
    return {
        'shotCount': len(shots), 'cutCount': cuts,
        'averageShotSeconds': rounded(sum(lengths) / len(lengths)) if lengths else None,
        'shortestShotSeconds': rounded(min(lengths)) if lengths else None,
        'longestShotSeconds': rounded(max(lengths)) if lengths else None,
        'cutsPerMinute': rounded(cuts / duration * 60, 2) if duration > 0 else None,
    }


def detect(path, threshold=27.0, min_shot=0.4, adaptive=True):
    from scenedetect import open_video, SceneManager, AdaptiveDetector, ContentDetector
    file = existing_file(path)
    video = open_video(str(file))
    fps = float(video.frame_rate)
    min_frames = max(1, int(round(min_shot * fps)))
    manager = SceneManager()
    manager.add_detector(AdaptiveDetector(min_scene_len=min_frames) if adaptive
                         else ContentDetector(threshold=threshold, min_scene_len=min_frames))
    manager.detect_scenes(video)
    scenes = manager.get_scene_list(start_in_scene=True)
    duration = seconds(video.duration) if video.duration is not None else 0.0
    shots = [(seconds(s), seconds(e)) for s, e in scenes] or [(0.0, duration)]
    return {
        'tool': 'pyscenedetect', 'input': str(file), 'fps': rounded(fps), 'durationSeconds': rounded(duration),
        'detector': 'adaptive' if adaptive else 'content',
        'shots': [{'index': i, 'start': rounded(a), 'end': rounded(b)} for i, (a, b) in enumerate(shots)],
        'cutTimes': [rounded(a) for a, _ in shots[1:]],
        'rhythm': summarize(shots, duration),
    }
