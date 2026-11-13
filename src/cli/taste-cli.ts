// `pnpm tempoloom taste`: the user's taste profile, as the agent reads it and as they edit it.
import {parseArgs} from 'node:util';
import * as T from '../engine/taste.js';
import {sync} from '../engine/brain/brain.js';
import {TEACH_TOPICS,type Topic} from '../engine/teach/teach.js';

const usage=`Usage: tempoloom taste <command>

  show [PROFILE]                 The profile as text: what the user likes by topic, the targets every
                                 preview is measured against, and what they reject most
  list                           The profiles (main, and any for a client or a brand)
  new "NAME" [--videos ID,ID]    A new profile, based on all taught videos or only some
  add PROFILE --topic TOPIC "LINE"     Add a line in the user's words
  off PROFILE REF | on PROFILE REF     Switch a line (a lesson, rule or pattern id) off or on
  target PROFILE METRIC LO HI | target PROFILE METRIC --clear
                                 Set or clear the user's own target for a measurement
  remove PROFILE                 Remove a profile (never the main one)

Measurements: ${Object.keys(T.METRIC_LABEL).join(', ')}
Topics: ${TEACH_TOPICS.join(', ')}
The profile is built from what the user taught, kept and rated; their edits are in agent/brain/taste.json.`;
const {values:v,positionals}=parseArgs({allowPositionals:true,options:{videos:{type:'string'},topic:{type:'string'},clear:{type:'boolean'},json:{type:'boolean'}}});
const [cmd,...a]=positionals;const out=(x:unknown)=>console.log(JSON.stringify(x,null,2));
function main(){
 if(!cmd||cmd==='help'||cmd==='--help')return console.log(usage);
 sync();
 switch(cmd){
  case 'show':return v.json?out(T.build(a[0]??'main')):console.log(T.markdown(a[0]??'main'));
  case 'list':return out(T.profiles());
  case 'new':{if(!a[0])throw new Error('new "NAME"');const b=T.create(a.join(' '),{videos:v.videos?v.videos.split(',').map(s=>s.trim()).filter(Boolean):null});return out({created:b.id,name:b.name,basedOn:b.basedOn});}
  case 'add':{if(!a[0]||!a[1]||!v.topic)throw new Error('add PROFILE --topic TOPIC "LINE"');if(!(TEACH_TOPICS as readonly string[]).includes(v.topic))throw new Error('Topics: '+TEACH_TOPICS.join(', '));
   T.addLine(a[0],v.topic as Topic,a.slice(1).join(' '));return out({added:true});}
  case 'off':case 'on':{if(!a[0]||!a[1])throw new Error(cmd+' PROFILE REF');T.setLine(a[0],a[1],cmd==='on');return out({[cmd]:a[1]});}
  case 'target':{if(!a[0]||!a[1])throw new Error('target PROFILE METRIC LO HI');
   if(v.clear){T.setTarget(a[0],a[1],null);return out({cleared:a[1]});}
   const lo=Number(a[2]),hi=Number(a[3]);if(!Number.isFinite(lo)||!Number.isFinite(hi))throw new Error('target PROFILE METRIC LO HI (two numbers)');
   T.setTarget(a[0],a[1],{lo,hi});return out({target:a[1],lo,hi});}
  case 'remove':if(!a[0])throw new Error('remove PROFILE');return out(T.remove(a[0]));
 }
 console.error(usage);process.exitCode=1;
}
try{main();}catch(e){console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;}
