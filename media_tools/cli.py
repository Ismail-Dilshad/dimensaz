"""Command line for the media tools. Prints one JSON object; inputs are never modified."""
import argparse
import importlib
import importlib.metadata
import json
import subprocess
import sys
from pathlib import Path
from .common import ROOT, model_dir, write_new

PACKAGES = {'scenedetect': 'scenedetect', 'librosa': 'librosa', 'mediapipe': 'mediapipe',
            'rembg': 'rembg', 'onnxruntime': 'onnxruntime', 'auto-editor': 'auto_editor',
            'demucs': 'demucs', 'opencv-contrib-python': 'cv2', 'yt-dlp': 'yt_dlp'}


def doctor():
    packages = {}
    for package, module in PACKAGES.items():
        try:
            importlib.import_module(module)
            version = importlib.metadata.version(package)
            packages[package] = {'version': version, 'imports': True}
        except Exception as error:
            packages[package] = {'imports': False, 'error': str(error)[:300]}
    providers = None
    try:
        import onnxruntime
        providers = onnxruntime.get_available_providers()
    except Exception:
        pass
    models = {'faceDetector': (model_dir('mediapipe') / 'blaze_face_short_range.tflite').is_file(),
              'cutout': sorted({p.stem for p in model_dir('rembg').rglob('*.onnx')}),
              'separation': sorted(p.stem for p in model_dir('demucs').glob('*.ready'))}
    cuda = None
    try:
        import torch
        cuda = torch.cuda.is_available()
    except Exception:
        pass
    return {'python': sys.executable, 'packages': packages, 'ready': all(p['imports'] for p in packages.values()),
            'onnxProviders': providers, 'torchCuda': cuda, 'models': models}


def setup():
    if Path(sys.prefix).resolve() != (ROOT / '.venv').resolve():
        raise RuntimeError('Run setup through the project .venv Python, never a global interpreter')
    requirements = ROOT / 'media_tools/requirements.txt'
    command = [sys.executable, '-m', 'pip', 'install', '--only-binary=:all:', '--disable-pip-version-check', '-r', str(requirements)]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60 * 60)
    if result.returncode != 0:
        raise RuntimeError('pip install failed: ' + (result.stderr or result.stdout)[-3000:])
    # auto-editor fetches its own small binary on first run; do it now instead of mid-edit.
    warm = subprocess.run([sys.executable, '-m', 'auto_editor', '--version'], capture_output=True, text=True, timeout=600)
    return {'installed': True, 'autoEditor': (warm.stdout or warm.stderr).strip()[:200], 'doctor': doctor()}


def download(which):
    """Download models only. Each model is fetched once and reused afterwards."""
    done = {}
    if which in ('face', 'all'):
        from .faces import model_path
        done['face'] = str(model_path(allow_download=True))
    if which in ('cutout', 'all'):
        from .cutout import session, model_file, DEFAULT_MODEL
        session(DEFAULT_MODEL, allow_download=True)
        done['cutout'] = str(model_file(DEFAULT_MODEL))
    if which in ('separation', 'all'):
        from .separate import cache_env, DEFAULT_MODEL
        folder = cache_env()
        from demucs.pretrained import get_model
        get_model(DEFAULT_MODEL)
        (folder / (DEFAULT_MODEL + '.ready')).write_text('ok', encoding='utf-8')
        done['separation'] = DEFAULT_MODEL
    return {'downloaded': done, 'doctor': doctor()}


def edl(input_file, operation, output):
    return write_new(output, {'version': 1, 'input': str(input_file), 'operations': [operation]})


def main(argv=None):
    parser = argparse.ArgumentParser(prog='media_tools')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('doctor')
    sub.add_parser('setup')
    d = sub.add_parser('download'); d.add_argument('which', nargs='?', default='all', choices=['all', 'face', 'cutout', 'separation'])
    s = sub.add_parser('silence'); s.add_argument('input'); s.add_argument('--threshold', type=float, default=0.04)
    s.add_argument('--margin', type=float, default=0.2); s.add_argument('--min-cut', type=float, default=0.3)
    s.add_argument('--edl-out')
    c = sub.add_parser('scenes'); c.add_argument('input'); c.add_argument('--threshold', type=float, default=27.0)
    c.add_argument('--min-shot', type=float, default=0.4); c.add_argument('--content', action='store_true')
    b = sub.add_parser('beats'); b.add_argument('input'); b.add_argument('--per-bar', type=int, default=4)
    r = sub.add_parser('reframe'); r.add_argument('input'); r.add_argument('--aspect', default='9:16', choices=['9:16', '16:9', '1:1', '4:5'])
    r.add_argument('--samples-per-second', type=float, default=4.0); r.add_argument('--allow-download', action='store_true')
    r.add_argument('--edl-out')
    o = sub.add_parser('cutout'); o.add_argument('inputs', nargs='+'); o.add_argument('--model', default=None)
    o.add_argument('--out-dir'); o.add_argument('--allow-download', action='store_true'); o.add_argument('--alpha-matting', action='store_true')
    v = sub.add_parser('separate'); v.add_argument('input'); v.add_argument('--model', default=None)
    v.add_argument('--stems', choices=['vocals', 'all'], default='vocals'); v.add_argument('--out-dir')
    v.add_argument('--allow-download', action='store_true'); v.add_argument('--device', choices=['auto', 'cpu', 'cuda'], default='auto')
    v.add_argument('--name', help='Name the stems folder after this file instead of the input')
    q = sub.add_parser('quality'); q.add_argument('input'); q.add_argument('--samples-per-second', type=float, default=1.0)
    m = sub.add_parser('motion'); m.add_argument('input')
    y = sub.add_parser('style'); y.add_argument('inputs', nargs='+'); y.add_argument('--name'); y.add_argument('--out-dir')
    y.add_argument('--save', action='store_true', help='Add as a reusable style in references/styles and the catalog')
    y.add_argument('--title'); y.add_argument('--max-frames', type=int, default=6)
    g = sub.add_parser('pacing'); g.add_argument('input')
    g.add_argument('--max-static', type=float, default=1.5); g.add_argument('--max-plain', type=float, default=1.0)
    lk = sub.add_parser('look'); lk.add_argument('input'); lk.add_argument('--samples', type=int, default=18)
    z = sub.add_parser('stabilize'); z.add_argument('input'); z.add_argument('--out')
    z.add_argument('--smoothing', type=float, default=1.0); z.add_argument('--zoom', type=float, default=1.06)
    for p in (s, c, b, r, o, v, q, m, z, g, y):
        p.add_argument('--output', help='Also save the JSON result to this new file')
    args = parser.parse_args(argv)

    if args.command == 'doctor':
        result = doctor()
    elif args.command == 'setup':
        result = setup()
    elif args.command == 'download':
        result = download(args.which)
    elif args.command == 'silence':
        from .silence import detect
        result = detect(args.input, args.threshold, args.margin, args.min_cut)
        if args.edl_out and result['edlOperation']:
            result['edl'] = edl(result['input'], result['edlOperation'], args.edl_out)
    elif args.command == 'scenes':
        from .scenes import detect
        result = detect(args.input, args.threshold, args.min_shot, adaptive=not args.content)
    elif args.command == 'beats':
        from .beats import detect
        result = detect(args.input, args.per_bar)
    elif args.command == 'reframe':
        from .faces import track_faces
        result = track_faces(args.input, args.aspect, args.samples_per_second, args.allow_download)
        if args.edl_out and result['edlOperation']:
            result['edl'] = edl(result['input'], result['edlOperation'], args.edl_out)
    elif args.command == 'separate':
        from .separate import separate, DEFAULT_MODEL
        result = separate(args.input, args.model or DEFAULT_MODEL, args.stems, args.out_dir, args.allow_download, args.device, args.name)
    elif args.command == 'quality':
        from .quality import check
        result = check(args.input, args.samples_per_second)
    elif args.command == 'motion':
        from .motion import analyze
        result = analyze(args.input)
    elif args.command == 'style':
        from .style import extract, add_style
        if args.save:
            if not args.name:
                raise ValueError('--save needs --name')
            result = add_style(args.inputs, args.name, args.title, args.max_frames)
        else:
            result = extract(args.inputs, args.name, args.out_dir)
    elif args.command == 'pacing':
        from .pacing import check as pacing
        result = pacing(args.input, args.max_static, args.max_plain)
    elif args.command == 'look':
        from .look import measure as look
        result = look(args.input, args.samples)
    elif args.command == 'stabilize':
        from .stabilize import stabilize
        if not 1.0 <= args.zoom <= 1.5:
            raise ValueError('--zoom must be between 1.0 and 1.5')
        result = stabilize(args.input, args.out, args.smoothing, args.zoom)
    else:
        from .cutout import remove_backgrounds, DEFAULT_MODEL
        result = remove_backgrounds(args.inputs, args.model or DEFAULT_MODEL, args.out_dir, args.allow_download, args.alpha_matting)
    if getattr(args, 'output', None):
        result['saved'] = write_new(args.output, result)
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main())
