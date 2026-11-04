const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const data=require('../../docs/xbox360-more-library.json');
const html=fs.readFileSync(path.join(root,'console/xbox360/library.html'),'utf8');
const {assertPublicPagePolicy}=require('../verify-xbox360-more.cjs');
const {requirementsFor}=require('../xbox360-library-requirements.cjs');
const {assertPreserved}=require('../xbox360-library-batches.cjs');
test('library has native apps, a self-contained game, ports, emulators and ready Aurora skins',()=>{
  const baseline=['swanstation','balatro360','dusklight','starship','ctr360','homebrew-app-store','aurora','aurora-az','catppuccin-latte','catppuccin-frappe','catppuccin-macchiato','catppuccin-mocha','harissa64','harissadc','anarch360'];
  for(const id of baseline)assert.ok(data.resources.some(item=>item.id===id),'Preserved original resource: '+id);
  assert.equal(new Set(data.resources.map(x=>x.id)).size,data.resources.length);
  for(const category of ['apps','games','ports','emulators','skins'])assert.ok(data.resources.some(x=>x.group===category));
  for(const item of data.resources){assert.equal(item.status,'ready');assert.match(item.file.sha256,/^[0-9a-f]{64}$/);assert.equal(item.file.bytes>0,true);assert.ok(item.installPath&&item.launch&&item.prerequisites&&item.temporary);}
  assert.equal((html.match(/data-library-card /g)||[]).length,data.resources.length);
});
test('temporary exploit support stays explicit and release-specific',()=>{
  assert.equal((html.match(/data-library-support="avatar"/g)||[]).length,1);
  assert.match(data.resources.find(x=>x.id==='balatro360').runtime,/ABadAvatar/);
  for(const id of ['harissa64','harissadc','swanstation','starship','dusklight','homebrew-app-store'])assert.match(data.resources.find(x=>x.id===id).runtime,/^RGH\/JTAG/);
  assert.match(html,/2\.0\.17559\.0/);assert.match(html,/Corona \/ Winchester/);assert.match(html,/no DashLaunch plugin support/);
});
test('manual wrappers and store alternatives retain correct conversion behavior',()=>{
  const store=data.resources.find(x=>x.id==='homebrew-app-store');assert.match(store.installPath,/apps\\hbstore/);
  for(const id of ['balatro360','ctr360']){const item=data.resources.find(x=>x.id===id);assert.equal(item.alternateFiles.length,1);assert.notEqual(item.file.sha256,item.alternateFiles[0].sha256);assert.equal(item.formatVerification.executables.find(x=>/default\.xex$/.test(x.name)).sha256,item.alternateFiles[0].formatVerification.executables.find(x=>/default\.xex$/.test(x.name)).sha256);}
  assert.ok(!html.includes('Requires already-prepared data:'));
  assert.match(data.resources.find(x=>x.id==='harissa64').prerequisites,/ROM filenames at most 42 characters/);
  assert.match(html,/ROM filenames at most 42 characters/);
});
function fixture(){
  const elements={};
  for(const id of ['library-search','library-category','library-support','library-reset','library-count','library-empty'])elements[id]={value:id==='library-category'||id==='library-support'?'all':'',hidden:false,textContent:'',handlers:{},addEventListener(event,handler){this.handlers[event]=handler;},focus(){this.focused=true;}};
  const cards=data.resources.map(x=>({id:x.id,hidden:false,dataset:{libraryCategory:x.group,librarySupport:requirementsFor(x).join(' '),librarySearch:[x.title,x.author,x.group,x.format,x.runtime,x.prerequisites,x.version,x.titleId].join(' ').toLowerCase()}}));
  const document={querySelector(){return {};},getElementById(id){return elements[id];},querySelectorAll(){return cards;}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'assets/xbox360-library.js'),'utf8'),{document});
  return {elements,cards,visible:()=>cards.filter(x=>!x.hidden).length};
}
test('search combines terms and categories; accents and zero-results remain usable',()=>{
  const f=fixture(),e=f.elements;assert.equal(f.visible(),data.resources.length);
  e['library-search'].value='frappe';e['library-search'].handlers.input();assert.equal(f.visible(),1);
  e['library-search'].value='';e['library-category'].value='emulators';e['library-category'].handlers.change();assert.equal(f.visible(),data.resources.filter(item=>item.group==='emulators').length);
  e['library-search'].value='BIOS PS1';e['library-search'].handlers.input();assert.equal(f.visible(),1);
  e['library-search'].value='unfindable';e['library-search'].handlers.input();assert.equal(f.visible(),0);assert.equal(e['library-empty'].hidden,false);
  e['library-reset'].handlers.click();assert.equal(f.visible(),data.resources.length);assert.equal(e['library-empty'].hidden,true);assert.equal(e['library-search'].focused,true);
});
test('runtime requirement filters do not imply unsupported temporary compatibility',()=>{
  const f=fixture(),e=f.elements;e['library-support'].value='avatar';e['library-support'].handlers.change();assert.equal(f.visible(),data.resources.filter(x=>requirementsFor(x).includes('avatar')).length);assert.equal(f.cards.find(x=>x.id==='balatro360').hidden,false);
  e['library-category'].value='emulators';e['library-category'].handlers.change();assert.equal(f.visible(),0);
  e['library-category'].value='all';e['library-support'].value='rgh';e['library-support'].handlers.change();assert.ok(f.visible()>=6);assert.equal(f.cards.find(x=>x.id==='multiplex360').hidden,true);
  e['library-support'].value='badupdate';e['library-support'].handlers.change();assert.equal(f.visible(),data.resources.filter(x=>requirementsFor(x).includes('badupdate')).length);assert.equal(f.cards.find(x=>x.id==='multiplex360').hidden,false);
});
test('all earlier batches and every pinned Triangle runtime component remain intact',()=>{
  assertPreserved(data,assert);
  const triangle=data.resources.find(x=>x.id==='triangle-runtime');assert.ok(triangle);assert.equal(triangle.components.length,50);assert.equal(triangle.expectedFiles.length,50);
  for(const c of triangle.components){assert.equal(c.file.sha256,c.expectedSha256);assert.equal(c.file.bytes,c.expectedBytes);assert.match(c.downloadUrl,/\/03cb4bc8e0e1efd838d1f445775f08095e482e70\//);}
  const actual=fs.readFileSync(path.join(root,triangle.localDownloadUrl));assert.equal(require('node:crypto').createHash('sha256').update(actual).digest('hex'),triangle.file.sha256);
  assert.deepEqual(requirementsFor(data.resources.find(x=>x.id==='dashlaunch-temporary-gui')),['avatar','badupdate']);
  assert.equal(requirementsFor(data.resources.find(x=>x.id==='amiga360-refresh'))[0],'rgh');
});
test('new batch preserves every prior download and adds each requested category',()=>{
  const baseline=require('../../docs/qa/xbox360-more-batch2-baseline.json'),batch=require('../../docs/xbox360-more-batch2.json');
  for(const original of baseline.resources){const current=data.resources.find(x=>x.id===original.id);assert.ok(current);for(const file of original.files)assert.ok([current.file,...(current.alternateFiles||[])].some(x=>x.name===file.name&&x.version===file.version&&x.sha256===file.sha256&&x.bytes===file.bytes&&x.sourceUrl===file.sourceUrl));}
  for(const group of ['games','apps','emulators','skins'])assert.ok(data.resources.some(x=>batch.addedIds.includes(x.id)&&x.group===group));
  assert.match(data.resources.find(x=>x.id==='xboxone-experience').runtime,/0\.6b/);
  for(const id of ['auroraflow-en','auroraflow-global']){const item=data.resources.find(x=>x.id===id);assert.equal(item.companions.length,1);assert.equal(item.companions[0].format,'CFLJSON');assert.ok(item.companions[0].file.sha256);}
  const silver=data.resources.find(x=>x.id==='silverdash360');assert.match(silver.file.version,/0\.1\.2/);assert.equal(silver.companions[0].required,true);assert.match(silver.companions[0].file.version,/0\.1\.3/);
  for(const item of data.resources.filter(x=>x.downloadLinkKind==='publisher-page')){const start=html.indexOf('href="'+item.file.sourceUrl+'"'),tag=html.slice(start,html.indexOf('>',start));assert.ok(start>=0);assert.ok(!tag.includes(' download='),'Publisher page must not be saved as a build');}
});
test('page keeps shared shell integrations and avoids private paths or video',()=>{
  for(const text of ['languages/i18n.js?v=3','mobile.css','site-background.js','data-background-theme="emerald"'])assert.ok(html.includes(text));
  // Shared footer links are navigation; embedded players and local archive paths are forbidden.
  assertPublicPagePolicy(html);
  assert.doesNotThrow(()=>assertPublicPagePolicy('<a href="https://www.youtube.com/channel/example">YouTube</a>'));
  for(const sample of ['<video controls>','<iframe src="https://www.youtube.com/embed/example">','<embed src="clip.mp4">','<object data="clip.mp4">'])assert.throws(()=>assertPublicPagePolicy(sample),/Unexpected video\/embed/,sample);
  for(const sample of ['F:\\whatsite-backup-downloads-etc','F:/whatsite-backup-downloads-etc','docs/tmp/capture.json','docs\\tmp\\capture.json','private-inventory'])assert.throws(()=>assertPublicPagePolicy(sample),/Private machine path/,sample);
  const css=fs.readFileSync(path.join(root,'assets/xbox360-library.css'),'utf8');assert.match(css,/@media\(max-width:680px\)/);assert.match(css,/min-height:48px/);assert.match(css,/overflow-wrap:anywhere/);
});
