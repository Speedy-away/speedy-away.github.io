'use strict';
// Acquire bounded static evidence, not whole repositories. Never evaluate it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tmp/host-672-review');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(45000),headers:{'User-Agent':'whatsite-static-loader-review'}});const b=Buffer.from(await r.arrayBuffer());if(b.length>8*1024*1024)throw Error('Evidence file too large');return {url,status:r.status,bytes:b.length,sha256:sha(b),data:b};}
async function main(){
 const report={checkedAt:new Date().toISOString(),repositories:[],method:'Metadata and selected original files only; no clone, source evaluation, payload execution or console contact.'};
 for(const repo of ['GamerHack/GamerHack.github.io','KAR0218/KAR0218.github.io']){
  const meta=await get('https://api.github.com/repos/'+repo);if(meta.status!==200)throw Error('Metadata '+meta.status);const metadata=JSON.parse(meta.data);
  const head=await get('https://api.github.com/repos/'+repo+'/commits/'+metadata.default_branch);if(head.status!==200)throw Error('Head '+head.status);const commit=JSON.parse(head.data).sha;
  const tr=await get('https://api.github.com/repos/'+repo+'/git/trees/'+commit+'?recursive=1');if(tr.status!==200)throw Error('Tree '+tr.status);const tree=JSON.parse(tr.data);if(tree.truncated)throw Error('Truncated tree');
  const base=path.join(out,repo.split('/')[0],commit);fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,'tree.json'),tr.data);
  const row={repo,commit,branch:metadata.default_branch,license:metadata.license,tree:tree.tree.map(({path,sha,size,type})=>({path,sha,size,type})),files:[]};
  const files=repo.startsWith('GamerHack')?['672/index.html','672/pl_loader.js','672/jb2.js','672/pl_GTA_ArabicGuy100.bin','672/pl_GTA_ArabicGuy127.bin','672/pl_GTA_ArabicGuy132.bin','672/cache.manifest','672goldhen/index.html']:['672/index.html','672A/index.html','672L/index.html','Goldhen672/index.html','binloader/index.html'];
  files.push(...tree.tree.filter(x=>/^(LICENSE|COPYING|README)(\.|$)/i.test(x.path)&&x.type==='blob').map(x=>x.path));
  for(const name of files){const r=await get('https://raw.githubusercontent.com/'+repo+'/'+commit+'/'+name);if(r.status===200){const target=path.join(base,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,r.data);}delete r.data;row.files.push({path:name,...r});}report.repositories.push(row);
 }
 const reportDir=path.join(root,'docs/host-reviews/ps4/6.72/arabicguy');fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'source-acquisition.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.repositories.map(r=>({repo:r.repo,commit:r.commit,license:r.license,files:r.files.map(f=>({path:f.path,status:f.status,bytes:f.bytes})),relevantTree:r.tree.filter(x=>/672|binloader|licen|readme/i.test(x.path)).map(x=>({path:x.path,size:x.size})).filter(x=>!x.path.includes('ps5/'))})),null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
