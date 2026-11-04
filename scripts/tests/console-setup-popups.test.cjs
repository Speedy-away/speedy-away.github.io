const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {apply}=require('../apply-console-setup-popups.cjs');
const {skipPath,setupPage}=require('../../assets/console-setup-popups.js');
test('setup-page popup routing excludes catalogues, external paths and archived helpers',()=>{
  for(const p of ['/console/wii/setup.html','/console/ps3/hen.html','/console/ps4/jailbreak.html','/console/xbox-one-series/install.html','/console/psvita/cfw.html'])assert.equal(setupPage(p),true,p);
  for(const p of ['/console/ps4/apps.html','/console/ps4/downloads.html','/console/ps5/game-patches.html','/pc/setup.html','/console/retro/ps2.html','/console/ps4/whatsite-ps4.html','/console/mods/ps4/setup.html'])assert.equal(setupPage(p),false,p);
});
test('integration is additive and idempotent, with no changes to standalone console helper bytes',()=>{
  const html='<html><head></head><body><main><section id="setup"><ol><li>Original instructions</li></ol><a download href="/exact.bin">Pinned download</a></section></main></body></html>';
  const after=apply('console/wii/setup.html',html);
  assert.equal(after.replace('<link rel="stylesheet" href="/assets/console-setup-popups.css?v=1">','').replace('<script defer src="/assets/console-setup-popups.js?v=1"></script>',''),html);
  assert.equal(apply('console/wii/setup.html',after),after);
  for(const file of ['console/ps4/whatsite-ps4.html','console/ps5/whatsite-ps5.html','console/retro/ps2.html','downloads/helpers/anything.html'])assert.equal(apply(file,html),html);
  for(const file of ['console/ps4/whatsite-ps4.html','console/ps5/whatsite-ps5.html'])if(fs.existsSync(file)){const h=fs.readFileSync(file,'utf8');assert.equal(apply(file,h),h);}
});
test('existing console builders gain integration without broad build execution',()=>{
  const policy=require('../guide-popup-policy.cjs');const out=policy.applyGuidePopupPolicy('console/ps3/hen.html','<html><head></head><body><main></main></body></html>');assert.ok(out.includes('console-setup-popups.js'));assert.equal(skipPath('/console/retro/ps2.html'),true);
});
