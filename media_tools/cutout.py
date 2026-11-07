"""Background removal with rembg (BiRefNet and other models). Writes new PNG files with transparency."""
import os
from pathlib import Path
from .common import existing_file, model_dir

MODELS = {  # name: approximate download size
    'birefnet-general-lite': '225 MB', 'birefnet-general': '975 MB', 'birefnet-portrait': '975 MB',
    'isnet-general-use': '170 MB', 'u2net': '170 MB', 'u2net_human_seg': '170 MB', 'u2netp': '5 MB',
}
DEFAULT_MODEL = 'birefnet-general-lite'


def model_file(name):
    """Where rembg keeps the model: <home>/models/<name>/<name>.onnx (older rembg: <home>/<name>.onnx)."""
    home = model_dir('rembg')
    current, legacy = home / 'models' / name / (name + '.onnx'), home / (name + '.onnx')
    return legacy if legacy.is_file() and not current.is_file() else current


def session(name, allow_download=False):
    if name not in MODELS:
        raise ValueError('Unknown cut-out model: ' + name + '. Choose one of ' + ', '.join(MODELS))
    os.environ['U2NET_HOME'] = str(model_dir('rembg'))
    if not model_file(name).is_file() and not allow_download:
        raise FileNotFoundError(f'Cut-out model {name} is not installed (about {MODELS[name]}). Run again with --allow-download.')
    try:
        import onnxruntime
        onnxruntime.preload_dlls()  # use the CUDA and cuDNN libraries that ship with torch when present
    except Exception:
        pass
    from rembg import new_session
    return new_session(name)


def output_for(source, out_dir):
    folder = Path(out_dir) if out_dir else source.parent
    folder.mkdir(parents=True, exist_ok=True)
    target, n = folder / (source.stem + '-cutout.png'), 2
    while target.exists():  # never overwrite
        target, n = folder / f'{source.stem}-cutout-{n}.png', n + 1
    return target


def remove_backgrounds(paths, model=DEFAULT_MODEL, out_dir=None, allow_download=False, alpha_matting=False):
    from PIL import Image
    from rembg import remove
    files = [existing_file(p) for p in paths]
    active = session(model, allow_download)
    results = []
    for source in files:
        with Image.open(source) as image:
            cut = remove(image.convert('RGBA'), session=active, alpha_matting=alpha_matting)
        target = output_for(source, out_dir)
        cut.save(target, format='PNG')
        alpha = cut.getchannel('A')
        coverage = sum(1 for v in alpha.getdata() if v > 127) / (alpha.width * alpha.height)
        box = alpha.point(lambda v: 255 if v > 127 else 0).getbbox()
        results.append({'input': str(source), 'output': str(target.resolve()), 'width': cut.width, 'height': cut.height,
                        'subjectCoverage': round(coverage, 4), 'subjectBox': list(box) if box else None})
    return {'tool': 'rembg', 'model': model, 'results': results,
            'note': 'Check edges (hair, glass, shadows) on a contrasting background before using a cut-out.'}
