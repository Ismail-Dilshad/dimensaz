// `pnpm tempoloom mcp`: Tempoloom's tools for any agent that speaks the Model Context Protocol
// (Claude Code, Codex, Gemini CLI, or a desktop app). A small stdio server: one JSON-RPC message
// per line in, one per line out. Anything the tools print goes to stderr, never to the protocol.
import readline from 'node:readline';
import {TOOLS,schemaOf,callTool} from '../engine/agent-tools.js';

const VERSIONS=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const log=console.log;console.log=(...a:unknown[])=>console.error(...a);
const send=(m:unknown)=>process.stdout.write(JSON.stringify(m)+'\n');
type Msg={jsonrpc:'2.0';id?:number|string|null;method?:string;params?:Record<string,unknown>};

async function handle(m:Msg){
 const reply=(result:unknown)=>m.id!==undefined&&send({jsonrpc:'2.0',id:m.id,result});
 const fail=(code:number,message:string)=>m.id!==undefined&&send({jsonrpc:'2.0',id:m.id,error:{code,message}});
 switch(m.method){
  case 'initialize':{const asked=String(m.params?.protocolVersion??'');
   return reply({protocolVersion:VERSIONS.includes(asked)?asked:VERSIONS[0],capabilities:{tools:{listChanged:false}},
    serverInfo:{name:'tempoloom',title:'Tempoloom studio',version:'9.8.0'},
    instructions:'Tempoloom runs every video as a studio job. Start each task with studio_start, say what you are doing with studio_say, finish with studio_done. Only the user approves gates.'});}
  case 'notifications/initialized':case 'notifications/cancelled':return;
  case 'ping':return reply({});
  case 'tools/list':return reply({tools:TOOLS.map(t=>({name:t.name,description:t.description,inputSchema:schemaOf(t)}))});
  case 'tools/call':{
   const name=String(m.params?.name??'');
   if(!TOOLS.some(t=>t.name===name))return fail(-32602,'Unknown tool: '+name);
   try{const out=await callTool(name,m.params?.arguments);return reply({content:[{type:'text',text:typeof out==='string'?out:JSON.stringify(out,null,1)}],isError:false});}
   catch(e){return reply({content:[{type:'text',text:(e as Error).message}],isError:true});}
  }
  default:if(m.id!==undefined)return fail(-32601,'Method not found: '+m.method);
 }
}

if(process.argv[2]==='help'||process.argv[2]==='--help'){log(`Usage: tempoloom mcp

Serves Tempoloom's studio tools over MCP (stdio). Add it to your agent, for example in Claude Code:
  claude mcp add tempoloom -- pnpm --silent tempoloom mcp
Tools: ${TOOLS.map(t=>t.name).join(', ')}`);process.exit(0);}
const rl=readline.createInterface({input:process.stdin});
rl.on('line',line=>{if(!line.trim())return;let m:Msg;try{m=JSON.parse(line) as Msg;}catch{return send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});}
 void handle(m).catch(e=>m.id!==undefined&&send({jsonrpc:'2.0',id:m.id,error:{code:-32603,message:(e as Error).message}}));});
