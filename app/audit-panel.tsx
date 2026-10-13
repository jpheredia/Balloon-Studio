'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Play,Plug,Download,Upload,Check,ExternalLink,Square,AlertTriangle} from 'lucide-react';
import {AUDIT_CLASSIFICATIONS,auditFields,auditCounts,recordReview,assertAuditMatches,validateInterpretation,type AuditState,type Interpretation,type JobSettings} from '@/lib/audit';
import {readAgentPackage} from '@/lib/agent-package';
import AgentProgress,{type AgentJob} from './agent-progress';

const BRIDGE='http://127.0.0.1:4318';
type Job=AgentJob;
type Props={project:any;disabled:boolean;getPackage:(settings:JobSettings)=>Promise<{bytes:Uint8Array}>;onAudit:(audit:AuditState)=>void;onLocate:(id:string)=>void;onExport:()=>void};
function download(bytes:Uint8Array,name:string){const url=URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>],{type:'application/zip'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function bridgeFetch(route:string,token:string,options:RequestInit={}){
 const res=await fetch(BRIDGE+route,{...options,headers:{...options.headers,Authorization:'Bearer '+token},signal:options.signal ?? AbortSignal.timeout(15000)});
 if(!res.ok){let error='El servicio local no pudo completar la operación.';try{const detail=await res.json() as {error?:unknown};if(typeof detail.error==='string')error=detail.error;}catch{}throw new Error(error);}
 return res;
}
const displayFields:[keyof Interpretation,string,boolean][]=[['transcription','Transcripción visual',true],['description','Descripción interpretada',true],['specification','Especificación',false],['gdtCallout','GD&T',false],['unit','Unidad',false],['coordinateValue','Valor de coordenada',false],['ruleApplied','Reglas y referencias utilizadas',true]];
type AuditFilter='all'|'pending'|'flagged'|'corrected';
function filteredRows(audit:AuditState,filter:AuditFilter){return audit.response.characteristics.filter(r=>filter==='all'||(filter==='pending'?!audit.reviews[r.balloonId]:filter==='corrected'?audit.reviews[r.balloonId]?.decision==='corrected':auditFields(audit,r.balloonId)?.manualReview));}

export default function AuditPanel({project,disabled,getPackage,onAudit,onLocate,onExport}:Props){
 const [token,setToken]=useState(''),[connected,setConnected]=useState(false),[connecting,setConnecting]=useState(false);
 const [progressSupported,setProgressSupported]=useState<boolean|null>(null);
 const [unit,setUnit]=useState(''),[toleranceMode,setToleranceMode]=useState(''),[tolerance,setTolerance]=useState('');
 const [job,setJob]=useState<Job|null>(null),[working,setWorking]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [selected,setSelected]=useState(''),[filter,setFilter]=useState<AuditFilter>('all'),[draft,setDraft]=useState<Interpretation|null>(null),[draftDirty,setDraftDirty]=useState(false),[reviewNote,setReviewNote]=useState('');
 const [stale,setStale]=useState<boolean|null>(null);
 const importInput=useRef<HTMLInputElement>(null),projectRef=useRef(project),result=useRef<Uint8Array|null>(null),appliedJob=useRef('');projectRef.current=project;
 const audit:AuditState|undefined=project.audit;
 const activeJob=!!job && ['preparing','running'].includes(job.status);
 const counts=audit?auditCounts(audit):null;
 useEffect(()=>{setToken(sessionStorage.getItem('balloon.bridge.token')??'');const saved=sessionStorage.getItem('balloon.bridge.job');if(saved)try{setJob(JSON.parse(saved));}catch{}},[]);
 useEffect(()=>{if(job)sessionStorage.setItem('balloon.bridge.job',JSON.stringify(job));},[job]);
 useEffect(()=>{let live=true;setStale(null);if(!audit){setStale(false);return;}assertAuditMatches(audit,project).then(()=>{if(live)setStale(false);}).catch(()=>{if(live)setStale(true);});return()=>{live=false;};},[audit,project]);
 useEffect(()=>{
  if(!audit){setSelected('');setDraft(null);setDraftDirty(false);return;}
  const rows=filteredRows(audit,filter);
  const id=rows.some(r=>r.balloonId===selected)?selected:rows[0]?.balloonId;
  setSelected(id??'');setDraft(id?structuredClone(auditFields(audit,id)!):null);setReviewNote(id?audit.reviews[id]?.note??'':'');setDraftDirty(false);
 },[audit]); // A committed review refreshes the form; the original agent response stays unchanged.
 useEffect(()=>{
  if(!connected || !job || !['preparing','running','completed'].includes(job.status) || appliedJob.current===job.id)return;
  const lifecycle=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function poll(){
   try{
    const status:Job=await (await bridgeFetch('/jobs/'+job!.id,token,{signal:lifecycle.signal})).json();
    if(lifecycle.signal.aborted)return;setJob(old=>JSON.stringify(old)===JSON.stringify(status)?old:status);
    if(status.status==='completed'){
     const bytes=new Uint8Array(await (await bridgeFetch('/jobs/'+status.id+'/result',token,{signal:lifecycle.signal})).arrayBuffer());
     if(lifecycle.signal.aborted)return;result.current=bytes;appliedJob.current=status.id;
     try{const next=await readAgentPackage(bytes,projectRef.current);if(!lifecycle.signal.aborted){onAudit(next);setNotice('Resultado recibido. Revisa cada interpretación antes de guardar la auditoría final.');}}
     catch(e:any){setError(e.message+' Puedes descargar el ZIP para abrir su proyecto original.');}
    }else if(['preparing','running'].includes(status.status))timer=setTimeout(poll,4000);
    else if(status.status==='failed')setError(status.message);
   }catch(e:any){if(!lifecycle.signal.aborted){setError('No se pudo consultar el trabajo: '+e.message);setConnected(false);}}
  }
  void poll();return()=>{lifecycle.abort();clearTimeout(timer);};
 },[connected,job?.id,job?.status,token]);
 async function connect(){setConnecting(true);setError('');try{const health=await (await bridgeFetch('/health',token)).json() as {version?:unknown;auth?:unknown;features?:unknown};if(health.version!==1 || health.auth!=='chatgpt')throw new Error('El servicio no usa el contrato o la autenticación esperados.');sessionStorage.setItem('balloon.bridge.token',token);setProgressSupported(Array.isArray(health.features)&&health.features.includes('job-progress'));setConnected(true);setNotice('Servicio local conectado con tu sesión de ChatGPT.');}catch(e:any){setConnected(false);setError('No se pudo conectar. Inicia el servicio local, revisa el código y permite el acceso a la red local si tu navegador lo solicita. '+e.message);}finally{setConnecting(false);}}
 async function start(){
  setWorking(true);setError('');setNotice('');
  try{
   if(audit && !window.confirm('El nuevo resultado sustituirá la auditoría visible. El ZIP del trabajo anterior seguirá disponible en el servicio local. ¿Ejecutar de nuevo?'))return;
   const settings:JobSettings={unit:unit as JobSettings['unit'],generalToleranceMode:toleranceMode as JobSettings['generalToleranceMode'],generalTolerance:toleranceMode==='specified'?tolerance:''};
   const {bytes}=await getPackage(settings);
   const next:Job=await (await bridgeFetch('/jobs',token,{method:'POST',headers:{'Content-Type':'application/zip'},body:bytes as Uint8Array<ArrayBuffer>,signal:AbortSignal.timeout(120000)})).json();
   appliedJob.current='';result.current=null;setJob(next);
  }catch(e:any){setError(e.message);}finally{setWorking(false);}
 }
 async function cancel(){if(!job)return;try{setJob(await (await bridgeFetch('/jobs/'+job.id+'/cancel',token,{method:'POST'})).json());}catch(e:any){setError(e.message);}}
 async function downloadResult(){try{let bytes=result.current;if(!bytes && job?.status==='completed')bytes=new Uint8Array(await (await bridgeFetch('/jobs/'+job.id+'/result',token)).arrayBuffer());if(bytes)download(bytes,project.name.replace(/\.pdf$/i,'')+'.interpreted.zip');}catch(e:any){setError(e.message);}}
 async function importResult(file?:File){if(!file)return;setWorking(true);setError('');try{const bytes=new Uint8Array(await file.arrayBuffer());const next=await readAgentPackage(bytes,projectRef.current);result.current=bytes;onAudit(next);setNotice('ZIP interpretado importado. Las decisiones humanas están pendientes.');}catch(e:any){setError(e.message);}finally{setWorking(false);if(importInput.current)importInput.current.value='';}}
 function selectRow(id:string){if(draftDirty && !window.confirm('Hay cambios de auditoría sin guardar. ¿Descartarlos y cambiar de balloon?'))return false;setSelected(id);setDraft(id?structuredClone(auditFields(audit!,id)!):null);setReviewNote(id?audit!.reviews[id]?.note??'':'');setDraftDirty(false);setError('');return true;}
 function changeFilter(next:AuditFilter){if(!audit)return;const rows=filteredRows(audit,next);if(!rows.some(r=>r.balloonId===selected)&&!selectRow(rows[0]?.balloonId??''))return;setFilter(next);}
 function changeField(key:keyof Interpretation,value:string|boolean){if(draft){setDraft({...draft,[key]:value,...(key==='manualReview' && value===false?{reviewReason:''}:{})});setDraftDirty(true);}}
 function review(correct:boolean){if(!audit || !draft)return;setError('');try{validateInterpretation(draft);if(!correct && draftDirty)throw new Error('Guarda tus correcciones antes de aceptar.');if(draft.manualReview)throw new Error('Resuelve la incidencia y desmarca «Requiere revisión» para validar este balloon.');onAudit(recordReview(audit,selected,correct?draft:null,reviewNote));setNotice('Balloon '+(project.zones.find((z:any)=>z.id===selected)?.number??selected)+' revisado.');}catch(e:any){setError(e.message);}}
 const visible=audit?filteredRows(audit,filter):[];
 const zone=project.zones.find((z:any)=>z.id===selected);
 const original=audit?.response.characteristics.find(r=>r.balloonId===selected);
 const canStart=connected && !!project.id && !!project.zones.length && !!unit && !!toleranceMode && (toleranceMode!=='specified'||!!tolerance.trim()) && !disabled && !working && !activeJob;
 return <section className="audit-panel" aria-label="Auditoría final de la inspección">
  <div className="audit-setup">
   <div className="audit-title"><div><h1>Interpretación y auditoría</h1><p>Recortes originales, resultado del agente y revisión humana.</p></div><span className={'bridge-status '+(connected?'connected':'')}>{connected?'Conectado · ChatGPT':'Servicio local desconectado'}</span></div>
   <details className="audit-run-setup" open={!audit||activeJob}><summary>Configuración del agente y unidades de trabajo</summary><details className="bridge-setup" open={!connected}><summary>Conexión con Balloon Expert local</summary><p>En tu ordenador, inicia <code>npm run agent:bridge</code> desde Balloon Studio. Mantén esa terminal abierta y pega su código de conexión.</p><div><label>Código de conexión<input type="password" value={token} onChange={e=>{setToken(e.target.value.trim());setConnected(false);}} autoComplete="off" spellCheck={false} disabled={activeJob}/></label><Button variant="outline" disabled={!token||connecting||activeJob} onClick={connect}><Plug/>{connecting?'Conectando…':'Conectar'}</Button></div><small>Los archivos se envían al servicio de este ordenador. Codex interpreta con tu sesión de ChatGPT y consume su cuota; no se configura una clave de API.</small><p>Si tu navegador bloquea el acceso a la red local desde Vercel, puedes usar <a href={BRIDGE} target="_blank" rel="noopener noreferrer">Balloon Studio local</a>, con el mismo editor y auditoría.</p></details>
   <AgentProgress job={job} connected={connected} supported={progressSupported} preparing={working}/>
   <div className="audit-job-settings"><label>Unidad principal<select value={unit} onChange={e=>setUnit(e.target.value)} disabled={activeJob}><option value="">Confirmar unidad…</option><option value="mm">Milímetros (mm)</option><option value="in">Pulgadas (in)</option></select></label><label>Tolerancia general<select value={toleranceMode} onChange={e=>setToleranceMode(e.target.value)} disabled={activeJob}><option value="">Confirmar criterio…</option><option value="none">No aplicar tolerancia general</option><option value="drawing">Leer del plano, cuando sea aplicable</option><option value="specified">Usar una tolerancia indicada</option></select></label>{toleranceMode==='specified' && <label>Regla de tolerancia<input value={tolerance} onChange={e=>setTolerance(e.target.value)} maxLength={2000} placeholder="Regla y ámbito de aplicación" disabled={activeJob}/></label>}<Button onClick={start} disabled={!canStart}><Play/>{working?'Preparando…':'Interpretar con agente'}</Button></div>
   </details><div className="audit-transport"><Button variant="outline" onClick={()=>importInput.current?.click()} disabled={!project.id||working||disabled}><Upload/>Cargar ZIP interpretado</Button><input hidden ref={importInput} type="file" accept=".zip,application/zip" onChange={e=>importResult(e.target.files?.[0])}/>{job?.status==='completed' && <Button variant="outline" onClick={downloadResult} disabled={!result.current&&!connected}><Download/>Descargar respuesta del agente</Button>}{audit && <Button onClick={onExport} disabled={disabled||working||stale!==false||!!counts?.pending||!!counts?.flagged||draftDirty}><Download/>Guardar auditoría final</Button>}</div>
   {job && <div className={'audit-job-state '+job.status} role="status"><span>{job.message}</span>{activeJob && <Button size="sm" variant="outline" onClick={cancel}><Square/>Cancelar trabajo</Button>}</div>}
   {error && <p className="audit-error" role="alert">{error}</p>}{notice && <p className="audit-notice" role="status">{notice}</p>}
   {stale && <p className="audit-error" role="alert"><AlertTriangle size={15}/> El plano, sus metadatos o sus recortes han cambiado. Conservamos el resultado anterior como referencia; vuelve a interpretar antes de cerrar la auditoría.</p>}
   {counts && <div className="audit-counts" role="group" aria-label="Filtrar interpretaciones">{([['all',counts.total,'interpretados'],['pending',counts.pending,'pendientes de revisión'],['flagged',counts.flagged,'con incidencias'],['corrected',counts.corrected,'corregidos']] as const).map(([value,count,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>changeFilter(value)}><strong>{count}</strong> {label}</button>)}</div>}
  </div>
  {!audit?<div className="audit-empty"><Check size={28}/><h2>La inspección está lista para su siguiente paso</h2><p>Confirma las unidades y tolerancias, conecta el servicio local y ejecuta el agente.<br/>Después podrás contrastar cada interpretación con su recorte y corregirla.</p><small>{project.zones.length} balloons preparados en el proyecto actual.</small></div>:<div className="audit-review-layout">
   <aside className="audit-row-list"><label>Mostrar<select value={filter} onChange={e=>changeFilter(e.target.value as AuditFilter)}><option value="all">Todos los balloons</option><option value="pending">Pendientes de revisión</option><option value="flagged">Con incidencias</option><option value="corrected">Corregidos</option></select></label><div>{visible.map(r=>{const z=project.zones.find((v:any)=>v.id===r.balloonId),fields=auditFields(audit,r.balloonId)!,decision=audit.reviews[r.balloonId]?.decision;return <button type="button" key={r.balloonId} className={'audit-row '+(selected===r.balloonId?'selected ':'')+(fields.manualReview?'flagged':!decision?'pending':'')} onClick={()=>selectRow(r.balloonId)} aria-pressed={selected===r.balloonId}><span className="audit-row-number">{z?.number??audit.request.balloons.find(b=>b.id===r.balloonId)?.number}</span><span><strong>{fields.classification}</strong><small>Pág. {z?.page??'—'} · {fields.manualReview?'Incidencia':decision==='corrected'?'Corregido':decision==='accepted'?'Revisado':'Pendiente'}</small></span>{fields.manualReview&&<AlertTriangle className="audit-row-warning" size={15} aria-label="Con incidencia"/>}{z && <img src={z.crop} alt={'Recorte del balloon '+z.number}/>}</button>;})}{!visible.length && <p className="audit-list-empty">No hay balloons con este filtro.</p>}</div></aside>
   <div className="audit-record">{!visible.length&&<p className="audit-list-empty">Selecciona otro filtro para continuar la revisión.</p>}{draft && original && <>
    <div className="audit-record-heading"><div><h2>Balloon {zone?.number??audit.request.balloons.find(b=>b.id===selected)?.number}</h2><span>{zone?'Página '+zone.page:'Elemento fuera del proyecto actual'} · {selected}</span></div><Button variant="outline" onClick={()=>onLocate(selected)} disabled={!zone}><ExternalLink/>Ver en plano</Button></div>
    <div className="audit-evidence">{zone?<img src={zone.crop} alt={'Evidencia original del balloon '+zone.number}/>:<p>El recorte original ya no está en este proyecto.</p>}<span>Recorte original · evidencia sin modificar</span></div>
    <div className="audit-fields"><label>Clasificación<select value={draft.classification} onChange={e=>changeField('classification',e.target.value)} disabled={stale!==false}>{AUDIT_CLASSIFICATIONS.map(c=><option key={c}>{c}</option>)}</select></label>{displayFields.filter(([key])=>key!=='coordinateValue'||zone?.type==='coordinate').map(([key,label,multiline])=><label key={key} className={multiline?'wide':''}>{label}{multiline?<textarea value={String(draft[key])} onChange={e=>changeField(key,e.target.value)} maxLength={20000} rows={key==='ruleApplied'?2:3} disabled={stale!==false}/>:<input value={String(draft[key])} onChange={e=>changeField(key,e.target.value)} maxLength={20000} disabled={stale!==false}/>}</label>)}
    <label className="audit-review-check wide"><input type="checkbox" checked={draft.manualReview} onChange={e=>changeField('manualReview',e.target.checked)} disabled={stale!==false}/> Requiere revisión</label>{draft.manualReview && <label className="wide">Motivo y comprobación necesaria<textarea value={draft.reviewReason} onChange={e=>changeField('reviewReason',e.target.value)} rows={2} maxLength={20000} disabled={stale!==false}/></label>}<label className="wide">Nota del revisor<textarea value={reviewNote} onChange={e=>{setReviewNote(e.target.value);setDraftDirty(true);}} rows={2} maxLength={20000} disabled={stale!==false}/></label></div>
    <div className="audit-review-actions"><Button variant="outline" disabled={stale!==false||draftDirty||draft.manualReview||!!audit.reviews[selected]} onClick={()=>review(false)}><Check/>Aceptar interpretación</Button><Button disabled={stale!==false||!draftDirty||draft.manualReview} onClick={()=>review(true)}><Check/>Guardar corrección y validar</Button><span>{audit.reviews[selected]?.decision==='corrected'?'Corrección humana guardada':audit.reviews[selected]?'Interpretación revisada':'Pendiente de revisión humana'}</span></div>
    <details className="audit-original"><summary>Respuesta original del agente</summary><dl>{(['transcription','classification','description','specification','gdtCallout','unit','coordinateValue','ruleApplied','manualReview','reviewReason'] as const).map(key=><div key={key}><dt>{key}</dt><dd>{String(original[key])||'—'}</dd></div>)}</dl></details>
   </>}</div>
  </div>}
 </section>;
}
