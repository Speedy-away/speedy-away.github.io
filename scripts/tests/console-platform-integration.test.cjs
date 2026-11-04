const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const nav=require('../integrate-console-platforms.cjs');
const {decorateNavLinks,applySidebarIcons}=require('../sidebar-icons.cjs');
const root=path.resolve(__dirname,'../..');
const routes=nav.platforms.map(p=>p.route);
const options={availableRoutes:routes};
const base='<ul class="nav-sublist nav-console-list"><li><a href="/console/xbox360/" class="nav-link nav-sublink"><span>Xbox 360</span></a></li><li><a href="/console/nintendo-switch.html" class="nav-link nav-sublink active" aria-current="page"><span>Nintendo Switch</span></a></li><li><a href="/console/retro/" class="nav-link nav-sublink"><span>Retro</span></a></li></ul>';
const sidebar=body=>'<aside id="sidebar">'+body+'</aside>';
test('adds available destinations in the console group and preserves unrelated markup',()=>{
 const input='<main><a href="/console/nintendo-switch.html">Body link</a></main>'+sidebar(base)+'<footer>untouched</footer>';
 const output=nav.integratePageConsoleNav('games/cod/index.html',input,options);
 for(const route of routes)assert.equal((output.match(new RegExp('href="'+route+'"','g'))||[]).length,1);
 assert.ok(output.indexOf('xbox360/')<output.indexOf('xbox-one-series.html'));
 assert.ok(output.indexOf('nintendo-switch.html')<output.indexOf('nintendo-switch-2.html'));
 assert.ok(output.includes('<main><a href="/console/nintendo-switch.html">Body link</a></main>'));
 assert.ok(output.endsWith('<footer>untouched</footer>'));
 assert.equal(nav.integratePageConsoleNav('games/cod/index.html',output,options),output);
});
test('waits for real destination pages and leaves absent console groups unchanged',()=>{
 assert.equal(nav.integrateConsoleList(base,{availableRoutes:[]}),base);
 const one=nav.integrateConsoleList(base,{availableRoutes:[routes[0]]});
 assert.ok(one.includes(routes[0]));assert.ok(!one.includes(routes[1]));
 assert.equal(nav.integrateConsoleList('<ul class="nav-sublist"><li>PC</li></ul>',options),'<ul class="nav-sublist"><li>PC</li></ul>');
});
test('dedupes relative and same-origin absolute destination rows',()=>{
 const extra='<li><a href="../../console/nintendo-switch-2.html" class="nav-link nav-sublink">old</a></li><li><a href="https://whatwhatboy.com/console/nintendo-switch-2.html?from=nav" class="nav-link nav-sublink">duplicate</a></li>';
 const output=nav.integrateConsoleList(base.replace('</ul>',extra+'</ul>'),{...options,file:'games/cod/index.html'});
 assert.equal((output.match(/href="\/console\/nintendo-switch-2.html"/g)||[]).length,1);
 assert.ok(!output.includes('>duplicate<'));
 assert.ok(!output.includes('>old<'));
});
test('activates Switch 2 distinctly from original Switch and clears fallback active entries',()=>{
 const withPC=base+'<ul class="nav-sublist nav-pc-list"><li><a href="/pc/index.html" class="nav-link nav-sublink active" aria-current="page">PC</a></li></ul>';
 const output=nav.integrateConsoleList(withPC,{...options,file:'console/nintendo-switch-2.html'});
 const anchors=output.match(/<a\b[^>]*>/g);
 assert.equal(anchors.filter(a=>a.includes('aria-current="page"')).length,1);
 assert.ok(anchors.find(a=>a.includes('nintendo-switch-2.html')).includes('aria-current="page"'));
 assert.ok(!anchors.find(a=>a.includes('nintendo-switch.html')).includes(' active'));
 assert.ok(!anchors.find(a=>a.includes('/pc/index.html')).includes(' active'));
});
test('supports Xbox nested pages and preserves active semantics when file is unknown',()=>{
 const active=nav.integrateConsoleList(base,{...options,file:'console/xbox-one-series/apps.html'});
 assert.match(active,/<a href="\/console\/xbox-one-series.html"[^>]*aria-current="page"/);
 assert.equal(nav.integrateConsoleList(active,options),active);
 assert.equal(nav.currentPlatform('console/nintendo-switch/apps.html'),undefined);
});
test('sidebar decorator remains compatible with old signature and new entries',()=>{
 const decorated=decorateNavLinks(nav.integrateConsoleList(base,options));
 assert.ok(decorated.includes('nav-platform-logo'));
 assert.ok(decorated.includes('data-nav-icon="retro"'));
 assert.equal(decorateNavLinks(decorated),decorated);
});
test('immutable downloaded helpers stay byte-identical through every entry point',()=>{
 const immutable='<html><head><title>PS4 Download Receiver | whatwhatboy</title><link href="/style.css?v=old"></head><body><div id="receiver-catalog"></div>'+sidebar(base)+'</body></html>';
 for(const filename of ['console/ps4/whatsite-ps4.html','downloads/archive/PS5/whatsite-ps5.html','downloads/other/copied-build.html']){
  assert.equal(nav.integratePageConsoleNav(filename,immutable,options),immutable);
  assert.equal(applySidebarIcons(filename,immutable),immutable);
 }
 assert.equal(nav.integratePageConsoleNav('console/ps4/renamed.html',immutable,options),immutable);
 for(const filename of ['console/ps4/whatsite-ps4.html','console/ps5/whatsite-ps5.html']){
  const bytes=fs.readFileSync(path.join(root,filename));const before=crypto.createHash('sha256').update(bytes).digest('hex');
  const after=Buffer.from(nav.integratePageConsoleNav(filename,bytes.toString('utf8'),options));
  assert.equal(crypto.createHash('sha256').update(after).digest('hex'),before);
 }
});
test('real logo assets are inert SVGs with viewBoxes and documented hashes',()=>{
 const provenance=JSON.parse(fs.readFileSync(path.join(root,'docs/platform-logo-sources.json')));
 for(const platform of nav.platforms){const bytes=fs.readFileSync(path.join(root,platform.image));const text=bytes.toString('utf8');assert.match(text,/<svg\b/);assert.match(text,/viewBox=/);assert.doesNotMatch(text,/<(?:script|foreignObject)\b|\bon\w+\s*=/i);const record=provenance.logos.find(x=>x.file===platform.image.slice(1)||x.sidebar_file===platform.image.slice(1));assert.ok(record);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sidebar_file===platform.image.slice(1)?record.sidebar_sha256:record.sha256);}
});
