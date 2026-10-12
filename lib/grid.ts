export type GridAxis={kind:'letters'|'numbers';count:number;start:string;descending:boolean;reverse:boolean;exclude:string};
export type GridEdge='left'|'right'|'top'|'bottom';
export function dragGridEdge(grid:PageGrid,edge:GridEdge,dx:number,dy:number,width:number,height:number):PageGrid{
 if(!Number.isFinite(dx) || !Number.isFinite(dy) || !(width>0) || !(height>0))return grid;
 const horizontal=edge==='left'||edge==='right',opposite=({left:'right',right:'left',top:'bottom',bottom:'top'} as const)[edge];
 const delta=(horizontal?dx/width:dy/height)*100*(edge==='right'||edge==='bottom'?-1:1);
 if(delta===0)return grid;
 const minSpan=Math.min(1,100-grid[edge]-grid[opposite]);
 const value=Math.max(0,Math.min(100-grid[opposite]-minSpan,Math.round((grid[edge]+delta)*10000)/10000));
 return value===grid[edge]?grid:{...grid,[edge]:value};
}
export type PageGrid={enabled:boolean;visible:boolean;horizontal:GridAxis;vertical:GridAxis;order:'horizontal-first'|'vertical-first';point:'zone'|'balloon';left:number;top:number;right:number;bottom:number};
export const defaultGrid=():PageGrid=>({enabled:false,visible:true,horizontal:{kind:'letters',count:8,start:'A',descending:false,reverse:false,exclude:'I, O'},vertical:{kind:'numbers',count:6,start:'1',descending:false,reverse:false,exclude:''},order:'horizontal-first',point:'zone',left:0,top:0,right:0,bottom:0});
function fromLetters(s:string){return [...s].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);}
function letters(n:number){let out='';while(n>0){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out;}
export function axisLabels(axis:GridAxis):string[]{
 if(!axis || !['letters','numbers'].includes(axis.kind) || !Number.isInteger(axis.count) || axis.count<1 || axis.count>200 || typeof axis.start!=='string' || typeof axis.exclude!=='string' || axis.exclude.length>2000 || typeof axis.descending!=='boolean' || typeof axis.reverse!=='boolean')throw new Error('Cada eje necesita entre 1 y 200 divisiones y una configuración válida.');
 const start=axis.start.trim().toUpperCase(),pattern=axis.kind==='letters'?/^[A-Z]{1,4}$/:/^\d{1,7}$/;
 if(!pattern.test(start))throw new Error('Inicio no válido: usa letras (A, Z, AA…) o un número, según el eje.');
 const excluded=axis.exclude.toUpperCase().split(/[\s,;]+/).filter(Boolean);
 if(excluded.some(s=>!pattern.test(s)))throw new Error('Revisa las exclusiones: sepáralas con comas y usa el formato del eje.');
 const blocked=new Set(excluded.map(s=>axis.kind==='numbers'?String(Number(s)):s));
 let n=axis.kind==='letters'?fromLetters(start):Number(start);const labels:string[]=[];
 for(let attempts=0;labels.length<axis.count && attempts<10000;attempts++,n+=axis.descending?-1:1){
  if(n<(axis.kind==='letters'?1:0) || n>(axis.kind==='letters'?475254:9999999))throw new Error('La serie no alcanza todas las divisiones. Cambia el inicio, el sentido o la cantidad.');
  const label=axis.kind==='letters'?letters(n):String(n);if(!blocked.has(label))labels.push(label);
 }
 if(labels.length!==axis.count)throw new Error('No hay suficientes etiquetas disponibles.');
 return axis.reverse?labels.reverse():labels;
}
export function validateGrid(g:PageGrid){
 if(!g || typeof g.enabled!=='boolean' || typeof g.visible!=='boolean' || !['horizontal-first','vertical-first'].includes(g.order) || !['zone','balloon'].includes(g.point) || !['left','right','top','bottom'].every(k=>Number.isFinite(g[k as 'left']) && g[k as 'left']>=0 && g[k as 'left']<100) || g.left+g.right>=100 || g.top+g.bottom>=100)throw new Error('Configuración del GRID no válida. Los márgenes deben dejar un área útil.');
 axisLabels(g.horizontal);axisLabels(g.vertical);
}
export function validateGrids(grids:any){if(!grids || typeof grids!=='object' || Array.isArray(grids) || Object.keys(grids).length>10000)throw new Error('Configuración de páginas no válida.');for(const [page,g] of Object.entries(grids)){if(!/^[1-9]\d*$/.test(page))throw new Error('Página de GRID no válida.');validateGrid(g as PageGrid);}}
export function applyGridPages(grids:Record<string,PageGrid>,grid:PageGrid,pages:number[]){
 validateGrid(grid);if(!pages.length || pages.some(p=>!Number.isInteger(p) || p<1))throw new Error('Selecciona páginas válidas.');
 const next={...grids};for(const page of pages)next[page]=structuredClone(grid);return next;
}
export function gridLocation(z:{page:number;x:number;y:number;width:number;height:number;bx:number;by:number;pageWidth:number;pageHeight:number},g?:PageGrid){
 if(!g?.enabled)return null;
 const px=(g.point==='zone'?z.x+z.width/2:z.bx)/z.pageWidth*100,py=(g.point==='zone'?z.y+z.height/2:z.by)/z.pageHeight*100;
 if(px<g.left || px>100-g.right || py<g.top || py>100-g.bottom)return null;
 const h=axisLabels(g.horizontal),v=axisLabels(g.vertical),column=Math.min(h.length-1,Math.floor((px-g.left)/(100-g.left-g.right)*h.length)),row=Math.min(v.length-1,Math.floor((py-g.top)/(100-g.top-g.bottom)*v.length));
 const horizontal=h[column],vertical=v[row],reference=`${z.page}-${g.order==='horizontal-first'?horizontal+vertical:vertical+horizontal}`;
 return {reference,horizontal,vertical,column:column+1,row:row+1};
}
export function withGridReferences<T extends {zones:any[];grids?:Record<string,PageGrid>}>(p:T){return {...p,zones:p.zones.map(z=>({...z,gridReference:gridLocation(z,p.grids?.[z.page])?.reference ?? null}))};}
export function gridsXml(grids:Record<string,PageGrid>={}){
 validateGrids(grids);
 return `  <grids>\n${Object.entries(grids).map(([page,g])=>`    <grid page="${page}" enabled="${g.enabled}" visible="${g.visible}" referenceOrder="${g.order}" referencePoint="${g.point}" leftPercent="${g.left}" topPercent="${g.top}" rightPercent="${g.right}" bottomPercent="${g.bottom}">${(['horizontal','vertical'] as const).map(direction=>`<axis direction="${direction}" kind="${g[direction].kind}" start="${g[direction].start.trim().toUpperCase()}" descending="${g[direction].descending}" reverse="${g[direction].reverse}" count="${g[direction].count}" excluded="${g[direction].exclude.toUpperCase().split(/[\s,;]+/).filter(Boolean).join(',')}" labels="${axisLabels(g[direction]).join(',')}"/>`).join('')}</grid>`).join('\n')}\n  </grids>\n`;
}
