const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const metadata=require('../docs/vita-more-files.json');
const artwork=[
 ['psvshell','https://user-images.githubusercontent.com/12598379/71311344-c1f68980-241e-11ea-9ca1-4207d4887002.png','Electry · official PSVshell HUD screenshot','https://github.com/Electry/PSVshell'],
 ['shellbat','https://raw.githubusercontent.com/nowrep/vita-shellbat/r10/doc/screenshot.jpg','nowrep · official shellbat screenshot (MIT repository)','https://github.com/nowrep/vita-shellbat'],
 ['revita','https://raw.githubusercontent.com/MERLev/reVita/1.0.8/include/screenshot.png','MERLev · official reVita menu screenshot','https://github.com/MERLev/reVita'],
 ['imago','https://raw.githubusercontent.com/SevyW/imago/v1.3.0/docs/images/discover.png','Sevy · official Imago emulator screenshot (MIT project)','https://github.com/SevyW/imago'],
 ['jumpnbump','https://raw.githubusercontent.com/rsn8887/jumpnbump/master/screenshots/jumpnbump_shot_1.png','rsn8887 / Brainchild Design · official port screenshot','https://github.com/rsn8887/jumpnbump#thanks'],
 ['enigma','https://raw.githubusercontent.com/rsn8887/Enigma/master/screenshots/enigma_vita_4.jpg','rsn8887 / Enigma team · official Vita screenshot','https://github.com/rsn8887/Enigma/blob/master/README.MD']
];
async function main(){
 for(const row of metadata.items)for(const f of row.files){if(f.verification.paths){f.verification.samplePaths=f.verification.paths.slice(0,12);delete f.verification.paths;}}
 for(const [id,url,credit,creditSource] of artwork){
  const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(id+' image HTTP '+r.status);const b=Buffer.from(await r.arrayBuffer());
  if(!['89504e470d0a1a0a','ffd8ffe000104a46'].some(s=>b.toString('hex').startsWith(s))&&!b.subarray(0,2).equals(Buffer.from([255,216])))throw Error('Not an image');
  const ext=b[0]===137?'png':'jpg',local='/assets/images/vita-more/'+id+'-screenshot.'+ext;
  fs.writeFileSync(path.join(root,local),b);
  const item=metadata.items.find(x=>x.id===id);item.screenshot={local,source:url,credit,creditSource,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};
 }
 fs.writeFileSync(path.join(root,'docs/vita-more-files.json'),JSON.stringify(metadata,null,2)+'\n');
 console.log(artwork.length+' official screenshots saved; package-icon credits retained.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
