'use strict';
// Reuse existing, provenance-recorded local artwork. No network or download work.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),api=require('../assets/host-trainer.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(){
  const catalog=read('hosts/tools/ps4-trainer/catalog.json'),patches=read('docs/ps4-ps5-game-patches.json'),source=read('docs/ps4-ps5-game-patch-images.json').images;
  const covers={},byTitle={},byName={};
  for(const [id,record] of Object.entries(source)){
    if(!record.image||!record.sha256||!record.sourcePage||id==='the-sinking-city')continue;
    const bytes=fs.readFileSync(path.join(root,record.image));
    if(sha(bytes)!==record.sha256)throw Error('Existing game image hash differs: '+record.image);
    const patchGame=patches.games.find(g=>g.id===id&&g.arch==='orbis');
    covers[id]={image:record.image,bytes:bytes.length,sha256:record.sha256,name:record.sourceTitle,displayName:patchGame&&patchGame.title||record.sourceTitle,sourcePage:record.sourcePage,source:record.source,evidence:'docs/ps4-ps5-game-patch-images.json#images.'+id};
    for(const game of patches.games.filter(g=>g.id===id&&g.arch==='orbis'))for(const title of game.titleIds||[])if(catalog.games.some(g=>g.title===title))byTitle[title]=id;
    // Exact normalized titles only. RE4 has a classic and a remake with the same
    // source name: artwork for that family is ONLY assigned by confirmed CUSA.
    if(id==='resident-evil-4-remake')continue;
    const key=api.gameKey(record.sourceTitle.replace(/ \(PS4\)$/,''));
    if(catalog.games.some(g=>api.gameKey(g.name)===key))byName[key]=id;
  }
  // These reviewed title-label aliases reuse art for the same named game, never
  // expand firmware/cheat compatibility. Every build still uses its pinned CUSA.
  const aliases={
    'grand-theft-auto-v':['Grand Theft Auto V'],
    'horizon-forbidden-west':['Horizon Forbidden West','Horizon Forbbiden West'],
    'horizon-zero-dawn':['Horizon Zero Dawn: Complete Edition'],
    'the-last-of-us-part-ii':['The Last of Us Part II'],
    'the-last-of-us-remastered':['The Last of Us Remastered'],
    'dying-light-2-stay-human':['Dying Light 2 Stay Human','Dying Light 2: Stay Human'],
    'dying-light':['Dying Light Following The Enhanced Edtion','Dying Light: The Following – Enhanced Edition'],
    'dark-souls-iii':['DARK SOULS III: The Fire Fades Edition'],
    'ghost-of-tsushima-director-s-cut':['Ghost of Tsushima','Ghost of Tsushima (v2.18)'],
    'final-fantasy-xv':['FINAL FANTASY XV'],
    'the-witcher-3':['The Witcher 3: Wild Hunt - Complete Edition','The Witcher 3: Wild Hunt – Game of the Year Edition'],
    'sekiro-shadows-die-twice':['Sekiro: Shadows Die Twice'],
    'resident-evil-hd':['Resident Evil'],
    'resident-evil-zero':['Resident Evil 0'],
    'dragon-s-dogma-dark-arisen':['Dragon’s Dogma: Dark Arisen']
  };
  for(const [id,names] of Object.entries(aliases))if(covers[id])for(const name of names){const key=api.gameKey(name);if(catalog.games.some(g=>api.gameKey(g.name)===key))byName[key]=id;}
  const featured=['grand-theft-auto-v','red-dead-redemption-2','bloodborne','elden-ring','god-of-war','days-gone','horizon-zero-dawn'];
  const used=new Set([...Object.values(byTitle),...Object.values(byName)]);
  for(const id of Object.keys(covers))if(!used.has(id))delete covers[id];
  const map={schemaVersion:1,catalogCommit:catalog.commit,covers,byTitle,byName,featured,fallback:'art/letter-cover.svg',policy:'Existing source-recorded game artwork identifies the game only. It is not a trainer preview or compatibility evidence. Unmapped games use an authored letter tile; no claim that all builds have unique official artwork.',aliases};
  const groups=api.groupGames(catalog.games,map);
  const report={schemaVersion:1,catalogCommit:catalog.commit,builds:catalog.games.length,gameTiles:groups.length,tilesWithExistingArtwork:groups.filter(g=>g.art).length,letterTiles:groups.filter(g=>!g.art).length,distinctExistingImages:Object.keys(covers).length,newWebDownloads:0,records:Object.entries(covers).map(([id,r])=>({id,...r})),policy:map.policy,identityNotes:['The same game can have several source names/regions; exact CUSA/update choices remain separate buttons.','Resident Evil 4 classic and remake are not mapped by ambiguous names. Remake CUSA33388 is source-confirmed by the pinned local patch catalogue; classic CUSA04885 has a separate letter tile.','Images do not change the WebRTE transport or any firmware/game build guard.']};
  fs.writeFileSync(path.join(root,'hosts/tools/ps4-trainer/tile-art.json'),JSON.stringify(map,null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/host-trainer-tile-artwork.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(require.main===module){const r=build();console.log(JSON.stringify({builds:r.builds,gameTiles:r.gameTiles,tilesWithExistingArtwork:r.tilesWithExistingArtwork,letterTiles:r.letterTiles,distinctExistingImages:r.distinctExistingImages,newWebDownloads:r.newWebDownloads}));}
module.exports={build};
