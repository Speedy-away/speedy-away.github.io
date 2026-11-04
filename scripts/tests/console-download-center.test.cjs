const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {getCatalog, MAX_PLATFORM_ITEMS, assertCatalogueBounds} = require('../console-download-catalog.cjs');
const {buildReceiverURL, buildPreparationURL, matchesFilter, matchesFormat, normalizeConsoleHost} = require('../../assets/console-downloads.js');

const root = path.resolve(__dirname, '../..');
const readJson = file => { let target=path.join(root,file); if(!fs.existsSync(target)&&['console/ps4/homebrew.json','console/ps5/payloads.json'].includes(file)){ const retained=path.resolve(root,'../whatsite',file); if(fs.existsSync(retained))target=retained; } return JSON.parse(fs.readFileSync(target,'utf8')); };
const catalogue = readJson('docs/console-download-catalog.json').items;

test('console catalogues contain only reviewed PS4/PS5 builds and keep platform scopes separate', () => {
  assert.ok(catalogue.length > 0);
  assert.equal(new Set(catalogue.map(item => item.id)).size, catalogue.length);
  for (const item of catalogue) {
    assert.ok(item.platforms.length > 0, item.id);
    assert.ok(item.platforms.every(platform => ['ps4', 'ps5'].includes(platform)), item.id);
    assert.ok(['apps', 'payloads', 'mods', 'patches'].includes(item.category), item.id);
    assert.match(item.sha256, /^[a-f0-9]{64}$/);
    assert.ok(Number.isSafeInteger(item.bytes) && item.bytes > 0, item.id);
    assert.ok(item.compatibility && item.version && item.page, item.id);
    assert.doesNotMatch(item.filename, /\.(?:apk|exe|msi|vpk|dmg|deb)$/i, item.id);
    assert.doesNotMatch(item.filename, /(?:source|windows|linux|macos)/i, item.id);
    const url = new URL(item.url, 'https://whatwhatboy.com');
    assert.equal(url.protocol, 'https:', item.id);
    assert.ok(url.origin === 'https://whatwhatboy.com' && url.pathname.startsWith('/downloads/') ||
      url.hostname === 'github.com' && url.pathname.includes('/releases/download/') ||
      url.hostname === 'raw.githubusercontent.com' && /\/[a-f0-9]{40}\//i.test(url.pathname) ||
      url.hostname === 'pkg-zone.com' && /^\/download\/ps4\/[A-Z0-9]+\/[0-9.]+$/.test(url.pathname) && !url.search && !url.hash, item.id);
  }
  for (const platform of ['ps4', 'ps5']) {
    const items = getCatalog(platform);
    assert.ok(items.length > 0 && items.length <= MAX_PLATFORM_ITEMS);
    assert.deepEqual(items.map(item => item.id), catalogue.filter(item => item.platforms.includes(platform)).map(item => item.id));
  }
  assert.throws(() => getCatalog('ps3'), /Expected ps4 or ps5/);
  for (const item of catalogue.filter(item => /GTA V game update/.test(item.compatibility))) {
    assert.deepEqual(item.platforms, ['ps4']);
    if (item.id.startsWith('ps4-legacy-') || item.id.startsWith('ps4-repository-gamerhack-') || item.id.startsWith('ps4-gta505-gamerhack-') || item.id.startsWith('ps4-arabicguy-672-')) {
      const is505 = item.id.startsWith('ps4-gta505-gamerhack-');
      const is672 = item.id.startsWith('ps4-arabicguy-672-');
      const sourceCatalogue = is672 ? 'docs/host-arabicguy-672-actions.json' : is505 ? 'docs/host-gta505-continuation-actions.json' : item.id.startsWith('ps4-repository-gamerhack-') ? 'docs/host-repository-menu-actions.json' : 'docs/host-legacy-menu-actions.json';
      const action = readJson(sourceCatalogue).actions.find(action => action.id === item.id);
      assert.ok(action, item.id + ' has original source evidence');
      assert.deepEqual(action.firmwares, [is672 ? '6.72' : is505 ? '5.05' : '9.00']);
      assert.equal(item.compatibility, action.requirements.join(' '));
      assert.equal(item.url, action.downloadURL);
      assert.equal(item.bytes, action.bytes);
      assert.equal(item.sha256, action.sha256);
      assert.equal(item.source, action.source);
      assert.equal(item.version, action.menuVersion || action.version || action.gameVersion);
      continue;
    }
    assert.match(item.compatibility, /1\.(?:56|57)/);
    if (item.id.startsWith('expulsion-v7-ready-')) {
      // Extracted V7 files use the archived INSTALL.txt's specific regional scope.
      assert.match(item.compatibility, /PS4 GoldHEN plugins; GTA V game update 1\.57\b/);
      assert.match(item.compatibility, /CUSA00419 USA/);
      assert.match(item.compatibility, /CUSA00411 EUR/);
      assert.match(item.compatibility, /EUR hardware testing remains required/);
      assert.doesNotMatch(item.compatibility, /\bPS5\b/i);
      assert.equal(item.requiresSupportArchive, '/downloads/ps4/GTA5/157/Expulsion_V7.0.zip');
    } else {
      assert.match(item.compatibility, /not console firmware or PS5 support/);
    }
  }
});

test('expanded catalogue retains bounded capacity and refuses missing platforms or duplicate identities', () => {
  assert.equal(MAX_PLATFORM_ITEMS,1024);
  const ps4 = Array.from({length:1024}, (_,index) => ({id:'ps4-'+index, platforms:['ps4']}));
  const ps5 = {id:'ps5', platforms:['ps5']};
  assert.doesNotThrow(() => assertCatalogueBounds([...ps4, ps5]));
  assert.throws(() => assertCatalogueBounds([...ps4, ps5, {id:'overflow', platforms:['ps4']}]), /curated limit/);
  assert.throws(() => assertCatalogueBounds(ps4), /No verified ps5/);
  assert.throws(() => assertCatalogueBounds([...ps4, ps5, ps5]), /Duplicate/);
});

test('native feeds exclude archives, cheat JSON, plugins and unsupported platform builds', () => {
  const ps4 = readJson('console/ps4/homebrew.json');
  const ps5 = readJson('console/ps5/payloads.json');
  assert.ok(Object.keys(ps4.DATA).length > 0);
  for (const url of Object.keys(ps4.DATA)) {
    const item = catalogue.find(item => new URL(item.url, 'https://whatwhatboy.com').href === url);
    assert.ok(item && item.platforms.includes('ps4') && item.category === 'apps' && /\.pkg$/i.test(item.filename), url);
  }
  assert.ok(ps5.payloads.length > 0);
  for (const entry of ps5.payloads) {
    const item = catalogue.find(item => item.id === entry.id);
    assert.ok(item && item.platforms.includes('ps5') && item.category !== 'mods', entry.id);
    assert.match(entry.filename, /\.(elf|bin)$/i);
    assert.doesNotMatch(entry.filename, /^pldmgr[_-]/i);
    assert.equal(entry.checksum, item.sha256);
  }
});

test('console address, receiver selection and filters preserve exact platform behavior', () => {
  assert.equal(buildPreparationURL('ps4', '192.168.1.4'), 'http://192.168.1.4:8080/data/whatsite-ps4.html?prepare=1');
  assert.equal(buildPreparationURL('ps5', '127.0.0.1'), 'http://127.0.0.1:9090/data/homebrew/ezremote-client/assets/whatsite-ps5.html?prepare=1');
  assert.equal(buildReceiverURL('ps4', '192.168.1.4', 'menu 1&2'), 'http://192.168.1.4:6701/data/whatsite-ps4.html?file=menu%201%262');
  assert.equal(buildReceiverURL('ps5', '127.0.0.1', 'payload'), 'http://127.0.0.1:6701/whatsite-ps5.html?file=payload');
  for (const invalid of ['192.168.1.4:6701', 'https://192.168.1.4', '8.8.8.8', '127.0.0.1.evil.example', '192.168.001.4']) assert.equal(normalizeConsoleHost(invalid), null, invalid);
  assert.equal(normalizeConsoleHost('169.254.1.2'), '169.254.1.2');
  assert.equal(matchesFilter('Dying Light CUSA03991 GoldHEN 01.35', 'mods', 'CUSA03991 01.35', 'mods'), true);
  assert.equal(matchesFilter('Dying Light CUSA03991 GoldHEN 01.35', 'mods', 'CUSA03991 01.00', 'mods'), false);
  assert.equal(matchesFilter('Dying Light CUSA03991 GoldHEN 01.35', 'mods', '', 'payloads'), false);
});

test('ready-file filtering keeps original archives available without treating them as executable builds', () => {
  for (const filename of ['app.pkg','payload.elf','payload.bin','menu.prx','menu.sprx','CUSA00001.xml','cheats.json']) {
    assert.equal(matchesFormat(filename,'ready'), true,filename);
    assert.equal(matchesFormat(filename,'archives'), false,filename);
  }
  for (const filename of ['menu.rar','complete.ZIP','GoldHEN.7z']) {
    assert.equal(matchesFormat(filename,'ready'), false,filename);
    assert.equal(matchesFormat(filename,'archives'), true,filename);
    assert.equal(matchesFormat(filename,'all'), true,filename);
  }
});

function installPublicFilters(query='') {
  const field = value => ({value,addEventListener(type,callback){this[type]=callback;}});
  const search=field(''), format=field('ready'), count={}, empty={};
  const card=(id,filename)=>({hidden:false, attrs:{'data-file-id':id,'data-filename':filename,'data-search':'CUSA00001 '+filename,'data-category':'mods'},getAttribute(name){return this.attrs[name];}});
  const cards=[card('menu-ready','menu.prx'),card('menu-archive','menu.rar')];
  const center={attrs:{'data-platform':'ps4'},getAttribute(name){return this.attrs[name];},setAttribute(name,value){this.attrs[name]=value;},querySelectorAll(selector){return selector==='article.console-download-card'?cards:[];}};
  const ids={'console-download-center':center,'console-file-search':search,'console-file-format':format,'console-file-count':count,'console-file-empty':empty};
  const document={readyState:'complete',getElementById(id){return ids[id]||null;}};
  const window={document,location:{search:query}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/console-downloads.js'),'utf8'),{window,module:{exports:{}}});
  return {search,format,count,empty,cards};
}

test('public console catalogue defaults to ready files and combines format with the search', () => {
  const ui=installPublicFilters();
  assert.equal(ui.count.textContent,'1 of 2 files');
  assert.deepEqual(ui.cards.map(card=>card.hidden),[false,true]);
  ui.format.value='archives';ui.format.change();
  assert.deepEqual(ui.cards.map(card=>card.hidden),[true,false]);
  ui.search.value='CUSA99999';ui.search.input();assert.equal(ui.empty.hidden,false);
  ui.search.value='CUSA00001';ui.search.input();assert.equal(ui.empty.hidden,true);
  ui.format.value='all';ui.format.change();assert.equal(ui.count.textContent,'2 of 2 files');
});

test('an intentional original-archive link selects the archive without hiding it behind the ready default', () => {
  const ui=installPublicFilters('?file=menu-archive');
  assert.equal(ui.format.value,'archives');assert.equal(ui.search.value,'menu.rar');
  assert.deepEqual(ui.cards.map(card=>card.hidden),[true,false]);
});

// Execute the real page generator with an in-memory filesystem and dependency
// boundary. This verifies its companion write contract without touching current
// pages, archives, inventories or another chat's work.
function isolatedBuild(options) {
  const written = new Map(), companionCalls = [];
  const fixture = (platform, filename, extra = {}) => ({id: platform + '-' + filename, name: filename,
    filename, url: '/downloads/test/' + filename, bytes: 1024, sha256: 'a'.repeat(64),
    version: 'Pinned 1.00', category: 'mods', compatibility: platform.toUpperCase() + ' exact game 1.00 only',
    description: 'Retain the listed title ID and game update.', platforms: [platform], page: '/console/' + platform + '/apps.html', ...extra});
  const items = {ps4: [fixture('ps4', 'menu.rar'), fixture('ps4', 'homebrew.pkg', {category:'apps'}), fixture('ps4', 'CUSA00001_01.00.json')],
    ps5: [fixture('ps5', 'payload.elf', {category:'payloads'}), fixture('ps5', 'ps5-theme.plugin', {category:'payloads'}),fixture('ps5','PPSA00001.xml',{category:'patches',preparation:'Keep <title ID> & matching game update; XML is data.'})]};
  const helpers = {
    page(file, title, description, image, nav, content) { written.set(path.join(root,file), '<head><meta name="keywords" content="old"></head><main>' + content + '</main>'); },
    section(id, title, content) { return '<section id="' + id + '"><h2>' + title + '</h2>' + content + '</section>'; },
    grid(...content) { return content.join(''); }, resource(title, description, content) { return '<h3>' + title + '</h3><p>' + description + '</p>' + content; },
    note(content) { return content; }, steps(entries) { return entries.map(entry=>entry.join(': ')).join(''); },
    ext(url,label) { return '<a href="' + url + '">' + label + '</a>'; }, link(url,label) { return '<a href="' + url + '">' + label + '</a>'; },
    sourceList() { return ''; }, ps4nav:'', ps5nav:''
  };
  const context = {module:{exports:{}}, __dirname:path.join(root,'scripts'), URL,
    console:{log(){}}, require(name) {
      if (name === 'node:fs') return {readFileSync(file) { assert.ok(written.has(file), file); return written.get(file); }, writeFileSync(file,content) {written.set(file,content);} };
      if (name === 'node:path') return path;
      if (name === './build-console-guides.cjs') return helpers;
      if (name === './apply-mobile-layout.cjs') return require('../apply-mobile-layout.cjs');
      // Search metadata has its own generator regression tests; this fixture
      // isolates downloader actions and the archived-companion write contract.
      if (name === './search-page-output.cjs') return {finish(file,html){return html;}};
      if (name === './console-download-catalog.cjs') return {buildCatalog(){},getCatalog(platform){return items[platform];}};
      if (name === './console-download-companion.cjs') return {renderCompanion(platform,files){companionCalls.push([platform,files.length]);return 'New '+platform+' companion';}};
      if (name === './console-store-cards.cjs') return {storeIntro(){return '';}};
      throw Error('Unexpected dependency: '+name);
    }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/build-console-downloads.cjs'),'utf8'),context);
  context.module.exports.buildConsoleDownloads(options);
  return {written,companionCalls};
}

test('routine page builds preserve archived companions; regeneration requires the explicit option', () => {
  const normal = isolatedBuild();
  assert.equal(normal.companionCalls.length, 0);
  assert.deepEqual([...normal.written.keys()].map(file=>path.relative(root,file)).sort(), ['console/ps4/downloads.html','console/ps5/downloads.html'].map(file=>path.normalize(file)));
  const deliberate = isolatedBuild({companions:true});
  assert.equal(deliberate.companionCalls.length, 2);
  for (const platform of ['ps4','ps5']) assert.equal(deliberate.written.get(path.join(root,'console',platform,'whatsite-'+platform+'.html')), 'New '+platform+' companion');
});

test('every card exposes its direct Download beside Save before the collapsed technical details',()=>{
  const {written}=isolatedBuild();
  for(const platform of ['ps4','ps5']){
    const html=written.get(path.join(root,'console',platform,'downloads.html'));
    const cards=[...html.matchAll(/<article\b[^>]*class="[^"]*console-download-card[^"]*"[\s\S]*?<\/article>/g)].map(match=>match[0]);
    assert.ok(cards.length>0);
    for(const card of cards){
      const filename=card.match(/data-filename="([^"]+)"/)[1];
      const visible=card.slice(0,card.indexOf('<details'));
      const row=visible.match(/<div class="guide-links console-file-actions">([\s\S]*?)<\/div>/)?.[1];assert.ok(row,filename);
      assert.match(row,new RegExp('Save on '+platform.toUpperCase()));
      const download=row.match(/<a\b([^>]*\bdownload="[^"]*"[^>]*)>Download<\/a>/);assert.ok(download,'Visible Download missing for '+filename);
      assert.ok(download[1].includes('download="'+filename+'"'),filename);
      const direct=download[1].match(/href="([^"]+)"/)[1];assert.equal(direct,'/downloads/test/'+filename);
      assert.doesNotMatch(download[1],/data-receiver-file/);
    }
  }
});

test('reviewed preparation instructions are text and retain their title/update markers',()=>{
  const html=isolatedBuild().written.get(path.join(root,'console/ps5/downloads.html'));
  assert.match(html,/<p class="console-next-action">Keep &lt;title ID> &amp; matching game update; XML is data\.<\/p>/);
  assert.doesNotMatch(html,/<title ID>/);
});

function publicAddressUI(platform){
  function node(attrs={},value=''){return {attrs,value,events:{},getAttribute(name){return Object.prototype.hasOwnProperty.call(this.attrs,name)?this.attrs[name]:null;},hasAttribute(name){return Object.prototype.hasOwnProperty.call(this.attrs,name);},setAttribute(name,value){this.attrs[name]=String(value);},removeAttribute(name){delete this.attrs[name];},addEventListener(type,callback){this.events[type]=callback;},focus(){this.focused=true;}};}
  const file=node({'data-receiver-file':'build 1&2',href:'uninitialized'}),open=node({'data-receiver-open':'',href:'uninitialized'}),prepare=node({'data-client-open':'',href:'uninitialized'}),download=node({download:'app.pkg',href:'https://github.com/example/project/releases/download/v1/app.pkg'});
  const address=node({},'127.0.0.1'),apply=node(),status=node(),nativeSource=node({},'https://whatwhatboy.com/console/'+platform+'/payloads.json');
  const center=node({'data-platform':platform});center.querySelectorAll=function(selector){if(selector==='a[data-receiver-file], a[data-receiver-open]')return[file,open];if(selector==='a[data-client-open]')return[prepare];return[];};
  const ids={'console-download-center':center,'console-address':address,'console-address-apply':apply,'console-address-status':status,'native-source':nativeSource};
  const document={getElementById(id){return ids[id]||null;}};
  require('../../assets/console-downloads.js').install(document);
  return{file,open,prepare,download,address,apply,status,nativeSource};
}

test('applying a console address updates actual receiver and client-preparation routes while download URLs stay pinned',()=>{
  for(const platform of ['ps4','ps5']){
    const ui=publicAddressUI(platform),direct=ui.download.attrs.href,feed=ui.nativeSource.value;
    assert.equal(ui.open.attrs.href,buildReceiverURL(platform,'127.0.0.1'));
    assert.equal(ui.prepare.attrs.href,buildPreparationURL(platform,'127.0.0.1'));
    ui.address.value='192.168.1.44';ui.apply.events.click();
    assert.equal(ui.file.attrs.href,buildReceiverURL(platform,'192.168.1.44','build 1&2'));
    assert.equal(ui.open.attrs.href,buildReceiverURL(platform,'192.168.1.44'));
    assert.equal(ui.prepare.attrs.href,buildPreparationURL(platform,'192.168.1.44'));
    assert.match(ui.prepare.attrs.href,platform==='ps4' ? /:8080\/data\/whatsite-ps4\.html\?prepare=1$/ : /:9090\/data\/homebrew\/ezremote-client\/assets\/whatsite-ps5\.html\?prepare=1$/);
    assert.equal(ui.download.attrs.href,direct);assert.equal(ui.nativeSource.value,feed);
    const previous=ui.prepare.attrs.href;ui.address.value='8.8.8.8';ui.apply.events.click();
    assert.equal(ui.prepare.attrs.href,previous);assert.equal(ui.address.attrs['aria-invalid'],'true');assert.equal(ui.status.attrs['data-status'],'error');
    let prevented=false;ui.address.value='10.0.0.5';ui.address.events.keydown({key:'Enter',preventDefault(){prevented=true;}});
    assert.equal(prevented,true);assert.equal(ui.prepare.attrs.href,buildPreparationURL(platform,'10.0.0.5'));assert.equal(ui.address.attrs['aria-invalid'],undefined);
  }
});

test('XML catalogue deduplication retains regional filenames and resolves each console guide separately',()=>{
  const sameHash='a'.repeat(64),nativeHash='b'.repeat(64),backup=path.resolve('F:/whatsite-backup-downloads-etc');
  const patch=(filename,platforms,sha256)=>({id:filename.toLowerCase().replace('.xml',''),title:filename+' patch XML',filename,platforms,category:'patches',version:'Pinned 1792785960',compatibility:filename+' title ID; game update01.09 only',preparation:'Use the matching patch engine.',page:'/console/ps4/game-patches.html#game',pages:Object.fromEntries(platforms.map(platform=>[platform,'/console/'+platform+'/game-patches.html#game'])),source:'https://raw.githubusercontent.com/example/repository/'+'c'.repeat(40)+'/'+filename,sha256});
  const resources=[patch('CUSA00001.xml',['ps4','ps5'],sameHash),patch('CUSA00002.xml',['ps4','ps5'],sameHash),patch('PPSA00001.xml',['ps5'],nativeHash)];
  const documents=new Map([
    ['docs/download-audit.json',{items:resources.map(entry=>({id:'ps4-ps5-'+entry.id,status:'downloaded',files:[{name:entry.filename,bytes:4,sha256:entry.sha256,backupPath:path.join(backup,'test',entry.filename),local:'/downloads/test/'+entry.filename}]}))}],
    ['docs/expansion-ps4-ps5.json',{platforms:{ps4:{apps:[],payloads:[]},ps5:{apps:[],payloads:[]}}}],
    ['docs/console-software-images.json',{}],['downloads/ps4/GTA5/manifest.json',{files:[]}],['downloads/ps4/BO3/manifest.json',{files:[]}],['docs/ps4-bo3-resources.json',{resources:[]}],['docs/ps4-ps5-customization.json',{resources:[]}],['docs/ps4-ps5-game-patches.json',{resources,release:'fixture',archive:{url:'https://github.com/example/repository/releases/download/fixture/patch1.zip'}}]
  ].map(([file,value])=>[path.join(root,file),JSON.stringify(value)]));
  for (const platform of ['ps4','ps5']) documents.set(path.join(root,'console',platform,'game-patches.html'),'<section id="game"></section>');
  const files=new Set(resources.flatMap(entry=>[path.join(backup,'test',entry.filename),path.join(root,'downloads/test',entry.filename)]));
  const fakeFs={existsSync(file){return file===backup||documents.has(file)||files.has(file);},realpathSync(file){return file;},statSync(file){if(!files.has(file)&&!documents.has(file))throw Error('Missing fixture '+file);return{isFile(){return true;},isDirectory(){return false;},size:4};},readFileSync(file){if(!documents.has(file))throw Error('Unexpected read '+file);return documents.get(file);},writeFileSync(file,content){documents.set(file,content);}};
  const mirrorContext={module:{exports:{}},__dirname:path.join(root,'scripts'),URL,require(name){if(name==='node:fs')return fakeFs;if(name==='node:path')return path;throw Error('Unexpected mirror dependency '+name);}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/download-mirror-policy.cjs'),'utf8'),mirrorContext);
  const context={module:{exports:{}},__dirname:path.join(root,'scripts'),URL,console:{log(){}},require(name){if(name==='node:fs')return fakeFs;if(name==='node:path')return path;if(name==='node:crypto')return require('node:crypto');if(name==='./download-mirror-policy.cjs')return mirrorContext.module.exports;throw Error('Unexpected dependency '+name);}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'scripts/console-download-catalog.cjs'),'utf8'),context);
  context.module.exports.buildCatalog();
  const ps4=context.module.exports.getCatalog('ps4'),ps5=context.module.exports.getCatalog('ps5');
  assert.equal(ps4.length,2);assert.equal(ps5.length,3);
  assert.equal(ps4[0].sha256,ps4[1].sha256);assert.notEqual(ps4[0].filename,ps4[1].filename);
  for(const item of ps4){assert.equal(item.page,'/console/ps4/game-patches.html#game');assert.match(item.filename,/^CUSA/);assert.match(item.compatibility,/01\.09 only/);}
  for(const item of ps5)assert.equal(item.page,'/console/ps5/game-patches.html#game');
  assert.equal(ps4.some(item=>item.filename==='PPSA00001.xml'),false);
});

test('download desk renders platform-specific actions, compatibility and truthful storage guidance', () => {
  const {written} = isolatedBuild();
  for (const platform of ['ps4','ps5']) {
    const html = written.get(path.join(root,'console',platform,'downloads.html'));
    assert.match(html, new RegExp('data-platform="'+platform+'"'));
    assert.match(html, new RegExp('Save on '+platform.toUpperCase()));
    assert.match(html, /stock console browser cannot write to arbitrary paths/);
    assert.match(html, /Mount numbers do not identify a physical front or rear USB port/);
    assert.match(html, /Packages still need installation, archives need extraction/);
    assert.match(html, /data-download-filter="apps"/);assert.match(html, /data-download-filter="payloads"/);assert.match(html, /data-download-filter="mods"/);
    assert.match(html, /exact game 1\.00 only/);assert.match(html, /SHA-256/);
    assert.doesNotMatch(html, /data-receiver-file="(?:ps3|vita|xbox)/);
  }
  const ps4 = written.get(path.join(root,'console/ps4/downloads.html'));
  const ps5 = written.get(path.join(root,'console/ps5/downloads.html'));
  assert.match(ps4, /Extract archive, then follow its guide/);
  assert.match(ps4, /Install with a compatible package installer/);
  assert.match(ps4, /cannot automatically enumerate USB mounts/);
  assert.match(ps5, /Load with the documented compatible loader/);
  assert.match(ps5, /Open payload manager/);
  assert.doesNotMatch(ps4, /data-receiver-file="ps5-/);
  assert.doesNotMatch(ps5, /data-receiver-file="ps4-/);
});
