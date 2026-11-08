// `pnpm dimensaz pieces`: the animated scene pieces, with a ready example for each, and a
// check for a request's sceneVisuals.
import fs from 'node:fs/promises';
import {pieceSchema,sceneVisualSchema,type Piece} from '../engine/scene-pieces-schema.js';

export const pieceExamples:Record<string,{use:string;piece:unknown}>={
 notifications:{use:'A problem: pressure, overload, messages piling up',piece:{kind:'notifications',items:[{app:'Slack',title:'5 new requests',body:'Can someone take the launch deck?'},{app:'Mail',title:'Urgent: client feedback'},{app:'Jira',title:'12 tickets unassigned'}],transition:'zoom-through'}},
 tasks:{use:'Work being assigned, done or organised (cards fly to avatars, tick off, or appear)',piece:{kind:'tasks',tasks:[{title:'Launch deck',assignee:'Sara',tag:'Design'},{title:'Client feedback',assignee:'Omar',tag:'Urgent'},{title:'Fix login bug',assignee:'Lena'}],flow:'assign'}},
 dashboard:{use:'Results, metrics, "see everything in one place"',piece:{kind:'dashboard',title:'This week',stats:[{label:'Tasks done',value:128,trend:'up'},{label:'On time',value:96,suffix:'%',trend:'up'}],chart:{type:'line',values:[12,18,15,26,31,38,44]}}},
 browser:{use:'A web app or website; wraps any other piece as its screen',piece:{kind:'browser',url:'app.example.com',screen:{kind:'dashboard',stats:[{label:'Revenue',value:42,prefix:'$',suffix:'k'}]},cursor:{path:[{x:.3,y:.45,at:1.2},{x:.7,y:.42,at:1.8,click:true}]},transition:'push'}},
 phone:{use:'A mobile app; wraps any other piece as its screen',piece:{kind:'phone',app:'Messages',screen:{kind:'chat',messages:[{from:'them',text:'Any update on our order?'},{from:'me',text:'Shipped this morning!'}]},tilt:-4,transition:'circle-reveal'}},
 chart:{use:'Growth, comparison or share: bar, line or donut',piece:{kind:'chart',type:'bar',title:'Revenue',values:[40,52,61,88],labels:['Q1','Q2','Q3','Q4'],unit:'k',transition:'mask-reveal'}},
 counter:{use:'One big number: users, savings, speed',piece:{kind:'counter',to:10000,suffix:'+',caption:'teams on board'}},
 progress:{use:'Completion, goals, comparisons in percent',piece:{kind:'progress',title:'Sprint',items:[{label:'Design',value:90},{label:'Build',value:70},{label:'Launch',value:40}]}},
 checklist:{use:'Steps, benefits, "everything done"',piece:{kind:'checklist',title:'Friday',items:['Deck approved','Bugs fixed','Client happy']}},
 chat:{use:'Customer support, teamwork, fast replies',piece:{kind:'chat',messages:[{from:'them',text:'Can you help today?',name:'Client'},{from:'me',text:'On it, done in 5 minutes.'}]}},
 avatars:{use:'A team, customers, "people like you"',piece:{kind:'avatars',people:[{name:'Sara Ali'},{name:'Omar Aziz'},{name:'Lena Park'},{name:'Dana Kurd'}],caption:'Your whole team'}},
 image:{use:'A real screenshot, product photo or rendered 3D view (asset id from the asset library or a pinned asset)',piece:{kind:'image',asset:'ASSET_ID',fit:'cover'}},
};

const usage=`Usage: dimensaz pieces [KIND | check REQUEST.json]

Animated scene pieces for video:create requests ("sceneVisuals"). Each scene's sentence stays
on screen as the headline; the piece shows it. Kinds: ${Object.keys(pieceExamples).join(', ')}.
Common options: placement center|top|bottom, size 0.3-0.75, delay SECONDS,
transition none|fade|wipe|push|zoom-through|mask-reveal|circle-reveal,
cursor {path:[{x,y,at,click}]} (x,y are 0-1 of the piece; at is seconds into the scene).
Write one sentence per script line; attach a piece with {"match":"words from that line","piece":{...}}.`;

async function main(){
 const [cmd,arg]=process.argv.slice(2);
 if(cmd==='check'){
  const req=JSON.parse(await fs.readFile(arg!,'utf8')) as {sceneVisuals?:unknown[];script?:string};
  const lines=(req.script??'').split(/\r?\n/).filter(l=>l.trim());
  const results=(req.sceneVisuals??[]).map((v,i)=>{const r=sceneVisualSchema.safeParse(v);if(!r.success)return {index:i,ok:false,problems:r.error.issues.map(x=>x.path.join('.')+': '+x.message)};
   const m=r.data.match?lines.findIndex(l=>l.toLowerCase().includes(r.data.match!.toLowerCase())):r.data.scene!;
   return {index:i,ok:m>=0&&m<lines.length,kind:r.data.piece.kind,line:m>=0?lines[m]:null,problems:m>=0&&m<lines.length?[]:['no script line matches']};});
  const covered=new Set(results.filter(r=>r.ok&&r.line).map(r=>r.line));
  console.log(JSON.stringify({ok:results.every(r=>r.ok),pieces:results,linesWithoutPiece:lines.filter(l=>!covered.has(l))},null,2));
  if(!results.every(r=>r.ok))process.exitCode=1;return;
 }
 if(cmd&&pieceExamples[cmd])return console.log(JSON.stringify({kind:cmd,...pieceExamples[cmd],valid:pieceSchema.safeParse(pieceExamples[cmd]!.piece).success},null,2));
 if(cmd&&cmd!=='help'){console.error('Unknown piece: '+cmd);process.exitCode=1;}
 console.log(usage+'\n\n'+Object.entries(pieceExamples).map(([k,v])=>`  ${k.padEnd(14)}${v.use}`).join('\n'));
}
if(process.argv[1]?.endsWith('pieces-cli.ts'))main().catch(e=>{console.error(JSON.stringify({error:(e as Error).message}));process.exitCode=1;});
export type {Piece};
