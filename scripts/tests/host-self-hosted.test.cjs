'use strict';
// Render the authored dashboard against inert controls. No console requests,
// downloaded-code evaluation, browser runtime launch or filesystem writes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const ui=require('../../assets/host-dashboard.js');
const {fixture}=require('./host-continuation-dom.cjs');
const root=path.resolve(__dirname,'../..');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function categoryFixture(category,platform='ps4'){
  const action={id:platform+'-image-policy-'+category,label:'Policy fixture',platform,category,
    game:category==='mods'?'GTA V':undefined,gameVersion:category==='mods'?'1.57':undefined,
    menuVersion:category==='mods'?'2.0':undefined,firmwares:[platform==='ps4'?'9.00':'4.51'],
    format:category==='loaders'?'HTML host':platform==='ps4'?'BIN':'ELF',
    image:'/assets/images/gta52.png',imageAlt:'Retained preview description',imageRole:'Project preview',
    launchURL:category==='loaders'?'/hosts/runtime/fixture/':undefined,
    run:category==='loaders'?undefined:{type:platform==='ps4'?'goldhen-http':'elf-http',port:platform==='ps4'?9090:9021},
    downloadURL:category==='loaders'?undefined:'/downloads/fixture.'+(platform==='ps4'?'bin':'elf'),requirements:[]};
  const f=fixture({platform,actions:[action]}),buttons=['mods','payloads','loaders','tools'].map(value=>{
    const button=f.document.createElement('button');button.setAttribute('data-host-category',value);return button;
  });
  const original=f.document.querySelectorAll;
  f.document.querySelectorAll=selector=>selector==='[data-host-category]'?buttons:original.call(f.document,selector);
  ui.install(f.document,f.window);
  buttons.find(button=>button.getAttribute('data-host-category')===category).click();
  return {...f,action};
}

test('payload, utility and loader cards omit project images for both consoles while preserving data and controls',()=>{
  for(const platform of ['ps4','ps5'])for(const category of ['payloads','tools','loaders']){
    const f=categoryFixture(category,platform),html=f.ids['host-action-grid'].innerHTML;
    assert.match(html,/Policy fixture/,platform+' '+category);
    assert.doesNotMatch(html,/<(?:figure|img)\b|host-action-with-art/,platform+' '+category);
    assert.ok(f.action.image,'Removing a rendered preview must not erase source metadata.');
    assert.equal(f.action.imageAlt,'Retained preview description');
    assert.match(html,/Details/);
    assert.match(html,/data-launch=/);
    if(category!=='loaders')assert.match(html,/data-download-action=/);
    assert.equal(f.sends.length,0);assert.equal(f.opened.length,0);assert.equal(f.checks.length,0);
  }
});

test('game family cards and version previews retain useful artwork without image-role badges',()=>{
  for(const platform of ['ps4','ps5']){
    const f=categoryFixture('mods',platform),card=f.ids['host-action-grid'].innerHTML;
    assert.match(card,/<figure\b[^>]*><img\b[^>]*alt="[^"]+"/);
    assert.match(card,/data-choose-group=/);
    assert.doesNotMatch(card,/<figcaption\b/);
    f.openMenu();const preview=f.ids['host-version-detail'].innerHTML;
    assert.match(preview,/<figure\b[^>]*><img\b[^>]*alt="Retained preview description"/);
    assert.doesNotMatch(preview,/<figcaption\b/);
    assert.equal(f.sends.length,0);assert.equal(f.opened.length,0);
  }
});

test('local browser runtime builds retain exact source bytes and explicit platform/firmware guards',()=>{
  const builds=JSON.parse(fs.readFileSync(path.join(root,'docs/host-runtime-builds.json'),'utf8')).runtimes;
  assert.ok(builds.length>=2);
  for(const runtime of builds){
    assert.ok(['ps4','ps5'].includes(runtime.console));
    assert.match(runtime.entry,/^\/hosts\/runtime\/[a-z0-9-]+\/$/);
    assert.ok(runtime.firmwares.length&&runtime.firmwares.every(v=>/^\d+\.\d+$/.test(v)));
    assert.equal(runtime.verified.downloadedCodeExecuted,false);
    assert.equal(runtime.verified.hardwareExecution,false);
    const base=path.join(root,runtime.entry);
    for(const record of runtime.files){
      const relative=path.relative(base,path.resolve(base,record.path));
      assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative));
      const bytes=fs.readFileSync(path.join(base,record.path));
      assert.equal(bytes.length,record.bytes,runtime.id+'/'+record.path);
      assert.equal(digest(bytes),record.sha256,runtime.id+'/'+record.path);
    }
    const guard=fs.readFileSync(path.join(base,'guard.js'),'utf8');
    assert.match(guard,/PlayStation|Playstation/i);
  }
  const ps4=builds.find(r=>r.id==='ps4-900'),ps5=builds.find(r=>r.id==='ps5-umtx');
  assert.deepEqual(ps4.firmwares,['9.00']);
  assert.ok(ps5.firmwares.every(v=>Number(v)<5));
  assert.equal(ui.firmwareMatches({firmwares:ps4.firmwares},'14.00'),false);
});
