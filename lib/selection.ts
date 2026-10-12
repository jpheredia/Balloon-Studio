import {type BalloonType,type Coordinate} from './balloon-types';
import {coordinateFromCell,nextTableCell,type TableCell,type InspectionTable} from './tables';

export function selectIds(ids:string[],id:string,order:string[],anchor:string,mode:'single'|'toggle'|'range'='single') {
 if(!order.includes(id))return [];
 const valid=ids.filter(value=>order.includes(value));
 if(mode==='toggle')return valid.includes(id)?valid.filter(value=>value!==id):[...valid,id];
 if(mode==='range' && order.includes(anchor)){const a=order.indexOf(anchor),b=order.indexOf(id);return order.slice(Math.min(a,b),Math.max(a,b)+1);}
 return [id];
}
export function classification(type:BalloonType,coordinate:Coordinate|null=null,tableCell:TableCell|null=null) {
 return {type,coordinate:type==='coordinate'?(coordinate ?? {axis:'X',point:'',value:''}):null,tableCell:type==='coordinate'?tableCell:null};
}
export function classifySelection<T extends {id:string;type:BalloonType;coordinate:Coordinate|null;tableCell?:TableCell|null}>(zones:T[],ids:string[],type:BalloonType,tables:InspectionTable[]=[]):T[] {
 const selected=new Set(ids);
 const assigned: T[] = zones.filter(z=>!selected.has(z.id) || (z.type==='coordinate' && z.tableCell));
 return zones.map(z=>{if(!selected.has(z.id))return z;const cell=type==='coordinate'?(z.tableCell ?? nextTableCell(tables,assigned)):null;const next={...z,...classification(type,coordinateFromCell(cell,tables,z.coordinate ?? undefined),cell)};assigned.push(next);return next;});
}
