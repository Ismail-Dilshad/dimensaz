"""Sorani-only acoustic backends. Automatic outputs always require review."""
import gc
import json
import math
from pathlib import Path
from difflib import SequenceMatcher
import time
import numpy as np
from .core import ctc_targets, ctc_word_times, normalize, tokens, digest
from .hardware import model_root, hardware_report, ctc_plan, peak_rss, GIB
from .setup import registry, record_for, verified_folder, acquire_model, slug


def convolution_geometry(config):
    stride, receptive = 1, 1
    for kernel, step in zip(config.conv_kernel, config.conv_stride):
        receptive += (kernel-1)*stride
        stride *= step
    if getattr(config, 'add_adapter', False):
        raise ValueError('Adapter CTC frame geometry is not implemented; do not guess frame times')
    return stride, receptive


def chunk_windows(samples, stride, receptive, core_samples, context_samples):
    """Keep one emission per global convolution frame, with overlapping acoustic context."""
    count = max(0, (samples-receptive)//stride+1)
    core_frames = max(1, core_samples//stride)
    context_frames = max(1, context_samples//stride)
    for first in range(0, count, core_frames):
        last = min(count, first+core_frames)
        left = max(0, first-context_frames)
        right = min(count, last+context_frames)
        yield {'sampleStart': left*stride, 'sampleEnd': min(samples, (right-1)*stride+receptive),
               'keepStart': first-left, 'keepEnd': last-left, 'frameStart': first, 'frameEnd': last}


def emission_timeline(model, processor, audio, rate, plan):
    import torch
    stride, receptive = convolution_geometry(model.config)
    windows = list(chunk_windows(len(audio), stride, receptive, int(plan['chunkSeconds']*rate), int(plan['overlapSeconds']*rate)))
    if not windows: raise ValueError('Audio too short for acoustic model')
    values = []
    with torch.inference_mode():
        for w in windows:
            batch = processor(audio[w['sampleStart']:w['sampleEnd']], sampling_rate=rate, return_tensors='pt')
            batch = {k: v.to(plan['device'], dtype=torch.float32 if v.is_floating_point() else v.dtype) for k, v in batch.items()}
            logits = model(**batch).logits[0].float()
            piece = logits[w['keepStart']:w['keepEnd']].log_softmax(-1).cpu().numpy()
            if len(piece) != w['frameEnd']-w['frameStart']:
                raise ValueError('Acoustic frame geometry mismatch; refusing guessed timing')
            if not np.isfinite(piece).all(): raise ValueError('Non-finite model emissions')
            values.append(piece)
            del batch, logits
    lp = np.concatenate(values)
    # Frame centers are determined by convolution stride/receptive field, never by word length.
    centers = (np.arange(len(lp))*stride + (receptive-1)/2)/rate
    intervals = np.column_stack((np.maximum(0, centers-stride/(2*rate)), np.minimum(len(audio)/rate, centers+stride/(2*rate))))
    return lp, intervals, len(windows)


def run_ctc(script, audio, rate, model_id, cache, download=False, device='auto', chunk_seconds=None):
    try:
        import torch
        from transformers import AutoProcessor, AutoModelForCTC
    except ImportError as error:
        raise RuntimeError('CTC dependencies missing in project .venv; run audio:setup --install-deps. ' + str(error)) from error
    record = record_for(model_id)
    if record['kind'] != 'ctc': raise ValueError('Expected a vetted Sorani CTC model')
    if download: acquire_model(model_id, cache)
    folder, manifest = verified_folder(model_id, cache)
    hw = hardware_report(cache); plan = ctc_plan(hw, device, chunk_seconds)
    torch.set_num_threads(plan['threads'])
    started = time.perf_counter()
    processor = AutoProcessor.from_pretrained(str(folder), local_files_only=True, trust_remote_code=False)
    ids, owners = ctc_targets(script, processor.tokenizer.get_vocab(), processor.tokenizer.word_delimiter_token or '|')
    # Loading on CPU keeps temporary allocation pressure off a 4 GB GPU.
    model = AutoModelForCTC.from_pretrained(str(folder), local_files_only=True, trust_remote_code=False, use_safetensors=True).eval()
    load_seconds = time.perf_counter()-started
    retries = []
    if plan['device'] == 'cuda': torch.cuda.reset_peak_memory_stats()
    inference_started = time.perf_counter()
    try:
        model.to(plan['device'])
        retry_small = False
        try:
            lp, intervals, chunks = emission_timeline(model, processor, audio, rate, plan)
        except torch.cuda.OutOfMemoryError:
            if plan['device'] != 'cuda': raise
            retry_small = True
        if retry_small:
            gc.collect(); torch.cuda.empty_cache()
            retries.append('CUDA OOM: retry with 4-second cores and 1-second context')
            plan.update(chunkSeconds=4, overlapSeconds=1)
            lp, intervals, chunks = emission_timeline(model, processor, audio, rate, plan)
        inference_seconds = time.perf_counter()-inference_started
        recognized = processor.decode(lp.argmax(-1))
        agreement = SequenceMatcher(None, normalize(script), normalize(recognized), autojunk=False).ratio()
        alignment_started = time.perf_counter()
        timings = ctc_word_times(script, lp, ids, owners, processor.tokenizer.pad_token_id, len(audio)/rate, frame_intervals=intervals)
        if agreement < .65:
            for word in timings: word['flags'].append('script-audio-disagreement')
        for word in timings:
            if word['confidence'] is not None and word['confidence'] < .15:
                word.update(start=None, end=None, flags=word['flags'] + ['insufficient-acoustic-evidence'])
        return timings, {'name': 'ctc-forced-alignment', 'model': model_id, 'revision': manifest['revision'], 'language': 'ckb', **plan,
                         'acousticTranscript': recognized, 'textAgreement': round(agreement, 4), 'chunks': chunks, 'retries': retries,
                         'modelCardWarnings': record.get('warnings', []), 'benchmark': {'modelLoadSeconds': load_seconds, 'inferenceSeconds': inference_seconds,
                         'alignmentSeconds': time.perf_counter()-alignment_started, 'processPeakRamBytes': peak_rss(),
                         'peakGpuAllocatedBytes': torch.cuda.max_memory_allocated() if plan['device']=='cuda' else 0,
                         'peakGpuReservedBytes': torch.cuda.max_memory_reserved() if plan['device']=='cuda' else 0,
                         'modelDiskBytes': sum(f['size'] for f in manifest['files']), 'reviewedAccuracy': None}}
    finally:
        del model
        gc.collect()
        if torch.cuda.is_available(): torch.cuda.empty_cache()


def converted_model(cache=None):
    for record in registry()['models']:
        if record['kind'] != 'whisper-finetune': continue
        pointer = model_root(cache) / 'installed' / (slug(record['id']) + '-ct2.json')
        if pointer.is_file(): return json.loads(pointer.read_text(encoding='utf-8'))['path']
    raise FileNotFoundError('No verified converted Sorani Whisper model; audio:setup --model MODEL --download-models --convert')


def run_whisper(script, audio, model_path, device='auto', compute_type=None):
    import ctranslate2
    from faster_whisper import WhisperModel
    folder = Path(model_path).resolve(); origin_file = folder / 'model-origin.json'
    if not folder.is_dir() or not origin_file.is_file():
        raise ValueError('Sorani ASR requires a converted Sorani model with model-origin.json; stock Whisper is unsupported')
    origin = json.loads(origin_file.read_text(encoding='utf-8')); record = record_for(origin['sourceModel'])
    if record['kind'] != 'whisper-finetune' or not origin.get('files') or not origin.get('revision'):
        raise ValueError('Sorani conversion provenance/integrity is missing; recreate conversion without deleting originals')
    for item in origin['files']:
        file = (folder / item['name']).resolve()
        if not file.is_relative_to(folder) or not file.is_file() or digest(file) != item['sha256']:
            raise ValueError('Converted model integrity failure: ' + item['name'])
    hw = hardware_report()
    available = hw['memory']['availableBytes']
    if available is not None and available < 6*GIB: raise RuntimeError('Whisper requires at least 6 GiB available system RAM')
    precision = compute_type or 'int8_float32'
    minimum_vram = (7 if precision == 'float32' else 5 if precision == 'float16' else 3.5)*GIB
    if precision == 'float32' and available is not None and available < 9*GIB: raise RuntimeError('Whisper FP32 needs at least 9 GiB available RAM')
    safe_gpu = hw['nvidia'] and hw['nvidia'][0]['freeBytes'] >= minimum_vram
    chosen = ('cuda' if safe_gpu else 'cpu') if device == 'auto' else device
    if chosen == 'cuda' and not safe_gpu: raise RuntimeError('Not enough free VRAM for conservative Whisper INT8 inference')
    if precision not in ctranslate2.get_supported_compute_types(chosen): raise RuntimeError('Unsupported CTranslate2 compute type: ' + precision)
    start = time.perf_counter()
    model = WhisperModel(str(folder), device=chosen, compute_type=precision, cpu_threads=min(6, max(1, (hw['logicalCpus'] or 2)//2)), num_workers=1, local_files_only=True)
    load_seconds = time.perf_counter()-start; start = time.perf_counter()
    try:
        segments, _ = model.transcribe(audio, language=record['decoderLanguage'], task='transcribe', word_timestamps=True, beam_size=5, vad_filter=False, condition_on_previous_text=False)
        recognized = [{'text': w.word.strip(), 'start': w.start, 'end': w.end, 'confidence': w.probability} for s in segments for w in s.words or []]
        rows = [{'start': None, 'end': None, 'confidence': None, 'flags': ['unmatched-ASR-word']} for _ in tokens(script)]
        matcher = SequenceMatcher(None, [normalize(w['text']) for w in tokens(script)], [normalize(w['text']) for w in recognized], autojunk=False)
        for a, b, count in matcher.get_matching_blocks():
            for j in range(count):
                r = recognized[b+j]
                rows[a+j] = {'start': r['start'], 'end': r['end'], 'confidence': r['confidence'], 'flags': ['ASR-timing-needs-review']}
        return rows, {'name': 'sorani-finetuned-faster-whisper', 'model': origin['sourceModel'], 'revision': origin['revision'], 'language': 'ckb', 'decoderLanguage': record['decoderLanguage'], 'recognition': recognized,
                      'device': chosen, 'precision': precision, 'batchSize': 1, 'benchmark': {'modelLoadSeconds': load_seconds, 'inferenceSeconds': time.perf_counter()-start, 'processPeakRamBytes': peak_rss(), 'peakGpuAllocatedBytes': None, 'modelDiskBytes': sum(p.stat().st_size for p in folder.iterdir() if p.is_file()), 'reviewedAccuracy': None},
                      'note': 'Only normalized exact matches receive acoustic timestamps; absent words remain null'}
    finally:
        del model
        gc.collect()


def run_auto(script, audio, rate, cache, model_id=None, download=False, device='auto', compute_type=None, chunk_seconds=None):
    hw = hardware_report(cache); model_id = model_id or registry()['recommended']
    failures, best = [], None
    candidates = []
    if device != 'cpu' and hw['torch'].get('cudaAvailable') and hw['torch'].get('freeBytes', 0) >= 2.5*GIB:
        candidates.append(('ctc', 'cuda'))
    if device != 'cpu' and hw['nvidia'] and hw['nvidia'][0]['freeBytes'] >= 3.5*GIB:
        candidates.append(('whisper', 'cuda'))
    if device != 'cuda': candidates.extend([('ctc', 'cpu'), ('whisper', 'cpu')])
    if not candidates: failures.append({'status': 'unavailable-device', 'device': device, 'message': 'Requested acceleration has insufficient memory or is unavailable'})
    for kind, candidate_device in candidates:
        try:
            if kind == 'ctc': rows, evidence = run_ctc(script, audio, rate, model_id, cache, download, device=candidate_device, chunk_seconds=chunk_seconds)
            else: rows, evidence = run_whisper(script, audio, converted_model(cache), device=candidate_device, compute_type=compute_type)
            coverage = sum(r['start'] is not None for r in rows)
            questionable = evidence.get('textAgreement', 1) < .65
            evidence['attempts'] = list(failures)
            if coverage == len(rows) and not questionable: return rows, evidence
            if best is None or (coverage, not questionable) > best[0]: best = ((coverage, not questionable), rows, evidence)
            failures.append({'backend': kind, 'device': candidate_device, 'status': 'partial-or-disagreement', 'timedWords': coverage})
        except Exception as error:
            failures.append({'backend': kind, 'device': candidate_device, 'type': type(error).__name__, 'message': str(error)})
    if best:
        best[2]['attempts'] = failures
        return best[1], best[2]
    return None, {'name': 'manual-assisted', 'language': 'ckb', 'wordAlignmentAvailable': False, 'attempts': failures, 'hardware': hw}
