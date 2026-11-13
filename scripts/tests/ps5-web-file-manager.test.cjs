const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),api=require('../../assets/ps5-web-file-manager.js'),manifest=require('../../docs/ps5-web-file-manager.json');
test('native manager routes use the console and notification port, rejecting foreign and injected URLs',()=>{
 assert.equal(api.serviceURL('192.168.1.50','8888','Windows'),'http://192.168.1.50:8888/');
 assert.equal(api.serviceURL('ps5.local',8889,'Windows'),'http://ps5.local:8889/');
 assert.equal(api.serviceURL('127.0.0.1',8888,'PlayStation 5/11.60'),'http://127.0.0.1:8888/');
 for(const address of ['127.0.0.1','localhost','8.8.8.8','https://evil.test','192.168.1.50/path','192.168.1.50:8888'])assert.throws(()=>api.serviceURL(address,8888,'Windows'));
 for(const port of ['',8080,65536,'8888/x','8888.0','9e3'])assert.throws(()=>api.serviceURL('192.168.1.50',port,'Windows'));
});
test('binding does not contact or open the console; explicit click opens exactly the selected origin',()=>{
 let handler,opened=[];const nodes={'#ps5-wfm-open':{addEventListener:(event,fn)=>handler=fn},'#ps5-wfm-port':{value:'8888'},'#host-console-address':{value:'192.168.1.50'},'#ps5-wfm-status':{textContent:''}};
 api.bind({querySelector:id=>nodes[id]},{navigator:{userAgent:'Windows'},localStorage:{getItem:()=>null,setItem:()=>{}},open:(...args)=>opened.push(args)});
 assert.deepEqual(opened,[]);nodes['#ps5-wfm-port'].value='8889';handler();assert.deepEqual(opened,[['http://192.168.1.50:8889/','_blank','noopener']]);
 nodes['#host-console-address'].value='127.0.0.1';handler();assert.equal(opened.length,1);assert.match(nodes['#ps5-wfm-status'].textContent,/LAN address/);
});
test('release payloads and archive copies match upstream byte counts and hashes without execution',()=>{
 for(const asset of manifest.assets)for(const filename of [root+asset.local,asset.backupPath]){const bytes=fs.readFileSync(filename);assert.equal(bytes.length,asset.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(bytes.subarray(0,4).toString('hex'),'7f454c46');}
});
test('new manager is loadable, helper stays installation-only, and legacy binaries remain intact',()=>{
 const actions=require('../../docs/host-actions-ps5.json').actions,current=actions.find(a=>a.id==='ps5-web-file-manager'),legacy=actions.find(a=>a.id==='ps5-websrv');
 assert.equal(current.run.type,'elf-http');assert.equal(current.run.port,9021);assert.equal(current.downloadURL,manifest.assets[0].local);
 assert(!actions.some(a=>/wfm-7zip-helper/.test(a.downloadURL||'')&&a.run));assert.equal(legacy.sha256,'54730c867c6e1148536fdcb370e63a7762d989ea87b62488ad4caff64d43f263');assert(fs.existsSync(root+legacy.downloadURL));
 const feed=require('../../console/ps5/payloads.json').payloads;assert(feed.some(a=>a.id===current.id));assert(!feed.some(a=>/wfm-7zip-helper/.test(a.filename)));
});
test('regeneration retains new native manager and all older workspace controls',()=>{
 const module=require('../ps5-web-file-manager.cjs');const legacy='<section class="host-native-workspace"><button data-open-workspace="files">Old workspace</button></section>';
 const html=module.apply('<html><head></head><body>'+legacy+'</body></html>');assert.equal(module.apply(html),html);assert.match(html,/id="ps5-wfm-open"/);assert.match(html,/data-open-workspace="files"/);assert.match(html,/data-open-service="websrv-files"/);assert.match(html,/\/data\/wfm\/wfm-7zip-helper.elf/);
 const published=fs.readFileSync(root+'/hosts/ps5/files/index.html','utf8');assert.match(published,/id="ps5-wfm-open"/);assert.match(published,/host-dashboard-page/);
 for(const page of ['hosts/ps5/index.html','hosts/ps5/files/index.html','hosts/ps5/payload-manager/index.html']){const source=fs.readFileSync(root+'/'+page,'utf8'),data=JSON.parse(source.match(/<script id="host-actions-data"[^>]*>([\s\S]*?)<\/script>/)[1]);assert(data.actions.some(a=>a.id==='ps5-web-file-manager'));}
});
