// Convert reviewed publisher metadata into download records, never cheat bytes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir='docs/tmp/console-batch5';
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const decode=value=>value.replaceAll('&quot;','"').replaceAll('&apos;',"'").replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
const attrs=text=>Object.fromEntries([...text.matchAll(/([A-Za-z]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
const sourceVersions={'PPSA01342':'1.004','PPSA01619':'1.000.004'};
const sourceNames={'PPSA01342':"Demon's Souls Remake",'PPSA05366':'A Plague Tale Requiem','PPSA10261':'Lie of P'};
function inspect(bytes,pin,index){
  if(bytes.length!==pin.bytes||sha(bytes)!==pin.sha256)throw Error('Pinned SHN bytes differ');
  const text=bytes.toString('utf8').replace(/^\uFEFF/,'');
  if(/<!DOCTYPE|<!ENTITY/i.test(text)||!text.trim().endsWith('</Trainer>'))throw Error('Unsupported SHN markup');
  const trainer=attrs(text.match(/<Trainer\b([^>]+)>/)?.[1]||'');
  const indexLine=index.split(/\r?\n/).find(line=>line.startsWith(pin.filename+'='));
  if(!/^PPSA\d{5}$/.test(pin.titleId)||!/^\d{2}\.\d{3}\.\d{3}$/.test(pin.gameVersion)||pin.filename!==pin.titleId+'_'+pin.gameVersion+'.shn'||!indexLine)throw Error('Exact publisher filename/index identity missing');
  if(trainer.Cusa!==pin.titleId||trainer.Process!=='eboot.bin'||trainer.Version!==(sourceVersions[pin.titleId]||pin.gameVersion)||trainer.Game?.trim()!==(sourceNames[pin.titleId]||pin.game)||!trainer.Moder?.trim())throw Error('Embedded SHN game/version/process identity differs');
  const options=[...text.matchAll(/<Cheat\b([^>]*)>([\s\S]*?)<\/Cheat>/g)].map(match=>{
    const info=attrs(match[1]);if(!info.Text?.trim())throw Error('Missing cheat label');
    const lines=[...match[2].matchAll(/<Cheatline>([\s\S]*?)<\/Cheatline>/g)];if(!lines.length)throw Error('Missing cheat data');
    for(const [,line] of lines){
      if(!/<Offset>[a-f0-9]+<\/Offset>/i.test(line)||!/<Section>\d+<\/Section>/.test(line))throw Error('Invalid memory reference');
      for(const tag of ['ValueOn','ValueOff'])if(!new RegExp('<'+tag+'>[a-f0-9]{2}(?:-[a-f0-9]{2})*</'+tag+'>','i').test(line))throw Error('Invalid byte definition');
    }
    return {name:info.Text,description:info.Description||''};
  });
  if(!options.length)throw Error('No game-specific options');
  const notes=[];
  if(trainer.Version!==pin.gameVersion)notes.push('The original embedded Version is '+trainer.Version+'; the publisher filename/index pins '+pin.gameVersion+'. Neither filename nor file content was rewritten.');
  if(/encoding="utf-16"/.test(text))notes.push('The original XML declares utf-16 but contains UTF-8 text. Its bytes are preserved unchanged; parser behavior and gameplay have not been tested on hardware.');
  return {trainer,options,indexLine,metadataValidation:['Original SHN title ID, process, author and option byte fields checked against the pinned publisher file.',...notes].join(' ')};
}
function prepare(){
  const selected=read(dir+'/ps5-selected.json'),repository='https://github.com/etaHEN/PS5_Cheats';
  const index=fs.readFileSync(path.join(root,'docs/tmp/ps5-native-extra-cheats/shn.txt'),'utf8');
  const notices=read('docs/ps5-native-extra-cheats.json').notices;
  const license=notices.find(n=>n.filename==='LICENSE.txt');
  const licenceDownload='/downloads/ps4-ps5/'+license.id+'/'+license.filename;
  const resources=[],jobs=[];
  for(const pin of selected.selected){
    const bytes=fs.readFileSync(path.join(root,pin.importPath)),details=inspect(bytes,pin,index);
    const id='ps5-native-shn-'+pin.titleId.toLowerCase()+'-'+pin.gameVersion.replaceAll('.','-');
    const page='/console/ps5/game-cheats/'+pin.gameSlug+'/',source=repository+'/blob/'+selected.commit+'/shn/'+pin.filename;
    const installPath='/data/etaHEN/cheats/shn/'+pin.filename;
    const preparation=`Native PS5 ${pin.game}, ${pin.titleId}, update ${pin.gameVersion}. Copy the unchanged SHN file to /data/etaHEN/cheats/shn/. Launch the matching game and use etaHEN Toolbox > Cheats to select options. Back up any existing definition; keep only one format per title ID/update. Review the original author's conditions below. This is cheat data, not a standalone payload.`;
    resources.push({...pin,id,importJobId:id,name:pin.game+' · native PS5 '+pin.gameVersion,version:pin.gameVersion,platforms:['ps5'],category:'mods',format:'SHN',url:'/downloads/ps4-ps5/'+id+'/'+pin.filename,page,source,sourceRaw:pin.sourceRaw,sourceCommit:selected.commit,titleIds:[pin.titleId],compatibility:`Native PS5 only · ${pin.titleId} · game ${pin.gameVersion}. Requires an existing compatible etaHEN cheat manager; no firmware range or hardware success is inferred.`,image:'/assets/images/consoles/ps5-featured-image.avif',imageProvenance:'Platform artwork, not a game screenshot or cover',installationPath:installPath,preparation,cheats:details.options.map(o=>o.name),cheatDetails:details.options.filter(o=>o.description.trim()),cheatCount:details.options.length,credits:[details.trainer.Moder],metadataValidation:details.metadataValidation,sourceTrainer:details.trainer,publisherIndexEntry:details.indexLine,licenceDownload});
    jobs.push({id,title:pin.game+' · native PS5 SHN '+pin.titleId+' '+pin.gameVersion,platform:'PS5',category:['Games',pin.game,'Native PS5 Cheats'],project:'etaHEN PS5 Cheats',version:pin.titleId+' '+pin.gameVersion+' · '+selected.commit.slice(0,12),filename:pin.filename,url:pin.sourceRaw,sourceUrls:[source,repository+'/blob/'+selected.commit+'/shn.txt'],importPath:pin.importPath,expectedBytes:pin.bytes,expectedSha256:pin.sha256,archiveRole:['Builds'],mirror:true,pages:[page.slice(1)+'index.html','console/ps5/game-cheats.html','console/ps5/downloads.html']});
  }
  const out={reviewed:'2026-11-02',repository,commit:selected.commit,sourceScope:'Separate primary publisher expansion. VirusMike has no native PS5 game download page; these files are not attributed to it.',resources,licenceDownload};
  fs.writeFileSync(path.join(root,'docs/ps5-native-batch5.json'),JSON.stringify(out,null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/ps5-native-batch5-jobs.json'),JSON.stringify({reviewed:out.reviewed,jobs},null,2)+'\n');
  console.log(JSON.stringify({newNativeGames:resources.length,options:resources.reduce((s,r)=>s+r.cheatCount,0),bytes:resources.reduce((s,r)=>s+r.bytes,0)}));
}
module.exports={inspect,prepare};
if(require.main===module)prepare();
