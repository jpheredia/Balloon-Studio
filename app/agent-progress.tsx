'use client';
import {useEffect,useState} from 'react';
import {Activity,Check,LoaderCircle} from 'lucide-react';
const phases=[['preparing','Preparación'],['connecting','Conexión'],['reading','Referencias'],['interpreting','Interpretación'],['validating','Validación'],['packaging','ZIP'],['completed','Listo']] as const;
export type AgentJob={id:string;status:'preparing'|'running'|'completed'|'failed'|'cancelled';message:string;createdAt?:string;updatedAt?:string;progress?:{phase:string;completedActions:number;lastActivityAt:string;events:{at:string;message:string;level:'info'|'warning'}[]}};
const elapsed=(start:number,end:number)=>{const seconds=Math.max(0,Math.floor((end-start)/1000));return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
export default function AgentProgress({job,connected,supported,preparing}:{job:AgentJob|null;connected:boolean;supported:boolean|null;preparing:boolean}){
 const [now,setNow]=useState(Date.now());
 const active=!!job&&['preparing','running'].includes(job.status);
 useEffect(()=>{setNow(Date.now());if(!active)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active,job?.id]);
 const progress=job?.progress;
 const current=phases.findIndex(([id])=>id===progress?.phase);
 const end=active?now:Date.parse(job?.updatedAt??'');
 const start=Date.parse(job?.createdAt??'');
 const since=progress?Math.max(0,Math.floor((now-Date.parse(progress.lastActivityAt))/1000)):0;
 return <section className={'agent-progress '+(active?'active ':'')+(job?.status??'idle')} aria-label="Seguimiento del agente">
  <div className="agent-progress-heading"><h2><Activity size={15}/>Actividad del agente</h2>{active?<span className="agent-live"><LoaderCircle size={13}/> {connected?'En ejecución':'Sin conexión'}</span>:<span>{preparing?'Preparando envío…':job?.status==='completed'?'Terminado':job?.status==='failed'?'Trabajo detenido':job?.status==='cancelled'?'Cancelado':'Sin trabajo en curso'}</span>}</div>
  {connected&&supported===false&&<p className="agent-progress-warning">Para ver la actividad detallada, reinicia el servicio local con Ctrl + C y <code>npm run agent:bridge</code>, y conecta su nuevo código. Espera a que termine cualquier trabajo activo antes de reiniciar.</p>}
  {!job?<p className="agent-progress-idle">{preparing?'Preparando el plano y los recortes para enviarlos al servicio local.':'Al pulsar «Interpretar con agente», verás aquí las fases y las últimas acciones.'}</p>:<>
   {progress&&<ol className="agent-phases" aria-label="Fases del trabajo">{phases.map(([id,label],i)=><li key={id} data-state={i<current||job.status==='completed'?'done':i===current?'current':'waiting'} aria-current={i===current&&active?'step':undefined}>{i<current||job.status==='completed'?<Check size={12}/>:<span className="agent-phase-dot"/>}{label}</li>)}</ol>}
   <div className="agent-progress-meta"><span>{Number.isFinite(start)&&Number.isFinite(end)?<>Tiempo transcurrido <strong>{elapsed(start,end)}</strong></>:'Tiempo no disponible para este trabajo'}</span>{progress&&<span><strong>{progress.completedActions}</strong> acciones completadas</span>}{active&&progress&&connected&&Number.isFinite(since)&&<span>Última actividad hace {since} s</span>}</div>
   {progress?.events.length?<ol className="agent-activity-log" aria-label="Últimas acciones del agente">{[...progress.events].reverse().map((event,i)=><li key={event.at+':'+i} className={event.level}><time dateTime={event.at}>{new Date(event.at).toLocaleTimeString('es-ES')}</time><span>{event.message}</span></li>)}</ol>:<p className="agent-progress-idle">{job.message}</p>}
   {active&&<p className="agent-progress-footnote">{connected?'La actividad se actualiza cada 4 segundos. Algunas acciones pueden tardar sin emitir eventos.':'Se muestra la última actividad recibida. Reconecta el servicio para actualizarla.'}</p>}
  </>}
 </section>;
}
