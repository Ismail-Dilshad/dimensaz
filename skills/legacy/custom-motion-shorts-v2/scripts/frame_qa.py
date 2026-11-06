"""Extract the first source frame at or after each half second and the final frame."""
import argparse
import bisect
import hashlib
import html
import json
import os
import shutil
import subprocess
import uuid
from pathlib import Path

def binary(name, explicit):
    if explicit:return explicit
    found=os.getenv(name.upper()+"_PATH")
    if found:return found
    for root in [Path.cwd(),*Path(__file__).resolve().parents]:
        module=root/"node_modules"/(name+"-static")
        rel="ffmpeg.exe" if name=="ffmpeg" else "bin/win32/x64/ffprobe.exe"
        if (module/rel).is_file():return str(module/rel)
    found=shutil.which(name)
    if found:return found
    raise ValueError("Supply --"+name+" with the executable path.")

def inspect(video,out,ffmpeg,ffprobe):
    info=json.loads(subprocess.check_output([ffprobe,"-v","error","-select_streams","v:0","-show_entries","frame=best_effort_timestamp_time","-of","json",str(video)]))
    pts=[float(f["best_effort_timestamp_time"]) for f in info["frames"]]
    if not pts:raise ValueError("No decoded video frames")
    indices={0,len(pts)-1};tick=1
    while pts[0]+tick*.5<=pts[-1]:
        indices.add(bisect.bisect_left(pts,pts[0]+tick*.5));tick+=1
    ordered=sorted(indices);out.mkdir(parents=True,exist_ok=True)
    dest=out/("frames-"+uuid.uuid4().hex[:12]);dest.mkdir()
    # Select the first decoded frame in each half-second bucket and both endpoints.
    bucket=f"floor((t-({pts[0]})+0.0000001)*2)"
    previous=bucket.replace("(t-","(prev_t-")
    expression=f"select='eq(n,0)+eq(n,{len(pts)-1})+gt({bucket},{previous})'"
    subprocess.run([ffmpeg,"-loglevel","error","-n","-i",str(video),"-map","0:v:0","-vf",expression,"-vsync","0","-q:v","2",str(dest/"sample-%05d.jpg")],check=True)
    files=sorted(dest.glob("sample-*.jpg"))
    if len(files)!=len(ordered):raise ValueError("Decoded sample count mismatch")
    rows=[];seen={}
    for i,file in zip(ordered,files):
        h=hashlib.sha256(file.read_bytes()).hexdigest()
        rows.append({"frame":i,"time":pts[i],"file":file.name,"sameSampleAs":seen.get(h)})
        seen[h]=pts[i]
    report={"video":str(video.resolve()),"sha256":hashlib.sha256(video.read_bytes()).hexdigest(),"samples":rows,"review":"Inspect stills and playback for clipping, contrast, overlap, glyph joining and visual reuse. Identical samples can be deliberate holds."}
    (dest/"report.json").write_text(json.dumps(report,indent=2),"utf8")
    gallery=''.join(f'<figure><a href="{r["file"]}"><img loading="lazy" src="{r["file"]}"></a><figcaption>{r["time"]:.3f}s · frame {r["frame"]}</figcaption></figure>' for r in rows)
    (dest/"review.html").write_text('<!doctype html><meta charset="utf-8"><title>Encoded frame review</title><style>body{font:16px system-ui}main{display:flex;flex-wrap:wrap}figure{margin:8px}img{width:145px}</style><h1>'+html.escape(video.name)+'</h1><p>'+report['review']+'</p><main>'+gallery+'</main>',"utf8")
    return dest

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("video",type=Path);parser.add_argument("--out",required=True,type=Path);parser.add_argument("--ffmpeg");parser.add_argument("--ffprobe")
    args=parser.parse_args();print(inspect(args.video,args.out,binary("ffmpeg",args.ffmpeg),binary("ffprobe",args.ffprobe)))
