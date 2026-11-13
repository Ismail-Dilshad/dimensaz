// The app's home: what the brain holds, what is waiting, and what happened lately.
import {report} from './brain/brain.js';
import {allKnowledge} from './brain/db.js';
import {videos} from './teach/teach.js';
import {overview as studio} from './studio-requests.js';

export function home(){
 const r=report(),vs=videos(),st=studio(),ks=allKnowledge();
 type Event={at:string;kind:'video'|'lesson'|'rating'|'rule'|'job';text:string;good?:boolean};
 const events:Event[]=[];
 for(const v of vs)if(v.learnedAt)events.push({at:v.learnedAt,kind:'video',text:`Learned "${v.title}" (${v.lessons.length} lesson${v.lessons.length===1?'':'s'})`,good:v.verdict==='good'});
 for(const k of ks)if(k.tags.includes('pattern'))events.push({at:k.updated,kind:'lesson',text:`Pattern: ${k.title}`});
 for(const j of st.jobs){events.push({at:j.created,kind:'job',text:`Started a ${j.mode==='edit'?'footage edit':'motion video'}`});
  for(const x of j.ratings)events.push({at:x.at,kind:'rating',text:`Rated ${x.task} ${x.rating==='ok'?'not bad':x.rating}`,good:x.rating!=='bad'});}
 const waiting=vs.filter(v=>v.status==='waiting').length;
 return {brain:{total:r.knowledge.total,byStatus:r.knowledge.byStatus,onTrial:r.knowledge.trialToTry,jobs:r.jobs.total},
  teach:{videos:vs.filter(v=>v.status==='learned').length,good:vs.filter(v=>v.status==='learned'&&v.verdict==='good').length,waiting,drafts:vs.filter(v=>v.status==='draft').length,
   lessons:ks.filter(k=>k.tags.includes('taught')&&!k.tags.includes('pattern')&&!['rejected','retired'].includes(k.status)).length,patterns:ks.filter(k=>k.tags.includes('pattern')&&k.status!=='rejected').length},
  studio:st.totals,made:st.jobs.flatMap(j=>j.tasks).reduce((n,t)=>n+(t.gate?0:t.show.filter(x=>x.type==='video').length),0),guesses:st.scores.guesses,scores:{good:st.scores.good,bad:st.scores.bad},
  // What to say to the agent now, most urgent first.
  agent:[...(waiting?[{say:'Study the videos I taught',command:'pnpm tempoloom teach next',why:`${waiting} taught video${waiting>1?'s are':' is'} waiting`}]:[]),
   ...(st.totals.waitingForAgent?[{say:'Check the studio inbox',command:'pnpm tempoloom studio inbox',why:`${st.totals.waitingForAgent} video job${st.totals.waitingForAgent>1?'s are':' is'} waiting`}]:[])],
  you:st.jobs.filter(j=>j.waitingFor==='you'&&!j.archived).map(j=>({job:j.job,title:j.request.split('\n')[0]!.slice(0,80)})),
  activity:events.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,14)};
}
