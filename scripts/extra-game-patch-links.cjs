// Context links use exact cheat filenames and PS4 patch IDs, never fuzzy game titles.
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const markerStart='<!-- extra-game-patch-links:start -->';
const markerEnd='<!-- extra-game-patch-links:end -->';
function relatedPatches(gameId,resources,patches){
  const titleIds=new Set(resources.filter(item=>item.category==='cheat' && item.publication==='include' && item.gameIds?.includes(gameId))
    .flatMap(item=>(item.downloads || []).filter(file=>file.distribution==='include').map(file=>String(file.filename || '').match(/^(CUSA\d{5})_\d{2}\.\d{2}(?:_[^/\\]+)?\.json$/)?.[1])).filter(Boolean));
  return (patches.games || []).filter(game=>game.arch==='orbis' && game.platforms?.includes('ps4') && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(game.id || '') && game.options?.length)
    .map(game=>({id:game.id,title:game.title,titleIds:[...new Set((game.titleIds || []).filter(id=>titleIds.has(id) && game.files?.some(file=>file.titleId===id)))],url:'/console/ps4/game-patches.html#'+game.id}))
    .filter(game=>game.titleIds.length);
}
function renderPatchLinks(related){
  if(!related.length)return '';
  return `<section class="section" id="related-game-patches"><div class="container"><div class="section-header"><h2 class="section-title">FPS &amp; graphics patches</h2></div><p>The patch catalogue also lists these exact PS4 title IDs. Cheat and patch update requirements are separate. Choose a patch option matching its own game update, hardware and patch-engine requirements.</p><ul class="guide-source-list">${related.map(game=>`<li><a href="${esc(game.url)}">${esc(game.title)} FPS &amp; graphics patches</a> · ${game.titleIds.map(esc).join(', ')}</li>`).join('')}</ul></div></section>`;
}
function appendPatchLinks(html,related){
  const clean=html.replace(/<!-- extra-game-patch-links:start -->[\s\S]*?<!-- extra-game-patch-links:end -->/g,'');
  const section=renderPatchLinks(related);
  if(!section)return clean;
  const footer='</div>\n<footer class="guide-footer">';
  if(!clean.includes(footer))throw Error('Extra-game page content marker missing');
  return clean.replace(footer,markerStart+section+markerEnd+footer);
}
module.exports={relatedPatches,renderPatchLinks,appendPatchLinks};
