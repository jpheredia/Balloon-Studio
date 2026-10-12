export type InspectionTable = { id:string; name:string; rows:string[]; columns:string[]; columnLabel:string };
export type TableCell = { tableId:string; row:number; column:number; value:string };
export const defaultCoordinateTable:InspectionTable={id:'coordinate-default',name:'Coordenadas',rows:['Punto A','Punto B','Punto C'],columns:['X','Y','Z'],columnLabel:'Coordenada'};
export function coordinateFromCell(cell:TableCell|null,tables:InspectionTable[],fallback={axis:'X',point:'',value:''}) {
 const table=tables.find(t=>t.id===cell?.tableId);
 return table && cell?{axis:table.columns[cell.column],point:table.rows[cell.row],value:cell.value}:fallback;
}
/** Assigns a point name to one balloon without renaming other points. */
export function coordinatePoint(tables:InspectionTable[],cell:TableCell,point:string) {
 const name=point.trim(),table=tables.find(t=>t.id===cell.tableId);
 if(!table || !name || name.length>100)throw new Error('Indica un punto de entre 1 y 100 caracteres.');
 let row=table.rows.indexOf(name);let next=tables;
 if(row<0){if(table.rows.length>=200)throw new Error('Este grupo ya tiene 200 puntos.');row=table.rows.length;next=tables.map(t=>t.id===table.id?{...t,rows:[...t.rows,name]}:t);}
 return {tables:next,cell:{...cell,row}};
}
export function parseHeaders(text:string) {
 const labels=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!labels.length || labels.length>200 || labels.some(s=>s.length>100) || new Set(labels).size!==labels.length)throw new Error('Introduce entre 1 y 200 nombres distintos, uno por línea (máximo 100 caracteres).');
 return labels;
}
export function validTableCell(cell:any) {return !!cell && typeof cell.tableId==='string' && Number.isInteger(cell.row) && cell.row>=0 && Number.isInteger(cell.column) && cell.column>=0 && typeof cell.value==='string' && cell.value.length<=300;}
export function validateTables(tables:any) {
 if(!Array.isArray(tables) || tables.length>100)throw new Error('Las tablas del proyecto no son válidas.');
 const ids=new Set<string>();
 for(const t of tables){if(!t || typeof t.id!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(t.id) || ids.has(t.id) || typeof t.name!=='string' || !t.name.trim() || t.name.length>100 || typeof t.columnLabel!=='string' || t.columnLabel.length>100 || !Array.isArray(t.rows) || !Array.isArray(t.columns) || ![t.rows,t.columns].every(a=>a.length>0 && a.length<=200 && a.every((s:any)=>typeof s==='string' && s.trim() && s.length<=100) && new Set(a).size===a.length))throw new Error('Las tablas del proyecto no son válidas.');ids.add(t.id);}
}
export function tableDescription(zone:{type:string;tableCell?:TableCell|null;note?:string},tables:InspectionTable[]) {
 if(!['table','coordinate'].includes(zone.type) || !zone.tableCell)return zone.note ?? '';
 const cell=zone.tableCell,table=tables.find(t=>t.id===cell.tableId);
 if(!table)return '';
 const column=[table.columnLabel,table.columns[cell.column]].filter(Boolean).join(' ');
 return `${table.rows[cell.row]} - ${column}${cell.value?': '+cell.value:''}`;
}
export function requireTableCells(zones:any[],tables:InspectionTable[]) {
 const used=new Set<string>();
 for(const z of zones.filter(z=>['table','coordinate'].includes(z.type))) {const c=z.tableCell,t=tables.find(t=>t.id===c?.tableId);if(!validTableCell(c) || !t || !t.rows[c.row] || !t.columns[c.column])throw new Error(`Completa el punto y eje del balloon ${z.number} antes de exportar.`);const key=JSON.stringify([c.tableId,c.row,c.column]);if(used.has(key))throw new Error(`El punto y eje del balloon ${z.number} ya están asignados en ${t.name}.`);used.add(key);}
}
export function nextTableCell(tables:InspectionTable[],zones:{type:string;tableCell?:TableCell|null}[]):TableCell|null {
 const last=zones.findLast(z=>['table','coordinate'].includes(z.type) && tables.some(t=>t.id===z.tableCell?.tableId));
 const table=tables.find(t=>t.id===last?.tableCell?.tableId) ?? tables[0];if(!table)return null;
 const used=new Set(zones.filter(z=>['table','coordinate'].includes(z.type) && z.tableCell?.tableId===table.id).map(z=>`${z.tableCell!.row}:${z.tableCell!.column}`));
 for(let row=0;row<table.rows.length;row++)for(let column=0;column<table.columns.length;column++)if(!used.has(`${row}:${column}`))return {tableId:table.id,row,column,value:''};
 return null;
}
export function tableCsv(zones:any[],tables:InspectionTable[]) {
 requireTableCells(zones,tables);
 const quote=(s:unknown)=>{const raw=String(s ?? '');const safe=/^[=+@\t\r]/.test(raw) || (/^-/.test(raw) && !/^-\d+(?:[.,]\d+)?$/.test(raw))?"'"+raw:raw;return '"'+safe.replaceAll('"','""')+'"';};
 const records=[['Balloon','Tabla','Punto','Eje','Valor','Descripción','Página','ID'],...zones.filter(z=>['table','coordinate'].includes(z.type)).map(z=>{const c=z.tableCell!,t=tables.find(t=>t.id===c.tableId)!;return [z.number,t.name,t.rows[c.row],t.columns[c.column],c.value,tableDescription(z,tables),z.page,z.id];})];
 return '\uFEFF'+records.map(r=>r.map(quote).join(';')).join('\r\n');
}
