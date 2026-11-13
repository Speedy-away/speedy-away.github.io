'use strict';
// Read-only byte and dependency audit; native scripts are never evaluated.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function audit(){
  const bridge=require('./console-payload-bridge.cjs'),actions=bridge.loadActions(root),selected=actions.filter(a=>a.run?.input==='user-file');
  for(const a of selected)bridge.userFileSpec(a);
  const payloads=await require('./verify-host-payloads.cjs').verifyHostPayloads({root,actions:actions.filter(a=>a.run?.input!=='user-file')});
  assert.equal(payloads.passed,true,JSON.stringify(payloads.files.filter(f=>!f.passed)));
  const report=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-loader-support.json'))),karo=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/karo/build.json')));
  let nativeScripts=0,dependencies=0,runtimeFiles=0;
  for(const job of karo.jobs.filter(j=>j.url.includes('/binloader/')&&/\.js$/.test(j.filename))){
    const name='binloader/'+job.url.split('/binloader/')[1],bytes=fs.readFileSync(path.join(root,karo.runtime,name));assert.equal(bytes.length,job.expectedBytes,name);assert.equal(sha(bytes),job.expectedSha256,name);nativeScripts++;
  }
  for(const group of report.legacy){
    const entry=path.join(root,group.runtimeEntry),html=fs.readFileSync(entry,'utf8');
    for(const m of html.matchAll(/\b(?:src|href|manifest)\s*=\s*["']([^"']+)["']/g)){
      const url=new URL(m[1],'https://host.invalid'+group.runtimeEntry);if(url.origin!=='https://host.invalid')continue;const target=path.join(root,decodeURIComponent(url.pathname));assert.ok(fs.existsSync(target),group.id+' missing '+m[1]);dependencies++;
    }
  }
  for(const runtime of JSON.parse(fs.readFileSync(path.join(root,'docs/host-runtime-builds.json'))).runtimes.filter(r=>r.console==='ps4'))for(const file of runtime.files){const b=fs.readFileSync(path.join(root,'hosts/runtime',runtime.id,file.path));assert.equal(b.length,file.bytes);assert.equal(sha(b),file.sha256,runtime.id+'/'+file.path);runtimeFiles++;}
  for(const f of [...Object.values(report.files),report.sender]){const b=fs.readFileSync(path.join(root,f.url));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
  return {date:'2026-11-13',passed:true,payloadFiles:payloads.summary,selectedOriginalFiles:{count:selected.length,status:'Metadata and upload contracts verified; original files must be selected by the user, so their bytes were not loaded or re-fetched.',ids:selected.map(a=>a.id)},standaloneBINLaunchers:report.legacy.length,nativeBINScriptsUnchanged:nativeScripts,localHTMLDependencies:dependencies,ps4RuntimeFiles:runtimeFiles,newLoaderFiles:2,payloadExecution:false,consoleContact:false,hardwareVerified:false};
}
if(require.main===module)audit().then(r=>{if(process.argv.includes('--write'))fs.writeFileSync(path.join(root,'docs/ps4-loader-audit.json'),JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(r,null,2));}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={audit};
