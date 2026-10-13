const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const JSZip=require('jszip');
const {createHash}=require('node:crypto');
const {prepareJob,assembleResultZip}=require('../scripts/agent-bridge.cjs');
const {createAgentPackage}=require('../lib/agent-package.ts');
const {readAgentPackage}=require('../lib/agent-package.ts');
const {defaultBalloonSettings}=require('../lib/balloon-settings.ts');
const {defaultCoordinateTable}=require('../lib/tables.ts');
const {emptyMetadata}=require('../lib/document-metadata.ts');
const {validateProject}=require('../lib/balloons.ts');
const {withGridReferences}=require('../lib/grid.ts');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'balloon-bridge-test-'));
 assert.ok(path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep));
 try{
  const agentDir=path.join(temp,'agent'),jobsRoot=path.join(temp,'jobs');await fs.mkdir(agentDir);await fs.mkdir(jobsRoot);
  const skill=new JSZip();skill.file('SKILL.md','Fixture skill');skill.file('references/source_handling.md','Fixture rules');await fs.writeFile(path.join(agentDir,'interpret-balloons.zip'),await skill.generateAsync({type:'nodebuffer'}));
  for(const name of ['ballooning_classification_visual_reference.pdf','GDT_Visual_Reference.pdf','Welding_Visual_Reference.pdf'])await fs.writeFile(path.join(agentDir,name),'Fixture reference');
  const source=Buffer.from('%PDF-1.7\nFixture'),png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=';
  const zone={id:'zone-a',number:'101.1',page:1,type:'dimension',coordinate:null,tableCell:null,note:'',crop:'data:image/png;base64,'+png,x:10,y:10,width:20,height:10,bx:5,by:5,pageWidth:100,pageHeight:100,rotation:0,pdfRect:[10,10,30,20],regions:[{kind:'rectangle',points:[{x:10,y:10},{x:30,y:10},{x:30,y:20},{x:10,y:20}]}]};
  const project={version:9,id:'project-a',name:'fixture.pdf',hash:createHash('sha256').update(source).digest('hex'),zones:[zone],nextNumbers:{1:'102'},metadata:emptyMetadata(),grids:{},tables:[structuredClone(defaultCoordinateTable)],comparison:null,balloonSettings:defaultBalloonSettings,hideQuickMenu:false,preferredType:'dimension'};
  const settings={unit:'mm',generalToleranceMode:'none',generalTolerance:''};
  const input=await createAgentPackage(project,source,null,settings),job=await prepareJob(input.bytes,jobsRoot,agentDir);
  assert.equal(await fs.readFile(path.join(job.dir,'agent','interpret-balloons','SKILL.md'),'utf8'),'Fixture skill');
  const response={contractVersion:1,jobId:input.request.jobId,projectId:project.id,documentSha256:project.hash,sourceDigest:input.request.sourceDigest,readingMethod:'direct-vision',characteristics:[{balloonId:zone.id,transcription:'10 ± 0.1',classification:'DIMENSION',description:'Length',specification:'10 ± 0.1',gdtCallout:'',unit:'mm',ruleApplied:'dimensions_rules.md',coordinateValue:'',manualReview:false,reviewReason:''}]};
  const result=await assembleResultZip(job,response),zip=await JSZip.loadAsync(result),reopened=JSON.parse(await zip.file('project.json').async('string'));
  validateProject(reopened);assert.deepEqual(reopened.zones,withGridReferences(project).zones);assert.equal(reopened.audit.response.characteristics[0].specification,'10 ± 0.1');
  const audit=await readAgentPackage(result,project);assert.equal(audit.request.jobId,input.request.jobId);
  assert.deepEqual(await zip.file('source.pdf').async('nodebuffer'),source);
  const unsafe=await JSZip.loadAsync(input.bytes);unsafe.file('../escape.txt','bad');await assert.rejects(()=>prepareJobFromZip(unsafe,jobsRoot,agentDir));
  const changed=await JSZip.loadAsync(input.bytes);changed.file('source.pdf','different');await assert.rejects(()=>prepareJobFromZip(changed,jobsRoot,agentDir));
  const wrongCrop=await JSZip.loadAsync(input.bytes);wrongCrop.file('crops/zone-a.png','wrong');await assert.rejects(()=>prepareJobFromZip(wrongCrop,jobsRoot,agentDir));
  await assert.rejects(()=>assembleResultZip(job,{...response,characteristics:[]}));
  console.log('Verificado: preparación local de skill y referencias, huellas PDF/PNG, rutas ZIP, cobertura por ID y retorno de un proyecto editable.');
 }finally{await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
async function prepareJobFromZip(zip,jobsRoot,agentDir){return prepareJob(await zip.generateAsync({type:'nodebuffer'}),jobsRoot,agentDir);}
