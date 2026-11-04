const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hashes={'1.56':'b1aaba333941b6a251d892c63fc0c716870035b0be5bac09f803f7f301d92934','1.57':'d762dac0be6e2f893a531813e57b60a00cdbe5182c27ef4a581964bf57e84070'};
test('Original Reborn ZIP and distinct client modules match the saved archive without execution',()=>{
 const saved=read('docs/qa/gta-reborn-archive.json').files;assert.equal(saved.length,3);
 for(const f of saved){assert.equal(sha(fs.readFileSync(f.backupPath)),f.sha256);assert.equal(sha(fs.readFileSync(path.join(root,'.'+f.local))),f.sha256);}
 assert.equal(saved.find(f=>f.name==='GTA_RBN.zip').sha256,'83bcf17b3f76bf6be8fbac9dc31728d72581b96abec033939cbf4f2cfaf1792e');
 for(const version of Object.keys(hashes)){const f=saved.find(x=>x.gameVersion===version),b=fs.readFileSync(f.backupPath);assert.equal(sha(b),hashes[version]);assert.equal(b.readUInt32LE(0),0x1d3d154f);assert.equal(b.readUInt16LE(352+18),62);assert.ok(b.includes(Buffer.from('/data/Reborn.txt')));assert.ok(b.includes(Buffer.from('Error are you in '+version+'?')));}
});
test('Each client is in its correct update group and the guide preserves the 1.57-only live notice',()=>{
 const html=fs.readFileSync(path.join(root,'console/mods/ps4/gta5/index.html'),'utf8'),data=read('docs/ps4-ps5-game-resources.json');
 for(const version of Object.keys(hashes)){const id='gta5-reborn-'+version.replace('.','-'),resource=data.resources.find(x=>x.id===id);assert.deepEqual(resource.gameVersions,[version]);assert.equal(resource.category,'client');assert.equal(resource.catalogueSection,'v'+version.replace('.',''));assert.deepEqual(resource.titleIds,[]);
  const section=html.match(new RegExp('<section\\b[^>]*\\bid="'+resource.catalogueSection+'"[^>]*>([\\s\\S]*?)<\\/section>'))[1];assert.ok(section.includes('id="resource-'+id+'"'));assert.equal(html.split('id="resource-'+id+'"').length-1,1);
  const guide=JSON.stringify(resource.guideBlocks);assert.ok(guide.includes('FOR 1.57 ONLY'));assert.ok(guide.includes('/link username:YOUR_GAMERTAG'));assert.ok(guide.includes('/data/Reborn.txt'));assert.ok(guide.includes('privately')||guide.includes('private'));assert.ok(!resource.downloads.some(f=>f.filename==='Reborn.txt'));
 }
 assert.match(html,/Read Reborn setup guide/);
});
test('Both Ozark builds require the exactly matching Reborn client and retain their original menus',()=>{
 const data=read('docs/ps4-ps5-game-resources.json'),catalog=read('downloads/ps4/GTA5/plugin-configs/manifest.json');
 for(const version of Object.keys(hashes)){const id='gta5-ozark-'+version.replace('.','-'),resource=data.resources.find(x=>x.id===id);assert.equal(resource.requiredResources[0].gameVersion,version);assert.ok(resource.description.includes('Reborn'));assert.ok(resource.guideBlocks.some(x=>x.title==='GTA Reborn is required'));
  const choice=catalog.downloads.find(x=>x.resourceId===id).variants[0];assert.equal(choice.dependencies.length,1);assert.equal(choice.dependencies[0].sha256,hashes[version]);assert.equal(choice.dependencies[0].gameVersion,version);
  for(const config of Object.values(choice.configs)){const ini=fs.readFileSync(path.join(root,'.'+config.url),'utf8');assert.deepEqual(ini.split(/\r?\n/).filter(x=>x.startsWith('/')),['/data/GoldHEN/plugins/GTARBN.sprx','/data/GoldHEN/plugins/Ozark.sprx']);assert.ok(ini.includes('/data/Reborn.txt'));}
 }
});
test('Ozark ZIP includes the matching Reborn module, both INI paths and no personal registration file',async()=>{
 const catalog=read('downloads/ps4/GTA5/plugin-configs/manifest.json'),api=require('../../assets/gta5-plugin-downloads.js');
 const env={crypto:crypto.webcrypto,fetch:async url=>new Response(fs.readFileSync(path.join(root,'.'+url)))};
 const report=[];
 for(const version of Object.keys(hashes)){const d=catalog.downloads.find(x=>x.resourceId==='gta5-ozark-'+version.replace('.','-')),v=d.variants[0],choice={...v,source:{url:d.url,name:d.name,bytes:d.bytes,sha256:d.sha256,kind:d.kind}};
  for(const region of ['CUSA00411','CUSA00419']){const bytes=await api.bundle(choice,region,env),file=path.join(root,'tmp/gta-reborn-tests/Ozark-'+version+'-'+region+'.zip');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);execFileSync('C:/Program Files/7-Zip/7z.exe',['t',file],{stdio:'pipe'});
   const member=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',file,'data/GoldHEN/plugins/GTARBN.sprx']);assert.equal(sha(member),hashes[version]);
   const original=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',file,'menu/'+d.name],{maxBuffer:4*1024*1024});assert.equal(sha(original),d.sha256);
   const ini=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',file,'plugins.ini']).toString();assert.ok(ini.includes('['+region+']'));assert.ok(ini.includes('/GTARBN.sprx'));assert.ok(ini.includes('/Ozark.sprx'));
   const inspect=require('../audit-console-ready-files.cjs').inspectArchive(file);assert.equal(inspect.fileCount,4);assert.ok(!inspect.entries.some(e=>/Reborn\.txt$/i.test(e.path)));report.push({version,region,bytes:bytes.length,sha256:sha(bytes),files:inspect.fileCount});
  }
  await assert.rejects(()=>api.bundle({...choice,dependencies:choice.dependencies.map(x=>({...x,gameVersion:'1.00'}))},'CUSA00419',env),/does not match/);
 }
 fs.writeFileSync(path.join(root,'docs/qa/gta-reborn-ozark-zip-checks.json'),JSON.stringify(report,null,2)+'\n');
});
