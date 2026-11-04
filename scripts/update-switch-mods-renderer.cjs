// One-time migration from the original three fixed groups to catalogue-driven games.
const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'build-switch-game-mods.cjs');let code=fs.readFileSync(file,'utf8');
const start=code.indexOf('<div id="mario-kart"'),end=code.indexOf('<p class="switch-mod-count" data-mod-empty hidden>',start);
if(start>=0){if(end<0)throw Error('Cannot locate old game groups');code=code.slice(0,start)+'${gameSections}'+code.slice(end);}
const shortcuts=code.indexOf('<div class="switch-mod-games">'),shortEnd=code.indexOf('</div>${note(',shortcuts);
if(shortcuts>=0&&shortEnd>=0)code=code.slice(0,shortcuts)+'<div class="switch-mod-games">${gameShortcuts}'+code.slice(shortEnd);
code=code.replace("Mario Kart 8 Deluxe, Smash Ultimate and Super Mario Odyssey mods, with ready console downloads, exact game requirements and installation paths.","Mario Kart, Smash Ultimate, Odyssey multiplayer, Sonic CrossWorlds, Pokémon and more Switch game mods, with ready downloads, exact build requirements and setup guides.");
code=code.replace("${mod.game==='Mario Kart 8 Deluxe'?'Original green custom racing circuit illustration':'Original green custom fighting arena illustration'}","Illustration for ${esc(mod.game)}");
fs.writeFileSync(file,code);
