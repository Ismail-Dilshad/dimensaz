export function parseScript(script:string):string[]{
 // Keep every code point, including whitespace and styling punctuation, unchanged.
 if(!script.trim())throw new Error('Script is empty.');
 const parts=script.match(/[^\r\n]+(?:\r\n|\r|\n|$)|\r\n|\r|\n/g)||[script];
 const result:string[]=[];
 for(const p of parts){if(p.trim())result.push(p);else if(result.length)result[result.length-1]+=p;else result.push(p);}
 if(result[0]&&!result[0].trim()&&result.length>1)result.splice(0,2,result[0]+result[1]);
 return result;
}

