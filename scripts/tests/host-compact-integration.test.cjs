'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),compact=require('../host-compact-pages.cjs'),dashboard=require('../../assets/host-dashboard.js');
test('primary families contain only existing local entries and exact populated firmware lists',()=>{const rows=compact.groups(root);assert.equal(rows.filter(r=>r.platform==='ps4').length,7);assert.equal(rows.filter(r=>r.platform==='ps5').length,3);for(const r of rows){assert.match(r.entry,/^\/hosts\//);assert.ok(r.firmwares.length);assert.ok(fs.existsSync(path.join(root,r.entry.slice(1),'index.html')));}assert.deepEqual(rows.find(r=>r.id==='ps4-afterglow').firmwares,['13.52','14.00']);assert.equal(rows.find(r=>r.id==='karo-g2allpro-modern').firmwares.includes('12.10'),false);assert.equal(rows.find(r=>r.id==='ps5-webkit-dd8e4e0914c5').firmwares.includes('10.60'),true);const cached=rows.find(r=>r.id==='gamerhack-g2all');assert.equal(cached.originalEntry.cacheRequired,true);assert.equal(cached.firmwares.length,33);assert.equal(cached.firmwares.includes('13.53'),false);});
test('PS4 firmware directory opens only the exact 14.00 short loader',()=>{
 const html=compact.directory(root,'ps4');
 assert.doesNotMatch(html,/<select\b|\/hosts\/ps4\/(?:afterglow|exploit)\//);
 assert.equal((html.match(/class="host-firmware-family"/g)||[]).length,1);
 assert.match(html,/<a class="host-firmware-family" data-firmwares="14\.00" href="\/ps4\/14\.00\/">/);
});
test('Karo G2All Pro has its own exact firmware gate and complete pinned cache',()=>{
 const report=require('../../docs/host-upstream-refresh-20261108.json');
 const group=compact.groups(root).find(row=>row.id===report.group.id);
 const gate=require('../../assets/host-karo-builds.js');
 for(const firmware of ['6.72','14.00'])assert.ok(gate.supports(group.originalEntry,{platform:'ps4',firmware}));
 for(const firmware of ['6.73','13.53','14.02'])assert.equal(gate.supports(group.originalEntry,{platform:'ps4',firmware}),false);
 assert.equal(gate.supports(group.originalEntry,{platform:'ps5',firmware:'14.00'}),false);
 const read=name=>fs.readFileSync(path.join(root,group.runtime,name));
 const cached=read('g2allpro/Cache.manifest').toString().split(/\r?\n/).filter(name=>/\.(?:html|js|bin)$/.test(name));
 const records=new Map(report.runtimeFiles.map(file=>[file.path,file.servedSHA256]));
 for(const file of cached){
  const name='g2allpro/'+file;
  assert.equal(require('node:crypto').createHash('sha256').update(read(name)).digest('hex'),records.get(name),name);
 }
});
test('family browsing cannot change exact compatibility checks for native payload transfers',()=>{const local={id:'local',category:'loaders',localLauncher:true,firmwares:['13.52','14.00']},payload={id:'native',category:'payloads',firmwares:['9.00'],run:{type:'goldhen-http'}};assert.equal(dashboard.filterActions([local],'loaders','13.50','',null,true).length,1);assert.equal(dashboard.firmwareMatches(local,'13.50'),false);assert.equal(dashboard.filterActions([payload],'payloads','13.50','',null,true).length,0);assert.equal(dashboard.firmwareMatches(payload,'14.00'),false);});
test('runtime picker keeps every HEN/control identifier while visible branding is firmware based',()=>{const rel='hosts/runtime/ps4-afterglow-acf25a831725/web/index.html',original=fs.readFileSync(path.join(root,rel),'utf8'),html=compact.apply(original,rel,{root,base:'/WWB-HOST'});for(const id of ['pick','auto','start','cancel','count','cache','browser-firmware'])assert.ok(html.includes('id="'+id+'"'));assert.ok(html.includes('value="hen"'));assert.ok(html.includes('value="goldhen"'));assert.ok(html.includes('>Load exploit</button>'));assert.ok(html.includes('Make your own host'));assert.doesNotMatch(html,/<b>afterglow<\/b>/i);});
test('execution documents receive no design, popup or ad transform',()=>{for(const rel of ['hosts/runtime/ps4-afterglow-acf25a831725/web/jb.html','hosts/runtime/ps5-webkit-dd8e4e0914c5/web/index.html']){const html=fs.readFileSync(path.join(root,rel),'utf8');assert.equal(compact.apply(html,rel,{root,base:'/WWB-HOST'}),html);}});
test('the library exposes firmware selection for Load and keeps a direct trainer shortcut',()=>{const js=fs.readFileSync(path.join(root,'assets/host-folders.js'),'utf8');assert.ok(js.includes('Installed firmware for Load'));assert.ok(js.includes('firmwareSettings.appendChild(firmwareControl)'));assert.ok(js.includes("selected==='mods'&&platform==='ps4'"));assert.ok(js.includes("trainer.href='/hosts/tools/ps4-trainer/'"));assert.ok(/Game mods|Mods \/ Mod Menus/.test(js));const html=fs.readFileSync(path.join(root,'hosts/ps4/index.html'),'utf8');assert.ok(html.includes('/hosts/ps4/patches/'));assert.ok(html.includes('Game patches'));});


test('desktop payload catalogue omits image elements while keeping selectable outlined controls',()=>{const{fixture}=require('./host-continuation-dom.cjs'),app=fixture({platform:'ps4',initialCategory:'payloads',catalogGrid:true,userAgent:'Desktop browser',actions:[{id:'fixture-payload',platform:'ps4',category:'payloads',label:'Fixture payload',format:'BIN',version:'source-snapshot-sha',image:'/assets/images/host-catalog/tools.svg',downloadURL:'/downloads/fixture.bin'}]});const grid=app.ids['host-action-grid'];assert.equal(grid.getAttribute('data-host-view'),'payloads');assert.doesNotMatch(grid.innerHTML,/<img\b|host-catalog-tile__media/);assert.match(grid.innerHTML,/data-choose-group/);assert.equal(app.sends.length,0);});

test('primary families use same-origin Load routes and exact native receipt metadata',()=>{for(const platform of ['ps4','ps5'])for(const a of require('../build-host-selector.cjs').hostActions(platform).filter(a=>a.category==='loaders')){assert.match(a.launchURL,/^\/hosts\/runtime\//);assert.ok(a.nativeRoute||a.id==='built-in-ps5-umtx');assert.equal(a.browserHost,true);assert.equal(a.secondaryHost,undefined);}});
