import {bounds,maskCrop,type Region} from './geometry';
export async function renderRegions(pdf:any,page:number,regions:Region[],createCanvas:()=>HTMLCanvasElement=()=>document.createElement('canvas')) {
 const rect=bounds(regions),pg=await pdf.getPage(page),v=pg.getViewport({scale:1});
 const a=v.convertToPdfPoint(rect.x,rect.y),b=v.convertToPdfPoint(rect.x+rect.width,rect.y+rect.height);
 const scale=Math.min(3,4096/Math.max(rect.width,rect.height)),raw=createCanvas();raw.width=Math.max(1,Math.ceil(rect.width*scale));raw.height=Math.max(1,Math.ceil(rect.height*scale));
 await pg.render({canvas:raw,viewport:pg.getViewport({scale}),transform:[1,0,0,1,-rect.x*scale,-rect.y*scale]}).promise;
 const crop=createCanvas();crop.width=raw.width;crop.height=raw.height;maskCrop(crop.getContext('2d')!,raw,regions,rect,scale,crop.width,crop.height);
 return {...rect,pageWidth:v.width,pageHeight:v.height,rotation:v.rotation,pdfRect:[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])],crop:crop.toDataURL('image/png')};
}
