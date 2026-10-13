/** Local-only Codex runner. ChatGPT authentication stays in the installed CLI. */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const JSZip = require('jszip');
const ts = require('typescript');
const plainFs = require('node:fs');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(plainFs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, file);
const {validateAuditRequest, validateAgentResponse, createAuditState, agentResultSchema, sourceDigest, sha256, cropBytes, auditCsv} = require('../lib/audit.ts');
const {validateProject, makeXml} = require('../lib/balloons.ts');
const promptFor = require('./agent-prompt.cjs');
const ROOT = path.resolve(__dirname, '..');
const MAX_UPLOAD = 150 * 1024 * 1024;
const UUID = /^[a-zA-Z0-9-]{1,80}$/;
const json = (res, status, value) => { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); };
function cleanEnvironment() {
  const env = {...process.env};
  for (const k of ['OPENAI_API_KEY','CODEX_API_KEY']) delete env[k];
  return env;
}
function safePath(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Ruta de archivo no válida.');
  return target;
}
async function limitedFile(entry, max) {
  if (!entry) throw new Error('Falta un archivo requerido en el ZIP.');
  // JSZip exposes the ZIP central-directory size before inflation. Check it as
  // well as the actual bytes, so oversized compressed entries are rejected early.
  if(entry._data?.uncompressedSize > max)throw new Error('Un archivo del ZIP supera el límite permitido.');
  const bytes = await entry.async('uint8array');
  if (bytes.length > max) throw new Error('Un archivo del ZIP supera el límite permitido.');
  return bytes;
}
async function prepareJob(bytes, jobsRoot, agentDir) {
  if (bytes.length > MAX_UPLOAD) throw new Error('El paquete supera 150 MB.');
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files).filter(v=>!v.dir);
  if (entries.length > 10010) throw new Error('Demasiados archivos en el ZIP.');
  if(entries.reduce((sum,e)=>sum+(e._data?.uncompressedSize??0),0)>500*1024*1024)throw new Error('El contenido descomprimido supera 500 MB.');
  for (const entry of entries) {
    const name = entry.unsafeOriginalName ?? entry.name;
    if (name !== entry.name || !/^(request\.json|project\.json|inspection\.xml|result\.schema\.json|source\.pdf|revision\.pdf|crops\/[a-zA-Z0-9-]{1,80}\.png)$/.test(name)) throw new Error('El ZIP contiene una ruta o archivo no permitido.');
  }
  const request = JSON.parse(new TextDecoder().decode(await limitedFile(zip.file('request.json'),4*1024*1024)));
  const project = JSON.parse(new TextDecoder().decode(await limitedFile(zip.file('project.json'),100*1024*1024)));
  validateAuditRequest(request); validateProject(project);
  if (project.audit || request.projectId !== project.id || request.documentSha256 !== project.hash || request.sourceDigest !== await sourceDigest(project) || project.zones.length !== request.balloons.length) throw new Error('El proyecto no coincide con la solicitud.');
  const original = await limitedFile(zip.file('source.pdf'),MAX_UPLOAD);
  if (await sha256(original) !== project.hash) throw new Error('El PDF no coincide con su huella.');
  const crops = new Map(); let total = original.length;
  for (let i=0;i<request.balloons.length;i++) {
    const b=request.balloons[i], z=project.zones[i];
    if (z.id!==b.id || z.number!==b.number || z.page!==b.page || z.type!==b.type) throw new Error('La asociación del balloon no coincide.');
    const crop=await limitedFile(zip.file(b.cropPath),20*1024*1024); total+=crop.length;
    if (total>500*1024*1024) throw new Error('El contenido descomprimido supera 500 MB.');
    if (!Buffer.from(crop.subarray(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])) || await sha256(crop)!==b.sha256 || await sha256(cropBytes(z.crop))!==b.sha256) throw new Error('Un recorte no coincide con el balloon.');
    crops.set(b.cropPath,crop);
  }
  if (entries.filter(e=>e.name.startsWith('crops/')).length!==crops.size) throw new Error('El ZIP contiene recortes sin asociación.');
  let revision=null;
  if (project.comparison) revision=await limitedFile(zip.file('revision.pdf'),MAX_UPLOAD);
  const dir=safePath(jobsRoot,request.jobId);
  await fs.mkdir(dir,{recursive:false});
  try {
    await fs.writeFile(path.join(dir,'source.pdf'),original);
    if(revision)await fs.writeFile(path.join(dir,'revision.pdf'),revision);
    await fs.writeFile(path.join(dir,'request.json'),JSON.stringify(request,null,2));
    await fs.writeFile(path.join(dir,'project.json'),JSON.stringify(project));
    // Rebuild the XML and schema from validated inputs, rather than trusting client copies.
    await fs.writeFile(path.join(dir,'inspection.xml'),makeXml(project));
    await fs.writeFile(path.join(dir,'result.schema.json'),JSON.stringify(agentResultSchema(request),null,2));
    await fs.mkdir(path.join(dir,'crops'));
    for(const [name,crop] of crops)await fs.writeFile(safePath(dir,name),crop);
    const skillZip=await JSZip.loadAsync(await fs.readFile(path.join(agentDir,'interpret-balloons.zip')));
    const skillRoot=path.join(dir,'agent','interpret-balloons'); await fs.mkdir(skillRoot,{recursive:true});
    for(const entry of Object.values(skillZip.files).filter(e=>!e.dir)) {
      const name=entry.unsafeOriginalName ?? entry.name;
      if(name!==entry.name || !/^(SKILL\.md|references\/[a-zA-Z0-9_-]+\.(md|json))$/.test(name))throw new Error('Ruta no permitida en la skill del agente.');
      const target=safePath(skillRoot,name);await fs.mkdir(path.dirname(target),{recursive:true});
      await fs.writeFile(target,await limitedFile(entry,10*1024*1024));
    }
    await fs.access(path.join(skillRoot,'SKILL.md'));
    const referenceFiles=['ballooning_classification_visual_reference.pdf','GDT_Visual_Reference.pdf','Welding_Visual_Reference.pdf'];
    await fs.mkdir(path.join(dir,'agent','knowledge'),{recursive:true});
    for(const name of referenceFiles)await fs.copyFile(path.join(agentDir,name),path.join(dir,'agent','knowledge',name));
    await fs.writeFile(path.join(dir,'agent','references.json'),JSON.stringify(referenceFiles.map(name=>({name,path:'agent/knowledge/'+name})),null,2));
    return {dir,request,project,original,revision,crops};
  } catch(error) { throw new Error('No se pudo preparar el trabajo local: '+error.message); }
}
async function assembleResultZip(job, response) {
  validateAgentResponse(response,job.request);
  const audit=createAuditState(job.request,response), project={...job.project,audit};
  validateProject(project);
  const zip=new JSZip();
  zip.file('request.json',JSON.stringify(job.request,null,2));
  zip.file('agent-result.json',JSON.stringify(response,null,2));
  zip.file('audit.json',JSON.stringify(audit,null,2));
  zip.file('auditoria.csv',auditCsv(audit));
  zip.file('project.json',JSON.stringify(project));
  zip.file('inspection.xml',makeXml(project));
  zip.file('source.pdf',job.original);
  if(job.revision)zip.file('revision.pdf',job.revision);
  for(const [name,crop] of job.crops)zip.file(name,crop);
  zip.file('LEEME.txt','Abre este ZIP en Balloon Studio, rama de auditoría. Las interpretaciones están pendientes de revisión humana. Los IDs y recortes originales se conservan. agent-result.json conserva la respuesta original. project.json conserva el proyecto editable y la auditoría.');
  return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
async function body(req) {
  if(Number(req.headers['content-length'])>MAX_UPLOAD)throw new Error('El paquete supera 150 MB.');
  const chunks=[];let count=0;
  for await (const chunk of req) {count+=chunk.length;if(count>MAX_UPLOAD)throw new Error('El paquete supera 150 MB.');chunks.push(chunk);}
  return Buffer.concat(chunks);
}
async function startBridge(options={}) {
  const port=options.port ?? 4318;
  const agentDir=path.resolve(options.agentDir ?? process.env.BALLOON_AGENT_DIR ?? path.join(ROOT,'..','Balloon-Expert-Agent'));
  const jobsRoot=path.resolve(options.jobsRoot ?? path.join(ROOT,'.balloon-agent','jobs'));
  const token=options.token ?? randomBytes(32).toString('hex');
  const codex=options.codex ?? process.env.BALLOON_CODEX_BIN ?? 'codex';
  const origins=new Set(options.origins ?? (process.env.BALLOON_ALLOWED_ORIGINS ?? 'http://127.0.0.1:4173,http://localhost:4173,http://127.0.0.1:5173,http://localhost:5173,https://balloon-studio-git-codex-agent-audit-jps-projects-7afdaa84.vercel.app').split(',').map(s=>s.trim()));
  origins.add(`http://127.0.0.1:${port}`);origins.add(`http://localhost:${port}`);
  const auth=spawnSync(codex,['login','status'],{encoding:'utf8',env:cleanEnvironment(),windowsHide:true});
  if(auth.status!==0 || !/Logged in using ChatGPT/.test((auth.stdout??'')+(auth.stderr??'')))throw new Error('Inicia sesión con ChatGPT mediante codex login. Este servicio no acepta claves de API.');
  await fs.access(path.join(agentDir,'interpret-balloons.zip'));
  await fs.mkdir(jobsRoot,{recursive:true});
  const jobs=new Map(); let active=null;
  const publicJob=j=>({id:j.id,status:j.status,message:j.message,createdAt:j.createdAt,updatedAt:j.updatedAt});
  const persist=async j=>{j.updatedAt=new Date().toISOString();await fs.writeFile(path.join(j.dir,'bridge-state.json'),JSON.stringify(publicJob(j)));};
  async function loadJob(id) {
    if(jobs.has(id))return jobs.get(id);
    if(!UUID.test(id))return null;
    try {
      const dir=safePath(jobsRoot,id),saved=JSON.parse(await fs.readFile(path.join(dir,'bridge-state.json'),'utf8'));
      if(saved.id!==id)return null;
      const job={...saved,dir,child:null};
      if(['running','preparing'].includes(job.status)){job.status='failed';job.message='El servicio se cerró durante el trabajo. Ejecuta una nueva solicitud.';await persist(job);}
      jobs.set(id,job);return job;
    }catch{return null;}
  }
  async function run(job) {
    let timer;
    try {
      job.status='running';job.message='Interpretando los recortes con la skill y las referencias.';await persist(job);
      if(job.status==='cancelled')return;
      const output=path.join(job.dir,'agent-result.json');
      const args=['exec','--sandbox','workspace-write','--skip-git-repo-check','--ephemeral','--json','--output-schema',path.join(job.dir,'result.schema.json'),'--output-last-message',output,'-'];
      const child=spawn(codex,args,{cwd:job.dir,env:cleanEnvironment(),windowsHide:true,stdio:['pipe','pipe','pipe']});job.child=child;
      const log=plainFs.createWriteStream(path.join(job.dir,'codex-events.log'),{flags:'a'});
      child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
      timer=setTimeout(()=>{job.timedOut=true;child.kill();},60*60*1000);
      const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>resolve(code));});
      child.stdin.on('error',()=>{});child.stdin.end(promptFor(job.request));
      let code;try{code=await exited;}finally{log.end();}
      if(job.status==='cancelled')return;
      if(job.timedOut)throw new Error('El trabajo excedió una hora. Reduce el lote de balloons.');
      if(code!==0)throw new Error('Codex terminó con un error. Consulta codex-events.log en la carpeta del trabajo.');
      const resultText=await fs.readFile(output,'utf8');
      if(resultText.length>32*1024*1024)throw new Error('La respuesta del agente es demasiado grande.');
      const response=JSON.parse(resultText);
      await fs.writeFile(path.join(job.dir,'result.zip'),await assembleResultZip(job, response));
      job.status='completed';job.message='Interpretación terminada. Resultado validado y pendiente de auditoría humana.';await persist(job);
    }catch(error){if(job.status!=='cancelled'){job.status='failed';job.message=error.message;await persist(job);}}
    finally{clearTimeout(timer);job.child=null;delete job.project;delete job.original;delete job.revision;delete job.crops;delete job.request;if(active===job.id)active=null;}
  }
  const server=http.createServer(async(req,res)=>{
    const origin=req.headers.origin;
    if(origin && !origins.has(origin)){json(res,403,{error:'Origen no autorizado en el servicio local.'});return;}
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
    if(req.headers.host!==`127.0.0.1:${port}` && req.headers.host!==`localhost:${port}`){json(res,403,{error:'Host no autorizado.'});return;}
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network','true');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const pathname=new URL(req.url,'http://localhost').pathname;
    // Serve the same compiled UI from loopback as a usable alternative when a
    // browser cannot grant a public Vercel page access to local services.
    let asset;
    try{asset=pathname==='/'?'index.html':decodeURIComponent(pathname).replace(/^\//,'');}catch{json(res,400,{error:'Ruta no válida.'});return;}
    if(req.method==='GET' && /^(index\.html|favicon\.svg|pdf\.worker\.min\.mjs|(?:assets|cmaps|standard_fonts|wasm)\/[^\0\\]+)$/.test(asset)){
      try{
        const bytes=await fs.readFile(safePath(path.join(ROOT,'dist','static'),asset));
        const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm','.png':'image/png','.woff2':'font/woff2'}[path.extname(asset)]??'application/octet-stream';
        res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-store'});res.end(bytes);
      }catch{json(res,404,{error:'Compila la app con npm run build:static antes de abrirla localmente.'});}
      return;
    }
    const supplied=Buffer.from(req.headers.authorization?.replace(/^Bearer /,'')??''), expected=Buffer.from(token);
    if(supplied.length!==expected.length || !timingSafeEqual(supplied,expected)){json(res,401,{error:'Código de conexión no válido.'});return;}
    try {
      if(req.method==='GET' && pathname==='/health'){json(res,200,{version:1,auth:'chatgpt',activeJob:active});return;}
      if(req.method==='POST' && pathname==='/jobs') {
        if(active){json(res,409,{error:'Hay un trabajo en ejecución. Espera o cancélalo.'});return;}
        if(!req.headers['content-type']?.startsWith('application/zip')){json(res,415,{error:'Envía un ZIP de solicitud.'});return;}
        active='preparing';
        let prepared;
        try{prepared=await prepareJob(await body(req),jobsRoot,agentDir);}catch(error){active=null;throw error;}
        const job={...prepared,id:prepared.request.jobId,status:'preparing',message:'Preparando interpretación.',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),child:null};
        jobs.set(job.id,job);active=job.id;await persist(job);json(res,202,publicJob(job));void run(job);return;
      }
      const route=pathname.match(/^\/jobs\/([a-zA-Z0-9-]{1,80})(?:\/(result|cancel))?$/);
      if(route){
        const job=await loadJob(route[1]);if(!job){json(res,404,{error:'Trabajo no encontrado.'});return;}
        if(req.method==='GET' && !route[2]){json(res,200,publicJob(job));return;}
        if(req.method==='POST' && route[2]==='cancel'){
          if(!['preparing','running'].includes(job.status)){json(res,409,{error:'El trabajo ya ha terminado.'});return;}
          job.status='cancelled';job.message='Trabajo cancelado.';job.child?.kill();await persist(job);json(res,200,publicJob(job));return;
        }
        if(req.method==='GET' && route[2]==='result'){
          if(job.status!=='completed'){json(res,409,{error:'El trabajo todavía no tiene resultado.'});return;}
          const bytes=await fs.readFile(path.join(job.dir,'result.zip'));
          res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${job.id}.interpreted.zip"`,'Cache-Control':'no-store'});res.end(bytes);return;
        }
      }
      json(res,404,{error:'Ruta no encontrada.'});
    }catch(error){json(res,400,{error:error.message});}
  });
  server.requestTimeout=120000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  server.on('close',()=>{for(const j of jobs.values())if(j.child)j.child.kill();});
  return {server,token,port,origins,jobs};
}
module.exports={prepareJob,assembleResultZip,startBridge};
if(require.main===module){
  startBridge().then(({port,token,origins,server})=>{
    console.log(`Balloon Expert local · http://127.0.0.1:${port}\nPuedes abrir la app completa en esa URL o conectar la web de Vercel.\nAutenticación: sesión de ChatGPT de Codex. No se usan claves de API.\nCódigo de conexión (solo para esta sesión): ${token}\nOrígenes autorizados:\n${[...origins].join('\n')}\nMantén esta terminal abierta mientras interpretas. Los trabajos se guardan en .balloon-agent/jobs.`);
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
  }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
