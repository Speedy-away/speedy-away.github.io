'use strict';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const bindings={
 'karo-offline-trainer':{launchURL:'/hosts/tools/ps4-trainer/',launchLabel:'Open trainer',label:'PS4 Offline Trainer',localTool:true},
 'kme-offline-trainer':{alias:true},
 'kme-esp-flasher':{launchURL:'/hosts/tools/esp-flasher/',launchLabel:'Open flasher',label:'ESP Web Flasher',localTool:true},
 'kme-webpayloads':{alias:true},
 'karo-copy-cheats':{launchURL:'/hosts/ps4/cheats/',launchLabel:'Open cheats',label:'GoldHEN cheats',localTool:true},
 'ps4-lua-game-loader':{launchURL:'/hosts/ps4/lua/',launchLabel:'Lua setup',label:'Lua game loader',localTool:true},
 'ps5-lua-game-loader':{launchURL:'/hosts/ps5/lua/',launchLabel:'Lua setup',label:'Lua game loader',localTool:true}
};
function bind(action){if(action.browserHost&&(require('./ps4-browser-hosts.cjs').isTrustedOriginal(action)||require('./ps5-browser-hosts.cjs').isTrustedOriginal(action)))return action;const b=bindings[action.id];if(b?.alias)return null;if(b)return {...action,...b,originalLaunchURL:action.launchURL,format:action.id.includes('lua')?'Game save setup':'Local web tool'};if(/^https?:\/\//.test(action.launchURL||'')&&!action.launchURL.includes('{address}')&&!action.run&&!action.game)return null;return action;}
function directory(platform,actions){const seen=new Set();const extra=require('../docs/console-exploit-hosts.json').platforms[platform].filter(h=>!h.firstParty&&/^https?:/.test(h.url)).map(h=>({platform,label:h.label,launchURL:h.url}));const rows=actions.concat(extra).filter(a=>a.platform===platform&&/^https?:\/\//.test(a.launchURL||'')&&!a.launchURL.includes('{address}')&&!a.game).filter(a=>{if(seen.has(a.launchURL))return false;seen.add(a.launchURL);return true;});return `<details class="host-other-directory"><summary>Other hosts</summary><p>Links to other projects. Your hosted tools and loaders are listed above.</p><div class="host-other-directory-list">${rows.map(a=>`<a href="${esc(a.launchURL)}" target="_blank" rel="noopener noreferrer">${esc(a.label)}<small>${esc((a.firmwares||[]).join(' · ')||'Check project requirements')}</small></a>`).join('')}</div></details>`;}
module.exports={bindings,bind,directory};
