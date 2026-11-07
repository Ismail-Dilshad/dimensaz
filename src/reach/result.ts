// One result shape for every reach command, and the error codes agents branch on.
// Ported from Agent Reach (runtime/result.py): {schema_version, ok, channel, action,
// backend, items, meta, error}. Agents never need to parse upstream tool output.
import {scrubSecrets} from './safety.js';

export const SCHEMA_VERSION=1;
export const codes=['NEED_SETUP','NEED_LOGIN','UPSTREAM_BROKEN','TIMEOUT','RATE_LIMITED','PLATFORM_BLOCKED','NOT_FOUND','BAD_INPUT','BUSY'] as const;
export type Code=typeof codes[number];
/** Codes where trying another backend cannot help. */
export const FINAL_CODES=new Set<Code>(['NOT_FOUND','BAD_INPUT','PLATFORM_BLOCKED','RATE_LIMITED','NEED_LOGIN','BUSY']);

export const DEFAULT_HINTS:Record<Code,string>={
 BUSY:'The shared browser stayed full while this command waited in line, or a login window is open. Retry later; do not switch accounts.',
 PLATFORM_BLOCKED:'Stop automation for this site. The user must clear the verification on the site themselves. Do not switch backends or retry.',
 NEED_SETUP:'A tool is missing. Run `pnpm dimensaz reach doctor` and follow its steps.',
 NEED_LOGIN:'Not logged in. Run `pnpm dimensaz reach login <channel>` and ask the user to log in in the window it opens. Never ask for a password and never log in for them.',
 UPSTREAM_BROKEN:'This platform is not working right now; `message` says what was reported. Tell the user which platform has a problem; suggest `pnpm dimensaz reach update` only if the message points to an outdated tool. Do not retry in a loop.',
 TIMEOUT:'The operation timed out. Check `pnpm dimensaz reach doctor`; do not repeat the request in a loop.',
 RATE_LIMITED:'The platform reported a rate limit. This channel is paused; wait retry_after_seconds and do not switch backends.',
 NOT_FOUND:'The requested content does not exist. Check the link or id.',
 BAD_INPUT:'Invalid arguments. Run `pnpm dimensaz reach channels` to see valid usage.',
};

export class ReachError extends Error{
 constructor(public code:Code,message:string,public hint?:string,public retryAfter?:number){super(message);}
}

export type Item={title:string|null;url:string|null;author:string|null;published_at:string|null;text:string|null;raw?:unknown};
export const makeItem=(i:Partial<Item>):Item=>({title:i.title||null,url:i.url||null,author:i.author||null,published_at:i.published_at||null,text:i.text||null,raw:i.raw});
export const unixToIso=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)&&n>0?new Date(n*1000).toISOString().replace(/\.\d{3}Z$/,'Z'):null;};

const clean=(t:unknown)=>scrubSecrets(String(t??'')).trim().slice(0,500);

/** Maps any thrown value to a ReachError. */
export function classify(e:unknown):ReachError{
 if(e instanceof ReachError)return e;
 const err=e as {name?:string;code?:string;message?:string;status?:number;cause?:{code?:string}};
 const msg=clean(err?.message??e);
 if(err?.status===404)return new ReachError('NOT_FOUND','HTTP 404');
 if(err?.status===429)return new ReachError('RATE_LIMITED','HTTP 429');
 if(err?.name==='TimeoutError'||err?.name==='AbortError'||err?.code==='ETIMEDOUT'||/timed out/i.test(msg))return new ReachError('TIMEOUT','upstream did not answer in time');
 if(err?.code==='ENOENT')return new ReachError('NEED_SETUP','missing executable: '+msg);
 if(err?.cause?.code)return new ReachError('UPSTREAM_BROKEN','network error: '+err.cause.code);
 return new ReachError('UPSTREAM_BROKEN',msg||'unknown error');
}

export type Attempt={backend:string;result:string;message?:string;skipped?:boolean;retry_after_seconds?:number};
export function envelope(o:{channel:string|null;action:string|null;backend?:string|null;items?:Item[];elapsedMs:number;attempts?:Attempt[];error?:ReachError|null;note?:string}){
 const error=o.error??null;
 return {schema_version:SCHEMA_VERSION,ok:!error,channel:o.channel,action:o.action,backend:error?null:o.backend??null,
  items:error?[]:o.items??[],meta:{elapsed_ms:o.elapsedMs,attempts:o.attempts??[],...(o.note?{note:o.note}:{})},
  error:error?{code:error.code,message:clean(error.message),hint:error.hint||DEFAULT_HINTS[error.code],...(error.retryAfter?{retry_after_seconds:error.retryAfter}:{})}:null};
}
export type Envelope=ReturnType<typeof envelope>;
