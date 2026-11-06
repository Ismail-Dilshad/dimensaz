import {spawn} from 'node:child_process';import path from 'node:path';import {ROOT} from '../engine/config.js';
export function monitorResources(){
 const samples:Array<{rss:number;cpu:number;gpu:number|null;vram:number|null}>=[];let pending='';let unavailable:string|undefined;
 const code=`import psutil,sys,time,threading,json,subprocess
stop=threading.Event()
threading.Thread(target=lambda:(sys.stdin.readline(),stop.set()),daemon=True).start()
root=psutil.Process(int(sys.argv[1]))
while not stop.is_set():
 try:
  processes=[root]+root.children(recursive=True);rss=0;cpu=0
  for p in processes:
   try:
    rss+=p.memory_info().rss;t=p.cpu_times();cpu+=t.user+t.system
   except psutil.Error:pass
  gpu=None;vram=None
  try:
   r=subprocess.run(['nvidia-smi','--query-gpu=utilization.gpu,memory.used','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=2,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
   if r.returncode==0:
    fields=r.stdout.splitlines()[0].split(',');gpu=float(fields[0]);vram=float(fields[1])*1024*1024
  except Exception:pass
  print(json.dumps(dict(rss=rss,cpu=cpu,gpu=gpu,vram=vram)),flush=True)
 except psutil.Error:break
 stop.wait(1)
`;
 const child=spawn(path.join(ROOT,'.venv',process.platform==='win32'?'Scripts/python.exe':'bin/python'),['-u','-c',code,String(process.pid)],{windowsHide:true,stdio:['pipe','pipe','pipe']});
 child.on('error',e=>{unavailable=String(e);});child.stdin.on('error',()=>{});child.stderr.on('data',b=>{unavailable=String(b).slice(-1000);});
 child.stdout.on('data',b=>{pending+=String(b);let at;while((at=pending.indexOf('\n'))>=0){const line=pending.slice(0,at);pending=pending.slice(at+1);try{samples.push(JSON.parse(line));}catch{}}});
 return {stop:async()=>{child.stdin.end('\n');await new Promise<void>(resolve=>{if(child.exitCode!==null||child.pid===undefined)return resolve();child.once('close',()=>resolve());});return {samples:samples.length,peakProcessTreeRssBytes:samples.length?Math.max(...samples.map(s=>s.rss)):null,peakDeviceGpuPercent:samples.length?Math.max(...samples.map(s=>s.gpu??0)):null,peakDeviceVramBytes:samples.length?Math.max(...samples.map(s=>s.vram??0)):null,cpuSecondsSampled:samples.length?Math.max(0,samples.at(-1)!.cpu-samples[0].cpu):null,unavailable,note:'1-second process-tree RSS samples (shared pages may be double counted); GPU/VRAM are device-wide, not attributable solely to renderer; sampled CPU misses exited processes.'};}};
}
