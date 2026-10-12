import {validateTables,requireTableCells,tableDescription} from './tables';
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
 const pageZones=zones.filter(z=>z.page===page),ordered=moveItem(pageZones,id,position);let i=0;
 return zones.map(z=>z.page===page?ordered[i++]:z);
}
export function renumberPageZones<T extends {id:string;number:string|number;page:number}>(zones:T[],page:number,start:string|number) {
 let number=normalizeNumber(start);
 const result=zones.map(z=>{if(z.page!==page)return z;const item={...z,number};number=incrementNumber(number);return item;});
 if(new Set(result.map(z=>normalizeNumber(z.number))).size!==result.length)throw new Error('La serie coincide con balloons de otra página. Elige otro inicio.');
 return {zones:result,next:number};
}
export function migrateProject(p:any) {
 validateProject(p);
 return withGridReferences({...p,version:8,tables:p.version>=8?p.tables:[],comparison:p.version>=8?p.comparison:null,grids:p.version>=7?p.grids:{},hideQuickMenu:p.version>=7?p.hideQuickMenu:false,preferredType:p.version>=6?p.preferredType:'dimension',metadata:p.metadata ?? emptyMetadata(),nextNumbers:Object.fromEntries(Object.entries(p.nextNumbers || {}).map(([k,v])=>[k,normalizeNumber(v)])),zones:p.zones.map((z:any,i:number)=>({...z,number:normalizeNumber(z.number ?? i+1),type:z.type ?? 'dimension',tableCell:z.type==='table'?z.tableCell:null,coordinate:z.type==='coordinate'?z.coordinate:null,regions:regionsOf(z)}))});
}
const escape = (s: unknown) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);
const n = (v: number) => Number(v.toFixed(6));
export function makeXml(p: any): string {
  requireCoordinates(p.zones);
  requireTableCells(p.zones,p.tables ?? []);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<inspection version="8" id="${escape(p.id)}" document="${escape(p.name)}" sha256="${escape(p.hash)}">\n${metadataXml(p.metadata ?? emptyMetadata())}${(p.tables ?? []).map((t:any)=>`  <table id="${escape(t.id)}" name="${escape(t.name)}" columnLabel="${escape(t.columnLabel)}"><rows>${t.rows.map((r:string,i:number)=>`<row index="${i}" name="${escape(r)}"/>`).join('')}</rows><columns>${t.columns.map((c:string,i:number)=>`<column index="${i}" name="${escape(c)}"/>`).join('')}</columns></table>\n`).join('')}${gridsXml(p.grids ?? {})}  <coordinates viewOrigin="top-left" viewUnits="pdfjs-viewport-scale-1" pdfOrigin="native-pdf" pdfUnits="pdf-user-space" pageBase="1"/>\n  <balloons count="${p.zones.length}">\n${p.zones.map((z: any, i: number) => `    <balloon id="${escape(z.id)}" number="${z.number ?? i + 1}" order="${i + 1}" pageOrder="${p.zones.slice(0,i+1).filter((v:any)=>v.page===z.page).length}" page="${z.page}">\n${gridLocation(z,p.grids?.[z.page])?`      <gridReference value="${gridLocation(z,p.grids?.[z.page])!.reference}" horizontal="${gridLocation(z,p.grids?.[z.page])!.horizontal}" vertical="${gridLocation(z,p.grids?.[z.page])!.vertical}" column="${gridLocation(z,p.grids?.[z.page])!.column}" row="${gridLocation(z,p.grids?.[z.page])!.row}"/>\n`:''}      <classification type="${escape(z.type ?? 'dimension')}"/>\n${z.type==='coordinate'?`      <coordinate axis="${escape(z.coordinate.axis)}" point="${escape(z.coordinate.point)}"/>\n`:''}${z.type==='table'?`      <tableCell tableId="${escape(z.tableCell.tableId)}" row="${z.tableCell.row}" column="${z.tableCell.column}" rowName="${escape(p.tables.find((t:any)=>t.id===z.tableCell.tableId).rows[z.tableCell.row])}" columnName="${escape(p.tables.find((t:any)=>t.id===z.tableCell.tableId).columns[z.tableCell.column])}" value="${escape(z.tableCell.value)}"/>\n`:''}      <description>${escape(tableDescription(z,p.tables ?? []))}</description>\n      <page width="${n(z.pageWidth)}" height="${n(z.pageHeight)}" rotation="${z.rotation}"/>\n      <viewRect x="${n(z.x)}" y="${n(z.y)}" width="${n(z.width)}" height="${n(z.height)}"/>\n      <normalizedRect x="${n(z.x / z.pageWidth)}" y="${n(z.y / z.pageHeight)}" width="${n(z.width / z.pageWidth)}" height="${n(z.height / z.pageHeight)}"/>\n      <pdfRect xMin="${n(z.pdfRect[0])}" yMin="${n(z.pdfRect[1])}" xMax="${n(z.pdfRect[2])}" yMax="${n(z.pdfRect[3])}"/>\n      <position x="${n(z.bx)}" y="${n(z.by)}"/>\n      <leaderAnchor x="${n(leaderAnchor(z).x)}" y="${n(leaderAnchor(z).y)}" rule="nearest-corner-right-top-ties"/>\n      <regions origin="top-left" units="pdfjs-viewport-scale-1" combine="union" outside="white">${regionsOf(z).map(r => `<region kind="${r.kind}"><points>${r.points.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}</points></region>`).join('')}</regions>\n      <crop href="crops/${escape(z.id)}.png" mimeType="image/png"/>\n    </balloon>`).join('\n')}\n  </balloons>\n</inspection>\n`;
}
export function validateProject(p: any) {
  const fail = () => { throw new Error('Formato de proyecto no válido.'); };
  if (!p || ![1,2,3,4,5,6,7,8].includes(p.version) || typeof p.id !== 'string' || typeof p.name !== 'string' || !/^[a-f0-9]{64}$/.test(p.hash) || !Array.isArray(p.zones) || p.zones.length > 10000) fail();
  if (p.version>=2 && (!p.nextNumbers || typeof p.nextNumbers!=='object' || Array.isArray(p.nextNumbers) || !Object.entries(p.nextNumbers).every(([k,v])=>/^[1-9][0-9]*$/.test(k) && validNumber(v as number)))) fail();
  if(p.version>=5)validateMetadata(p.metadata);
  if(p.version>=6 && !Object.hasOwn(BALLOON_TYPES,p.preferredType))fail();
  if(p.version>=7){validateGrids(p.grids);if(typeof p.hideQuickMenu!=='boolean')fail();}
  if(p.version>=8){validateTables(p.tables);if(!validComparison(p.comparison))fail();}
  const numbers = new Set();
  const ids = new Set();
  for (const z of p.zones) {
    if (!z || !/^[a-zA-Z0-9-]{1,80}$/.test(z.id) || ids.has(z.id) || !Number.isInteger(z.page) || z.page < 1 || typeof z.note !== 'string' || typeof z.crop !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(z.crop)) fail();
    ids.add(z.id);
    if(p.version>=4 && !validClassification(z))fail();
    if(z.type==='table' && z.tableCell){const t=p.tables?.find((t:any)=>t.id===z.tableCell.tableId);if(!t || !t.rows[z.tableCell.row] || !t.columns[z.tableCell.column])fail();}
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

