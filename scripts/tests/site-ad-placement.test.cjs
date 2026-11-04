const {test}=require('node:test');
const assert=require('node:assert/strict');
const {applyAds,placement}=require('../site-ads.cjs');
test('advertisement follows the complete resource section, outside nested card guides',()=>{
 const html='<html><head></head><body><main id="main-content"><section id="resources"><div class="games-grid"><article><section id="guide"><script>const text="</section>";</script>Guide</section><a href="/downloads/pinned.pkg" download>Download</a></article></div></section><section id="compatibility">Requirements</section></main></body></html>';
 const fixed=applyAds('console/ps3/mods/example/index.html',html);
 assert.ok(fixed.indexOf('id="page-advertisement"')>fixed.indexOf('</article></div></section>'));
 assert.ok(fixed.indexOf('<!-- END SITE AD -->')<fixed.indexOf('<section id="compatibility">'));
 assert.ok(fixed.includes('<a href="/downloads/pinned.pkg" download>Download</a>'));
 assert.equal(applyAds('console/ps3/mods/example/index.html',fixed),fixed);
 const old=html.replace('Guide</section>','Guide</section>'+placement());
 assert.equal(applyAds('console/ps3/mods/example/index.html',old),fixed);
});
test('unknown region prompts are omitted while actual title-ID requirements remain',()=>{
 const {card}=require('../build-ps3-catalog.cjs');
 const item={id:'test-region-placeholder',name:'Test resource',gameId:'world-at-war',category:'script',compatibility:'Der Riese only',downloads:[]};
 const unknown=card({...item,region:'Match your title ID; not specified'});
 assert.ok(!unknown.includes('<dt>Region / title</dt>'));
 assert.ok(unknown.includes('Der Riese only'));
 const known=card({...item,region:'BLES00148'});
 assert.ok(known.includes('<dt>Region / title</dt><dd>BLES00148</dd>'));
});
test('missing menu screenshots use labelled game art without replacing verified source images',()=>{
 const {card}=require('../build-ps3-catalog.cjs');
 const item={id:'test-image-fallback',name:'Test resource',gameId:'world-at-war',category:'script',compatibility:'Source requirements',downloads:[]};
 const fallback=card(item);
 assert.ok(fallback.includes('src="/assets/images/ps3-mods/waw-official-cover.jpg"'));
 assert.ok(fallback.includes('data-menu-preview="artwork"'));
 assert.ok(fallback.includes('alt="Call of Duty: World at War artwork"'));
 const source=card({...item,image:'/assets/images/ps3-mods/fourth-waw-paradise.jpg',imageCaption:'Verified source still'});
 assert.ok(source.includes('src="/assets/images/ps3-mods/fourth-waw-paradise.jpg"'));
 assert.ok(source.includes('Verified source still'));
});
