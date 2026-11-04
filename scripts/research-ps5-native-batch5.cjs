const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir='docs/tmp/console-batch5';
const commit=require('../docs/ps5-native-extra-cheats.json').commit;
const selected=[
  ['demons-souls',"Demon's Souls",'PPSA01342','01.004.000'],
  ['mortal-kombat-11','Mortal Kombat 11','PPSA01619','01.000.004'],
  ['maneater','Maneater','PPSA01861','01.000.010'],
  ['alan-wake-remastered','Alan Wake Remastered','PPSA01925','01.000.003'],
  ['no-more-heroes-iii','No More Heroes III','PPSA07576','01.000.000'],
  ['a-plague-tale-requiem','A Plague Tale: Requiem','PPSA05366','01.005.000'],
  ['tales-of-arise','Tales of Arise','PPSA02745','01.000.004'],
  ['lies-of-p','Lies of P','PPSA10261','01.000.000']
].map(([gameSlug,game,titleId,gameVersion])=>({gameSlug,game,titleId,gameVersion,filename:`${titleId}_${gameVersion}.shn`}));
async function main(){
  fs.mkdirSync(path.join(root,dir),{recursive:true});
  const treeFile=path.join(root,dir,'ps5-tree.json');
  if(!fs.existsSync(treeFile)){
    const response=await fetch(`https://api.github.com/repos/etaHEN/PS5_Cheats/git/trees/${commit}?recursive=1`,{headers:{'User-Agent':'whatsite-game-download-review'},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('Tree HTTP '+response.status);fs.writeFileSync(treeFile,await response.text());
  }
  const tree=JSON.parse(fs.readFileSync(treeFile,'utf8'));if(tree.sha!==commit||tree.truncated)throw Error('Incomplete publisher tree');
  for(const entry of selected){
    const member='shn/'+entry.filename,blob=tree.tree.find(f=>f.path===member);
    if(!blob)throw Error('Missing publisher file '+member);
    const target=path.join(root,dir,entry.filename),url=`https://raw.githubusercontent.com/etaHEN/PS5_Cheats/${commit}/${member}`;
    let bytes;
    if(fs.existsSync(target))bytes=fs.readFileSync(target);else{
      const response=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('HTTP '+response.status);
      bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1024*1024)throw Error('Oversized cheat definition');
      fs.writeFileSync(target,bytes,{flag:'wx'});
    }
    const gitBlob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
    if(gitBlob!==blob.sha||bytes.length!==blob.size)throw Error('Publisher Git blob mismatch');
    Object.assign(entry,{sourceRaw:url,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),gitBlob,importPath:dir+'/'+entry.filename});
    console.log(entry.game,bytes.length,bytes.subarray(0,96).toString('utf8'));
  }
  fs.writeFileSync(path.join(root,dir,'ps5-selected.json'),JSON.stringify({commit,selected},null,2)+'\n');
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
