import argparse
import importlib
import importlib.metadata
import importlib.util
import json
import os
import sys
from pathlib import Path
from .core import load_audio, make_analysis, correct_analysis
from .backends import registry, run_ctc, run_whisper, run_auto, converted_model
from .hardware import hardware_report, model_root, precision_probe
from .setup import install_dependencies, acquire_model, model_status, convert_whisper, validate_model

def write_json(file, value):
    target = Path(file)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Never overwrite an analysis, correction, or previous project artifact.
    with target.open("x", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)

def doctor():
    names = {"faster-whisper": "faster_whisper", "soundfile": "soundfile", "numpy": "numpy",
             "scipy": "scipy", "ctranslate2": "ctranslate2", "torch": "torch", "transformers": "transformers"}
    packages = {}
    for package, module in names.items():
        try:
            importlib.import_module(module)
            packages[package] = {"version": importlib.metadata.version(package), "imports": True}
        except Exception as error:
            packages[package] = {"imports": False, "error": str(error)}
    cuda_count, language_support = None, None
    diagnostics = []
    try:
        import ctranslate2
        cuda_count = ctranslate2.get_cuda_device_count()
    except Exception as error:
        diagnostics.append({"check": "cuda", "error": str(error)})
    try:
        from faster_whisper.tokenizer import _LANGUAGE_CODES
        language_support = {"ckb": "ckb" in _LANGUAGE_CODES, "ku": "ku" in _LANGUAGE_CODES}
    except Exception as error:
        diagnostics.append({"check": "whisper-languages", "error": str(error)})
    return {"python": sys.executable, "version": sys.version, "prefix": sys.prefix,
            "basePrefix": sys.base_prefix, "packages": packages,
            "stockWhisperSorani": language_support, "diagnostics": diagnostics,
            "cudaDeviceCount": cuda_count,
            "defaultDevice": "auto", "models": registry(), "hardware": hardware_report(), "modelCache": model_status(),
            "notes": ["Package installation does not install model weights", "CUDA device detection does not verify CUDA runtime/cuDNN compatibility"]}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["doctor", "analyze", "correct", "setup", "precision-probe", "identity", "evaluate"])
    parser.add_argument("--audio")
    parser.add_argument("--script")
    parser.add_argument("--output")
    parser.add_argument("--backend", choices=["auto", "pauses", "ctc", "whisper"], default="auto")
    parser.add_argument("--model")
    parser.add_argument("--language", choices=["ckb", "en", "ar", "fa", "kmr", "badini"], default="ckb")
    parser.add_argument("--cache")
    parser.add_argument("--device", choices=["auto", "cpu", "cuda"], default="auto")
    parser.add_argument("--compute-type", choices=["float32", "float16", "int8", "int8_float32", "int8_float16"])
    parser.add_argument("--chunk-seconds", type=float)
    parser.add_argument("--install-deps", action="store_true")
    parser.add_argument("--download-models", action="store_true")
    parser.add_argument("--repair", action="store_true")
    parser.add_argument("--convert", action="store_true")
    parser.add_argument("--validate-model", action="store_true")
    parser.add_argument("--allow-download", action="store_true")
    parser.add_argument("--analysis")
    parser.add_argument("--patch")
    parser.add_argument("--reviewer")
    parser.add_argument("--reference")
    args = parser.parse_args()
    if args.chunk_seconds is not None and not 2 <= args.chunk_seconds <= 20:
        parser.error("chunk-seconds must be between 2 and 20")
    args.cache = str(model_root(args.cache))
    if args.command == "doctor":
        result = doctor()
    elif args.command == "identity":
        packages = {}
        for name in ("torch", "transformers", "faster-whisper", "ctranslate2", "huggingface-hub"):
            try: packages[name] = importlib.metadata.version(name)
            except importlib.metadata.PackageNotFoundError: packages[name] = None
        result = {"python": sys.executable, "version": sys.version, "packages": packages, "models": model_status(args.cache)}
    elif args.command == "precision-probe":
        try: result = precision_probe()
        except Exception as error: result = {"status": "blocked", "error": str(error)}
    elif args.command == "setup":
        result = {"hardware": hardware_report(args.cache), "steps": [], "errors": []}
        if args.repair and not args.download_models:
            parser.error("repair requires --download-models; existing snapshots are retained")
        try:
            if args.install_deps: result["steps"].append(install_dependencies(args.cache))
            if args.download_models: result["steps"].append(acquire_model(args.model or registry()["recommended"], args.cache, args.repair))
            if args.convert: result["steps"].append(convert_whisper(args.model or "rzgar/whisper-large-v3-sorani-kurdish-ckb-v2", args.cache))
            if args.validate_model: result["steps"].append(validate_model(args.model or registry()["recommended"], args.cache))
        except Exception as error:
            result["errors"].append({"type": type(error).__name__, "message": str(error)})
        result["models"] = model_status(args.cache)
        result["status"] = "blocked" if result["errors"] else "checked"
        if args.output: write_json(args.output, result)
    elif args.command == "evaluate":
        from .evaluation import evaluate_samples
        if not all([args.analysis,args.reference,args.output]): parser.error("evaluate requires --analysis --reference --output")
        result = evaluate_samples(json.loads(Path(args.analysis).read_text(encoding="utf-8-sig")), json.loads(Path(args.reference).read_text(encoding="utf-8-sig")))
        write_json(args.output,result)
    elif args.command == "correct":
        if not all([args.analysis, args.patch, args.reviewer, args.output]):
            parser.error("correct requires --analysis --patch --reviewer --output")
        analysis = json.loads(Path(args.analysis).read_text(encoding="utf-8"))
        patches = json.loads(Path(args.patch).read_text(encoding="utf-8"))
        result = correct_analysis(analysis, patches, args.reviewer)
        write_json(args.output, result)
        result = {"file": str(Path(args.output).resolve()), "reviewed": result["reviewed"]}
    else:
        if not all([args.audio, args.script, args.output]):
            parser.error("analyze requires --audio --script --output")
        with Path(args.script).open("r", encoding="utf-8", newline="") as handle:
            script = handle.read()
        audio, rate = load_audio(args.audio)
        timings, errors = None, []
        backend = {"name": "pause-analysis-only", "language": args.language, "wordAlignmentAvailable": False}
        try:
            if args.backend != "pauses" and args.language != "ckb":
                raise ValueError("Automatic speech models are currently vetted only for ckb, not " + args.language + ". Use reviewed provider/manual word timing; no Sorani model substitution.")
            if args.backend == "auto":
                timings, backend = run_auto(script, audio, rate, args.cache, args.model, args.allow_download, device=args.device, compute_type=args.compute_type, chunk_seconds=args.chunk_seconds)
                if timings is None: errors.extend(backend.get("attempts", []))
            elif args.backend == "ctc":
                timings, backend = run_ctc(script, audio, rate, args.model or registry()["recommended"], args.cache, args.allow_download, device=args.device, chunk_seconds=args.chunk_seconds)
            elif args.backend == "whisper":
                timings, backend = run_whisper(script, audio, args.model or converted_model(args.cache), device=args.device, compute_type=args.compute_type)
        except Exception as error:
            errors.append({"type": type(error).__name__, "message": str(error)})
        result = make_analysis(script, args.audio, audio, rate, backend, timings, errors)
        write_json(args.output, result)
        result = {"file": str(Path(args.output).resolve()), "duration": result["duration"],
                  "wordCount": len(result["words"]), "timedWords": sum(w["start"] is not None for w in result["words"]),
                  "pauseCount": len(result["pauses"]), "backend": result["backend"], "status": "needs-review" if timings else "alignment-blocked", "errors": errors}
    print(json.dumps(result, ensure_ascii=False, allow_nan=False))

if __name__ == "__main__":
    os.environ.setdefault("HF_HUB_DOWNLOAD_TIMEOUT", "15")
    os.environ.setdefault("HF_HUB_ETAG_TIMEOUT", "10")
    main()
