const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const art=require('../category-card-art.cjs');
function section(html,id){const start=new RegExp('<section\\b(?=[^>]*id="'+id+'")[^>]*>').exec(html);assert.ok(start,id);const range=art.range(html,start.index,start[0]);return html.slice(range.start,range.end);}
test('PS3 and Xbox 360 mod hubs order GTA V, Call of Duty and GTA IV first',()=>{
 for(const [file,id] of [['console/ps3/mods.html','games'],['console/xbox360/mods.html','discord-game-catalogue']]){
  const body=section(read(file),id),titles=[...body.matchAll(/<h3[^>]*>([^<]+)/g)].map(m=>m[1]);
  assert.deepEqual(titles.slice(0,3),['Grand Theft Auto V','Call of Duty','Grand Theft Auto IV']);
  assert.ok(!body.includes('/assets/images/consoles/xbox360.png'));
 }
});
test('Xbox Call of Duty, stealth and Myten have distinct destinations without changing game claims',()=>{
 const data=require('../../docs/discord-xbox360-resources.json');
 const cod=read('console/xbox360/mods/call-of-duty/index.html');
 for(const game of data.games.filter(g=>g.page.includes('/call-of-duty/')))assert.ok(cod.includes('href="'+game.page+'"'),game.id);
 const stealth=read('console/xbox360/mods/stealth-servers/index.html'),tools=read('console/xbox360/mods/tools/index.html'),myten=read('console/xbox360/mods/multi-game-tools/myten/index.html');
 for(const item of data.resources.filter(x=>/^discord-xbox360-stealth-/.test(x.id))){assert.ok(stealth.includes('id="'+item.id+'"'));assert.ok(!tools.includes('id="'+item.id+'"'));}
 for(const item of data.resources.filter(x=>/\bmyten\b/i.test(x.name))){assert.ok(myten.includes('id="'+item.id+'"'));for(const id of item.gameIds){const game=data.games.find(g=>g.id===id);assert.ok(myten.includes(game.page+'#'+item.id));}}
 assert.ok(!myten.includes('class="feature-tag"'));
 assert.ok(myten.includes('<summary>Setup &amp; source</summary>'));
 assert.ok(myten.includes('Info.txt')||myten.includes('Source version'));
 const mislabeled=data.resources.find(x=>x.id==='discord-xbox360-gta5-myten-1-3');assert.ok(!mislabeled.gameIds.includes('gta-v'));
});
test('Themes below Retro opens a page and preserves console hub links',()=>{
 const {applyThemes}=require('../add-themes-sidebar.cjs');
 const shell='<html><head></head><body><nav class="sidebar-nav"><li data-nav-section="themes"><a href="/console/themes.html">Themes</a></li><li><a data-tooltip="Retro" href="/console/retro/"><span>Retro</span></a></li></nav><nav class="guide-nav"></nav><section id="start"><div class="games-grid"></div></section></body></html>';
 const ps3=applyThemes(shell,'console/ps3/index.html');assert.ok(ps3.includes('<span>Retro</span></a></li><li data-nav-section="themes"><a href="/console/themes.html"'));assert.ok(ps3.includes('href="/console/ps3/themes.html"'));assert.ok(ps3.includes('data-console-theme-card'));assert.equal(applyThemes(ps3,'console/ps3/index.html'),ps3);
 const child=applyThemes(shell,'console/ps3/apps.html');assert.ok(child.includes('href="/console/ps3/themes.html"'));assert.ok(!child.includes('data-console-theme-card'));
 const actual=read('console/ps3/index.html');assert.ok(actual.includes('href="/console/ps3/themes.html"'));assert.ok(actual.includes('data-nav-section="themes"'));
 const theme=applyThemes(shell,'console/themes.html');assert.ok(!theme.includes('nav-group-toggle'));assert.ok(theme.includes('data-tooltip="Themes" aria-label="Themes" aria-current="page"'));assert.equal(applyThemes(theme,'console/themes.html'),theme);
 const decorated=require('../sidebar-icons.cjs').decorateNavLinks(theme,{file:'console/themes.html'});assert.ok(decorated.includes('data-tooltip="Themes" aria-label="Themes" aria-current="page"'));
});
test('PS5 Payload Manager lists verified native releases with their original firmware limits',()=>{
 const ui=require('../../assets/host-dashboard.js'),html=read('hosts/ps5/index.html'),actions=JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]).actions;
 const payloads=ui.filterActions(actions,'payloads','','','',true);assert.ok(payloads.length>=19);
 for(const action of require('../../docs/host-native-payload-actions.json').actions){
  assert.ok(payloads.some(x=>x.id===action.id),action.id);const bytes=fs.readFileSync(path.join(root,action.downloadURL));assert.equal(bytes.length,action.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),action.sha256);
  if(action.format==='BIN')assert.equal(action.run,null);
 }
 const patch=payloads.find(a=>a.id==='library-fps-ps5-patch-system-38108724867');assert.ok(patch);assert.equal(ui.firmwareMatches(patch,'12.70'),true);assert.equal(ui.firmwareMatches(patch,'13.00'),false);
 const theme=payloads.find(a=>a.firmwareMax==='13.60');assert.ok(theme);assert.equal(ui.firmwareMatches(theme,'14.00'),false);
 assert.ok(html.includes('PS5 Payload Manager'));
});
