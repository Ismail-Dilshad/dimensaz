"""Explicit, resumable setup in the existing venv; immutable, checksum-verified snapshots."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import uuid
from .hardware import ROOT, GIB, model_root, require_space, hardware_report, memory_info
from .core import digest

REGISTRY = ROOT / 'config/speech-models.json'


def registry():
    return json.loads(REGISTRY.read_text(encoding='utf-8-sig'))


def record_for(model_id):
    found = next((m for m in registry()['models'] if m['id'] == model_id), None)
    if not found or found.get('language') != 'ckb' or found.get('license') not in ('apache-2.0', 'mit'):
        raise ValueError('Model must have explicitly vetted Sorani language and reusable license in config/speech-models.json')
    return found


def slug(model_id):
    record_for(model_id)
    return model_id.replace('/', '--')


def write_atomic(file, value):
    target = Path(file); target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(target.name + '.' + uuid.uuid4().hex + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
    os.replace(temporary, target)


def network_check(hosts):
    errors = []
    for host in hosts:
        try: socket.getaddrinfo(host, 443)
        except OSError as error: errors.append({'host': host, 'error': str(error)})
    if errors:
        raise RuntimeError('Network/DNS unavailable; this is not evidence of incompatible Python wheels: ' + json.dumps(errors))


def verified_folder(model_id, cache=None):
    root = model_root(cache)
    pointer = root / 'installed' / (slug(model_id) + '.json')
    if not pointer.is_file():
        raise FileNotFoundError('Model not installed/verified: ' + model_id + '; run audio:setup --download-models')
    manifest = json.loads(pointer.read_text(encoding='utf-8'))
    folder = Path(manifest['path']).resolve()
    if not folder.is_relative_to(root):
        raise ValueError('Model pointer escapes configured cache')
    if manifest.get('model') != model_id or not manifest.get('revision') or not manifest.get('files'):
        raise ValueError('Invalid model integrity manifest')
    for item in manifest['files']:
        file = (folder / item['name']).resolve()
        if not file.is_relative_to(folder) or not file.is_file() or file.stat().st_size != item['size'] or digest(file) != item['sha256']:
            raise ValueError('Model integrity check failed: ' + item['name'] + '; audio:setup --repair downloads a separate snapshot; old bytes are retained')
    return folder, manifest


def model_status(cache=None):
    result = []
    for m in registry()['models']:
        try:
            folder, manifest = verified_folder(m['id'], cache)
            result.append({'model': m['id'], 'ready': True, 'path': str(folder), 'revision': manifest['revision'], 'bytes': sum(f['size'] for f in manifest['files'])})
        except Exception as error:
            result.append({'model': m['id'], 'ready': False, 'error': str(error)})
    return result


def acquire_model(model_id, cache=None, repair=False):
    record = record_for(model_id); root = model_root(cache)
    if not repair:
        try:
            folder, manifest = verified_folder(model_id, root)
            return {'model': model_id, 'path': str(folder), 'cached': True, 'bytes': sum(f['size'] for f in manifest['files'])}
        except FileNotFoundError:
            pass
    network_check(['huggingface.co'])
    from huggingface_hub import HfApi, hf_hub_download
    info = HfApi().model_info(model_id, revision=record.get('revision', 'main'), files_metadata=True)
    if info.gated or info.private:
        raise RuntimeError('Model needs gated/private access; setup does not log in or accept terms')
    remote_license = getattr(info.card_data, 'license', None)
    if remote_license != record['license']:
        raise RuntimeError('Model license changed or cannot be confirmed; review required')
    # Only weights/config/tokenizers/licenses. Never execute remote Python.
    allowed = []
    for f in info.siblings:
        name = f.rfilename
        if '/' in name: continue
        if name.endswith(('.safetensors', '.json')) or name in ('merges.txt', 'vocab.txt', 'README.md', 'LICENSE', 'LICENSE.txt'):
            allowed.append(f)
    if not any(f.rfilename.endswith('.safetensors') for f in allowed):
        raise RuntimeError('No official safetensors weights; refusing an unreviewed pickle-model fallback')
    if any(f.size is None for f in allowed):
        raise RuntimeError('Provider did not report file sizes; cannot preflight disk requirements')
    required = sum(f.size for f in allowed)
    require_space(root, required * 2)
    # Unique staging snapshot also repairs corrupt caches without deleting/replacing them.
    stage_file = root / 'staging' / (slug(model_id) + '.json')
    stage = json.loads(stage_file.read_text(encoding='utf-8')) if stage_file.is_file() and not repair else None
    folder = Path(stage['path']).resolve() if stage and stage.get('revision') == info.sha else root / 'verified' / slug(model_id) / (info.sha + '-' + uuid.uuid4().hex[:8])
    if not folder.is_relative_to(root): raise ValueError('Staging path escapes model cache')
    folder.mkdir(parents=True, exist_ok=True)
    write_atomic(stage_file, {'path': str(folder), 'revision': info.sha})
    receipt = {'model': model_id, 'revision': info.sha, 'license': record['license'], 'source': record['source'], 'path': str(folder), 'files': []}
    for entry in allowed:
        file = Path(hf_hub_download(repo_id=model_id, filename=entry.rfilename, revision=info.sha, local_dir=folder))
        sha256 = digest(file)
        if entry.rfilename == 'model.safetensors' and record.get('weightsSha256') and sha256 != record['weightsSha256']:
            raise ValueError('Weights differ from the researched release; review model registry before replacing')
        lfs = entry.lfs
        expected = (lfs.get('sha256') if isinstance(lfs, dict) else getattr(lfs, 'sha256', None)) if lfs else None
        if file.stat().st_size != entry.size:
            raise ValueError('Downloaded file size mismatch: ' + entry.rfilename)
        if expected:
            if sha256 != expected: raise ValueError('Provider SHA-256 mismatch: ' + entry.rfilename)
        elif entry.blob_id:
            content = file.read_bytes()
            actual = hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()
            if actual != entry.blob_id: raise ValueError('Provider Git blob hash mismatch: ' + entry.rfilename)
        else:
            raise ValueError('No provider checksum available: ' + entry.rfilename)
        receipt['files'].append({'name': entry.rfilename, 'size': entry.size, 'sha256': sha256, 'providerChecksum': expected or entry.blob_id})
    write_atomic(folder / 'integrity.json', receipt)
    write_atomic(root / 'installed' / (slug(model_id) + '.json'), receipt)
    return {'model': model_id, 'path': str(folder), 'revision': info.sha, 'cached': False, 'bytes': required}


def ensure_venv():
    if Path(sys.prefix).resolve() != (ROOT / '.venv').resolve():
        raise RuntimeError('Setup must run through the existing project .venv, never a global interpreter')


def install_dependencies(cache=None):
    ensure_venv(); root = model_root(cache)
    require_space(ROOT / '.venv', 8 * GIB)
    require_space(root, 8 * GIB)
    network_check(['pypi.org', 'download.pytorch.org'])
    root.mkdir(parents=True, exist_ok=True)
    env = {**os.environ, 'PIP_CACHE_DIR': str(root / 'pip'), 'TMP': str(ROOT / 'workspace/cache/temp'), 'TEMP': str(ROOT / 'workspace/cache/temp'), 'PIP_DISABLE_PIP_VERSION_CHECK': '1'}
    Path(env['TMP']).mkdir(parents=True, exist_ok=True)
    logs = root / 'setup-receipts'; logs.mkdir(exist_ok=True)
    steps = []
    def pip(args):
        result = subprocess.run([sys.executable, '-m', 'pip', *args], env=env, capture_output=True, text=True, timeout=1800, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        steps.append({'arguments': args, 'exitCode': result.returncode, 'stdout': result.stdout[-24000:], 'stderr': result.stderr[-12000:]})
        write_atomic(logs / ('latest-install-' + run_id + '.json'), steps)
        if result.returncode: raise RuntimeError('Dependency setup failed; see ' + str(logs) + ': ' + result.stderr[-2000:])
    run_id = uuid.uuid4().hex
    # Resolve compatible binary wheels before installation; never compile torch on this laptop.
    hw = hardware_report(root)
    index = 'https://download.pytorch.org/whl/cu128' if hw['nvidia'] else 'https://download.pytorch.org/whl/cpu'
    torch_args = ['--only-binary=:all:', '--retries', '1', '--timeout', '30', 'torch>=2.10,<3', '--index-url', index]
    pip(['install', '--dry-run', *torch_args])
    pip(['install', *torch_args])
    pip(['install', '--only-binary=:all:', '--retries', '1', '--timeout', '30', '-r', str(ROOT / 'audio_pipeline/requirements.txt')])
    pip(['check'])
    return {'steps': steps, 'python': sys.executable}


def whisper_feature_config(folder):
    """Flatten only the official feature configuration; never default large-v3 to 80 mels."""
    config = json.loads((folder / 'config.json').read_text(encoding='utf-8'))
    feature_file = folder / 'preprocessor_config.json'
    if not feature_file.is_file(): feature_file = folder / 'processor_config.json'
    raw = json.loads(feature_file.read_text(encoding='utf-8'))
    features = raw.get('feature_extractor', raw)
    if not isinstance(features, dict) or features.get('feature_size') != config.get('num_mel_bins') or not features.get('feature_size'):
        raise ValueError('Whisper feature dimension disagrees with official model configuration')
    if features.get('sampling_rate') != 16000:
        raise ValueError('Only verified 16 kHz Whisper features are supported')
    return features


def load_whisper_tokenizer(folder):
    """Adapt newer list metadata in memory without changing source bytes or token IDs."""
    from transformers import AutoTokenizer
    from tokenizers import Tokenizer
    folder = Path(folder)
    config = json.loads((folder / 'tokenizer_config.json').read_text(encoding='utf-8'))
    extra = config.get('extra_special_tokens')
    kwargs = {}
    if isinstance(extra, list):
        if not all(isinstance(token, str) for token in extra):
            raise ValueError('Unsupported non-string special-token metadata')
        kwargs = {'extra_special_tokens': {}, 'additional_special_tokens': list(dict.fromkeys(config.get('additional_special_tokens', []) + extra))}
    tokenizer = AutoTokenizer.from_pretrained(str(folder), local_files_only=True, trust_remote_code=False, **kwargs)
    original = Tokenizer.from_file(str(folder / 'tokenizer.json')).get_vocab()
    if tokenizer.get_vocab() != original:
        raise ValueError('Tokenizer compatibility would change token IDs; refusing conversion')
    return tokenizer


def convert_whisper(model_id, cache=None):
    from ctranslate2.converters import TransformersConverter
    record = record_for(model_id)
    if record.get('kind') != 'whisper-finetune': raise ValueError('Only vetted Whisper fine-tunes can be converted')
    root = model_root(cache); folder, manifest = verified_folder(model_id, root)
    pointer = root / 'installed' / (slug(model_id) + '-ct2.json')
    if pointer.is_file():
        previous = json.loads(pointer.read_text(encoding='utf-8'))
        if previous.get('revision') == manifest['revision']:
            dest = Path(previous['path']).resolve()
            if not dest.is_relative_to(root): raise ValueError('Converted model pointer escapes cache')
            origin_path = dest / 'model-origin.json'
            if origin_path.is_file():
                origin = json.loads(origin_path.read_text(encoding='utf-8'))
                if origin.get('files') and all((dest/f['name']).resolve().is_relative_to(dest) and (dest/f['name']).is_file() and digest(dest/f['name']) == f['sha256'] for f in origin['files']):
                    return {'path': str(dest), 'sourceModel': model_id, 'cached': True, 'bytes': sum(f['size'] for f in origin['files'])}
    available = memory_info()['availableBytes']
    if available is not None and available < 10 * GIB: raise RuntimeError('Whisper conversion requires at least 10 GiB available RAM')
    require_space(root, sum(f['size'] for f in manifest['files']) * 2)
    destination = root / 'converted' / (slug(model_id) + '-' + manifest['revision'][:12] + '-' + uuid.uuid4().hex[:8])
    destination.parent.mkdir(parents=True, exist_ok=True)
    class CompatibleWhisperConverter(TransformersConverter):
        def load_tokenizer(self, tokenizer_class, model_name_or_path, **kwargs):
            return load_whisper_tokenizer(model_name_or_path)
    CompatibleWhisperConverter(str(folder), load_as_float16=True, trust_remote_code=False).convert(str(destination), quantization='int8_float32')
    # Tokenizer JSON is needed by faster-whisper; save the verified local tokenizer.
    from transformers import AutoTokenizer
    tokenizer = load_whisper_tokenizer(folder)
    tokenizer.save_pretrained(destination)
    write_atomic(destination / 'preprocessor_config.json', whisper_feature_config(folder))
    origin = {'sourceModel': model_id, 'revision': manifest['revision'], 'license': record['license'], 'quantization': 'int8_float32', 'sourceIntegrity': manifest['files'], 'files': [{'name': p.name, 'sha256': digest(p), 'size': p.stat().st_size} for p in destination.iterdir() if p.is_file()]}
    write_atomic(destination / 'model-origin.json', origin)
    write_atomic(root / 'installed' / (slug(model_id) + '-ct2.json'), {'path': str(destination), 'sourceModel': model_id, 'revision': manifest['revision']})
    return {'path': str(destination), 'sourceModel': model_id, 'bytes': sum(f['size'] for f in origin['files'])}


def validate_model(model_id, cache=None):
    """Load official local weights and run a small tensor pass; never treat silence as speech evidence."""
    import torch
    import numpy as np
    from transformers import AutoProcessor, AutoModelForCTC
    record = record_for(model_id)
    folder, manifest = verified_folder(model_id, cache)
    start = time.perf_counter()
    if record['kind'] == 'ctc':
        processor = AutoProcessor.from_pretrained(str(folder), local_files_only=True, trust_remote_code=False)
        model = AutoModelForCTC.from_pretrained(str(folder), local_files_only=True, trust_remote_code=False, use_safetensors=True).eval()
        inputs = processor(np.zeros(16000, dtype='float32'), sampling_rate=16000, return_tensors='pt')
        with torch.inference_mode(): output = model(**inputs).logits
        if not torch.isfinite(output).all(): raise ValueError('Non-finite model validation output')
        result = {'model': model_id, 'revision': manifest['revision'], 'loaded': True, 'device': 'cpu', 'seconds': time.perf_counter()-start, 'outputShape': list(output.shape), 'speechAccuracy': 'Not measured; silence is only a model-load check'}
        del model, output
    else:
        from transformers import AutoModelForSpeechSeq2Seq, AutoTokenizer
        tokenizer = load_whisper_tokenizer(folder)
        model = AutoModelForSpeechSeq2Seq.from_pretrained(str(folder), local_files_only=True, trust_remote_code=False, use_safetensors=True, torch_dtype=torch.float32).eval()
        result = {'model': model_id, 'revision': manifest['revision'], 'loaded': True, 'device': 'cpu', 'seconds': time.perf_counter()-start, 'speechAccuracy': 'Not measured; load only', 'vocabularySize': len(tokenizer)}
        del model
    return result
