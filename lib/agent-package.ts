import { makeXml } from './balloons';
import { withGridReferences } from './grid';
import { createAuditRequest, createAuditState, assertAuditMatches, validateAuditRequest, agentResultSchema, type AuditState, type JobSettings } from './audit';

export async function createAgentPackage(project: any, source: Uint8Array, revision: Uint8Array | null, settings: JobSettings) {
  const JSZip = (await import('jszip')).default;
  const snapshot = structuredClone(withGridReferences(project));
  delete snapshot.audit;
  const request = await createAuditRequest(snapshot, settings);
  const zip = new JSZip();
  zip.file('request.json', JSON.stringify(request, null, 2));
  zip.file('project.json', JSON.stringify(snapshot));
  zip.file('inspection.xml', makeXml(snapshot));
  zip.file('result.schema.json', JSON.stringify(agentResultSchema(request), null, 2));
  zip.file('source.pdf', source);
  if (revision && snapshot.comparison) zip.file('revision.pdf', revision);
  for (const z of snapshot.zones) zip.file(`crops/${z.id}.png`, z.crop.split(',')[1], { base64:true });
  return { request, bytes: await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}) };
}
export async function readAgentPackage(bytes: Uint8Array, project: any): Promise<AuditState> {
  const JSZip = (await import('jszip')).default;
  if (bytes.byteLength > 150 * 1024 * 1024) throw new Error('El ZIP supera 150 MB.');
  const zip = await JSZip.loadAsync(bytes);
  const requestFile = zip.file('request.json'), resultFile = zip.file('agent-result.json');
  if (!requestFile || !resultFile) throw new Error('El ZIP de respuesta debe incluir request.json y agent-result.json.');
  const requestText = await requestFile.async('string'), resultText = await resultFile.async('string');
  if (requestText.length > 4 * 1024 * 1024 || resultText.length > 32 * 1024 * 1024) throw new Error('La respuesta contiene archivos de datos demasiado grandes.');
  const request = JSON.parse(requestText); validateAuditRequest(request);
  const audit = createAuditState(request, JSON.parse(resultText));
  await assertAuditMatches(audit, project);
  return audit;
}
