'use strict';
// Reuse reviewed translations, replacing literal technical scope only.
const prior=require('./host-repository-translations.cjs');
const table={};
for(const [key,values] of Object.entries(prior)){
 if(!key.includes('PS4 firmware 9.00 and GTA V')&&!key.startsWith('The reviewed GamerHack 900v3 host'))continue;
 const next=key.replaceAll('9.00','5.05').replaceAll('900v3','505');
 table[next]=Object.fromEntries(Object.entries(values).map(([code,text])=>[code,text.replaceAll('9.00','5.05').replaceAll('900v3','505')]));
}
const template='PS4 firmware 5.05 and GTA V game update {gameVersion}; the game update is separate from console firmware.';
for(const version of ['1.00','1.33','1.46'])table[template.replace('{gameVersion}',version)]=Object.fromEntries(Object.entries(table[template]).map(([code,text])=>[code,text.replace('{gameVersion}',version)]));
module.exports=table;
