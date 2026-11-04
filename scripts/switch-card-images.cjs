// Source-published identity artwork; game/hardware art never asserts mod compatibility.
const fs=require('node:fs'),path=require('node:path');
const data=require('../docs/switch-card-image-recovery.json');
const root=path.resolve(__dirname,'..');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function image(src,alt){if(!src||!fs.existsSync(path.join(root,'.'+src)))throw Error('Missing Switch card art: '+src);return `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;}
function modImage(mod){
 if(mod.image)return {src:mod.image,alt:'Illustration for '+mod.game};
 if(mod.id==='playable-bosses')return {src:data.images['playable-bosses'].image,alt:'Competitive Playable Bosses original project artwork'};
 const key={'Mario Kart 8 Deluxe':'mario-kart','Super Smash Bros. Ultimate':'smash','Super Mario Odyssey':'odyssey'}[mod.game];
 return {src:data.images[key].image,alt:mod.game+' official game artwork'};
}
function themeTool(id){return id==='themezer-nx'?image(data.images.themezer.image,'Themezer-NX original browsing interface'):image('/assets/images/switch-homebrew/NXthemes_Installer.png','NXThemes Installer project icon');}
function switch2Project(id){return id==='ns2-savekit'?image(data.images['ns2-savekit'].image,'ns2-savekit original project identity'):image('/assets/images/switch2-console/console.jpg','Nintendo Switch 2 official hardware artwork');}
module.exports={image,modImage,themeTool,switch2Project};
