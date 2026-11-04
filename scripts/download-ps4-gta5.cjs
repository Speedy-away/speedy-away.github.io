const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../downloads/ps4/GTA5');
const cdn = (p, q) => 'https://cdn.discordapp.com/attachments/' + p + '?' + q + '&';
const files = [
['157','Expulsion 7.0','Expulsion_V7.0.zip','https://www.mediafire.com/file/t3kgvyhof1ig5sm/Expulsion_V7.0.zip/file','expulsion-preview.png'],
['157','Ozark','ozarkrbn_1.zip',cdn('1552113897882910811/1552114071992664094/ozarkrbn_1.zip','ex=6ae8819f&is=6ae7301f&hm=11aa35473572c85055b450a9d6af7f32da206ba40c2134f0a051334e05e4a3b4'),'ozark.png'],
['157','Velora 1.5','Velora.sprx',cdn('1551562290258518167/1561212081712136232/Velora.sprx','ex=6ae8a54e&is=6ae753ce&hm=6e211c1eff62ace1d7ee06de406a5c19e84dacc7888261a718dccf3024ecf2de'),'velora.png'],
['157','Beach','BeachMenu157.prx',cdn('1552861165477040219/1552861203787812914/BeachMenu157.prx','ex=6ae89671&is=6ae744f1&hm=f80f7ddec485b36b232a368815c344d57c02ecea8f66a1239687d846503b0a6d&'.replace(/&$/,'')),'beach.png'],
['157','LTS','LRS.prx',cdn('1553009205764685856/1554233714660081734/LRS.prx','ex=6ae8f771&is=6ae7a5f1&hm=f6a4b81491a85c6add4b5fa02e6a9e2806d031dcbe86e51bd1966058f271a888'),'lts.png'],
['157','Serendipity','Seren.prx',cdn('1563209961096613918/1563210180227764276/Seren.prx','ex=6ae8a9ee&is=6ae7586e&hm=7b3ccfdb3da7466417a452588e4f522591951274d24e3cde18fd97a6259e4d26'),'serendipity.png'],
['156','Ozark','ozarkrbn_2.rar',cdn('1551563249328328754/1551565064954183710/ozarkrbn_2.rar','ex=6ae87c92&is=6ae72b12&hm=55890bd9cc4aea1961328e6e338817a94e6994b769c2118abe026c074dc1f458'),'ozark.png'],
['156','Velora','Velora.sprx',cdn('1551562652281602089/1551562896880828506/Velora.sprx','ex=6ae87a8d&is=6ae7290d&hm=c9a477ff72e4208e939947e43287198de4dc71593a8739e2e4374c043e56255d'),'velora.png'],
['156','Oxagon Full','Oxagon-v1.0.zip',cdn('1526686816672153732/1526690993838100530/Oxagon-v1.0.zip','ex=6ae8f649&is=6ae7a4c9&hm=a72cf00193711f237a3269a412a3dc3eaa59857fdb82b99c367843029ab543a6'),'oxagon.png'],
['156','Oxagon Lite','Oxagon-Lite-v1.4.zip',cdn('1521234351797309481/1526678431444504676/Oxagon-Lite-v1.4.zip','ex=6ae8ea96&is=6ae79916&hm=4b19539b90824e0e0fa671cf89b0d4c45c5460438e5ad076f744d5cc2585ccdd'),'oxagon.png'],
['156','Beach','BeachMenu156.prx',cdn('1552861357584425001/1552861390170234950/BeachMenu156.prx','ex=6ae8969e&is=6ae7451e&hm=6f59cb323c55c7f5e894bd0b6d7ad6490e3dea82e37239a65e4d0bb229003ca7'),'beach.png'],
['scripts','Script Loader','Script_Loader.zip',cdn('1551565519306629140/1551565963395211364/Script_Loader.zip','ex=6ae87d68&is=6ae72be8&hm=96c8a504599f7acc63dd9538254d2eeebd92533262346120e5f8274d0018a9eb'),null],
['scripts','FCLoader','FCLoader.csc',cdn('1551565519306629140/1551567930582368346/FCLoader.csc','ex=6ae87f3d&is=6ae72dbd&hm=6779d10fa413704ec99e8d1c626a76372a24ccfb647fcdcd9bab76ede88303d6'),null],
['scripts','GTA Fucker','GTAFUCKER.csc',cdn('1551565519306629140/1552083482921009222/GTAFUCKER.csc','ex=6ae86522&is=6ae713a2&hm=dd17ffc1e5c2f364dd992b57617bc8f4edd334fabab52ee66097181222840778'),'gta-fucker.png'],
['scripts','Random Scripts Pack','scripts.zip',cdn('1551565519306629140/1551566073567117362/scripts.zip','ex=6ae87d82&is=6ae72c02&hm=be8e7fbad6ec08a3151fbe3428b8f2248ce64e5747b610093b201d8963936f5b'),null],
];
fs.mkdirSync(root, {recursive:true});
async function download([group,name,filename,source,image]) {
  const dir=path.join(root,group);fs.mkdirSync(dir,{recursive:true});
  const target=path.join(dir,filename);
  const item={group,name,filename,source,image,status:'unavailable'};
  try {
    if(!fs.existsSync(target)) {
      let response=await fetch(source,{signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      if(source.includes('mediafire.com')) {
        const html=await response.text();
        const tag=[...html.matchAll(/<a\b[^>]*>/gi)].map(m=>m[0]).find(t=>/id="downloadButton"/.test(t));
        const url=tag?.match(/href="([^"]*)"/)?.[1]?.replaceAll('&amp;','&');
        if(!url||!new URL(url).hostname.endsWith('.mediafire.com'))throw Error('MediaFire direct link not available');
        response=await fetch(url,{signal:AbortSignal.timeout(90000)});
        if(!response.ok)throw Error('Download HTTP '+response.status);
      }
      const buffer=Buffer.from(await response.arrayBuffer());
      if(!buffer.length||/html|json|text\/plain/i.test(response.headers.get('content-type')||''))throw Error('Server returned an error page instead of a file');
      if(filename.endsWith('.zip')&&buffer.subarray(0,2).toString()!=='PK')throw Error('Invalid ZIP signature');
      fs.writeFileSync(target,buffer);
    }
    const buffer=fs.readFileSync(target);
    Object.assign(item,{status:'downloaded',bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),local:'/downloads/ps4/GTA5/'+group+'/'+filename});
  } catch(error) { item.error=error.message; }
  console.log(name+' ['+group+']: '+item.status+(item.error?' ('+item.error+')':''));
  return item;
}
(async()=>{const results=[];for(let i=0;i<files.length;i+=3)results.push(...await Promise.all(files.slice(i,i+3).map(download)));fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({files:results},null,2)+'\n');console.log(`${results.filter(f=>f.status==='downloaded').length}/${results.length} files downloaded. No files executed or extracted.`);})();
