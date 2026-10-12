export type Point = { x: number; y: number };
export type Region = { kind: 'rectangle' | 'freehand'; points: Point[] };
export type ResizeHandle = 'move'|'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw';
export function editRegion(region:Region,handle:ResizeHandle,dx:number,dy:number,pageWidth:number,pageHeight:number):Region {
 const b=bounds([region]);let x=b.x,y=b.y,right=x+b.width,bottom=y+b.height;
 if(handle==='move'){dx=Math.max(-x,Math.min(pageWidth-right,dx));dy=Math.max(-y,Math.min(pageHeight-bottom,dy));return {...region,points:region.points.map(p=>({x:p.x+dx,y:p.y+dy}))};}
 const minW=Math.min(2,b.width),minH=Math.min(2,b.height);
 if(handle.includes('w'))x=Math.max(0,Math.min(right-minW,x+dx));
 if(handle.includes('e'))right=Math.min(pageWidth,Math.max(x+minW,right+dx));
 if(handle.includes('n'))y=Math.max(0,Math.min(bottom-minH,y+dy));
 if(handle.includes('s'))bottom=Math.min(pageHeight,Math.max(y+minH,bottom+dy));
 return {...region,points:region.points.map(p=>({x:x+(p.x-b.x)*(right-x)/b.width,y:y+(p.y-b.y)*(bottom-y)/b.height}))};
}
export function leaderAnchor(z: {x:number;y:number;width:number;height:number;bx:number;by:number}): Point {
 return { x:z.bx>=z.x+z.width/2?z.x+z.width:z.x, y:z.by>z.y+z.height/2?z.y+z.height:z.y };
}
export function balloonRadii(label:string|number,fontSize=13) { const scale=fontSize/13;return {rx:Math.max(14,String(label).length*3.7+6)*scale,ry:14*scale}; }
export function rectangle(a: Point, b: Point): Region {
 const x = Math.min(a.x,b.x), y = Math.min(a.y,b.y), right = Math.max(a.x,b.x), bottom = Math.max(a.y,b.y);
 return { kind:'rectangle', points:[{x,y},{x:right,y},{x:right,y:bottom},{x,y:bottom}] };
}
export function bounds(regions: Region[]) {
 let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;
 for (const r of regions) for (const p of r.points) { x=Math.min(x,p.x); y=Math.min(y,p.y); right=Math.max(right,p.x); bottom=Math.max(bottom,p.y); }
 return { x,y,width:right-x,height:bottom-y };
}
export function regionsOf(z: { regions?: Region[]; x:number;y:number;width:number;height:number }): Region[] {
 return z.regions || [rectangle({x:z.x,y:z.y},{x:z.x+z.width,y:z.y+z.height})];
}
export function maskCrop(ctx: CanvasRenderingContext2D, source: CanvasImageSource, regions: Region[], rect: {x:number;y:number}, scale: number, width: number, height: number) {
 ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height);
 // Each region is clipped separately. Overlaps form a union regardless of winding.
 for (const region of regions) {
  ctx.save(); ctx.beginPath(); region.points.forEach((p,i) => { const x=(p.x-rect.x)*scale,y=(p.y-rect.y)*scale; if (!i) ctx.moveTo(x,y); else ctx.lineTo(x,y); }); ctx.closePath(); ctx.clip('evenodd'); ctx.drawImage(source,0,0); ctx.restore();
 }
}
