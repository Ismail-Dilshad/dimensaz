"""Local capability evidence; no model download and no precision assumptions."""
import ctypes
import os
from pathlib import Path, PurePosixPath, PureWindowsPath
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
GIB = 1024 ** 3


def model_root(value=None):
    return Path(value or os.environ.get('VIDEO_MODEL_DIR') or ROOT / 'workspace/cache/audio-models').resolve()


CACHE_DIRS = ('verified', 'converted', 'staging')


def stored_path(root, folder):
    """Path to write into a pointer: relative to the cache, so a moved project keeps working."""
    folder = Path(folder).resolve()
    return folder.relative_to(root).as_posix() if folder.is_relative_to(root) else str(folder)


def cache_path(root, stored):
    """Resolve a pointer path. Relative paths are inside the cache. Absolute paths written by
    an older version, before the project folder was moved or renamed, are rebased onto the
    current cache by their verified/converted/staging tail when that folder exists here."""
    root = Path(root).resolve()
    looks_windows = '\\' in stored or (len(stored) > 1 and stored[1] == ':')
    pure = PureWindowsPath(stored) if looks_windows else PurePosixPath(stored)
    if not pure.is_absolute():
        return root.joinpath(*pure.parts).resolve()
    direct = Path(stored).resolve()
    if direct.is_relative_to(root) and direct.exists():
        return direct
    parts = pure.parts
    for index in range(len(parts) - 1, -1, -1):
        if parts[index] in CACHE_DIRS:
            rebased = root.joinpath(*parts[index:]).resolve()
            if rebased.is_relative_to(root) and rebased.exists():
                return rebased
            break
    return direct


def memory_info():
    if sys.platform == 'win32':
        class Status(ctypes.Structure):
            _fields_ = [('length', ctypes.c_ulong), ('load', ctypes.c_ulong)] + [(n, ctypes.c_ulonglong) for n in ('total', 'available', 'pageTotal', 'pageAvailable', 'virtualTotal', 'virtualAvailable', 'extended')]
        s = Status(); s.length = ctypes.sizeof(s)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(s)):
            raise OSError('GlobalMemoryStatusEx failed')
        return {'totalBytes': s.total, 'availableBytes': s.available}
    try:
        import psutil
        m = psutil.virtual_memory()
        return {'totalBytes': m.total, 'availableBytes': m.available}
    except ImportError:
        return {'totalBytes': None, 'availableBytes': None}


def peak_rss():
    if sys.platform == 'win32':
        from ctypes import wintypes
        class Counters(ctypes.Structure):
            _fields_ = [('cb', wintypes.DWORD), ('faults', wintypes.DWORD)] + [(name, ctypes.c_size_t) for name in ('peak', 'working', 'peakPaged', 'paged', 'peakNonpaged', 'nonpaged', 'pagefile', 'peakPagefile')]
        c = Counters(); c.cb = ctypes.sizeof(c)
        kernel = ctypes.windll.kernel32
        kernel.GetCurrentProcess.restype = wintypes.HANDLE
        fn = ctypes.windll.psapi.GetProcessMemoryInfo
        fn.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD]
        if fn(kernel.GetCurrentProcess(), ctypes.byref(c), c.cb):
            return c.peak
    else:
        import resource
        return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * (1 if sys.platform == 'darwin' else 1024)
    return None


def disk_info(folder):
    target = Path(folder).resolve(); existing = target
    while not existing.exists():
        existing = existing.parent
    usage = shutil.disk_usage(existing)
    return {'path': str(target), 'totalBytes': usage.total, 'freeBytes': usage.free}


def require_space(folder, required):
    d = disk_info(folder)
    if d['freeBytes'] < required + 5 * GIB:
        raise RuntimeError(f"Insufficient disk space at {d['path']}: need {required} bytes plus 5 GiB reserve")
    return d


def hardware_report(cache=None):
    report = {'python': sys.executable, 'pythonVersion': sys.version.split()[0], 'logicalCpus': os.cpu_count(), 'memory': memory_info(), 'disk': disk_info(model_root(cache)), 'nvidia': [], 'torch': {'available': False}, 'ctranslate2': {}, 'diagnostics': []}
    try:
        result = subprocess.run(['nvidia-smi', '--query-gpu=name,driver_version,memory.total,memory.free,compute_cap', '--format=csv,noheader,nounits'], capture_output=True, text=True, timeout=10, check=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        for line in result.stdout.strip().splitlines():
            name, driver, total, free, capability = [s.strip() for s in line.split(',')]
            report['nvidia'].append({'name': name, 'driver': driver, 'totalBytes': int(float(total)*1024**2), 'freeBytes': int(float(free)*1024**2), 'computeCapability': capability})
    except Exception as error:
        report['diagnostics'].append({'check': 'nvidia-smi', 'error': str(error)})
    try:
        import torch
        report['torch'] = {'available': True, 'version': torch.__version__, 'cudaBuild': torch.version.cuda, 'cudaAvailable': torch.cuda.is_available()}
        if torch.cuda.is_available():
            free, total = torch.cuda.mem_get_info()
            report['torch'].update(freeBytes=free, totalBytes=total, capability=list(torch.cuda.get_device_capability()))
    except Exception as error:
        report['diagnostics'].append({'check': 'torch', 'error': str(error)})
    try:
        import ctranslate2
        for device in ('cpu', 'cuda'):
            try:
                report['ctranslate2'][device] = sorted(ctranslate2.get_supported_compute_types(device))
            except Exception as error:
                report['diagnostics'].append({'check': 'ctranslate2-' + device, 'error': str(error)})
    except ImportError:
        pass
    return report


def ctc_plan(hardware, device='auto', chunk_seconds=None):
    ram = hardware['memory']['availableBytes']
    if ram is not None and ram < 4 * GIB:
        raise RuntimeError('CTC needs at least 4 GiB available RAM; close other applications or use manual review')
    gpu = hardware['torch']
    safe_gpu = gpu.get('cudaAvailable', False) and gpu.get('freeBytes', 0) >= 2.5 * GIB
    if device == 'cuda' and not safe_gpu:
        raise RuntimeError('CUDA CTC needs a working PyTorch CUDA runtime and at least 2.5 GiB free VRAM')
    chosen = 'cuda' if device != 'cpu' and safe_gpu else 'cpu'
    return {'device': chosen, 'precision': 'float32', 'batchSize': 1, 'chunkSeconds': min(float(chunk_seconds or 12), 20), 'overlapSeconds': 2, 'threads': min(6, max(1, (hardware['logicalCpus'] or 2)//2)), 'reason': 'FP32 reference path; reduced precision requires measured model-level comparison'}


def precision_probe():
    """Kernel benchmark only. Does not claim model accuracy or select FP16 for CTC."""
    import torch
    results = []
    if not torch.cuda.is_available():
        return {'results': [], 'note': 'PyTorch CUDA unavailable; CTC uses CPU FP32'}
    for name, dtype in (('float32', torch.float32), ('float16', torch.float16)):
        try:
            torch.manual_seed(0)
            a = torch.randn(512, 512, device='cuda', dtype=dtype)
            for _ in range(3): _ = a @ a
            torch.cuda.synchronize(); started = time.perf_counter()
            for _ in range(20): output = a @ a
            torch.cuda.synchronize()
            results.append({'precision': name, 'millisecondsPerMatmul': (time.perf_counter()-started)*50, 'finite': bool(torch.isfinite(output).all().item())})
            del a, output
        except Exception as error:
            results.append({'precision': name, 'error': str(error)})
        finally:
            torch.cuda.empty_cache()
    return {'results': results, 'note': 'Small matrix kernel only; not an ASR accuracy or model-throughput benchmark'}
