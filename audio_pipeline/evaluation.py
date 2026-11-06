"""Compare predictions with explicit human-reviewed acoustic samples; never approve predictions."""
import math
import numpy as np


def evaluate_samples(analysis, reference):
    if reference.get('audioSha256') != analysis['audioSha256']:
        raise ValueError('Reviewed samples belong to different audio')
    if not reference.get('reviewer', '').strip() or reference.get('reviewed') is not True:
        raise ValueError('Reference needs explicit reviewer and reviewed:true')
    samples = reference.get('words', [])
    if not samples: raise ValueError('No reviewed sample boundaries')
    errors, missing, seen = [], [], set()
    for sample in samples:
        i = sample['index']
        if isinstance(i, bool) or not isinstance(i, int) or i < 0 or i >= len(analysis['words']) or i in seen:
            raise ValueError('Invalid/duplicate reviewed word index')
        seen.add(i); word = analysis['words'][i]
        if sample.get('text') != word['text']: raise ValueError('Reviewed text differs from exact source')
        start, end = sample['start'], sample['end']
        if not (math.isfinite(start) and math.isfinite(end) and 0 <= start < end <= analysis['duration']):
            raise ValueError('Invalid reviewed acoustic boundary')
        if word['start'] is None or word['end'] is None:
            missing.append(i); continue
        errors.append({'index': i, 'text': word['text'], 'startErrorMs': abs(word['start']-start)*1000, 'endErrorMs': abs(word['end']-end)*1000})
    values=[e[k] for e in errors for k in ('startErrorMs','endErrorMs')]
    return {'audioSha256':analysis['audioSha256'],'reviewer':reference['reviewer'],'sampleCount':len(samples),'matchedSamples':len(errors),'unresolvedIndices':missing,'errors':errors,
            'meanBoundaryErrorMs':float(np.mean(values)) if values else None,'p95BoundaryErrorMs':float(np.percentile(values,95)) if values else None,
            'boundaryFractionWithin80Ms':sum(v<=80 for v in values)/len(values) if values else None,
            'limitation':'Only these reviewed samples were evaluated; this does not approve other words or certify a model'}
