'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),api=require('../../assets/host-catalog-grid.js');
const action=(id,game,gameVersion,extra={})=>({id,game,gameVersion,category:'mods',platform:'ps4',...extra});

test('game groups preserve exact actions and game identity while known GTA/RDR aliases share a tile',()=>{
  const rows=[action('doom','DOOM','1.01'),action('gta','GTA V','1.57'),action('gta5','GTA 5','1.00'),action('rdr','RDR2','1.29'),action('rdr-name','Red Dead Redemption 2','1.24'),action('other','Dying Light 2: Stay Human','1.22'),action('gta-iv','GTA IV','1.00'),{id:'ftp',category:'payloads'}],before=JSON.stringify(rows);
  const groups=api.gameGroups(rows);assert.deepEqual(groups.map(g=>g.key),['gta5','rdr2','DOOM','Dying Light 2: Stay Human','GTA IV']);assert.deepEqual(groups[0].actions,[rows[1],rows[2]]);assert.equal(groups[1].label,'Red Dead Redemption 2');assert.equal(groups[0].actions[0],rows[1]);assert.equal(JSON.stringify(rows),before);assert.equal(groups.reduce((n,g)=>n+g.actions.length,0),7);
  const collisions=api.gameGroups([action('one','Game-A','1'),action('two','Game A','1'),action('three','game a','1'),action('four','__proto__','1')]);assert.equal(collisions.length,4);assert.equal(api.gameGroups([]).length,0);assert.equal(api.gameGroups(null).length,0);
});

test('game update choices preserve exact source values, sort numeric components and never manufacture compatibility',()=>{
  const rows=['1.57','1.9','1.10','1.57','01.010.002','01.005.000','1.0','1.00','1.100000000000000000001','1.99999999999999999999','source-specific'].map((v,i)=>action('a'+i,'GTA V',v));rows.push(action('missing','GTA V',null));
  const updates=api.updates(rows);assert.equal(updates.length,11);assert.equal(updates[0],'1.100000000000000000001');assert.ok(updates.indexOf('1.57')<updates.indexOf('1.10'));assert.ok(updates.indexOf('1.10')<updates.indexOf('1.9'));assert.ok(updates.includes('1.0'));assert.ok(updates.includes('1.00'));assert.ok(updates.includes('01.010.002'));assert.equal(updates.at(-1),'unspecified');
  assert.deepEqual(api.updates([action('only','GTA V','1.57')]),['1.57']);assert.deepEqual(api.updates([action('label','GTA V','Not provided')]),['Not provided']);assert.deepEqual(api.updates([]),[]);
});

test('game and update filters are exact and never substitute latest, match a prefix, or cross-list unrelated versions',()=>{
  const rows=[action('a','GTA V','1.57'),action('b','GTA 5','1.56'),action('c','GTA V','01.57'),action('d','RDR2','1.57'),action('e','GTA V',null),action('f','GTA V','1.570')];
  assert.deepEqual(api.filterByGameUpdate(rows,'gta5','1.57'),[rows[0]]);assert.deepEqual(api.filterByGameUpdate(rows,'gta5','1.56'),[rows[1]]);assert.deepEqual(api.filterByGameUpdate(rows,'gta5','unspecified'),[rows[4]]);assert.deepEqual(api.filterByGameUpdate(rows,'rdr2','1.57'),[rows[3]]);assert.deepEqual(api.filterByGameUpdate(rows,'gta5','latest'),[]);assert.deepEqual(api.filterByGameUpdate(rows,'gta5','1.5'),[]);
});

test('game tiles prefer true existing game art and menu tiles retain their actual previews',()=>{
  const menu=action('a','GTA V','1.57',{image:'/assets/images/ps4-gta5/beach.png',imageRole:'Menu preview'}),rdr=action('b','RDR2','1.29',{image:'/assets/images/ps4-ps5/originals/rdr2-oyster-image.webp',imageRole:'Menu preview'}),unknown=action('c','Unknown','1',{image:'/assets/images/ps4-gta5/beach.png',imageRole:'Menu preview'});
  assert.equal(api.gameGroups([menu])[0].image,'/assets/images/gta52.png');assert.equal(api.gameGroups([rdr])[0].image,'/assets/images/rdr2.png');assert.equal(api.representativeImage([menu]),menu.image);assert.equal(api.representativeImage([rdr]),rdr.image);assert.equal(api.gameGroups([unknown])[0].image,api.fallbackImage('games'));
  const title=action('d','Game','1',{image:'/assets/images/gta52.png',imageRole:'Game artwork'});assert.equal(api.gameGroups([title])[0].image,title.image);assert.equal(api.representativeImage([{category:'tools',image:'/assets/images/expansion-ps4-ps5/ftpsrv.png'}]),api.fallbackImage('tools'));
});

test('all local catalogue image paths are bounded and exclude external URLs, traversal and HTML',()=>{
  for(const src of ['/assets/images/gta52.png','/assets/images/host-catalog/tools.svg','/assets/images/covers/My Game.jpg'])assert.equal(api.localImage(src),src);
  for(const src of ['https://example.com/image.png','//example.com/image.png','data:image/svg+xml,<svg/>','/assets/images/../secret.png','/assets/images/a/../../secret.png','/assets/images/a//b.png','/assets/images/a.png?x','/assets/images/a.png#x','/assets/images/%61.png','/assets/images/a.png" onerror="x','/assets/images/a.html','/downloads/tool.svg'])assert.equal(api.localImage(src),'',src);
  const unknown=api.representativeImage([{category:'payloads',image:'https://example.invalid/social.png'}]);assert.equal(unknown,api.fallbackImage('payloads'));
});

test('tile markup permits only the defined data actions and escapes every metadata value',()=>{
  const html=api.tileMarkup({id:'x" onclick="alert(1)',label:'<img src=x onerror=alert(1)>',image:'/assets/images/gta52.png',detail:'1.57 & <script>bad</script>',attribute:'data-catalog-game'});
  assert.match(html,/data-catalog-game="x&quot; onclick=&quot;alert\(1\)"/);assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<script>|<img src=x|\sonclick="/);assert.match(html,/<button type="button"/);assert.match(html,/alt="" loading="lazy"/);assert.doesNotMatch(html,/href=|Game artwork|Menu preview|Menu cover/);
  for(const attribute of ['onclick','href','style','data-catalog-game="x" onfocus','data-version-id'])assert.throws(()=>api.tileMarkup({id:'x',label:'X',attribute}));
  assert.doesNotMatch(api.tileMarkup({id:'x',label:'X',image:'https://evil.invalid/image.png'}),/<img/);assert.match(api.tileMarkup({id:"'x",label:'X'}),/data-choose-group="&#39;x"/);
});

test('existing host action grouping changes no payload pins and every chosen local game image exists',()=>{
  const {hostActions}=require('../build-host-selector.cjs');for(const platform of ['ps4','ps5']){const rows=hostActions(platform),before=JSON.stringify(rows),groups=api.gameGroups(rows);assert.ok(groups.length>5);for(const group of groups){assert.ok(fs.existsSync(path.join(root,'.'+group.image)),group.image);for(const update of api.updates(group.actions)){const selected=api.filterByGameUpdate(rows,group.key,update);assert.ok(selected.length);assert.ok(selected.every(a=>a.platform===platform));}}assert.equal(JSON.stringify(rows),before);}
});

test('generic category icons are distinct local SVG drawings without external resources or scripts',()=>{
  const images=['games','updates','payloads','loaders','tools','files'].map(api.fallbackImage);assert.equal(new Set(images).size,6);const drawings=[];for(const image of images){const source=fs.readFileSync(path.join(root,'.'+image),'utf8');assert.match(source,/viewBox="0 0 640 400"/);assert.doesNotMatch(source,/<script|href=|<image|<text|onload=|https?:\/\/(?!www.w3.org)/);drawings.push(source);}assert.equal(new Set(drawings).size,6);
});

test('presentation module is inert in the browser and scoped CSS overrides legacy list display at requested breakpoints',()=>{
  const code=fs.readFileSync(path.join(root,'assets/host-catalog-grid.js'),'utf8'),sandbox={window:{}};vm.runInNewContext(code,sandbox);assert.ok(sandbox.HostCatalogGrid);assert.equal(sandbox.HostCatalogGrid.updates([]).length,0);assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|document\.|localStorage|setTimeout/);
  const css=fs.readFileSync(path.join(root,'assets/host-catalog-grid.css'),'utf8');assert.match(css,/\.host-reset #host-action-grid\.host-catalog-grid\{display:grid!important/);for(const [width,columns] of [[650,3],[1000,4],[1500,7]])assert.match(css,new RegExp('@media\\(min-width:'+width+'px\\)\\{[\\s\\S]*?grid-template-columns:repeat\\('+columns+','));assert.match(css,/grid-template-columns:repeat\(2,/);assert.match(css,/aspect-ratio:16\/10/);assert.match(css,/object-fit:cover!important/);assert.doesNotMatch(css,/(?:^|\})\s*(?:ul|li|button|img)\s*\{/);
});
