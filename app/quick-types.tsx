'use client';
import {useLayoutEffect,useState,type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {Button} from '@/components/ui/button';
import {BALLOON_TYPES,type BalloonType} from '@/lib/balloon-types';

export default function QuickTypes({getAnchor,viewport,count,value,onChange,disabled}:{getAnchor:()=>HTMLElement|null;viewport:RefObject<HTMLDivElement|null>;count:number;value:BalloonType|null;onChange:(type:BalloonType)=>void;disabled:boolean}) {
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 useLayoutEffect(()=>{
  const anchor=getAnchor();
  if(!anchor){setPosition(null);return;}
  const place=()=>{const r=anchor.getBoundingClientRect(),v=viewport.current?.getBoundingClientRect();if(!v || r.right<v.left || r.left>v.right || r.bottom<v.top || r.top>v.bottom){setPosition(null);return;}
   const width=Math.min(310,window.innerWidth-16),height=150;
   const left=Math.max(8,Math.min(r.left,Math.min(v.right,window.innerWidth)-width-8));
   const below=r.bottom+12;
   const top=below+height<Math.min(v.bottom,window.innerHeight)?below:Math.max(v.top+4,r.top-height-12);
   setPosition(old=>old?.left===left && old.top===top?old:{left,top});};
  place();window.addEventListener('scroll',place,true);window.addEventListener('resize',place);
  const observer=new ResizeObserver(place);observer.observe(anchor);if(viewport.current)observer.observe(viewport.current);
  return()=>{window.removeEventListener('scroll',place,true);window.removeEventListener('resize',place);observer.disconnect();};
 });
 if(!position || disabled)return null;
 return createPortal(<div className="quick-types" style={position} role="toolbar" aria-label="Cambiar tipo de los balloons seleccionados" onPointerDown={e=>e.stopPropagation()}>
  <span>{count>1?`${count} balloons seleccionados`:'Tipo de balloon'}</span>
  <div>{Object.entries(BALLOON_TYPES).map(([type,label])=><Button key={type} size="sm" variant={value===type?'default':'ghost'} aria-pressed={value===type} onClick={()=>onChange(type as BalloonType)}>{label}</Button>)}</div>
 </div>,document.body);
}
