// Exact title mappings for console-directory, reference and original Xbox cards.
// Artwork does not establish game, network-service or firmware compatibility.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const xbox='/assets/images/original-xbox-more/';
const maps={
 'console/index.html':{
  'PlayStation 2':'/assets/images/merged-categories/library-ps2-v1.png',
  'PlayStation':'/assets/images/consoles/playstation.jpg',
  'PlayStation Portable':'/assets/images/merged-categories/library-psp-v1.png',
  'Original Xbox':'/assets/images/merged-categories/library-xbox-v1.png',
  'Nintendo Wii U':'/assets/images/merged-categories/library-wiiu-v1.png',
  'Nintendo Wii':'/assets/images/merged-categories/library-wii-v1.png',
  'Nintendo GameCube':'/assets/images/merged-categories/library-gamecube-v1.png',
  'Nintendo DS & DSi':'/assets/images/merged-categories/library-ds-v1.png',
  'Nintendo 2DS & 3DS':'/assets/images/merged-categories/library-3ds-v1.png',
  'Sega classics':'/assets/images/emulators/GensGenesisPlusGX.jpg',
  'Console themes':'/assets/images/merged-categories/category-themes-universal-v1.png',
  'Retro consoles':'/assets/images/social/pages/console-retro-e2b55e99ba2b.png',
  'Console game mods':'/assets/images/merged-categories/category-mods-v1.png',
  'Console game downloads':'/assets/images/merged-categories/library-game-downloads-v1.png',
  'PS4 / PS5 game mods':'/assets/images/merged-categories/category-mods-v1.png',
  'PC emulators':'/assets/images/merged-categories/emulators-emulators-v1.png'
 },
 'console/vault.html':{
  'PKG-Zone':'/assets/images/expansion-ps4-ps5/homebrew-store.png',
  'OrbisPatches':xbox+'orbispatches.svg',
  'Garlicsaves':'/assets/images/expansion-ps4-ps5/garlic.png',
  'SuperPSX':xbox+'superpsx.png',
  'PlayStation Firmware':'/assets/images/platform-logos/ps4.svg',
  'Vimm’s Lair':'/assets/images/ps3-resources/vimm.png'
 },
 'console/retro/xbox.html':{
  'Insignia & XLink Kai':xbox+'insignia.svg',
  'Find a game mode':xbox+'halo-2.png',
  'LithiumX':xbox+'lithiumx.jpg',
  'NevolutionX':'/assets/images/consoles/xbox.jpg',
  'SDLPoPX':'/assets/images/xbox-one-series/sdlpop.png',
  'Peanut-GB Xbox port':xbox+'peanut-gb.png'
 },
 'console/retro/xbox-online.html':{
  'Xbox Live → Insignia':xbox+'insignia.svg',
  'System Link → XLink Kai':xbox+'xlink.png',
  'Local System Link':'/assets/images/consoles/xbox.jpg',
  'Same-console multiplayer':'/assets/images/consoles/xbox.jpg',
  'Halo: Combat Evolved':xbox+'halo-combat-evolved-xlink.png',
  'Halo 2':xbox+'halo-2.png',
  'Doom 3':xbox+'doom-3.png',
  'Brute Force':xbox+'brute-force-xlink.png',
  'Call of Duty 2: Big Red One':xbox+'cod2-big-red-one.png',
  'Forza Motorsport':xbox+'forza.png',
  'Project Gotham Racing 2':xbox+'pgr2.png',
  'TimeSplitters 2':xbox+'timesplitters-2-xlink.webp',
  'Splinter Cell: Chaos Theory':xbox+'splinter-cell-chaos-theory.png',
  'Rainbow Six 3':xbox+'rainbow-six-3.png'
 }
};
const decode=title=>String(title).replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&apos;',"'").replace(/<[^>]+>/g,'').split(' · ')[0].trim();
function forTitle(file,title){
 const clean=decode(title),image=maps[file]?.[clean];
 if(!image)return null;
 if(!fs.existsSync(path.join(root,'.'+image)))throw Error('Missing mapped console image: '+image);
 const alt=clean==='NevolutionX'?'Original Xbox platform artwork':clean==='Peanut-GB Xbox port'?'Peanut-GB upstream emulator screenshot':clean==='SDLPoPX'?'SDLPoP game character artwork':clean+' artwork';
 return {image,alt};
}
const esc=text=>String(text).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function markup(file,title){const record=forTitle(file,title);return record?`<img class="${file==='console/index.html'?'console-directory-artwork':'console-rest-card-image'}" src="${esc(record.image)}" alt="${esc(record.alt)}" loading="lazy" decoding="async"${file==='console/index.html'?' width="480" height="220"':' style="width:100%;aspect-ratio:16/9;object-fit:contain;background:#101214"'}>`:'';}
function repair(){
 const report={checkedAt:new Date().toISOString(),changedPages:[],added:[]};
 for(const file of Object.keys(maps)){
  const full=path.join(root,file),before=fs.readFileSync(full,'utf8');
  const after=before.replace(/(<article\b[^>]*>)([\s\S]*?)(<\/article>)/g,(all,open,body,end)=>{
   if(/<img\b/.test(body)){
    if(file!=='console/index.html')return all;
    const category=body.match(/<div class="category-art\b[^>]*>[\s\S]*?<\/div>/)?.[0];
    const header=body.match(/<div class="game-image"><div class="console-wordmark"[^>]*>[\s\S]*?<\/div><\/div>/)?.[0];
    let next=body;
    if(category&&header){
     next=next.replace(category,'').replace(header,'<div class="game-image">'+category+'</div>');
    }
    next=next.replace(/<div class="console-wordmark"[^>]*>[\s\S]*?<\/div>/g,'');
    next=next.replace(/<div class="category-art\b[^>]*>[\s\S]*?<\/div>/g,art=>art.replace(' class="console-directory-artwork"',''));
    return open+next+end;
   }
   const title=body.match(/<h[234]\b[^>]*>([\s\S]*?)<\/h[234]>/)?.[1];if(!title)return all;
   const image=markup(file,title);if(!image)return all;
   const wordmark=body.match(/<div class="console-wordmark"[^>]*>[\s\S]*?<\/div>/)?.[0];
   report.added.push({file,title:decode(title),...forTitle(file,title)});
   return open+(wordmark?body.replace(wordmark,image):image+body)+end;
  });
  if(before!==after){fs.writeFileSync(full,after);report.changedPages.push(file);}
 }
 fs.writeFileSync(path.join(root,'docs/qa/console-rest-owned-card-repair.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({pages:report.changedPages.length,images:report.added.length}));return report;
}
module.exports={forTitle,markup,maps,repair};
if(require.main===module)repair();
