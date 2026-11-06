import sys,json
from pathlib import Path
import soundfile as sf
import numpy as np
from scipy.signal import correlate,correlation_lags
folder=Path(sys.argv[1]);a,sr=sf.read(folder/'original.wav');b,sr2=sf.read(folder/'export.wav');assert sr==sr2
items=[]
for start in [1,10,20,30,38]:
 lo=int(start*sr);hi=min(int((start+3)*sr),len(a),len(b));x=a[lo:hi];y=b[lo:hi];r=correlate(y,x,mode='full',method='fft');lags=correlation_lags(len(y),len(x));valid=np.abs(lags)<=int(.2*sr);lag=int(lags[valid][np.argmax(r[valid])]);items.append({'startSeconds':start,'lagMs':lag/sr*1000,'correlation':float(np.max(r[valid])/np.sqrt(np.sum(x*x)*np.sum(y*y)))})
result={'sampleRate':sr,'windows':items,'note':'Waveform comparison measures audio-track preservation and drift, not phonetic word-boundary accuracy.'};(folder/'audio-sync.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
