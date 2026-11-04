const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const catalog=()=>read('downloads/ps4/GTA5/plugin-configs/manifest.json');
const api=require('../../assets/gta5-plugin-downloads.js');
test('Every plugin configuration enables one selected regional section and its exact required modules',()=>{
 const c=catalog();assert.equal(c.downloads.length,53);assert.equal(new Set(c.downloads.map(x=>x.resourceId)).size,22);
 let count=0;for(const d of c.downloads)for(const v of d.variants)for(const region of c.regions){
  const config=v.configs[region.id],bytes=fs.readFileSync(path.join(root,'.'+config.url)),text=bytes.toString();
  assert.equal(sha(bytes),config.sha256);assert.deepEqual(text.match(/^\[CUSA\d+\]/gm),['['+region.id+']']);
  assert.deepEqual(text.split(/\r?\n/).filter(x=>x.startsWith('/')),(config.modules||[config.module]).map(m=>'/data/GoldHEN/plugins/'+m));assert.ok(!text.includes('[default]'));if(config.modules?.length>1)assert.match(d.resourceId,/^gta5-ozark-/);count++;
 }assert.equal(count,122);
});
test('Scorpion 1.00 selects the EU/US binary while Oxagon keeps its actual game-update pin',()=>{
 const d=catalog().downloads;
 const scorpion=d.find(x=>x.downloadId==='gta5-scorpion-v1-2b').variants.find(x=>x.gameVersion==='1.00');
 assert.match(scorpion.configs.CUSA00411.module,/100EU\.prx$/);assert.match(scorpion.configs.CUSA00419.module,/100US\.prx$/);
 const full=d.find(x=>x.downloadId==='gta5-oxagon-1-56');assert.equal(full.variants.length,2);
 for(const v of full.variants){assert.equal(v.configs.CUSA00411.module,v.configs.CUSA00419.module);assert.equal(v.configs.CUSA00419.sourceExample,v.gameVersion==='1.53');assert.equal(v.configs.CUSA00411.sourceExample,v.gameVersion==='1.56');}
 const crystalis=d.find(x=>x.downloadId==='gta5-crystalis-1-57-sprx').variants[0];assert.equal(crystalis.configs.CUSA00419.sourceExample,true);assert.equal(crystalis.configs.CUSA00411.sourceExample,false);
 const resource=read('docs/ps4-ps5-game-resources.json').resources.find(x=>x.id==='gta5-oxagon-1-56');
 const legacy=read('downloads/ps4/GTA5/manifest.json').files.find(x=>x.name==='Oxagon Full');
 const html=require('../gta5-plugin-downloads.cjs').createPluginDownloads().render(resource,undefined,legacy);
 const rows=JSON.parse(html.match(/data-plugin-choices="([^"]+)"/)[1].replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#39;/g,"'"));
 assert.equal(rows[0].gameVersion,'1.56');assert.ok(!rows[1].label.includes('1.56'));assert.ok(rows[1].label.includes('1.53'));
});
test('BIN/CSC resources are not represented as GoldHEN plugins and portable original input captures remain byte-exact',()=>{
 for(const d of catalog().downloads){assert.ok(!/lotus|wildemodz|fcloader|random-scripts|gta-fucker/.test(d.resourceId));assert.ok(d.variants.every(v=>/\.(prx|sprx)$/i.test(v.module)));}
 for(const f of read('docs/qa/gta5-plugin-config-inputs.json').inputFiles){
  assert.match(f.snapshot,/^scripts\/tests\/fixtures\/gta5-plugin-inputs\/[a-f0-9]{64}\/plugins\.ini$/);
  const b=fs.readFileSync(path.join(root,f.snapshot));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);assert.equal(b.toString('utf8'),f.text);
 }
});

test('input-example regeneration never needs the original Desktop or Downloads paths',()=>{
 const vm=require('node:vm'),filename=path.join(root,'scripts/prepare-gta5-plugin-configs.cjs'),writes=new Map();
 const originalPaths=new Set(read('docs/qa/gta5-plugin-config-inputs.json').inputFiles.map(f=>path.resolve(f.file)));
 const memoryFs={...fs,readFileSync(file,...args){assert.ok(!originalPaths.has(path.resolve(file)),'Do not read mutable user input paths');return fs.readFileSync(file,...args);},writeFileSync(file,data){writes.set(path.resolve(file),data);},mkdirSync(){}};
 const localRequire=require('node:module').createRequire(filename),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,__dirname:path.dirname(filename),require(name){return name==='node:fs'?memoryFs:localRequire(name);},Buffer,console},{filename});
 const examples=module.exports.preserveInputExamples();assert.equal(examples.length,2);
 const report=JSON.parse(writes.get(path.join(root,'docs/qa/gta5-plugin-config-inputs.json')));
 for(const example of report.inputFiles){assert.ok(example.snapshot);assert.equal(sha(Buffer.from(example.text)),example.sha256);}
});
test('Every authored configuration and mirrored source has a verified local archive copy',()=>{
 const jobs=read('docs/qa/gta5-plugin-config-jobs.json').files,saved=read('docs/qa/gta5-plugin-config-archive.json').files;
 assert.equal(jobs.length,123);for(const f of jobs){const backup=saved.find(x=>x.sha256===f.sha256&&x.local===f.local);assert.ok(backup,f.local);const b=fs.readFileSync(backup.backupPath);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
});
test('Combined ZIPs preserve original menu bytes and include the selected plugins.ini',async()=>{
 const data=read('docs/ps4-ps5-game-resources.json'),item=data.resources.find(x=>x.id==='gta5-crystalis-1-57');
 const rows=require('../gta5-plugin-downloads.cjs').createPluginDownloads().choices(item);
 const env={crypto:crypto.webcrypto,fetch:async url=>{const file=path.join(root,'.'+url);if(!fs.existsSync(file))return new Response('',{status:404});return new Response(fs.readFileSync(file));}};
 const outputs=[];
 for(const row of rows)for(const region of ['CUSA00411','CUSA00419']){
  const bytes=await api.bundle(row,region,env),file=path.join(root,'tmp/gta5-plugin-config-tests',row.source.kind+'-'+region+'.zip');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
  execFileSync('C:/Program Files/7-Zip/7z.exe',['t',file],{stdio:'pipe'});
  const ini=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',file,'plugins.ini']).toString();assert.ok(ini.includes('['+region+']'));assert.ok(ini.includes('/data/GoldHEN/plugins/Crystalis.sprx'));
  const member=row.source.kind==='plugin'?'data/GoldHEN/plugins/Crystalis.sprx':'menu/'+row.source.name;
  const original=execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',file,member],{maxBuffer:4*1024*1024});assert.equal(sha(original),row.source.sha256);outputs.push({file,region,kind:row.source.kind,bytes:bytes.length,sha256:sha(bytes)});
 }fs.writeFileSync(path.join(root,'docs/qa/gta5-plugin-config-zip-checks.json'),JSON.stringify(outputs,null,2)+'\n');assert.equal(outputs.length,4);
});
test('Bundle creation rejects changed bytes, wrong region and ZIP traversal before saving',async()=>{
 assert.throws(()=>api.zip([{name:'../plugins.ini',bytes:new Uint8Array()}]),/Unsafe ZIP path/);
 assert.throws(()=>api.zip([{name:'/plugins.ini',bytes:new Uint8Array()}]),/Unsafe ZIP path/);
 await assert.rejects(()=>api.fetchVerified({url:'https://example.com/file',sha256:'x'},{fetch:()=>{throw Error('Should not fetch');}}),/Invalid local download/);
 await assert.rejects(()=>api.fetchVerified({url:'/downloads/test.prx',sha256:'0'.repeat(64)},{crypto:crypto.webcrypto,fetch:async()=>new Response('different')}),/verification failed/);
 await assert.rejects(()=>api.bundle({configs:{}},'CUSA12345',{}),/Select a game region/);
});
test('The rendered page includes regional controls, combined actions and the moved 1.57 cards',()=>{
 const s=fs.readFileSync(path.join(root,'console/mods/ps4/gta5/index.html'),'utf8');assert.ok(s.includes('/assets/gta5-plugin-downloads.js?v=2'));assert.ok(s.includes('/assets/gta5-plugin-downloads.css?v=1'));assert.ok(s.includes('Download menu + plugins.ini'));assert.ok(s.includes('Europe / EU · CUSA00411'));assert.ok(s.includes('USA · CUSA00419'));assert.ok(!s.includes('id="gallery"'));
 const section=s.match(/<section\b[^>]*\bid="v157"[^>]*>([\s\S]*?)<\/section>/)[1];for(const id of ['gta5-crystalis-1-57','gta5-velora-1-57'])assert.ok(section.includes('id="resource-'+id+'"'));
});
