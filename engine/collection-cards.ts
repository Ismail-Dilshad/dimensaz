import {referenceStyles} from './reference-styles.js';
import {cardNames,type CardName,type ReferenceStyle} from './reference-motion-schema.js';
import type {Scene} from './schema.js';

type Id=ReferenceStyle['id'];
type Card={base:Id; compatible:Id[]; example:string; look?:Partial<ReferenceStyle>};
export const collectionCards:Record<CardName,Card>={
 'Blue Editorial':{base:'style-1',compatible:['style-1','style-2'],example:'Compose the cart approaching its shop, a dart seating in its target, or a paper plane leaving a message. Separate the mover, destination and relevant signal.'},
 'Classic':{base:'style-1',compatible:['style-1','style-2'],example:'Place a glossy store in the middle distance and bring the cobalt cart toward it. Reserve a clear band for the spoken phrase.',look:{material:'glossy cobalt enamel and white 3D retail objects'}},
 'Red Signal':{base:'style-3',compatible:['style-3','style-6'],example:'Turn a red key in a stationary black lock, then illuminate the status indicator.'},
 'Apricot Miniatures':{base:'style-4',compatible:['style-4'],example:'A cream fingertip approaches an orange button on a separate plinth.'},
 'Emerald Contrast':{base:'style-5',compatible:['style-5'],example:'Balance a pearl object against a lime object on separate scale pans.'},
 'Lavender Glass':{base:'style-7',compatible:['style-7'],example:'Set a translucent gem into a pearl hand, then reveal one violet glint.'},
 'Green Beacon':{base:'style-5',compatible:[],example:'A green key approaches a black nameplate. Light the receiving slot after contact.',look:{background:'#0C100F',corner:'#182F24',accent:'#18CB67',ink:'#F4F7F0',onAccent:'#0C100F',shadow:'#12492C',material:'black hardware with emissive emerald edges',lighting:'green spot and mint rim on low-key stage'}},
 'Tangerine Counter':{base:'style-4',compatible:[],example:'Raise an indigo-and-cream striped storefront and pivot its separate orange sale tag face-on.',look:{background:'#FBF2DF',corner:'#F2D7B5',accent:'#FF651E',ink:'#251D56',onAccent:'#251D56',shadow:'#D7C5A9',grid:{...referenceStyles['style-1'].grid,color:'#E6D7C1',opacity:.6},material:'chunky molded tangerine and indigo retail props',lighting:'warm directional light and grounded soft shadows'}},
 'Citron Clay':{base:'style-5',compatible:[],example:'Hold the matte magnet steady and bring a line of putty beads toward its citron tips.',look:{background:'#151B1C',corner:'#252E2E',accent:'#CBEA35',ink:'#F4F4E8',onAccent:'#151B1C',shadow:'#344239',material:'unglazed putty clay with citron tips',lighting:'soft workshop light on matte edges'}},
 'Violet Cutout':{base:'style-7',compatible:[],example:'Tip one purple domino toward a grayscale cutout hand over an ivory drafting grid.',look:{background:'#F6F2E8',corner:'#C8BBD3',accent:'#381873',ink:'#191717',onAccent:'#FFFFFF',shadow:'#AFA2AD',texture:'paper',grid:{...referenceStyles['style-1'].grid,color:'#C8BBD3',opacity:.45},material:'grayscale photographic cutouts, torn paper and grape ink',lighting:'soft cast-paper shadows on warm ivory'}}
};
export function cardForReference(id:Id):CardName {
 return cardNames.find(name=>collectionCards[name].compatible.includes(id))!;
}
export function cardLock(name:CardName,id=collectionCards[name].base):ReferenceStyle {
 const recipe=collectionCards[name];
 if(id!==recipe.base&&!recipe.compatible.includes(id))throw new Error(name+' conflicts with reference-'+id);
 return {...structuredClone(referenceStyles[id]),...structuredClone(recipe.look),id,name,card:name};
}
export function layerPlanIssues(scene:Scene):string[] {
 const r=scene.referenceMotion;if(!r)return ['Plan the relationship between a hero and its supporting objects.'];
 const issues:string[]=[];
 if(!scene.asset||!r.layers.some(l=>l.asset!==scene.asset))issues.push('Assign a hero and at least one distinct companion asset.');
 if(r.camera!=='static'||r.ghost||r.heroLoop==='float')issues.push('Keep the camera static and disable ambient loops and ghost copies.');
 const windows:{start:number;end:number}[]=[];
 for(const layer of r.layers){
  if(!layer.action?.trim())issues.push('Describe the role or action of '+layer.asset);
  if((layer.keyframes&&layer.beat)||layer.loop!=='none'||layer.travelX||layer.travelY)issues.push('Use a single motion track, settle beat, or static hold per layer: '+layer.asset);
  const b=layer.beat;if(!b)continue;
  if(b.start+b.duration>scene.duration-.15)issues.push('Reserve a settled reading hold after the beat.');
  if(!b.fromX&&!b.fromY&&!b.fromRotation&&b.fromScale===1&&b.fromOpacity===1)issues.push('This beat has no visible change: '+layer.asset);
  windows.push({start:b.start,end:b.start+b.duration});
 }
 for(const track of [r.heroMotion,...r.layers]){
  const keys=track?.keyframes;if(!keys)continue;
  if(!track.origin)issues.push('Specify the local pivot of each tracked object.');
  for(let i=1;i<keys.length;i++){
   const a=keys[i-1],b=keys[i];
   if(a.x===b.x&&a.y===b.y&&a.rotation===b.rotation&&a.scale===b.scale&&a.opacity===b.opacity)continue;
   const seconds=(b.at-a.at)*scene.duration;
   if(seconds<.4-1e-6||seconds>.6+1e-6||b.easing!=='smooth')issues.push('Use smooth 0.4–0.6 second transitions between distinct poses.');
   windows.push({start:a.at*scene.duration,end:b.at*scene.duration});
  }
 }
 if(r.holdArtwork&&windows.length)issues.push('A deliberate artwork hold cannot contain a moving object.');
 if(!r.holdArtwork&&!windows.length)issues.push('Give an object a timed action or explicitly hold the artwork.');
 windows.sort((a,b)=>a.start-b.start);
 if(windows.some((w,i)=>i>0&&w.start<windows[i-1].end-1e-6))issues.push('Stagger actions so outgoing and incoming objects do not compete.');
 return issues;
}
