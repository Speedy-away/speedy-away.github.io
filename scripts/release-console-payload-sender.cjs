'use strict';
// Upload a preserved sender ZIP as data. Never execute bundled/native files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {releaseInfo,markLocalOnly}=require('./sender-release-delivery.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const file=path.join(root,'downloads/helpers/console-payload-sender/manifest.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8')),info=manifest.files.find(f=>f.url===manifest.latest);if(!info)throw Error('Missing latest sender');
 const bytes=fs.readFileSync(path.join(root,info.url)),digest=hash(bytes);if(digest!==info.sha256||bytes.length!==info.bytes)throw Error('Sender identity mismatch');
 const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/download-audit.json'),'utf8')),backup=audit.items.flatMap(i=>i.files||[]).find(f=>f.sha256===digest&&f.backupPath&&fs.existsSync(f.backupPath));if(!backup||hash(fs.readFileSync(backup.backupPath))!==digest)throw Error('Verified F: sender copy is required');
 const delivery=releaseInfo(info);markLocalOnly(info,root);
 const saved=cp.execFileSync('git',['credential','fill'],{cwd:root,input:'protocol=https\nhost=github.com\nusername=Speedy-away\n\n'.replaceAll('\\n','\n'),encoding:'utf8',stdio:['pipe','pipe','pipe']});
 const credential=Object.fromEntries(saved.trim().split('\n').map(row=>{const at=row.indexOf('=');return [row.slice(0,at),row.slice(at+1)];}));if(!credential.password)throw Error('No saved GitHub credential');
 const headers={Authorization:'Bearer '+credential.password,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 async function api(endpoint,method='GET',body){const r=await fetch('https://api.github.com/repos/Speedy-away/WWB-HOST'+endpoint,{method,headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(r.status===404&&method==='GET')return null;if(!r.ok)throw Error('GitHub '+method+' '+endpoint+': HTTP '+r.status);return r.json();}
 let release=await api('/releases/tags/'+delivery.releaseTag);
 if(!release)release=await api('/releases','POST',{tag_name:delivery.releaseTag,target_commitish:process.env.SENDER_RELEASE_COMMIT||'main',name:'Console Payload Sender '+info.version,body:'Immutable, self-contained desktop sender snapshot. Source files and exact hashes are included in bundle-manifest.json inside the ZIP.\n\nBytes: '+info.bytes+'\nSHA-256: '+digest+'\n\nExtract the complete ZIP and follow README.md. Node.js 20 or newer is required. Physical console execution remains unverified.',draft:false,prerelease:false,make_latest:'false'});
 let asset=release.assets.find(a=>a.name===info.name);
 if(!asset){console.log('Uploading preserved ZIP ('+info.bytes+' bytes) to '+release.html_url);const upload=release.upload_url.replace(/\{.*$/,'')+'?name='+encodeURIComponent(info.name),r=await fetch(upload,{method:'POST',headers:{...headers,'Content-Type':'application/zip','Content-Length':String(bytes.length)},body:bytes,signal:AbortSignal.timeout(600000)});if(!r.ok)throw Error('Release upload HTTP '+r.status);asset=await r.json();}
 if(asset.size!==bytes.length||asset.state!=='uploaded'||asset.digest&&asset.digest!=='sha256:'+digest)throw Error('Release asset verification failed; existing asset preserved');
 Object.assign(info,delivery,{originalSource:info.originalSource||info.source,source:asset.browser_download_url,releaseAssetId:asset.id});
 const current=JSON.parse(fs.readFileSync(file,'utf8'));let savedInfo=current.files.find(f=>f.sha256===info.sha256);if(savedInfo)Object.assign(savedInfo,info);else current.files.push(info);
 fs.writeFileSync(file,JSON.stringify(current,null,2)+'\n');
 const index=path.join(root,'downloads/helpers/console-payload-sender/index.html'),before=fs.readFileSync(index,'utf8');fs.writeFileSync(index,before.replace('href="'+info.name+'"','href="'+asset.browser_download_url+'"'));
 const report={verifiedAt:new Date().toISOString(),version:info.version,name:info.name,bytes:bytes.length,sha256:digest,local:info.url,archivePath:backup.backupPath,release:release.html_url,downloadURL:asset.browser_download_url,assetId:asset.id,serverDigest:asset.digest,zipUnchanged:true,archiveVerified:true,downloadedCodeExecuted:false};
 fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/sender-release-delivery.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={main};
