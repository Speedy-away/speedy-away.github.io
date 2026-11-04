// Scoped intake: downloads data, statically inspects packages, and archives without execution.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {apps, frameworks} = require('./xbox-one-series-catalogue.cjs');
const {zip, inspect, artwork} = require('./xbox-one-series-packages.cjs');
const {createArchive} = require('./console-expansion-archive.cjs');
const root = path.resolve(__dirname, '..'), scope = 'xbox-one-series';
const staging = path.join(root, 'tmp', scope);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function preserve(file, bytes) {
  if (fs.existsSync(file)) {if (sha(fs.readFileSync(file)) !== sha(bytes)) throw Error('Refusing to replace different existing bytes: ' + file); return;}
  fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, bytes, {flag:'wx'});
}
async function main() {
  fs.mkdirSync(staging, {recursive:true});
  const archive = createArchive(), files = [], packageReports = [], credits = [];
  const allJobs = [...apps.flatMap(app => app.jobs.map(job => ({app,job}))), ...frameworks.map(job => ({app:{id:'frameworks', title:'Xbox UWP framework dependencies', category:'Tools', project:'https://github.com/TheElixZammuto/moonlight-xbox/releases/tag/1.18.2'}, job}))];
  for (const {app,job} of allJobs) {
    const source = path.join(staging, job.name);
    console.log(`Inspect/archive ${app.id}: ${job.name}`);
    if (!fs.existsSync(source)) {
      if (!process.argv.includes('--download')) throw Error('Stage the official release first: ' + job.name);
      console.log(`Downloading ${job.url}`);
      const response = await fetch(job.url, {signal:AbortSignal.timeout(240000)});
      if (!response.ok) throw Error(`${response.status}: ${job.url}`);
      preserve(source, Buffer.from(await response.arrayBuffer()));
    }
    const original = fs.readFileSync(source), packages = inspect(original, job.name);
    if (!packages.some(p => p.identity.ProcessorArchitecture === 'x64')) throw Error('No x64 UWP package in ' + job.name);
    const candidates = [{name:job.name, bytes:original, label:job.label, original:true, legacy:!!job.legacy, packages}];
    if (job.extract) {
      const container = zip(original);
      for (const pkg of packages.filter(p => p.identity.ProcessorArchitecture === 'x64')) {
        const member = pkg.member.split(' > ')[1];
        if (!member) throw Error('Unexpected wrapper');
        const bytes = container.read(member), name = path.posix.basename(member);
        if (!candidates.some(c=>c.name===name)) candidates.push({name, bytes, label:pkg.framework ? `${pkg.identity.Name} · x64` : `${app.title.split(' · ')[0]} · x64 install package`, packages:inspect(bytes,name), member, framework:pkg.framework});
      }
    }
    for (const candidate of candidates) {
      const digest = sha(candidate.bytes), local = `/downloads/${scope}/${app.id}/${candidate.name}`;
      preserve(path.join(root,local),candidate.bytes);
      const pkg = candidate.packages.find(p => p.identity.ProcessorArchitecture === 'x64' && !p.framework) || candidate.packages.find(p => p.identity.ProcessorArchitecture === 'x64');
      const version = candidate.framework || app.id === 'frameworks' ? pkg.identity.Version : job.version;
      const file = {name:candidate.name, sourceUrl:job.url, version, releaseTag:version, local, expectedBytes:candidate.bytes.length, expectedSha256:digest, archiveRole:['Builds'], format:path.extname(candidate.name).slice(1).toUpperCase(), ...(candidate.member ? {derivedFrom:{name:job.name,sha256:sha(original),member:candidate.member}} : {})};
      if (process.argv.includes('--archive')) await archive.writeBytes({scope,item:{id:`${scope}-${app.id}`,title:app.title,url:app.project,platform:'Xbox One and Series',category:[app.category],pages:['console/xbox-one-series.html']},file,bytes:candidate.bytes});
      files.push({appId:app.id,label:candidate.label,original:candidate.original || false,framework:candidate.framework || app.id === 'frameworks',legacy:!!candidate.legacy,models:job.models || app.models || ['one','series'],...file,bytes:candidate.bytes.length,sha256:digest,packages:candidate.packages.map(({xml,...p})=>p)});
      packageReports.push({name:candidate.name,local,bytes:candidate.bytes.length,sha256:digest,packages:candidate.packages});
    }
    if (app.id !== 'frameworks' && !credits.some(c=>c.appId===app.id)) {
      const choices = packages.filter(p=>!p.framework).sort((a,b)=>Number(/scale-400/.test(b.member))-Number(/scale-400/.test(a.member)));
      for (const pkg of choices) {
        const art = artwork(original,pkg.member);
        if (!art) continue;
        const extension = path.extname(art.name).toLowerCase(), image = `/assets/images/xbox-one-series/${app.id}${extension}`;
        preserve(path.join(root,image),art.buffer);
        credits.push({appId:app.id,image,credit:app.credit,source:job.url,package:job.name,member:pkg.member+' > '+art.name,sha256:sha(art.buffer)});
        break;
      }
    }
  }
  const catalogue = {schemaVersion:1,reviewed:'2026-11-02',platform:'Xbox One / Xbox Series S and X',apps:apps.map(({jobs,...app})=>({...app,files:files.filter(f=>f.appId===app.id),artwork:credits.find(c=>c.appId===app.id)})),frameworks:files.filter(f=>f.framework)};
  fs.writeFileSync(path.join(root,'docs/xbox-one-series-catalogue.json'),JSON.stringify(catalogue,null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/xbox-one-series-artwork.json'),JSON.stringify(credits,null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/xbox-one-series-package-verification.json'),JSON.stringify({reviewed:catalogue.reviewed,method:'Static ZIP/manifest inspection only; no builds executed',files:packageReports},null,2)+'\n');
  console.log(JSON.stringify({apps:catalogue.apps.length,files:files.length,artwork:credits.length,archived:process.argv.includes('--archive')}));
}
if (require.main === module) main().catch(error=>{console.error(error);process.exitCode=1});
module.exports={main};
