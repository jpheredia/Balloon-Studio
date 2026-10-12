export type ComparisonSettings={ name:string; pageOffset:number; x:number; y:number; scale:number; threshold:number; opacity:number; visible:boolean; mode:'changes'|'overlay' };
export const comparisonDefaults:Omit<ComparisonSettings,'name'>={pageOffset:0,x:0,y:0,scale:1,threshold:45,opacity:.85,visible:true,mode:'changes'};
export function validComparison(c:any) {return c===null || (!!c && typeof c.name==='string' && c.name.length<=300 && Number.isInteger(c.pageOffset) && Math.abs(c.pageOffset)<=100000 && ['x','y'].every(k=>Number.isFinite(c[k]) && Math.abs(c[k])<=10000) && Number.isFinite(c.scale) && c.scale>=.1 && c.scale<=10 && Number.isFinite(c.threshold) && c.threshold>=1 && c.threshold<=255 && Number.isFinite(c.opacity) && c.opacity>=0 && c.opacity<=1 && typeof c.visible==='boolean' && ['changes','overlay'].includes(c.mode));}
/** New ink must be darker than the existing drawing. Nearby existing ink absorbs rasterization noise. */
export function newInk(base:Uint8ClampedArray,revision:Uint8ClampedArray,width:number,height:number,threshold:number) {
 const result=new Uint8ClampedArray(base.length);
 const lum=(pixels:Uint8ClampedArray,i:number)=>(pixels[i]*.2126+pixels[i+1]*.7152+pixels[i+2]*.0722);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4,dark=lum(revision,i);if(dark>240 || lum(base,i)-dark<threshold)continue;
  let old=255;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0 && yy>=0 && xx<width && yy<height)old=Math.min(old,lum(base,(yy*width+xx)*4));}
  if(old-dark<threshold)continue;
  result[i]=220;result[i+1]=25;result[i+2]=35;result[i+3]=Math.round(255-dark);
 }
 return result;
}
