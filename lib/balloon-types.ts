import {validTableCell} from './tables';
export const BALLOON_TYPES={note:'Nota',gdt:'GD&T',dimension:'Dimensión',reference:'Referencia',basic:'Básica',welding:'Soldadura',coordinate:'Coordenada',table:'Tabla'} as const;
export type BalloonType=keyof typeof BALLOON_TYPES;
export type Coordinate={axis:'X'|'Y'|'Z';point:string};
export function validClassification(z:any){return Object.hasOwn(BALLOON_TYPES,z.type) && (z.type==='coordinate' ? !!z.coordinate && ['X','Y','Z'].includes(z.coordinate.axis) && typeof z.coordinate.point==='string' && z.coordinate.point.length<=100 : z.coordinate===null) && (z.type!=='table' || z.tableCell===null || validTableCell(z.tableCell));}
export function requireCoordinates(zones:any[]){const z=zones.find(z=>z.type==='coordinate' && !z.coordinate?.point.trim());if(z)throw new Error('Indica el punto de la coordenada del balloon '+z.number+' (página '+z.page+').');}
