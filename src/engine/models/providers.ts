// Every service the browser studio can connect to, and how to check a key: each check reads the
// provider's own model list, so new models appear without a Tempoloom update. What a model can do
// comes from that list where the provider says it, and from its name where it does not.
export type Can={agents?:boolean;vision?:boolean;images?:boolean;video?:boolean;speech?:boolean;sound?:boolean;music?:boolean;stock?:boolean};
export type Model={id:string;name?:string;can:Can;context?:number;price?:{in:number;out:number}|null};
export type Group='models'|'makers'|'voice'|'sources'|'local';
export type Provider={id:string;name:string;group:Group;env:string;signup:string;about:string;can:Can;
 /** Reads the models (or checks the account). Throws a plain sentence when the key does not work. */
 test:(key:string,f:typeof fetch,baseURL?:string)=>Promise<{models:Model[];note?:string}>};

type Json=Record<string,any>; // provider JSON, read field by field
async function get(f:typeof fetch,url:string,headers:Record<string,string>={}):Promise<Json>{
 let r:Response;
 try{r=await f(url,{headers:{accept:'application/json',...headers},signal:AbortSignal.timeout(15000)});}
 catch(e){throw new Error(`Could not reach ${new URL(url).host}: ${(e as Error).name==='TimeoutError'?'no answer in 15 seconds':(e as Error).message}`);}
 if(r.status===401||r.status===403)throw new Error('The key was refused. Check that it is copied whole and still active.');
 if(r.status===429)throw new Error('The service says too many requests right now. Try again in a minute.');
 if(!r.ok)throw new Error(`The service answered ${r.status}${r.statusText?' '+r.statusText:''}.`);
 return await r.json() as Json;
}
const bearer=(k:string)=>({authorization:'Bearer '+k});
const perM=(x:unknown)=>{const n=Number(x);return Number.isFinite(n)?Math.round(n*1e6*1000)/1000:null;};
/** What an OpenAI-style model id can do, read from its name. */
function byName(id:string):Can{
 const n=id.toLowerCase();
 if(/embed|moderation|rerank|whisper|transcribe/.test(n))return {};
 if(/gpt-image|dall-e|image|imagen|flux|seedream|recraft/.test(n))return {images:true};
 if(/sora|veo|video/.test(n))return {video:true};
 if(/tts|realtime|audio/.test(n))return {speech:true};
 return {agents:true,vision:/gpt-4o|gpt-4\.1|gpt-5|^o[134]|vision|grok-4|gemini|claude|pixtral|llava|qwen.*vl|gemma-3/.test(n)};
}
const openaiStyle=(url:string)=>async(k:string,f:typeof fetch)=>{const j=await get(f,url,bearer(k));
 return {models:(j.data??[]).map((m:Json)=>({id:String(m.id),can:byName(String(m.id))})).filter((m:Model)=>Object.keys(m.can).length)};};

export const PROVIDERS:Provider[]=[
 {id:'anthropic',name:'Claude (Anthropic)',group:'models',env:'ANTHROPIC_API_KEY',signup:'https://console.anthropic.com/settings/keys',about:'Agents that plan, write and check, and see frames.',can:{agents:true,vision:true},
  test:async(k,f)=>{const j=await get(f,'https://api.anthropic.com/v1/models?limit=1000',{'x-api-key':k,'anthropic-version':'2023-06-01'});
   return {models:(j.data??[]).map((m:Json)=>({id:String(m.id),name:m.display_name?String(m.display_name):undefined,can:{agents:true,vision:true}}))};}},
 {id:'openai',name:'OpenAI (ChatGPT models)',group:'models',env:'OPENAI_API_KEY',signup:'https://platform.openai.com/api-keys',about:'Agents, frames, and images (gpt-image).',can:{agents:true,vision:true,images:true,speech:true},
  test:openaiStyle('https://api.openai.com/v1/models')},
 {id:'google',name:'Gemini (Google)',group:'models',env:'GEMINI_API_KEY',signup:'https://aistudio.google.com/apikey',about:'Agents that also watch video, images (Nano Banana) and video clips (Veo).',can:{agents:true,vision:true,images:true,video:true,speech:true},
  test:async(k,f)=>{const j=await get(f,'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{'x-goog-api-key':k});
   return {models:(j.models??[]).map((m:Json)=>{const id=String(m.name??'').replace(/^models\//,''),how:string[]=m.supportedGenerationMethods??[],c=byName(id);
    return {id,name:m.displayName?String(m.displayName):undefined,context:Number(m.inputTokenLimit)||undefined,
     can:c.agents?(how.includes('generateContent')?{agents:true,vision:true}:{}):c};}).filter((m:Model)=>Object.keys(m.can).length)};}},
 {id:'openrouter',name:'OpenRouter',group:'models',env:'OPENROUTER_API_KEY',signup:'https://openrouter.ai/settings/keys',about:'One key for hundreds of models from every lab, with prices.',can:{agents:true,vision:true,images:true},
  test:async(k,f)=>{const who=await get(f,'https://openrouter.ai/api/v1/key',bearer(k)),j=await get(f,'https://openrouter.ai/api/v1/models',bearer(k));
   const left=who.data?.limit_remaining;
   return {note:left!=null?`$${Number(left).toFixed(2)} left on this key`:undefined,models:(j.data??[]).map((m:Json)=>{const a=m.architecture??{},inp:string[]=a.input_modalities??[],out:string[]=a.output_modalities??[],params:string[]=m.supported_parameters??[];
    const can:Can=out.includes('image')?{images:true}:out.includes('text')?{agents:params.includes('tools'),vision:inp.includes('image')}:{};
    return {id:String(m.id),name:m.name?String(m.name):undefined,context:Number(m.context_length)||undefined,can,price:m.pricing?{in:perM(m.pricing.prompt)??0,out:perM(m.pricing.completion)??0}:null};}).filter((m:Model)=>m.can.agents||m.can.images||m.can.vision)};}},
 {id:'xai',name:'xAI (Grok)',group:'models',env:'XAI_API_KEY',signup:'https://console.x.ai',about:'Agents, images and video.',can:{agents:true,vision:true,images:true,video:true},test:openaiStyle('https://api.x.ai/v1/models')},
 {id:'mistral',name:'Mistral',group:'models',env:'MISTRAL_API_KEY',signup:'https://console.mistral.ai/api-keys',about:'Agents; some models see images.',can:{agents:true,vision:true},
  test:async(k,f)=>{const j=await get(f,'https://api.mistral.ai/v1/models',bearer(k));
   return {models:(j.data??[]).filter((m:Json)=>m.capabilities?.completion_chat).map((m:Json)=>({id:String(m.id),context:Number(m.max_context_length)||undefined,can:{agents:!!m.capabilities?.function_calling,vision:!!m.capabilities?.vision}}))};}},
 {id:'deepseek',name:'DeepSeek',group:'models',env:'DEEPSEEK_API_KEY',signup:'https://platform.deepseek.com/api_keys',about:'Low-cost agents (text only).',can:{agents:true},
  test:async(k,f)=>{const j=await get(f,'https://api.deepseek.com/models',bearer(k));return {models:(j.data??[]).map((m:Json)=>({id:String(m.id),can:{agents:true}}))};}},
 {id:'groq',name:'Groq',group:'models',env:'GROQ_API_KEY',signup:'https://console.groq.com/keys',about:'Very fast open models.',can:{agents:true},test:openaiStyle('https://api.groq.com/openai/v1/models')},
 {id:'fal',name:'fal',group:'makers',env:'FAL_KEY',signup:'https://fal.ai/dashboard/keys',about:'Open image and video models (Flux and others), background removal, upscaling.',can:{images:true,video:true,sound:true},
  test:async(k)=>{if(!/^[\w-]+:[\w-]+$/.test(k.trim()))throw new Error('A fal key looks like two parts joined by a colon (id:secret). Copy it whole.');
   return {models:[],note:'Saved. fal has no key check of its own; it is checked the first time an image is made.'};}},
 {id:'replicate',name:'Replicate',group:'makers',env:'REPLICATE_API_TOKEN',signup:'https://replicate.com/account/api-tokens',about:'Open image, video and music models.',can:{images:true,video:true,music:true},
  test:async(k,f)=>{const j=await get(f,'https://api.replicate.com/v1/account',bearer(k));return {models:[],note:`Account: ${j.username??'checked'}`};}},
 {id:'elevenlabs',name:'ElevenLabs',group:'voice',env:'ELEVENLABS_API_KEY',signup:'https://elevenlabs.io/app/settings/api-keys',about:'Your voice-overs, transcripts, sound effects and music. Used only when you ask for a voice.',can:{speech:true,sound:true,music:true},
  test:async(k,f)=>{const j=await get(f,'https://api.elevenlabs.io/v1/user/subscription',{'xi-api-key':k});
   const left=j.character_limit!=null&&j.character_count!=null?Number(j.character_limit)-Number(j.character_count):null;return {models:[],note:left!=null?`${left.toLocaleString('en')} characters left this month`:'Key works'};}},
 {id:'pexels',name:'Pexels',group:'sources',env:'PEXELS_API_KEY',signup:'https://www.pexels.com/api/',about:'Free stock photos and videos.',can:{stock:true},
  test:async(k,f)=>{await get(f,'https://api.pexels.com/v1/search?query=coffee&per_page=1',{authorization:k});return {models:[],note:'Key works'};}},
 {id:'pixabay',name:'Pixabay',group:'sources',env:'PIXABAY_API_KEY',signup:'https://pixabay.com/api/docs/',about:'Free images, vectors and videos.',can:{stock:true},
  test:async(k,f)=>{await get(f,`https://pixabay.com/api/?key=${encodeURIComponent(k)}&q=coffee&per_page=3`);return {models:[],note:'Key works'};}},
 {id:'freesound',name:'Freesound',group:'sources',env:'FREESOUND_API_KEY',signup:'https://freesound.org/apiv2/apply/',about:'Free sound effects.',can:{stock:true},
  test:async(k,f)=>{await get(f,`https://freesound.org/apiv2/search/text/?query=whoosh&page_size=1&token=${encodeURIComponent(k)}`);return {models:[],note:'Key works'};}},
];
export const providerById=(id:string)=>{const p=PROVIDERS.find(x=>x.id===id);if(!p)throw new Error('Unknown service: '+id);return p;};

/** A model server on this computer or your network that speaks the OpenAI API (Ollama, LM Studio, llama.cpp, vLLM). */
export async function testLocal(baseURL:string,key:string|undefined,f:typeof fetch):Promise<{models:Model[];note?:string}>{
 const j=await get(f,baseURL.replace(/\/+$/,'')+'/models',key?bearer(key):{});
 return {models:(j.data??j.models??[]).map((m:Json)=>{const id=String(m.id??m.name??m.model);return {id,can:byName(id)};}).filter((m:Model)=>m.id&&m.id!=='undefined'&&Object.keys(m.can).length)};
}
export const LOCAL_PRESETS=[{name:'Ollama',baseURL:'http://localhost:11434/v1'},{name:'LM Studio',baseURL:'http://localhost:1234/v1'},{name:'llama.cpp server',baseURL:'http://localhost:8080/v1'}];
