export type ComponentInfo={id:string;partNumber:string;revision:string;quantity:number};
export type StandardInfo={id:string;reference:string;revision:string;description:string};
export type DocumentMetadata={partNumber:string;partNumberRev:string;drawingNumber:string;drawingRev:string;kind:'Part'|'Assy';components:ComponentInfo[];standards:StandardInfo[]};
export function emptyMetadata():DocumentMetadata{return {partNumber:'',partNumberRev:'',drawingNumber:'',drawingRev:'',kind:'Part',components:[],standards:[]};}
export function validateMetadata(m:any){
 const text=(v:any,max=200)=>typeof v==='string' && v.length<=max;
 const error=()=>{throw new Error('Los metadatos del plano no son válidos.');};
 if(!m || !['Part','Assy'].includes(m.kind) || !['partNumber','partNumberRev','drawingNumber','drawingRev'].every(k=>text(m[k])) || !Array.isArray(m.components) || !Array.isArray(m.standards) || m.components.length>1000 || m.standards.length>1000)error();
 for(const list of [m.components,m.standards]){const ids=new Set();for(const item of list){if(!item || !text(item.id,80) || !/^[a-zA-Z0-9-]+$/.test(item.id) || ids.has(item.id))error();ids.add(item.id);}}
 for(const c of m.components){if(!text(c.partNumber) || !c.partNumber.trim() || !text(c.revision) || !Number.isSafeInteger(c.quantity) || c.quantity<1 || c.quantity>999999999)throw new Error('Cada componente necesita un Part Number y una cantidad entera mayor que cero.');}
 for(const s of m.standards){if(!text(s.reference) || !s.reference.trim() || !text(s.revision) || !text(s.description,1000))throw new Error('Cada norma necesita una referencia; la descripción puede tener hasta 1000 caracteres.');}
}
const esc=(value:string)=>value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[c]!);
export function metadataXml(metadata:DocumentMetadata){validateMetadata(metadata);const m=metadata;
 return `  <metadata>\n    <part number="${esc(m.partNumber)}" revision="${esc(m.partNumberRev)}" kind="${m.kind}"/>\n    <drawing number="${esc(m.drawingNumber)}" revision="${esc(m.drawingRev)}"/>\n${m.kind==='Assy'?`    <components count="${m.components.length}">\n${m.components.map(c=>`      <component id="${esc(c.id)}" partNumber="${esc(c.partNumber)}" revision="${esc(c.revision)}" quantity="${c.quantity}"/>`).join('\n')}\n    </components>\n`:''}    <standards count="${m.standards.length}">\n${m.standards.map(s=>`      <standard id="${esc(s.id)}" reference="${esc(s.reference)}" revision="${esc(s.revision)}"><description>${esc(s.description)}</description></standard>`).join('\n')}\n    </standards>\n  </metadata>\n`;
}
