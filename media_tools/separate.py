"""Source separation with Demucs: split a mix into voice and music (or four stems)."""
import os
from pathlib import Path
from .common import existing_file, model_dir, rounded

MODELS = {  # name: approximate download size
    'htdemucs': '80 MB', 'htdemucs_ft': '320 MB', 'htdemucs_6s': '55 MB',
}
DEFAULT_MODEL = 'htdemucs'
TEST_MODEL = 'demucs_unittest'  # tiny untrained model built in; used by tests only


def cache_env():
    folder = model_dir('demucs')
    os.environ['TORCH_HOME'] = str(folder / 'torch')
    os.environ.setdefault('HF_HUB_CACHE', str(folder / 'hub'))
    os.environ.setdefault('HF_HUB_DISABLE_TELEMETRY', '1')
    return folder


def output_folder(source, out_dir):
    base = Path(out_dir) if out_dir else source.parent
    target, n = base / (source.stem + '-stems'), 2
    while target.exists():  # never overwrite earlier stems
        target, n = base / f'{source.stem}-stems-{n}', n + 1
    target.mkdir(parents=True)
    return target


def load_wav(file, samplerate, channels):
    import numpy as np
    import soundfile as sf
    import torch
    data, rate = sf.read(str(file), dtype='float32', always_2d=True)
    if rate != samplerate:
        import librosa
        data = librosa.resample(data.T, orig_sr=rate, target_sr=samplerate).T
    if data.shape[1] < channels:
        data = np.repeat(data, channels, axis=1)
    return torch.from_numpy(np.ascontiguousarray(data[:, :channels].T))


def separate(path, model=DEFAULT_MODEL, stems='vocals', out_dir=None, allow_download=False, device='auto', name=None):
    if model not in MODELS and model != TEST_MODEL:
        raise ValueError('Unknown separation model: ' + model + '. Choose one of ' + ', '.join(MODELS))
    folder = cache_env()
    marker = folder / (model + '.ready')
    if model != TEST_MODEL and not marker.is_file() and not allow_download:
        raise FileNotFoundError(f'Separation model {model} is not installed (about {MODELS[model]}). Run again with --allow-download.')
    import soundfile as sf
    import torch
    from demucs.api import Separator
    file = existing_file(path)
    run_on = ('cuda' if torch.cuda.is_available() else 'cpu') if device == 'auto' else device
    separator = Separator(model=model, device=run_on, progress=False)
    if model != TEST_MODEL:
        marker.write_text('ok', encoding='utf-8')
    rate, channels = separator.samplerate, separator.audio_channels
    _, parts = separator.separate_tensor(load_wav(file, rate, channels), rate)
    target = output_folder(Path(name) if name else file, out_dir)
    if stems == 'vocals':
        voice = parts['vocals']
        music = sum(v for k, v in parts.items() if k != 'vocals')
        parts = {'vocals': voice, 'music': music}
    written = {}
    for stem, tensor in parts.items():
        out = target / (stem + '.wav')
        sf.write(str(out), tensor.detach().cpu().numpy().T, rate, subtype='FLOAT')
        written[stem] = str(out.resolve())
    seconds = parts[next(iter(parts))].shape[-1] / rate
    return {'tool': 'demucs', 'model': model, 'device': run_on, 'input': str(file), 'durationSeconds': rounded(seconds),
            'sampleRate': rate, 'folder': str(target.resolve()), 'stems': written,
            'note': 'Listen to the vocals stem for artifacts before using it as the final voice-over.'}
