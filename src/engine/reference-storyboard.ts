import {referenceStyles,styleLockText} from './reference-styles.js';
import {referenceStyleIds,referenceSceneSchema} from './reference-motion-schema.js';
import {sceneSchema,type Scene} from './schema.js';
import {direction} from './rtl-layout.js';
import {validateTimeline} from './scene-planner.js';
import {collectionCards,cardLock} from './collection-cards.js';
import type {CardName} from './reference-motion-schema.js';
import pacing from '../../config/motion.json' with {type:'json'};

export function planReference(script:string,id:typeof referenceStyleIds[number],card?:CardName){
 if(!script.trim())throw new Error('Supply an exact script');
 const pieces=script.match(/[\s\S]*?(?:[.!?؟]+(?=\s|$)\s*|\r?\n+|$)/gu)?.filter(Boolean)??[script];
 const parts:string[]=[];
 for(const piece of pieces){if(!piece.trim()&&parts.length)parts[parts.length-1]+=piece;else parts.push(piece);}
 if(parts[0]&&!parts[0].trim()&&parts.length>1)parts.splice(0,2,parts[0]+parts[1]);
 let startFrame=0;
 const scenes:Scene[]=parts.map((text,i)=>{
  const tokens=[...text.matchAll(/\S+/gu)];
  const last=tokens[Math.min(3,tokens.length-1)],first=tokens[0];
  // Silent design estimate. Narrated scene boundaries come from the bound audio cues.
  const readingSeconds=tokens.length/pacing.wordsPerSecond;
  const hold=i===parts.length-1?.6:0;
  const frames=Math.ceil(60*Math.max(pacing.minSceneDuration,readingSeconds+pacing.entrance+pacing.exit+hold));
  const start=startFrame/60,duration=frames/60;
  const scene=sceneSchema.parse({id:'S'+String(i+1).padStart(2,'0'),text,start,duration,
   direction:direction(text),role:i===0?'hook':i===parts.length-1?'cta':'explanation',
   animation:'word-slide-up',layout:'center',highlights:last?[{start:last.index,end:last.index+last[0].length}]:[],
   referenceMotion:referenceSceneSchema.parse({metaphor:'REQUIRED: choose a physical metaphor for this exact sentence.',
    headline:first&&last?{from:first.index,to:last.index+last[0].length}:undefined,
    layout:i%2?'headline-bottom':'headline-top',entrance:['rise','left','pop','drop'][i%4],
    transition:card?'cut':['fade','wipe','push'][i%3],camera:card?'static':i%2?'pull':'push',heroLoop:card?'none':undefined})
  });
  startFrame+=frames;return scene;
 });
 validateTimeline(scenes,script);
 const style=card?cardLock(card,id):referenceStyles[id];
 return {status:'storyboard-needs-assets',style,
  packetDraft:{version:2,title:'Reference motion short',script,style:card??style.name,rationale:'',
   look:styleLockText(style),assetLook:[style.material,style.lighting,'Use '+style.accent+' accents.'].join('. '),
   easing:'Smoothstep',timingNote:'Draft visual pacing at 60 fps. Choose each cut for its idea, reading hold and actions. For narration, use the bound voice cues.',
   registry:{},baseLayers:[],scenes:scenes.map(scene=>({title:'',copy:scene.text,scoreFrames:Math.round(scene.duration*60),anchor:'',image:'',motion:'',
    safe:[],art:[],text:[],contact:'',layers:[],moves:[],first:'',last:'',cut:''}))},
  timing:'Choose and refine each duration as the storyboard develops. Narration sets the cuts when supplied.',
  request:{schemaVersion:1,title:'Reference motion short',script,preset:'reference-'+id,...(card?{styleCard:card}:{}),language:'ckb',scenes,sfx:'off',fps:60,previewScale:.5},
  tasks:scenes.map(scene=>({scene:scene.id,source:scene.text,referenceFolder:card?'references/style-library/styles/'+card.toLowerCase().replaceAll(' ','-'):'references/styles/custom-motion-shorts/'+id,
   relationship:card?collectionCards[card].example:undefined,
   packetGuide:'docs/guides/scene-packet.md',
   masterImageBlueprint:styleLockText(style)+'\nPlan the layout, focal relationship and supporting objects for the exact source slice. Planning only.',
   layerInventory:[],assetPrompts:[],assembly:[],
   masterMotionBlueprint:'Choose the cut for this idea. Name the first focus, stagger necessary actions and reserve a readable hold. Planning only.',
   imagePrompt:'Resolve the layer inventory first. Write a separate generation prompt for each missing object.',
   motionBrief:'Assemble the moving-layer timeline within this scene’s chosen duration.',
   movingLayers:[],timeline:[],
   acquisition:['Search and visually assess local assets','Use code for suitable vector geometry','Source licensed images from official providers','Generate original text-free assets with available image tools'],
   required:['Name one idea and source anchor','Complete both blueprints and all seven scene packet sections','Resolve the registry before sending one request per missing object or movable part','Inspect the assembled still and layer pivots','Verify the final frame and compile the cross-scene summary'] }))
 };
}

