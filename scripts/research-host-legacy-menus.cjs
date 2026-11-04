'use strict';
// Read primary host source as text/data only. Never execute its JavaScript or payloads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const repos = ['KAR0218/KAR0218.github.io', 'Nazky/PSFree', 'kmeps4/psfree900a'];
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
async function read(url) {
  const response = await fetch(url, {headers:{'User-Agent':'whatsite-primary-source-review'}, signal:AbortSignal.timeout(45000)});
  if (!response.ok) throw Error(response.status + ' ' + url);
  return Buffer.from(await response.arrayBuffer());
}
async function main() {
  const out = {checkedAt:new Date().toISOString(), note:'Source read only; no exploit or payload executed.', repositories:[]};
  for (const repo of repos) {
    const tree = JSON.parse(await read('https://api.github.com/repos/' + repo + '/git/trees/main?recursive=1'));
    const record = {repo, commit:tree.sha, candidates:tree.tree.filter(x=>/gta|arabic|beef|lamance|expul|wild|rebel|lotus|lt[rs]|mod[sc]|menu|payloads\.js|index\.html/i.test(x.path)).map(({path,size,type})=>({path,size,type})), sources:[]};
    const files = repo.startsWith('KAR0218/') ? ['900New/index.html','900New/README.md','900New/payload.js'] : repo.startsWith('Nazky/') ? ['README.md','payloads/payloads.js'] : ['README.md','index.html'];
    for (const file of files) {
      const url = `https://raw.githubusercontent.com/${repo}/${tree.sha}/${file}`;
      try {const bytes=await read(url);record.sources.push({file,url,sha256:digest(bytes),text:bytes.toString('utf8')});}
      catch(error) {record.sources.push({file,url,error:error.message});}
    }
    out.repositories.push(record);
  }
  fs.writeFileSync(path.join(root,'docs/qa/host-legacy-research.json'),JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify(out.repositories.map(r=>({repo:r.repo,commit:r.commit,candidates:r.candidates.filter(x=>!x.path.endsWith('index.html')),sources:r.sources.map(({file,sha256,error})=>({file,sha256,error}))})),null,2));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
