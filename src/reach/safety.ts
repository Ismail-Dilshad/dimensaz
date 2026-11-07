// Safety rules from Agent Reach: only public http(s) links, secrets removed from any text
// that leaves a backend, and read-only site commands (every write command is refused).
import net from 'node:net';
import {ReachError} from './result.js';

const SECRET_PATTERNS:[RegExp,string][]=[
 [/(https?:\/\/)[^\s/@:]+:[^\s/@]+@/gi,'$1***@'],
 [/([?&](?:token|key|api_key|apikey|access_token|auth|sig|signature|session|sessionid|password)=)[^&\s"']+/gi,'$1***'],
 [/((?:cookie|authorization|x-api-key|xi-api-key)\s*[:=]\s*)[^\n"']+/gi,'$1***'],
 [/\b(sessionid|ds_user_id|csrftoken|auth_token|ct0|c_user|xs|li_at)=([^;\s"']+)/gi,'$1=***'],
 [/\b(sk|pk|rk)[-_][A-Za-z0-9_-]{16,}\b/g,'$1-***'],
];
export function scrubSecrets(text:string){return SECRET_PATTERNS.reduce((t,[re,rep])=>t.replace(re,rep),text);}

const privateV4=(ip:string)=>{const [a,b]=ip.split('.').map(Number) as [number,number];
 return a===10||a===127||a===0||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||a>=224;};
const allowLocal=()=>process.env.DIMENSAZ_REACH_ALLOW_LOCAL==='1'; // tests only

/** A public http(s) URL with no credentials, or a BAD_INPUT error. */
export function publicUrl(input:string){
 let u:URL;
 try{u=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input.trim())?input.trim():'https://'+input.trim());}catch{throw new ReachError('BAD_INPUT','Not a valid link: '+input.slice(0,200));}
 if(!/^https?:$/.test(u.protocol))throw new ReachError('BAD_INPUT','Only http(s) links are allowed');
 if(u.username||u.password)throw new ReachError('BAD_INPUT','Links with a user name or password are not allowed');
 const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase();
 if(!allowLocal()){
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal'))throw new ReachError('BAD_INPUT','Local addresses are not allowed');
  if(net.isIPv4(host)&&privateV4(host))throw new ReachError('BAD_INPUT','Private addresses are not allowed');
  if(net.isIPv6(host)&&(host==='::1'||/^f[cd]/.test(host)||host.startsWith('fe80')||host.startsWith('::ffff:')))throw new ReachError('BAD_INPUT','Private addresses are not allowed');
 }
 u.hash='';
 return u.toString();
}

export function hostMatches(url:string,...domains:string[]){
 try{const h=new URL(url.includes('://')?url:'https://'+url).hostname.toLowerCase();return domains.some(d=>h===d||h.endsWith('.'+d));}catch{return false;}
}

/** Browser commands that run code or send files; they need an explicit confirmation. */
export const BROWSE_ACTIONS_NEEDING_CONFIRM=new Set(['eval','upload']);
