from pathlib import Path
import numpy as np, wave, json, hashlib
from scipy.signal import butter,sosfilt
rate=48000
for kind,duration,name in [('pops',.12,'soft-typography-pop'),('impacts',.20,'soft-typography-impact'),('whooshes',.38,'gentle-text-transition-whoosh')]:
 t=np.arange(int(rate*duration))/rate
 if kind=='pops':
  phase=2*np.pi*(950*t-2100*t*t);x=np.sin(phase)*np.exp(-t*42)*(1-np.exp(-t*900))
 elif kind=='impacts':
  phase=2*np.pi*(150*t-190*t*t);x=(np.sin(phase)+.12*np.sin(phase*2))*np.exp(-t*25)*(1-np.exp(-t*700))
 else:
  x=sosfilt(butter(2,[450,3200],btype='bandpass',fs=rate,output='sos'),np.random.default_rng(21).normal(0,1,len(t)))*np.sin(np.pi*t/duration)**3
 x=x/max(np.max(np.abs(x)),.01)*.22
 pcm=(x*32767).astype('<i2').tobytes();digest=hashlib.sha256(pcm).hexdigest()[:12]
 folder=Path('assets/sfx')/kind;folder.mkdir(exist_ok=True,parents=True);f=folder/(name+'-'+digest+'.wav')
 if not f.exists():
  with wave.open(str(f),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm)
  data={'name':name,'category':kind,'license':'CC0-1.0','source':'Original deterministic procedural synthesis for this project; no third-party recordings','creator':'Project procedural sound generator','licenseEvidence':'New sine/noise synthesis, dedicated under CC0; no sampled third-party material','commercial':True,'verified':True,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'tags':['subtle','typography','original'],'generator':'scripts/generate-typography-sfx.py'}
  f.with_suffix('.wav.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
 print(f)
