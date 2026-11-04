// Fetch only publisher indexes and the source-linked custom map page.
// Source text is inspected as data and never executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir='docs/tmp/console-batch5';
async function main(){
  fs.mkdirSync(path.join(root,dir),{recursive:true});
  const ps5=require('../docs/ps5-native-extra-cheats.json');
  const ps4=require('../docs/ps4-extra-game-cheats.json');
  const targets=[
    ['ps5-json-index.txt',`https://raw.githubusercontent.com/etaHEN/PS5_Cheats/${ps5.commit}/json.txt`],
    ['ps4-json-index.txt',`https://raw.githubusercontent.com/GoldHEN/GoldHEN_Cheat_Repository/${ps4.commit}/json.txt`],
    ['bo3-cjhouse-mediafire.html','https://www.mediafire.com/file/rbwfnw29u46mkdh/zm_cjhouse.rar/file'],
    ['source-bo3.html','https://sites.google.com/view/im-virusmike-exe/ps4-all-you-need/call-of-duty-black-ops-iii']
  ];
  const results=await Promise.allSettled(targets.map(async([file,url])=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error(file+': HTTP '+response.status);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>3*1024*1024)throw Error('Unexpected source size');
    fs.writeFileSync(path.join(root,dir,file),bytes);
    return {file:dir+'/'+file,url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  }));
  const report={checkedAt:new Date().toISOString(),results:results.map((r,i)=>r.status==='fulfilled'?r.value:{url:targets[i][1],error:r.reason.message})};
  fs.writeFileSync(path.join(root,dir,'research.json'),JSON.stringify(report,null,2)+'\n');
  for(const r of report.results)console.log(r);
  const index=path.join(root,dir,'ps5-json-index.txt');
  if(fs.existsSync(index))console.log(fs.readFileSync(index,'utf8').split(/\r?\n/).filter(x=>x.startsWith('PPSA')).join('\n'));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
