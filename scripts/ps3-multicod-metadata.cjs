// Archive-reviewed PS3 metadata only. Do not infer HEN/DEX variants on other platforms.
const metadata = require('../docs/ps3-multicod-routing.json');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const unique = values => [...new Set(values)];
const canonicalGameId = id => metadata.gameAliases[id]?.id || id;
if (metadata.platform !== 'PS3') throw Error('Multi-game archive metadata must be PS3-scoped');

function mergeGameDefinitions(games) {
  const result = [...games];
  for (const game of metadata.games) if (!result.some(existing => existing.id === game.id)) result.push(game);
  const canonical = result.filter(game=>!metadata.gameAliases[game.id] || !result.some(existing=>existing.id===canonicalGameId(game.id)));
  return canonical.map(source => {
    const alias = metadata.gameAliases[source.id];
    let game = alias ? {...source,id:alias.id,url:alias.url} : source;
    const synonyms = result.filter(other=>other!==source && canonicalGameId(other.id)===game.id);
    if(synonyms.length) game={...game,aliases:unique([...(game.aliases || []),...synonyms.flatMap(other=>other.aliases || [])])};
    const fallback=metadata.assetFallbacks[game.image];
    if(fallback && !fs.existsSync(path.join(root,game.image.slice(1))) && fs.existsSync(path.join(root,fallback.slice(1)))) game={...game,image:fallback};
    return metadata.collections[game.id] ? {...game,...metadata.collections[game.id],kind:'collection'} : game;
  });
}

function entryForResource(item) {
  if(metadata.resources[item.id])return metadata.resources[item.id];
  const sources=new Set((item.downloads || []).map(download=>download.url));
  return Object.values(metadata.resources).find(entry=>entry.variants.some(variant=>sources.has(variant.sourceUrl)));
}

function enhanceResource(item) {
  const entry = entryForResource(item);
  const gameId=canonicalGameId(item.gameId);
  const gameIds=unique([...(item.gameIds || []),...(entry?.supportedGameIds || [])].map(canonicalGameId));
  if (!entry && gameId===item.gameId && gameIds.every((id,index)=>id===(item.gameIds || [])[index])) return item;
  // Add reviewed routing without overwriting the original version, compatibility or downloads.
  return {...item,
    gameId,
    gameIds,
    indexIds:unique([...(item.indexIds || []), ...(entry?.indexIds || [])])
  };
}

function writeAliasPages(selectedGames) {
  for(const alias of Object.values(metadata.gameAliases)) {
    if(selectedGames && !selectedGames.includes(alias.id)) continue;
    const source=path.join(root,alias.url.slice(1),'index.html');
    if(!fs.existsSync(source)) continue;
    const target=path.join(root,alias.legacyUrl.slice(1),'index.html');
    // A full alias page preserves old resource fragments even in browsers without JavaScript.
    const html=fs.readFileSync(source,'utf8').replace('<meta name="robots" content="index, follow">','<meta name="robots" content="noindex, follow">');
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,require('./search-page-output.cjs').finish(target,html));
  }
}

function variantForFile(item, file) {
  // Exact archive content identifies a build; a similar filename alone does not.
  return entryForResource(item)?.variants.find(variant => variant.sha256 === file.sha256?.toLowerCase());
}

function downloadLabel(item, download) {
  const variant = entryForResource(item)?.variants.find(variant => variant.sourceUrl === download.url);
  return variant ? `${variant.label} · original source` : download.label || 'Original file page';
}

module.exports = {metadata,canonicalGameId,mergeGameDefinitions,entryForResource,enhanceResource,variantForFile,downloadLabel,writeAliasPages};
