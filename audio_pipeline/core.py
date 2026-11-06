"""Local acoustic analysis. No script rewriting or fabricated timing."""
import hashlib
import math
import re
import unicodedata
from pathlib import Path
import numpy as np

def digest(file):
    h = hashlib.sha256()
    with open(file, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def tokens(script):
    return [{"text": m.group(), "cpFrom": m.start(), "cpTo": m.end(),
             "from": len(script[:m.start()].encode("utf-16-le")) // 2,
             "to": len(script[:m.end()].encode("utf-16-le")) // 2}
            for m in re.finditer(r"\S+", script)]

def load_audio(file):
    import soundfile as sf
    from scipy.signal import resample_poly
    try:
        audio, rate = sf.read(file, dtype="float32", always_2d=True)
        audio = audio.mean(axis=1)
        if rate != 16000:
            g = math.gcd(rate, 16000)
            audio = resample_poly(audio, 16000 // g, rate // g).astype("float32")
    except (RuntimeError, sf.LibsndfileError):
        from faster_whisper.audio import decode_audio
        audio = decode_audio(str(file), sampling_rate=16000)
    if not len(audio) or not np.isfinite(audio).all():
        raise ValueError("Empty or non-finite decoded audio")
    return audio, 16000

def detect_pauses(audio, rate=16000, threshold_db=-38, min_pause=.16):
    hop = max(1, round(rate * .02))
    rms = np.array([np.sqrt(np.mean(audio[i:i+hop].astype("float64") ** 2))
                    for i in range(0, len(audio), hop)])
    db = 20 * np.log10(np.maximum(rms, 1e-10))
    silent = db < threshold_db
    pauses = []
    start = None
    for i, value in enumerate(np.r_[silent, False]):
        if value and start is None:
            start = i * hop / rate
        elif not value and start is not None:
            end = min(i * hop / rate, len(audio) / rate)
            if end - start >= min_pause:
                pauses.append({"start": round(start, 4), "end": round(end, 4),
                               "duration": round(end-start, 4)})
            start = None
    stride = max(1, math.ceil(len(rms) / 1800))
    return pauses, [round(float(v), 5) for v in rms[::stride]]

def normalize(text):
    aliases = str.maketrans({"\u064a": "\u06cc", "\u0643": "\u06a9"})
    return "".join(c for c in unicodedata.normalize("NFC", text).translate(aliases).lower()
                   if unicodedata.category(c)[0] in ("L", "N"))

def ctc_targets(script, vocab, delimiter="|"):
    ids, owners, issues = [], [], []
    aliases = {"\u064a": "\u06cc", "\u06cc": "\u064a",
               "\u0643": "\u06a9", "\u06a9": "\u0643"}
    for i, word in enumerate(tokens(script)):
        if i and delimiter in vocab:
            ids.append(vocab[delimiter]); owners.append(None)
        count = 0
        for char in unicodedata.normalize("NFC", word["text"]).lower():
            category = unicodedata.category(char)
            if category[0] in ("P", "S", "M") or category == "Cf":
                continue
            candidate = char if char in vocab else aliases.get(char)
            if candidate not in vocab:
                issues.append({"word": i, "character": char, "reason": "out-of-vocabulary"})
            else:
                ids.append(vocab[candidate]); owners.append(i); count += 1
        if not count:
            issues.append({"word": i, "reason": "no supported acoustic characters"})
    if issues:
        raise ValueError("CTC vocabulary cannot represent the exact script: " + str(issues[:16]))
    return ids, owners

def ctc_viterbi(log_probs, targets, blank):
    """Standard blank/label CTC path, retaining repeat-label constraints."""
    lp = np.asarray(log_probs, dtype=np.float32)
    if lp.ndim != 2 or not len(targets):
        raise ValueError("Need frame emissions and nonempty transcript targets")
    if not np.isfinite(lp).all():
        raise ValueError("Non-finite CTC emissions")
    T, V = lp.shape
    if blank < 0 or blank >= V or any(t < 0 or t >= V or t == blank for t in targets):
        raise ValueError("Invalid CTC target/blank IDs")
    states = np.full(2 * len(targets) + 1, blank, dtype=np.int32)
    states[1::2] = targets
    S = len(states)
    if T * S > 100_000_000:
        raise ValueError("CTC trellis too large; split the recording at reviewed boundaries")
    scores = np.full(S, -np.inf, dtype=np.float32)
    scores[0], scores[1] = lp[0, blank], lp[0, states[1]]
    back = np.zeros((T, S), dtype=np.uint8)
    can_skip = np.zeros(S, dtype=bool)
    can_skip[2:] = (states[2:] != blank) & (states[2:] != states[:-2])
    for frame in range(1, T):
        one = np.r_[np.float32(-np.inf), scores[:-1]]
        two = np.r_[np.full(2, -np.inf, dtype=np.float32), scores[:-2]]
        two[~can_skip] = -np.inf
        choices = np.stack([scores, one, two])
        which = np.argmax(choices, axis=0)
        back[frame] = which
        scores = choices[which, np.arange(S)] + lp[frame, states]
    state = S-1 if scores[-1] >= scores[-2] else S-2
    if not np.isfinite(scores[state]):
        raise ValueError("No complete acoustic path fits the transcript; do not interpolate")
    path = np.empty(T, dtype=np.int32)
    for frame in range(T-1, -1, -1):
        path[frame] = state
        if frame:
            state -= int(back[frame, state])
    return path, states

def ctc_word_times(script, log_probs, ids, owners, blank, duration, frame_intervals=None):
    path, states = ctc_viterbi(log_probs, ids, blank)
    step = duration / len(path)
    if frame_intervals is not None:
        frame_intervals = np.asarray(frame_intervals)
        if frame_intervals.shape != (len(path), 2) or not np.isfinite(frame_intervals).all() or np.any(frame_intervals[:, 1] <= frame_intervals[:, 0]) or np.any(frame_intervals[1:, 0] < frame_intervals[:-1, 1] - 1e-8):
            raise ValueError("Invalid acoustic frame intervals")
    rows = []
    for i, word in enumerate(tokens(script)):
        token_indices = [j for j, owner in enumerate(owners) if owner == i]
        positions = np.flatnonzero(np.isin(path, [2*j+1 for j in token_indices]))
        if not len(positions):
            rows.append({"start": None, "end": None, "confidence": None,
                         "flags": ["missing-acoustic-path"]})
            continue
        values = np.exp(log_probs[positions, states[path[positions]]])
        score = float(np.mean(values))
        rows.append({"start": round(float(frame_intervals[positions[0], 0]) if frame_intervals is not None else float(positions[0])*step, 4),
                     "end": round(float(frame_intervals[positions[-1], 1]) if frame_intervals is not None else (float(positions[-1])+1)*step, 4),
                     "confidence": round(score, 4), "flags": []})
    return rows

def group_sentences(script, rows, pauses):
    tt = tokens(script)
    groups, cursor, first = [], 0, 0
    for i, token in enumerate(tt):
        after = script[token["cpTo"]:(tt[i+1]["cpFrom"] if i+1 < len(tt) else len(script))]
        boundary = bool(re.search(r"[.!?\u061f\u06d4]$", token["text"]) or "\n" in after)
        if i+1 < len(rows) and rows[i]["end"] is not None and rows[i+1]["start"] is not None:
            boundary |= any(p["duration"] >= .35 and p["start"] >= rows[i]["end"]-.08
                            and p["end"] <= rows[i+1]["start"]+.08 for p in pauses)
        if boundary or i == len(tt)-1:
            end = tt[i+1]["cpFrom"] if i+1 < len(tt) else len(script)
            subset = rows[first:i+1]
            complete = all(w["start"] is not None and w["end"] is not None for w in subset)
            groups.append({"id": len(groups)+1, "text": script[cursor:end],
                           "firstWord": first, "lastWord": i,
                           "start": subset[0]["start"] if complete else None,
                           "end": subset[-1]["end"] if complete else None})
            cursor, first = end, i+1
    return groups

def make_analysis(script, audio_file, audio, rate, backend, timings=None, errors=None):
    pauses, waveform = detect_pauses(audio, rate)
    rows = []
    if timings is not None and len(timings) != len(tokens(script)):
        raise ValueError("Acoustic output must cover every source token, including unresolved entries")
    previous_end = 0
    for i, token in enumerate(tokens(script)):
        timing = timings[i] if timings else {"start": None, "end": None, "confidence": None,
                                             "flags": ["alignment-unavailable"]}
        flags = list(timing.get("flags", []))
        start, end = timing.get("start"), timing.get("end")
        score = timing.get("confidence")
        if (start is None) != (end is None):
            start, end = None, None
            flags.append("incomplete-boundary")
        if start is not None and end is not None:
            if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end <= len(audio)/rate and start >= previous_end):
                flags.append("invalid-or-overlapping-acoustic-boundary")
                start, end = None, None
            else:
                previous_end = end
        if start is not None and end is not None:
            length = end-start
            if length < .045: flags.append("very-short")
            if length > 1.8: flags.append("very-long")
            if score is not None and score < .45: flags.append("low-acoustic-score")
            overlap = sum(max(0, min(end, p["end"])-max(start, p["start"])) for p in pauses)
            if length > 0 and overlap / length > .5: flags.append("mostly-silence")
        rows.append({"index": i, "text": token["text"], "from": token["from"], "to": token["to"],
                     "start": start, "end": end, "confidence": score,
                     "flags": sorted(set(flags)), "reviewed": False, "reviewer": None,
                     "originalWord": token["text"], "normalizedWord": normalize(token["text"]),
                     "alignmentMethod": backend["name"], "reviewRequired": True})
    sentences = group_sentences(script, rows, pauses)
    for sentence in sentences:
        for row in rows[sentence["firstWord"]:sentence["lastWord"]+1]:
            row["sentenceId"] = sentence["id"]
    return {"schemaVersion": 1, "script": script, "audioSha256": digest(audio_file),
            "audioFile": str(Path(audio_file).resolve()), "duration": round(len(audio)/rate, 6),
            "sampleRate": rate, "backend": backend, "reviewed": False,
            "confidenceMeaning": "Heuristic acoustic/token score, NOT calibrated timestamp accuracy",
            "errors": errors or [], "pauses": pauses, "waveform": waveform,
            "words": rows, "sentences": sentences}

def correct_analysis(analysis, corrections, reviewer):
    import copy
    result = copy.deepcopy(analysis)
    if not reviewer.strip():
        raise ValueError("Reviewer identity/label is required")
    seen = set()
    for correction in corrections:
        index = correction["index"]
        if isinstance(index, bool) or not isinstance(index, int) or index < 0 or index >= len(result["words"]) or index in seen:
            raise ValueError("Invalid or duplicate correction index")
        seen.add(index)
        word = result["words"][index]
        start, end = correction["start"], correction["end"]
        if isinstance(start, bool) or isinstance(end, bool) or not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not (0 <= start < end <= result["duration"]):
            raise ValueError("Invalid corrected word time")
        word.update(start=start, end=end, reviewed=correction.get("reviewed") is True,
                    reviewer=reviewer, flags=["manual-correction"], alignmentMethod="manual-review",
                    reviewRequired=correction.get("reviewed") is not True)
    last = 0
    for word in result["words"]:
        if word["start"] is not None and word["end"] is not None:
            if word["start"] < last:
                raise ValueError("Corrected words overlap or go backwards")
            last = word["end"]
    result["reviewed"] = all(w["reviewed"] and w["start"] is not None and w["end"] is not None for w in result["words"])
    result["sentences"] = group_sentences(result["script"], result["words"], result["pauses"])
    for sentence in result["sentences"]:
        for word in result["words"][sentence["firstWord"]:sentence["lastWord"]+1]:
            word["sentenceId"] = sentence["id"]
    return result
