// Regenerate only source-reviewed multi-game PS3 routes and their entry points.
const catalog = require('./build-ps3-catalog.cjs');
const {metadata} = require('./ps3-multicod-metadata.cjs');
const pages = require('./build-ps3-pages.cjs');
const gameIds = [...new Set(Object.values(metadata.resources).flatMap(entry => [...entry.supportedGameIds,...entry.indexIds]))];
catalog.build(pages.ps3nav,{onlyGames:gameIds,updateCategories:true});
// The topic builder also merges the latest sitemap additively after the new leaf exists.
pages.buildPs3Pages({onlyPages:['console/ps3/mods.html'],skipResourceRefresh:true});
