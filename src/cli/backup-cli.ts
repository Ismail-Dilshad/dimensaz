// `pnpm tempoloom backup`: everything the studio learned in one file, to keep or to move to
// another computer. Restoring saves a backup of what is here first, then merges.
import fs from 'node:fs';
import {parseArgs} from 'node:util';
import {createBackup,listBackups,previewRestore,restoreBackup,backupDir} from '../engine/backup.js';

const usage=`Usage: tempoloom backup [create] [--out FILE.zip]
       tempoloom backup list
       tempoloom backup check FILE.zip [--replace]
       tempoloom backup restore FILE.zip [--replace] --yes

Everything the studio learned in one file: the brain (lessons and their scores, taught videos,
past jobs), your taste profiles and feedback rules, the taught videos' thumbnails, the studio's
jobs and your ratings, the gallery's stars and your settings. Never your keys or your videos.

  create    Writes the backup (default: backups/tempoloom-backup-DATE.zip)
  list      Your backups, including the weekly automatic ones (backups/auto, four kept)
  check     What a restore would change, without changing anything
  restore   Saves a backup of what is here first, then merges: newer wins item by item, nothing
            is removed, and your own settings and taste profiles stay. --replace makes the
            backup win everywhere.`;

const {values:v,positionals:a}=parseArgs({args:process.argv.slice(2),allowPositionals:true,options:{out:{type:'string'},replace:{type:'boolean'},yes:{type:'boolean'}}});
const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
const changed=(c:{what:string;add:number;update:number;same:number;keep:number}[])=>c.filter(x=>x.add+x.update+x.same+x.keep).map(x=>({what:x.what,new:x.add,updated:x.update,unchanged:x.same,yoursKept:x.keep}));
try{
 const [cmd='create',file]=a;
 switch(cmd){
  case 'create':out({...createBackup(v.out?{out:v.out}:{}),note:'Keep it somewhere safe, or copy it to the other computer and run: pnpm tempoloom backup restore FILE.zip --yes'});break;
  case 'list':out({folder:backupDir(),backups:listBackups()});break;
  case 'check':case 'restore':{
   if(!file)throw new Error(`backup ${cmd} FILE.zip`);
   const bytes=new Uint8Array(fs.readFileSync(file)),mode=v.replace?'replace':'merge';
   if(cmd==='check'||!v.yes){const p=previewRestore(bytes,mode);out({backup:{made:p.manifest.created,byVersion:p.manifest.app,holds:p.manifest.counts},mode,wouldChange:changed(p.changes),
    then:cmd==='check'?`To restore: pnpm tempoloom backup restore ${file}${v.replace?' --replace':''} --yes`:'Nothing was changed. Add --yes to restore.'});break;}
   const r=restoreBackup(bytes,mode);out({restored:changed(r.changes),mode,savedFirst:r.savedFirst});break;}
  case 'help':case '--help':console.log(usage);break;
  default:console.log(usage);process.exitCode=1;
 }
}catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
