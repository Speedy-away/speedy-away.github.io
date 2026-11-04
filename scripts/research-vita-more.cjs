const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const repos = ['xyzz/vita-moonlight','Electry/VitaGrafix','SevyW/imago','Rinnegatamante/DaedalusX64-vitaGL','fgsfdsfgs/chocolate-doom','rsn8887/jumpnbump','theheroGAC/SuperTux-PSVITA','rsn8887/Enigma','mgba-emu/mgba','Electry/PSVshell','nowrep/vita-shellbat','MERLev/ds34vita','MERLev/reVita','dots-tb/PSVita-RE-tools'];
async function main() {
 const dir = path.join(root, 'tmp/vita-more'); fs.mkdirSync(dir,{recursive:true});
 const results = await Promise.all([...new Set(repos)].map(async repo => {
  try {
   const r = await fetch('https://github.com/'+repo+'/releases/latest'); const html = await r.text();
   const tag = r.url.split('/tag/')[1] || [...html.matchAll(/href="[^"]+\/releases\/tag\/([^"]+)"/g)][0]?.[1]; const key = repo.split('/')[1]; fs.writeFileSync(path.join(dir,key+'.html'),html);
   const assets = tag ? await (await fetch('https://github.com/'+repo+'/releases/expanded_assets/'+tag)).text() : '';
   fs.writeFileSync(path.join(dir,key+'-assets.html'),assets);
   const readmeResponse = await fetch('https://raw.githubusercontent.com/'+repo+'/HEAD/README.md');
   const readme = readmeResponse.ok ? await readmeResponse.text() : '';
   fs.writeFileSync(path.join(dir,key+'-README.md'),readme);
   return {repo,status:r.status,tag,release:r.url,dates:[...html.matchAll(/datetime="([^"]+)/g)].map(m=>m[1]),assets:[...assets.matchAll(/href="([^"]+releases\/download[^"]+)"/g)].map(m=>'https://github.com'+m[1])};
  } catch(e) {return {repo,error:e.message};}
 }));
 fs.writeFileSync(path.join(root,'docs/vita-more-release-snapshot.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
