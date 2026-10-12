import {validateTables,requireTableCells,tableDescription,coordinateFromCell,nextTableCell,defaultCoordinateTable,type InspectionTable,type TableCell} from './tables';
import {defaultBalloonSettings,validBalloonSettings} from './balloon-settings';
import {validComparison} from './pdf-comparison';
import {gridLocation,gridsXml,validateGrids,withGridReferences} from './grid';
import {emptyMetadata,validateMetadata,metadataXml} from './document-metadata';
import {BALLOON_TYPES,validClassification,requireCoordinates} from './balloon-types';
import { regionsOf, bounds, leaderAnchor } from './geometry';
export function moveItem<T extends { id: string; number?: string | number }>(items: T[], id: string, position: number): T[] {
  const from = items.findIndex(i => i.id === id);
  if (from < 0 || !Number.isInteger(position) || position < 1 || position > items.length) return items;
  const result = [...items]; const [item] = result.splice(from, 1); result.splice(position - 1, 0, item);
  return result.map((z,i) => items[i].number === undefined ? z : { ...z, number: items[i].number });
}
export function normalizeNumber(value: unknown): string {
 const raw=String(value ?? '').trim().replace(',', '.');
 if(!/^\d{1,9}(?:\.\d{1,9})?$/.test(raw)) throw new Error('Usa un número como 101 o 101.1, con hasta 9 cifras por parte.');
 const parts=raw.split('.').map(s=>String(Number(s)));
 if(Number(parts[0])<1)throw new Error('El número debe empezar por un entero mayor que cero.');
 return parts.join('.');
}
export function validNumber(value: unknown) {try{normalizeNumber(value);return true;}catch{return false;}}
export function incrementNumber(value:string|number) {
 const parts=normalizeNumber(value).split('.'),last=parts.length-1;
 if(Number(parts[last])>=999999999)throw new Error('La serie ha llegado al máximo. Elige otro número inicial.');
 parts[last]=String(Number(parts[last])+1);return parts.join('.');
}
export function nextNumber(zones: {number:string|number;page:number}[], page:number, preferred?:string|number) {
 try {
 const local=zones.filter(z=>z.page===page);
 let n=preferred===undefined?(local.length?incrementNumber(local.at(-1)!.number):'1'):normalizeNumber(preferred);
 const used=new Set(zones.map(z=>normalizeNumber(z.number)));
 while(used.has(n))n=incrementNumber(n);return n;
 }catch{return '';}
}
export function changeNumber<T extends {id:string;number:string|number;page?:number}>(zones:T[],id:string,value:string|number):T[] {
 const number=normalizeNumber(value),duplicate=zones.find(z=>z.id!==id && normalizeNumber(z.number)===number);
 if(duplicate)throw new Error('El balloon '+number+' ya existe'+(duplicate.page?' en la página '+duplicate.page:'')+'. No se permiten duplicados.');
 return zones.map(z=>z.id===id?{...z,number}:z);
}
export function moveOnPage<T extends {id:string;number:string|number;page:number}>(zones:T[],page:number,id:string,position:number):T[] {
 return moveSelectionOnPage(zones,page,[id],position);
}
/** Moves a selection as one block, keeping its relative order and page labels. */
export function moveSelectionOnPage<T extends {id:string;number:string|number;page:number}>(zones:T[],page:number,ids:string[],position:number):T[] {
 const local=zones.filter(z=>z.page===page),selected=new Set(ids),block=local.filter(z=>selected.has(z.id));
 if(!block.length || !Number.isInteger(position) || position<1 || position>local.length)return zones;
 const remaining=local.filter(z=>!selected.has(z.id)),ordered=[...remaining];
 ordered.splice(Math.min(position-1,remaining.length),0,...block);
 if(ordered.every((z,i)=>z.id===local[i].id))return zones;
 let index=0;
 return zones.map(z=>z.page===page?{...ordered[index],number:local[index++].number}:z);
}
export function dropSelectionOnPage<T extends {id:string;number:string|number;page:number}>(zones:T[],page:number,ids:string[],targetId:string,after:boolean):T[] {
 const local=zones.filter(z=>z.page===page),selected=new Set(ids),target=local.findIndex(z=>z.id===targetId);
 if(target<0 || selected.has(targetId))return zones;
 const insertion=target+(after?1:0),removedBefore=local.slice(0,insertion).filter(z=>selected.has(z.id)).length;
 return moveSelectionOnPage(zones,page,ids,insertion-removedBefore+1);
}
/** Reuses the page's original number slots, so other pages cannot collide. */
export function removeAndRenumber<T extends {id:string;number:string|number;page:number}>(zones:T[],ids:string[],nextNumbers:Record<string,string>={}) {
 const removed=new Set(ids),pages=new Set(zones.filter(z=>removed.has(z.id)).map(z=>z.page));
 if(!pages.size)return {zones,nextNumbers};
 const labels=new Map<number,(string|number)[]>(),offsets=new Map<number,number>(),next={...nextNumbers};
 for(const page of pages){const local=zones.filter(z=>z.page===page);labels.set(page,local.map(z=>z.number));offsets.set(page,0);const count=local.filter(z=>!removed.has(z.id)).length;next[page]=normalizeNumber(local[count].number);}
 const remaining=zones.filter(z=>!removed.has(z.id)).map(z=>{if(!pages.has(z.page))return z;const index=offsets.get(z.page)!;offsets.set(z.page,index+1);return {...z,number:labels.get(z.page)![index]};});
 return {zones:remaining,nextNumbers:next};
}
export function renumberPageZones<T extends {id:string;number:string|number;page:number}>(zones:T[],page:number,start:string|number) {
 let number=normalizeNumber(start);
 const result=zones.map(z=>{if(z.page!==page)return z;const item={...z,number};number=incrementNumber(number);return item;});
 if(new Set(result.map(z=>normalizeNumber(z.number))).size!==result.length)throw new Error('La serie coincide con balloons de otra página. Elige otro inicio.');
 return {zones:result,next:number};
}
export function migrateProject(p:any) {
 validateProject(p);
 const tables:InspectionTable[]=structuredClone(p.version>=8?p.tables:[]);
 const legacyCoordinates=p.version<9?p.zones.filter((z:any)=>z.type==='coordinate'):[];
 let legacyTable:InspectionTable|undefined;
 if(legacyCoordinates.length){const rows=[...new Set<string>(legacyCoordinates.map((z:any)=>z.coordinate.point).filter((s:string)=>s.trim()))];let id='coordinate-legacy';while(tables.some(t=>t.id===id))id+='-old';legacyTable={...structuredClone(defaultCoordinateTable),id,rows:rows.length?rows:defaultCoordinateTable.rows};tables.push(legacyTable);}
 if(!tables.length)tables.push(structuredClone(defaultCoordinateTable));
 const assigned:any[]=p.zones.filter((z:any)=>['table','coordinate'].includes(z.type) && z.tableCell);
 const zones=p.zones.map((z:any,i:number)=>{
  const type=z.type==='table'?'coordinate':z.type ?? 'dimension';let cell:TableCell|null=null;
  if(type==='coordinate'){
   if(p.version>=9)cell=z.tableCell ?? null;
   else if(z.tableCell)cell=z.tableCell;
   else if(legacyTable && z.type==='coordinate' && z.coordinate.point.trim())cell={tableId:legacyTable.id,row:legacyTable.rows.indexOf(z.coordinate.point),column:legacyTable.columns.indexOf(z.coordinate.axis),value:z.coordinate.value ?? ''};
   else cell=nextTableCell(tables,assigned);
  }
  const next={...z,number:normalizeNumber(z.number ?? i+1),type,tableCell:cell,coordinate:type==='coordinate'?coordinateFromCell(cell,tables,p.version>=9?z.coordinate:undefined):null,regions:regionsOf(z)};assigned.push(next);return next;
 });
 return withGridReferences({...p,version:9,balloonSettings:p.version>=9?p.balloonSettings:{...defaultBalloonSettings},tables,comparison:p.version>=8?p.comparison:null,grids:p.version>=7?p.grids:{},hideQuickMenu:p.version>=7?p.hideQuickMenu:false,preferredType:'dimension',metadata:p.metadata ?? emptyMetadata(),nextNumbers:Object.fromEntries(Object.entries(p.nextNumbers || {}).map(([k,v])=>[k,normalizeNumber(v)])),zones});
}
const escape = (s: unknown) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const n = (v: number) => Number(v.toFixed(6));
export function makeXml(p: any): string {
  if(p.version<9)p=migrateProject(p);
  requireCoordinates(p.zones);
  requireTableCells(p.zones,p.tables ?? []);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<inspection version="9" id="${escape(p.id)}" document="${escape(p.name)}" sha256="${escape(p.hash)}">\n${metadataXml(p.metadata ?? emptyMetadata())}  <balloonSettings fontSize="${p.balloonSettings?.fontSize ?? 13}" position="${escape(p.balloonSettings?.position ?? "top-left")}"/>\n${(p.tables ?? []).map((t:any)=>`  <table id="${escape(t.id)}" name="${escape(t.name)}" columnLabel="${escape(t.columnLabel)}"><rows>${t.rows.map((r:string,i:number)=>`<row index="${i}" name="${escape(r)}"/>`).join('')}</rows><columns>${t.columns.map((c:string,i:number)=>`<column index="${i}" name="${escape(c)}"/>`).join('')}</columns></table>\n`).join('')}${gridsXml(p.grids ?? {})}  <coordinates viewOrigin="top-left" viewUnits="pdfjs-viewport-scale-1" pdfOrigin="native-pdf" pdfUnits="pdf-user-space" pageBase="1"/>\n  <balloons count="${p.zones.length}">\n${p.zones.map((z: any, i: number) => `    <balloon id="${escape(z.id)}" number="${z.number ?? i + 1}" order="${i + 1}" pageOrder="${p.zones.slice(0,i+1).filter((v:any)=>v.page===z.page).length}" page="${z.page}">\n${gridLocation(z,p.grids?.[z.page])?`      <gridReference value="${gridLocation(z,p.grids?.[z.page])!.reference}" horizontal="${gridLocation(z,p.grids?.[z.page])!.horizontal}" vertical="${gridLocation(z,p.grids?.[z.page])!.vertical}" column="${gridLocation(z,p.grids?.[z.page])!.column}" row="${gridLocation(z,p.grids?.[z.page])!.row}"/>\n`:''}      <classification type="${escape(z.type ?? 'dimension')}"/>\n${z.type==='coordinate'?`      <coordinate axis="${escape(z.coordinate.axis)}" point="${escape(z.coordinate.point)}" value="${escape(z.coordinate.value)}"/>\n`:''}${z.type==='coordinate' && z.tableCell?`      <tableCell tableId="${escape(z.tableCell.tableId)}" row="${z.tableCell.row}" column="${z.tableCell.column}" rowName="${escape(p.tables.find((t:any)=>t.id===z.tableCell.tableId).rows[z.tableCell.row])}" columnName="${escape(p.tables.find((t:any)=>t.id===z.tableCell.tableId).columns[z.tableCell.column])}" value="${escape(z.tableCell.value)}"/>\n`:''}      <description>${escape(tableDescription(z,p.tables ?? []))}</description>\n      <page width="${n(z.pageWidth)}" height="${n(z.pageHeight)}" rotation="${z.rotation}"/>\n      <viewRect x="${n(z.x)}" y="${n(z.y)}" width="${n(z.width)}" height="${n(z.height)}"/>\n      <normalizedRect x="${n(z.x / z.pageWidth)}" y="${n(z.y / z.pageHeight)}" width="${n(z.width / z.pageWidth)}" height="${n(z.height / z.pageHeight)}"/>\n      <pdfRect xMin="${n(z.pdfRect[0])}" yMin="${n(z.pdfRect[1])}" xMax="${n(z.pdfRect[2])}" yMax="${n(z.pdfRect[3])}"/>\n      <position x="${n(z.bx)}" y="${n(z.by)}"/>\n      <leaderAnchor x="${n(leaderAnchor(z).x)}" y="${n(leaderAnchor(z).y)}" rule="nearest-corner-right-top-ties"/>\n      <regions origin="top-left" units="pdfjs-viewport-scale-1" combine="union" outside="white">${regionsOf(z).map(r => `<region kind="${r.kind}"><points>${r.points.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}</points></region>`).join('')}</regions>\n      <crop href="crops/${escape(z.id)}.png" mimeType="image/png"/>\n    </balloon>`).join('\n')}\n  </balloons>\n</inspection>\n`;
}
export function validateProject(p: any) {
  const fail = () => { throw new Error('Formato de proyecto no válido.'); };
  if (!p || ![1,2,3,4,5,6,7,8,9].includes(p.version) || typeof p.id !== 'string' || typeof p.name !== 'string' || !/^[a-f0-9]{64}$/.test(p.hash) || !Array.isArray(p.zones) || p.zones.length > 10000) fail();
  if (p.version>=2 && (!p.nextNumbers || typeof p.nextNumbers!=='object' || Array.isArray(p.nextNumbers) || !Object.entries(p.nextNumbers).every(([k,v])=>/^[1-9][0-9]*$/.test(k) && validNumber(v as number)))) fail();
  if(p.version>=5)validateMetadata(p.metadata);
  if(p.version>=6 && !Object.hasOwn(BALLOON_TYPES,p.preferredType) && !(p.version<9 && p.preferredType==='table'))fail();
  if(p.version>=7){validateGrids(p.grids);if(typeof p.hideQuickMenu!=='boolean')fail();}
  if(p.version>=8){validateTables(p.tables);if(!validComparison(p.comparison))fail();}
  if(p.version>=9 && !validBalloonSettings(p.balloonSettings))fail();
  const numbers = new Set();
  const ids = new Set();
  for (const z of p.zones) {
    if (!z || !/^[a-zA-Z0-9-]{1,80}$/.test(z.id) || ids.has(z.id) || !Number.isInteger(z.page) || z.page < 1 || typeof z.note !== 'string' || typeof z.crop !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(z.crop)) fail();
    ids.add(z.id);
    if(p.version>=4 && !validClassification(z,p.version<9))fail();
    if(['table','coordinate'].includes(z.type) && z.tableCell){const t=p.tables?.find((t:any)=>t.id===z.tableCell.tableId);if(!t || !t.rows[z.tableCell.row] || !t.columns[z.tableCell.column])fail();if(p.version>=9){const c=coordinateFromCell(z.tableCell,p.tables);if(c.axis!==z.coordinate?.axis || c.point!==z.coordinate?.point || c.value!==z.coordinate?.value)fail();}}
    if (p.version>=2) {
     if (!validNumber(z.number) || numbers.has(normalizeNumber(z.number)) || !Array.isArray(z.regions) || !z.regions.length || z.regions.length>1000) fail();
     numbers.add(normalizeNumber(z.number));
     for (const r of z.regions) { if (!['rectangle','freehand'].includes(r.kind) || !Array.isArray(r.points) || r.points.length<3 || r.points.length>50000 || !r.points.every((v:any)=>v && Number.isFinite(v.x) && Number.isFinite(v.y) && v.x>=0 && v.y>=0 && v.x<=z.pageWidth && v.y<=z.pageHeight)) fail(); }
     const b=bounds(z.regions); if (['x','y','width','height'].some(k=>Math.abs(b[k as keyof typeof b]-z[k])>.01)) fail();
    }
    if (!['x','y','width','height','bx','by','pageWidth','pageHeight','rotation'].every(k => typeof z[k] === 'number' && Number.isFinite(z[k]))) fail();
    if (z.x < 0 || z.y < 0 || z.width <= 0 || z.height <= 0 || z.pageWidth <= 0 || z.pageHeight <= 0 || z.x + z.width > z.pageWidth + .01 || z.y + z.height > z.pageHeight + .01 || z.bx < 0 || z.by < 0 || z.bx > z.pageWidth || z.by > z.pageHeight || ![0,90,180,270].includes(z.rotation)) fail();
    if (!Array.isArray(z.pdfRect) || z.pdfRect.length !== 4 || !z.pdfRect.every((v: unknown) => typeof v === 'number' && Number.isFinite(v))) fail();
  }
}

