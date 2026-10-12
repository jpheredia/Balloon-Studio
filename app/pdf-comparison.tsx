'use client';
import {useEffect,useRef,useState} from 'react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import {newInk,type ComparisonSettings} from '@/lib/pdf-comparison';
export function ComparisonLayer({base,revision,page,settings,width,height}:{base:PDFDocumentProxy;revision:PDFDocumentProxy;page:number;settings:ComparisonSettings;width:number;height:number}) {
 const canvas=useRef<HTMLCanvasElement>(null),[status,setStatus]=useState('');
 useEffect(()=>{
  let cancelled=false;const tasks:{cancel:()=>void}[]=[];setStatus('Comparando…');
  (async()=>{
   const revisionPage=page+settings.pageOffset;
   if(revisionPage<1 || revisionPage>revision.numPages){setStatus('Esta página no tiene una hoja equivalente en la revisión.');return;}
   const basePage=await base.getPage(page),newPage=await revision.getPage(revisionPage);if(cancelled)return;
   const factor=Math.min(2,2200/Math.max(width,height)),vp=basePage.getViewport({scale:factor});
   const oldCanvas=document.createElement('canvas'),newCanvas=document.createElement('canvas');
   oldCanvas.width=newCanvas.width=Math.ceil(vp.width);oldCanvas.height=newCanvas.height=Math.ceil(vp.height);
   const ctx=newCanvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,newCanvas.width,newCanvas.height);
   const a=basePage.render({canvas:oldCanvas,viewport:vp}),b=newPage.render({canvas:newCanvas,viewport:newPage.getViewport({scale:factor*settings.scale}),transform:[1,0,0,1,settings.x*factor,settings.y*factor],background:'rgba(255,255,255,0)'});tasks.push(a,b);
   await Promise.all([a.promise,b.promise]);if(cancelled || !canvas.current)return;
   const target=canvas.current;target.width=newCanvas.width;target.height=newCanvas.height;
   const data=ctx.getImageData(0,0,target.width,target.height);
   if(settings.mode==='changes')data.data.set(newInk(oldCanvas.getContext('2d')!.getImageData(0,0,target.width,target.height).data,data.data,target.width,target.height,settings.threshold));
   else for(let i=0;i<data.data.length;i+=4){const darkness=255-(data.data[i]+data.data[i+1]+data.data[i+2])/3;data.data[i]=220;data.data[i+1]=25;data.data[i+2]=35;data.data[i+3]=darkness;}
   target.getContext('2d')!.putImageData(data,0,0);setStatus('');
  })().catch(e=>{if(!cancelled && e.name!=='RenderingCancelledException')setStatus('No se pudo comparar esta página. '+e.message);});
  return()=>{cancelled=true;tasks.forEach(t=>t.cancel());};
 },[base,revision,page,width,height,settings.pageOffset,settings.x,settings.y,settings.scale,settings.threshold,settings.mode]);
 return <><canvas className="comparison-layer" ref={canvas} style={{opacity:status?0:settings.opacity}} aria-label="Trazos nuevos del PDF de revisión en rojo"/>{status && <span className="comparison-status" role="status">{status}</span>}</>;
}
export function ComparisonControls({settings,page,pages,disabled,onChange,onRemove}:{settings:ComparisonSettings;page:number;pages:number;disabled:boolean;onChange:(s:ComparisonSettings)=>void;onRemove:()=>void}) {
 function numeric(field:'x'|'y'|'scale'|'threshold'|'opacity'|'pageOffset',value:number){if(Number.isFinite(value))onChange({...settings,[field]:value});}
 return <details className="comparison-controls" open><summary>Comparación · {settings.name}</summary><div className="comparison-options"><label><input type="checkbox" checked={settings.visible} disabled={disabled} onChange={e=>onChange({...settings,visible:e.target.checked})}/> Mostrar revisión</label><label>Vista<select value={settings.mode} disabled={disabled} onChange={e=>onChange({...settings,mode:e.target.value as ComparisonSettings['mode']})}><option value="changes">Solo trazos nuevos en rojo</option><option value="overlay">Superponer toda la revisión</option></select></label><label>Hoja de revisión<input type="number" min={1} max={pages} value={page+settings.pageOffset} disabled={disabled} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=pages)numeric('pageOffset',n-page);}}/></label><label>Desplazamiento X<input type="number" min={-10000} max={10000} step={.5} value={settings.x} disabled={disabled} onChange={e=>numeric('x',Math.max(-10000,Math.min(10000,Number(e.target.value))))}/></label><label>Desplazamiento Y<input type="number" min={-10000} max={10000} step={.5} value={settings.y} disabled={disabled} onChange={e=>numeric('y',Math.max(-10000,Math.min(10000,Number(e.target.value))))}/></label><label>Escala (%)<input type="number" min={10} max={1000} step={.1} value={Math.round(settings.scale*1000)/10} disabled={disabled} onChange={e=>numeric('scale',Math.max(.1,Math.min(10,Number(e.target.value)/100)))}/></label><label>Umbral<input type="range" min={1} max={160} value={settings.threshold} disabled={disabled} onChange={e=>numeric('threshold',Number(e.target.value))}/></label><label>Intensidad del rojo<input type="range" min={0} max={1} step={.05} value={settings.opacity} disabled={disabled} onChange={e=>numeric('opacity',Number(e.target.value))}/></label><button disabled={disabled} onClick={()=>onChange({...settings,x:0,y:0,scale:1})}>Restablecer alineación</button><button disabled={disabled} onClick={onRemove}>Quitar revisión</button></div><p>El PDF abierto es la base. Rojo: tinta nueva de la revisión. Ajusta la alineación si las hojas se han desplazado; los trazos eliminados permanecen en la base.</p></details>;
}
