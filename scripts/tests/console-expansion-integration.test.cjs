const {test}=require('node:test');
const assert=require('node:assert/strict');
const {entries,integrateIndex,addSitemap}=require('../integrate-console-expansion.cjs');
const shell='<main><section class="section" id="modern"><div class="games-grid"><article>Existing console</article></div></section><section id="retro">Wii U, Wii U, Wii U, Wii, GameCube, DS and DSi, Nintendo 2DS and 3DS, PS2, original Xbox and PSP homebrew.</section></main>';
test('adds only ready cards, retains existing content and stays idempotent',()=>{
  const result=integrateIndex(shell,[entries[2]]);
  assert.ok(result.includes('Existing console'));
  assert.ok(result.includes('href="/console/themes.html"'));
  assert.ok(!result.includes('href="/console/nintendo-switch-2.html"'));
  assert.equal(integrateIndex(result,[entries[2]]),result);
  assert.ok(!result.includes('Wii U, Wii U'));
});
test('refreshing managed cards adds newly ready consoles once',()=>{
  const result=integrateIndex(integrateIndex(shell,[entries[2]]),entries);
  for(const item of entries)assert.equal(result.split('href="'+item.route+'"').length-1,1);
  assert.equal(integrateIndex(result,entries),result);
  assert.ok(result.includes('<article>Existing console</article>'));
});
test('sitemap expansion preserves existing URLs and adds each canonical once',()=>{
  const old='<urlset><url><loc>https://whatwhatboy.com/console/</loc></url></urlset>';
  const routes=entries.map(x=>x.route),next=addSitemap(old,routes);
  assert.ok(next.includes('<loc>https://whatwhatboy.com/console/</loc>'));
  assert.equal(addSitemap(next,routes),next);
  assert.equal((next.match(/<url>/g)||[]).length,4);
});
