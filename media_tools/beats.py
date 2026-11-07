"""Tempo, beats and onsets with librosa, so motion and cuts can land on the music."""
from .common import existing_file, rounded


def bars(beats, per_bar=4):
    """Every per_bar-th beat from the first. An estimate: librosa does not detect true downbeats."""
    return beats[::per_bar]


def detect(path, per_bar=4, sample_rate=22050):
    import librosa
    import numpy as np
    file = existing_file(path)
    y, sr = librosa.load(str(file), sr=sample_rate, mono=True)
    duration = len(y) / sr if sr else 0.0
    if duration == 0 or float(np.max(np.abs(y))) < 1e-4:
        return {'tool': 'librosa', 'input': str(file), 'durationSeconds': rounded(duration), 'tempoBpm': None,
                'beats': [], 'barStarts': [], 'onsets': [], 'note': 'Silent or empty audio.'}
    envelope = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_times = librosa.beat.beat_track(onset_envelope=envelope, sr=sr, units='time')
    onsets = librosa.onset.onset_detect(onset_envelope=envelope, sr=sr, units='time')
    tempo = float(np.atleast_1d(tempo)[0])
    beats = [rounded(t) for t in beat_times]
    return {
        'tool': 'librosa', 'input': str(file), 'durationSeconds': rounded(duration),
        'tempoBpm': rounded(tempo, 1) if tempo > 0 else None,
        'beatSeconds': rounded(60 / tempo) if tempo > 0 else None,
        'beats': beats, 'barStarts': bars(beats, per_bar),
        'onsets': [rounded(t) for t in onsets],
        'note': 'Bar starts assume ' + str(per_bar) + ' beats per bar from the first beat; check by ear for important cuts.',
    }
