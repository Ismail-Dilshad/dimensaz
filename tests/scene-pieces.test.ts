import {it,expect} from 'vitest';
import {pieceSchema,sceneVisualSchema,sceneIndexFor} from '../src/engine/scene-pieces-schema.js';
import {pieceExamples} from '../src/cli/pieces-cli.js';
import {requestSchema} from '../src/engine/production.js';
import {create,save} from '../src/engine/project.js';
import {planProject} from '../src/engine/timeline-builder.js';
import {openRenderer} from '../src/renderer/browser-renderer.js';

it('has a valid example for every kind',()=>{
 expect(Object.keys(pieceExamples).sort()).toEqual(['avatars','browser','chart','chat','checklist','counter','dashboard','image','notifications','phone','progress','tasks']);
 for(const [k,v] of Object.entries(pieceExamples)){const r=pieceSchema.safeParse(v.piece);expect(r.success,k).toBe(true);}
 const p=pieceSchema.parse({kind:'counter',to:5});expect(p).toMatchObject({placement:'center',size:.56,transition:'wipe',delay:.15});
 expect(pieceSchema.safeParse({kind:'counter',to:5,colour:'red'}).success).toBe(false);
 expect(pieceSchema.safeParse({kind:'phone',screen:{kind:'phone',screen:{kind:'counter',to:1}}}).success).toBe(false); // no device in a device
});

it('attaches pieces to scenes by index or by words of the sentence',()=>{
 const scenes=[{text:'Your team drowns in tasks.\n'},{text:'Flowly assigns them automatically.'}];
 expect(sceneIndexFor({match:'ASSIGNS them'},scenes)).toBe(1);
 expect(sceneIndexFor({scene:0},scenes)).toBe(0);
 expect(()=>sceneIndexFor({match:'nothing here'},scenes)).toThrow(/no scene contains.*0: Your team/);
 expect(()=>sceneIndexFor({scene:5},scenes)).toThrow(/has 2 scenes/);
 expect(sceneVisualSchema.safeParse({piece:{kind:'counter',to:1}}).success).toBe(false);
 expect(sceneVisualSchema.safeParse({scene:0,match:'x x',piece:{kind:'counter',to:1}}).success).toBe(false);
 const req=requestSchema.parse({schemaVersion:1,title:'t',script:'a\nb',preset:'kinetic',sceneVisuals:[{match:'a b',piece:pieceExamples.tasks!.piece}],pieceTheme:{accent:'#FF6B4A'}});
 expect(req.sceneVisuals[0]!.piece.kind).toBe('tasks');
});

it.skipIf(process.env.RUN_BROWSER_TESTS!=='1')('renders every piece, moves over time and repeats frames exactly',async()=>{
 const kinds=Object.keys(pieceExamples).filter(k=>k!=='image');
 const p=await create('pieces-integration',kinds.map(k=>'Scene '+k).join('\n'),{width:360,height:640,fps:12,fontSize:40,minFontSize:18});
 p.scenes=planProject(p);
 p.scenes.forEach((s,i)=>{s.piece=pieceSchema.parse(pieceExamples[kinds[i]!]!.piece);});
 p.config.pieces={primary:'#0B3B3C',accent:'#FF6B4A',surface:'#FFFFFF',background:'#FFF1D6',text:'#0B3B3C',muted:'#6B7280',radius:18};
 await save(p);const r=await openRenderer(p);
 try{
  for(const s of p.scenes){
   await r.page.evaluate(t=>window.render(t),s.start+.3);const early=await r.page.screenshot();
   await r.page.evaluate(t=>window.render(t),s.start+s.duration*.8);const late=await r.page.screenshot();
   expect(late.equals(early),s.text).toBe(false);
   await r.page.evaluate(t=>window.render(t),s.start+.3);expect((await r.page.screenshot()).equals(early),s.text).toBe(true);
  }
 }finally{await r.close();}
},120000);
