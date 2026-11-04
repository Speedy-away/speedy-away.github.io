const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const {inspect}=require('../prepare-ps5-native-batch5.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const native=read('docs/ps5-native-batch5.json'),index=fs.readFileSync(path.join(root,'docs/tmp/ps5-native-extra-cheats/shn.txt'),'utf8');
test('native SHN definitions retain pinned publisher bytes, exact filename/index and embedded identities',()=>{
  const tree=read('docs/tmp/console-batch5/ps5-tree.json');assert.equal(tree.sha,native.commit);
  assert.equal(native.resources.length,8);
  for(const pin of native.resources){
    const bytes=fs.readFileSync(path.join(root,pin.importPath)),meta=inspect(bytes,pin,index);
    const blob=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
    assert.equal(blob,tree.tree.find(x=>x.path==='shn/'+pin.filename).sha);
    assert.equal(pin.cheatCount,meta.options.length);assert.deepEqual(pin.cheats,meta.options.map(x=>x.name));
    assert.deepEqual(pin.cheatDetails,meta.options.filter(x=>x.description.trim()));assert.deepEqual(pin.credits,[meta.trainer.Moder]);
    assert.deepEqual(pin.platforms,['ps5']);assert.equal(pin.format,'SHN');assert.equal(meta.trainer.Process,'eboot.bin');
    if(pin.titleId==='PPSA01342')assert.match(pin.metadataValidation,/embedded Version is 1\.004/);
    if(/encoding="utf-16"/.test(bytes.toString()))assert.match(pin.metadataValidation,/declares utf-16 but contains UTF-8/);
  }
});
test('native validation rejects unrelated games, source versions and malformed memory data',()=>{
  const pin=native.resources.find(x=>x.titleId==='PPSA02745'),original=fs.readFileSync(path.join(root,pin.importPath));
  for(const [a,b] of [['Cusa="PPSA02745"','Cusa="PPSA02746"'],['Version="01.000.004"','Version="01.000.005"'],['Process="eboot.bin"','Process="other.elf"'],['Game="Tales of Arise "','Game="Another Game"'],['<ValueOn>EB-FE</ValueOn>','<ValueOn>bad</ValueOn>']]){
    const changed=Buffer.from(original.toString().replace(a,b));assert.notEqual(hash(changed),pin.sha256);
    assert.throws(()=>inspect(changed,{...pin,bytes:changed.length,sha256:hash(changed)},index));
  }
});
test('new PS4 cards keep exact build and two download actions visible while setup remains collapsed',()=>{
  const config=read('docs/console-expansion-batch5.json'),catalog=read('docs/ps4-ps5-game-resources.json');
  for(const pick of config.cheats){
    const entry=catalog.resources.find(r=>r.downloads?.some(d=>d.filename===pick.filename));assert.equal(entry.compactDownload,true);
    const html=fs.readFileSync(path.join(root,'console/mods/ps4',pick.game,'index.html'),'utf8');
    const card=html.match(new RegExp('<article[^>]*id="resource-'+entry.id+'"[\\s\\S]*?</article>'))?.[0];assert.ok(card);
    const visible=card.replace(/<details[\s\S]*?<\/details>/g,'');
    assert.match(visible,/>Download<\/a>/);assert.match(visible,/>Save on PS4<\/a>/);assert.ok(visible.includes(pick.filename.split('_')[0]));
    assert.doesNotMatch(visible,/Infinite|SHA-256|Native PS5 support/);assert.match(card,/<summary>Setup &amp; source<\/summary>/);assert.doesNotMatch(card,/<details[^>]*\sopen(?:\s|>)/);
  }
});
test('incomplete CJ House transfer stays preserved and outside public download jobs',()=>{
  const report=read('docs/tmp/console-batch5/cjhouse-transfer.json');
  assert.equal(report.complete,false);assert.ok(fs.existsSync(path.join(root,report.priorPartial)));assert.ok(fs.existsSync(path.join(root,report.stagedPath)));
  assert.equal(report.sha256,undefined);assert.ok(report.bytes<report.expectedBytes);
  assert.ok(!read('docs/qa/console-batch5-download-jobs.json').jobs.some(j=>/cjhouse/i.test(j.id)));
});
