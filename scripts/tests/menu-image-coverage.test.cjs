const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const media=require('../console-menu-media.cjs').createMenuMedia({root});
test('every available captured PS3 and Xbox menu has a verified local source image',()=>{
 for(const platform of ['ps3','xbox360'])for(const item of [...read(`docs/discord-${platform}-resources.json`).resources,...(platform==='xbox360'?read('docs/xbox360-mod-resources.json').resources:[])]){
  const record=media.forItem(item);
  if(!record){assert.equal(item.status,'source-marks-down',item.id);assert.match(item.id,/xakawin/);continue;}
  assert.equal(record.visuallyVerified,true,item.id);
  const bytes=fs.readFileSync(path.join(root,'.'+record.path));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256,item.id);
  assert.ok(record.path.startsWith('/assets/images/'),item.id);
 }
});
test('additional base previews resolve to the reviewed source files',()=>{
 const items=read('docs/ps3-mod-resources.json').resources;
 for(const [id,record] of Object.entries(read('docs/ps3-base-additional-image-research.json').resources))assert.equal(media.forItem(items.find(x=>x.id===id)).path,record.image,id);
});
test('family aliases preserve existing precise resource screenshots',()=>{
 const aliases=read('docs/ps3-base-menu-image-aliases.json').resources;
 const items=read('docs/ps3-mod-resources.json').resources;
 for(const [id,alias] of Object.entries(aliases)){
  const item=items.find(x=>x.id===id);assert.ok(item,id);
  const record=media.forItem(item);
  if(alias.currentlyApplicable)assert.equal(record.match,'menu-family',id);
  else if(item.image)assert.equal(record.path,item.image,id);
 }
});
test('source image mismatches remain visible in their provenance and guide notes',()=>{
 for(const id of ['discord-ps3-bo1-mp-nightmare-engine-v2','discord-ps3-bo3-pepitax','discord-ps3-waw-mp-hidden-gold-v5-older']){
  const item=read('docs/discord-ps3-resources.json').resources.find(x=>x.id===id);
  assert.match(media.figure(item),/see source notes/);
  assert.match(media.details(item),/source post|source image/i);
 }
});
