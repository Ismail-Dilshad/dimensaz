// Automatic categories, so nothing has to be filed by hand. Lessons, patterns and taught videos
// fall into the three ways of teaching (motion design, footage editing, storytelling); a taught
// video also gets style tags from its measurements; a video the agent made gets a kind of video
// (ad, teaser, explainer…) from its brief, length and shape.
import type {Measured} from './teach/measure.js';

export const GROUPS=[
 {id:'motion',label:'Motion design',about:'Animation, type, layout and colour',topics:['motion','typography','design','color']},
 {id:'edit',label:'Footage editing',about:'Cut rhythm, transitions and sound',topics:['editing','pacing','transitions','audio']},
 {id:'story',label:'Storytelling',about:'Hooks, script and captions',topics:['script','captions']}] as const;
export type GroupId=typeof GROUPS[number]['id'];
export const groupOfTopic=(topic:string):GroupId=>GROUPS.find(g=>(g.topics as readonly string[]).includes(topic))?.id??'motion';
/** The group most of the topics belong to (the first group wins a tie). */
export function groupOfTopics(topics:string[]):GroupId{
 let best:GroupId='motion',n=-1;
 for(const g of GROUPS){const c=topics.filter(t=>(g.topics as readonly string[]).includes(t)).length;if(c>n){n=c;best=g.id;}}
 return best;
}
/** What a taught video is like, read from its measurements. */
export function styleTags(m:Measured|null):string[]{
 if(!m)return [];const t:string[]=[];
 t.push(m.pacing.cuts<2?'One take':m.pacing.shotMedian<1.5?'Fast cuts':m.pacing.shotMedian>3?'Slow cuts':'Steady cuts');
 t.push(m.motion.energy<1?'Calm motion':m.motion.energy<3?'Lively motion':'Busy motion');
 t.push(m.color.brightness<.3?'Dark look':m.color.brightness>.7?'Light look':'Mid-tone look');
 if(m.color.saturation>=.5)t.push('Vivid colour');else if(m.color.saturation<.2)t.push('Muted colour');
 if(m.sound?.cutsOnBeat!=null&&m.sound.cutsOnBeat>=.7)t.push('Cut to the beat');
 t.push(m.media.shape==='vertical'?'Vertical':m.media.shape==='horizontal'?'Horizontal':'Square');
 return t;
}

export const VIDEO_KINDS=[
 {id:'teaser',label:'Teasers and launches',words:/teaser|launch|coming soon|announc|trailer|reveal|sneak peek|تیزەر|تشويق|قريبا/i},
 {id:'explainer',label:'Explainers and tutorials',words:/explain|how to|how it works|tutorial|guide|walk-?through|demo\b|step by step|فێرکاری|ڕوونکردنەوە|شرح|كيف/i},
 {id:'ad',label:'Ads and promos',words:/\bads?\b|advert|promo|commercial|offer|sale\b|discount|product|brand|ڕیکلام|إعلان|عرض/i},
 {id:'talk',label:'Talking head and interviews',words:/talking[- ]head|interview|podcast|vlog|speaker|testimonial|to camera|چاوپێکەوتن|مقابلة/i},
 {id:'short',label:'Social shorts',words:/reel|short\b|shorts|tiktok|story\b/i},
 {id:'other',label:'Other videos',words:/$^/}] as const;
export type VideoKind=typeof VIDEO_KINDS[number]['id'];
/** The kind of video, from the words of its brief or name; then from how it was made and its shape. */
export function videoKind(text:string,o:{mode?:string;seconds?:number|null;shape?:string|null}={}):VideoKind{
 for(const k of VIDEO_KINDS)if(k.id!=='other'&&k.id!=='short'&&k.id!=='talk'&&k.words.test(text))return k.id;
 if(VIDEO_KINDS[3].words.test(text)||o.mode==='edit')return 'talk';
 if(VIDEO_KINDS[4].words.test(text)||(o.seconds!=null&&o.seconds<=20&&o.shape==='vertical'))return 'short';
 return 'other';
}
export const lengthTag=(s:number|null)=>s==null?null:s<=20?'Under 20 s':s<=45?'20 to 45 s':s<=90?'45 to 90 s':'Over 90 s';
export const shapeOf=(w:number|null,h:number|null)=>!w||!h?null:w/h>1.15?'horizontal':w/h<.87?'vertical':'square';
