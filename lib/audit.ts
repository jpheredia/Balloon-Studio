/** Versioned, transport-independent contract for the interpreter and human review. */
export const AUDIT_CLASSIFICATIONS = ['DIMENSION', 'NOTE', 'GDT', 'WELD', 'SURFACE_FINISH', 'THREAD', 'DATUM', 'OTHER', 'Basic_Characteristic', 'Reference_Characteristic', 'Nominal_With_Default_Tolerance'] as const;
export type AuditClassification = typeof AUDIT_CLASSIFICATIONS[number];
export type JobSettings = { unit: 'mm' | 'in'; generalToleranceMode: 'none' | 'drawing' | 'specified'; generalTolerance: string };
export type AuditRequest = {
  contractVersion: 1; jobId: string; projectId: string; documentSha256: string; sourceDigest: string;
  createdAt: string; settings: JobSettings;
  balloons: { id: string; number: string; page: number; type: string; cropPath: string; sha256: string }[];
};
export type Interpretation = {
  balloonId: string; transcription: string; classification: AuditClassification; description: string;
  specification: string; gdtCallout: string; unit: string; ruleApplied: string; coordinateValue: string;
  manualReview: boolean; reviewReason: string;
};
export type AgentResponse = {
  contractVersion: 1; jobId: string; projectId: string; documentSha256: string; sourceDigest: string;
  readingMethod: 'direct-vision'; characteristics: Interpretation[];
};
export type AuditReview = { decision: 'accepted' | 'corrected'; reviewedAt: string; note: string; corrected: Interpretation | null };
export type AuditState = { version: 1; request: AuditRequest; response: AgentResponse; importedAt: string; reviews: Record<string, AuditReview>; sourceNotes?: Record<string, string> };
const ID = /^[a-zA-Z0-9-]{1,80}$/;
const SHA = /^[a-f0-9]{64}$/;
const validId = (v: unknown) => typeof v === 'string' && ID.test(v);
const validHash = (v: unknown) => typeof v === 'string' && SHA.test(v);
const date = (v: unknown) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const string = (v: unknown, max = 20000) => typeof v === 'string' && v.length <= max;

export async function sha256(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))).map(v => v.toString(16).padStart(2, '0')).join('');
}
export function cropBytes(crop: string): Uint8Array {
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(crop)) throw new Error('Recorte PNG no válido.');
  return Uint8Array.from(atob(crop.split(',')[1]), c => c.charCodeAt(0));
}
/** Excludes review data and balloon placement. Moving a label does not change its evidence. */
export function sourceSnapshot(project: any) {
  return {
    id: project.id, name: project.name, hash: project.hash, metadata: project.metadata,
    tables: project.tables, grids: project.grids,
    zones: project.zones.map((z: any) => ({
      id: z.id, number: z.number, page: z.page, type: z.type,
      // A copied transcription is review output; retain the note actually sent to the agent.
      // Any subsequent manual change remains evidence and invalidates the old result.
      note: project.audit?.sourceNotes?.[z.id] !== undefined && z.note === auditFields(project.audit, z.id)?.transcription ? project.audit.sourceNotes[z.id] : z.note,
      coordinate: z.coordinate, tableCell: z.tableCell, regions: z.regions,
      pageWidth: z.pageWidth, pageHeight: z.pageHeight, rotation: z.rotation, crop: z.crop,
    })),
  };
}
export function sourceDigest(project: any) { return sha256(new TextEncoder().encode(JSON.stringify(sourceSnapshot(project)))); }
export function validateSettings(settings: any): asserts settings is JobSettings {
  if (!settings || !['mm', 'in'].includes(settings.unit) || !['none', 'drawing', 'specified'].includes(settings.generalToleranceMode) || !string(settings.generalTolerance, 2000) || (settings.generalToleranceMode === 'specified' ? !settings.generalTolerance.trim() : settings.generalTolerance !== '')) {
    throw new Error('Confirma las unidades y el criterio de tolerancia general antes de ejecutar.');
  }
}
export async function createAuditRequest(project: any, settings: JobSettings): Promise<AuditRequest> {
  validateSettings(settings);
  if (!project.id || !project.zones.length) throw new Error('Abre un plano y marca al menos un balloon.');
  const request: AuditRequest = {
    contractVersion: 1, jobId: crypto.randomUUID(), projectId: project.id, documentSha256: project.hash,
    sourceDigest: await sourceDigest(project), createdAt: new Date().toISOString(), settings: { ...settings },
    balloons: await Promise.all(project.zones.map(async (z: any) => ({
      id: z.id, number: z.number, page: z.page, type: z.type,
      cropPath: `crops/${z.id}.png`, sha256: await sha256(cropBytes(z.crop)),
    }))),
  };
  validateAuditRequest(request);
  return request;
}
export function validateAuditRequest(v: any): asserts v is AuditRequest {
  if (!v || v.contractVersion !== 1 || !validId(v.jobId) || !validId(v.projectId) || !validHash(v.documentSha256) || !validHash(v.sourceDigest) || !date(v.createdAt) || !Array.isArray(v.balloons) || !v.balloons.length || v.balloons.length > 10000) throw new Error('Solicitud de interpretación no válida.');
  validateSettings(v.settings);
  const ids = new Set<string>();
  for (const b of v.balloons) {
    if (!b || !validId(b.id) || ids.has(b.id) || !string(b.number, 80) || !b.number || !Number.isInteger(b.page) || b.page < 1 || !string(b.type, 80) || b.cropPath !== `crops/${b.id}.png` || !validHash(b.sha256)) throw new Error('Identificadores o recortes de la solicitud no válidos.');
    ids.add(b.id);
  }
}
export function validateInterpretation(v: any): asserts v is Interpretation {
  if (!v || !validId(v.balloonId) || !AUDIT_CLASSIFICATIONS.includes(v.classification) || !['transcription','description','specification','gdtCallout','unit','ruleApplied','coordinateValue','reviewReason'].every(k => string(v[k])) || typeof v.manualReview !== 'boolean' || (v.manualReview ? !v.reviewReason.trim() : v.reviewReason !== '')) throw new Error('Interpretación no válida: conserva los campos, la clasificación y el motivo de revisión.');
}
export function validateAgentResponse(v: any, request: AuditRequest): asserts v is AgentResponse {
  validateAuditRequest(request);
  if (!v || v.contractVersion !== 1 || v.readingMethod !== 'direct-vision' || !['jobId','projectId','documentSha256','sourceDigest'].every(k => v[k] === request[k as keyof AuditRequest]) || !Array.isArray(v.characteristics) || v.characteristics.length !== request.balloons.length) throw new Error('La respuesta no corresponde al trabajo o no cubre todos sus balloons.');
  const ids = new Set<string>();
  for (let i = 0; i < v.characteristics.length; i++) {
    const row = v.characteristics[i]; validateInterpretation(row);
    if (ids.has(row.balloonId) || row.balloonId !== request.balloons[i].id) throw new Error('La respuesta contiene IDs duplicados, desconocidos o fuera de orden.');
    ids.add(row.balloonId);
  }
}
export function createAuditState(request: AuditRequest, response: AgentResponse): AuditState {
  validateAgentResponse(response, request);
  return { version: 1, request: structuredClone(request), response: structuredClone(response), importedAt: new Date().toISOString(), reviews: {} };
}
export function validateAuditState(v: any): asserts v is AuditState {
  if (!v || v.version !== 1 || !date(v.importedAt) || !v.reviews || typeof v.reviews !== 'object' || Array.isArray(v.reviews)) throw new Error('Auditoría guardada no válida.');
  validateAgentResponse(v.response, v.request);
  const ids = new Set(v.request.balloons.map((b: any) => b.id));
  if (v.sourceNotes !== undefined && (!v.sourceNotes || typeof v.sourceNotes !== 'object' || Array.isArray(v.sourceNotes) || Object.entries(v.sourceNotes).some(([id, note]) => !ids.has(id) || !string(note)))) throw new Error('Notas originales de auditoría no válidas.');
  for (const [id, value] of Object.entries(v.reviews)) {
    const r = value as any;
    if (!ids.has(id) || !r || !['accepted','corrected'].includes(r.decision) || !date(r.reviewedAt) || !string(r.note) || (r.decision === 'accepted' ? r.corrected !== null : !r.corrected)) throw new Error('Decisión de auditoría no válida.');
    if (r.corrected) { validateInterpretation(r.corrected); if (r.corrected.balloonId !== id) throw new Error('La corrección no corresponde al balloon.'); }
  }
}
export function auditFields(audit: AuditState, id: string): Interpretation | undefined {
  return audit.reviews[id]?.corrected ?? audit.response.characteristics.find(v => v.balloonId === id);
}
/** Copy committed transcriptions into drawing cards without changing the original evidence. */
export function applyAuditTranscriptions<T extends { zones: { id: string; type: string; note: string }[]; audit?: AuditState }>(project: T, audit: AuditState): T {
  validateAuditState(audit);
  const sameJob = project.audit?.request.jobId === audit.request.jobId;
  const sourceNotes = { ...(sameJob ? project.audit?.sourceNotes : undefined), ...audit.sourceNotes };
  const zones = project.zones.map(z => {
    const fields = auditFields(audit, z.id);
    if (z.type === 'coordinate' || !fields) return z;
    // Preserve an independent edit in the drawing card, including when reopening a ZIP.
    if (sameJob && project.audit?.sourceNotes?.[z.id] !== undefined && z.note !== auditFields(project.audit, z.id)?.transcription) return z;
    sourceNotes[z.id] ??= z.note;
    return { ...z, note: fields.transcription };
  });
  return { ...project, zones, audit: { ...audit, sourceNotes } };
}
export function auditCounts(audit: AuditState) {
  const rows = audit.response.characteristics;
  return { total: rows.length, pending: rows.filter(r => !audit.reviews[r.balloonId]).length, flagged: rows.filter(r => auditFields(audit, r.balloonId)?.manualReview).length, corrected: Object.values(audit.reviews).filter(r => r.decision === 'corrected').length };
}
export function recordReview(audit: AuditState, id: string, corrected: Interpretation | null, note = ''): AuditState {
  if (!audit.response.characteristics.some(r => r.balloonId === id)) throw new Error('Balloon no encontrado en la auditoría.');
  if (corrected) { validateInterpretation(corrected); if (corrected.balloonId !== id) throw new Error('La corrección no corresponde al balloon.'); }
  return { ...audit, reviews: { ...audit.reviews, [id]: { decision: corrected ? 'corrected' : 'accepted', reviewedAt: new Date().toISOString(), note, corrected: corrected ? structuredClone(corrected) : null } } };
}
export async function assertAuditMatches(audit: AuditState, project: any) {
  validateAuditState(audit);
  const contextAudit = project.audit?.request.jobId === audit.request.jobId ? project.audit : audit;
  if (audit.request.projectId !== project.id || audit.request.documentSha256 !== project.hash || audit.request.sourceDigest !== await sourceDigest({ ...project, audit: contextAudit })) throw new Error('La auditoría pertenece a otra versión del plano o sus recortes. Vuelve a ejecutar el agente sobre el proyecto actual.');
}
export async function assertFinalAudit(audit: AuditState, project: any) {
  await assertAuditMatches(audit, project);
  if (auditCounts(audit).pending) throw new Error('Revisa todos los balloons antes de exportar la auditoría final.');
  if (auditCounts(audit).flagged) throw new Error('Quedan incidencias de interpretación. Resuélvelas antes de exportar la auditoría final.');
}
const escapeXml = (value: unknown) => String(value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'})[c]!);
export function auditXml(audit: AuditState): string {
  validateAuditState(audit);
  return `  <audit contractVersion="1" jobId="${escapeXml(audit.request.jobId)}" sourceDigest="${audit.request.sourceDigest}" readingMethod="direct-vision">\n${audit.response.characteristics.map(original => {
    const r = auditFields(audit, original.balloonId)!, review = audit.reviews[r.balloonId];
    return `    <interpretation balloonId="${escapeXml(r.balloonId)}" decision="${review?.decision ?? 'pending'}" manualReview="${r.manualReview}">${(['transcription','classification','description','specification','gdtCallout','unit','ruleApplied','coordinateValue','reviewReason'] as const).map(k => `<${k}>${escapeXml(r[k])}</${k}>`).join('')}</interpretation>`;
  }).join('\n')}\n  </audit>\n`;
}
export function auditCsv(audit: AuditState): string {
  const quote = (v: unknown) => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const headers = ['Balloon ID','Balloon Number','Page','Classification','Transcription','Description','Specification','GDT Callout','Unit','Coordinate Value','Rule applied','Manual review flag','Review reason','Decision'];
  return '\ufeff' + [headers, ...audit.request.balloons.map(b => {
    const r = auditFields(audit,b.id)!;
    return [b.id,b.number,b.page,r.classification,r.transcription,r.description,r.specification,r.gdtCallout,r.unit,r.coordinateValue,r.ruleApplied,r.manualReview?'X':'',r.reviewReason,audit.reviews[b.id]?.decision ?? 'pending'];
  })].map(row => row.map(quote).join(';')).join('\r\n') + '\r\n';
}
export function agentResultSchema(request: AuditRequest) {
  const text = { type:'string', maxLength:20000 };
  const fields = { balloonId:{type:'string',enum:request.balloons.map(b=>b.id)},transcription:text,classification:{type:'string',enum:[...AUDIT_CLASSIFICATIONS]},description:text,specification:text,gdtCallout:text,unit:text,ruleApplied:text,coordinateValue:text,manualReview:{type:'boolean'},reviewReason:text };
  const properties = { contractVersion:{type:'integer',const:1},jobId:{type:'string',const:request.jobId},projectId:{type:'string',const:request.projectId},documentSha256:{type:'string',const:request.documentSha256},sourceDigest:{type:'string',const:request.sourceDigest},readingMethod:{type:'string',const:'direct-vision'},characteristics:{type:'array',items:{type:'object',properties:fields,required:Object.keys(fields),additionalProperties:false}} };
  return { type:'object',properties,required:Object.keys(properties),additionalProperties:false };
}
