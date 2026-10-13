/** Public activity summaries only. Never publish commands, tool outputs or reasoning. */
const {StringDecoder}=require('node:string_decoder');
const PHASES=['preparing','connecting','reading','interpreting','validating','packaging','completed'];
function createProgress(){return {phase:'preparing',completedActions:0,lastActivityAt:new Date().toISOString(),events:[]};}
function activity(progress,message,level='info'){
  const at=new Date().toISOString();progress.lastActivityAt=at;
  progress.events.push({at,message,level});progress.events=progress.events.slice(-12);
}
function advance(progress,phase,message){
  if(PHASES.indexOf(phase)>PHASES.indexOf(progress.phase))progress.phase=phase;
  if(message)activity(progress,message);
}
function describeTool(item){
  const hint=(typeof item.command==='string'?item.command:JSON.stringify(item.arguments??{})).slice(0,262144);
  if(/view_image|emitImage|open_image|crops[\\/]/i.test(hint)||/image/i.test(item.tool??''))return {phase:'interpreting',start:'Inspeccionando los recortes del plano.',done:'Inspección visual de recortes realizada.'};
  if(/SKILL\.md|references[\\/]|knowledge[\\/]|references\.json/i.test(hint))return {phase:'reading',start:'Consultando la skill y las referencias.',done:'Consulta de instrucciones y referencias realizada.'};
  return {phase:'interpreting',start:'Ejecutando una herramienta de análisis.',done:'Acción de análisis terminada.'};
}
function eventObserver(progress){
  const completed=new Set();
  return event=>{
    if(event?.type==='thread.started'){activity(progress,'Sesión de Codex iniciada.');return true;}
    if(event?.type==='turn.started'){activity(progress,'El agente ha iniciado la interpretación.');return true;}
    const item=event?.item;
    if(!item||!['item.started','item.completed'].includes(event.type))return false;
    if(item.type==='agent_message'){progress.lastActivityAt=new Date().toISOString();return true;}
    if(!['command_execution','mcp_tool_call'].includes(item.type))return false;
    const description=describeTool(item);
    if(event.type==='item.started'){advance(progress,description.phase,description.start);return true;}
    if(typeof item.id==='string'&&completed.has(item.id))return false;
    if(typeof item.id==='string'&&completed.size<10000)completed.add(item.id);
    const failed=item.status==='failed'||!!item.error||(typeof item.exit_code==='number'&&item.exit_code!==0);
    if(failed)activity(progress,'Una herramienta ha fallado; el agente puede volver a intentarlo.','warning');
    else{progress.completedActions++;advance(progress,description.phase,description.done);}
    return true;
  };
}
/** JSONL may span stdout chunks. Oversized or non-JSON lines are ignored. */
function jsonLineReader(onEvent){
  const decoder=new StringDecoder('utf8');let buffer='',discarding=false;
  function text(chunk){
    for(const part of chunk.split(/(?<=\n)/)){
      if(!discarding)buffer+=part;
      if(buffer.length>262144){buffer='';discarding=true;}
      if(part.endsWith('\n')){
        if(!discarding){try{onEvent(JSON.parse(buffer));}catch{}}
        buffer='';discarding=false;
      }
    }
  }
  return {write:chunk=>text(decoder.write(chunk)),end:()=>{text(decoder.end());if(buffer&&!discarding){try{onEvent(JSON.parse(buffer));}catch{}}buffer='';}};
}
module.exports={createProgress,activity,advance,eventObserver,jsonLineReader};
