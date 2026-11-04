'use strict';
// Old game bookmarks join the shared catalogue without starting a native action.
const ORIGIN='https://speedy-away.github.io';
function renderModRedirect(platform,scope){
 if(!['ps4','ps5'].includes(platform)||!['gta5','rdr2','other-games'].includes(scope))throw Error('Unknown mods bookmark route');
 const query='view=mods'+(scope==='other-games'?'':'&game='+scope),canonical=ORIGIN+'/hosts/'+platform+'/?'+query,escape=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;'),fallback='../?'+query+'#actions';
 const script='(function(){var target=new URL("../",location.href),params=new URLSearchParams(location.search);params.set("view","mods");'+(scope==='other-games'?'params.delete("game");':'params.set("game",'+JSON.stringify(scope)+');')+'target.search=params.toString();target.hash=location.hash||"#actions";location.replace(target.pathname+target.search+target.hash);}());';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mods / Mod Menus | WWB HOST</title><link rel="canonical" href="'+escape(canonical)+'"><script>'+script+'</script><noscript><meta http-equiv="refresh" content="0;url='+escape(fallback)+'"></noscript></head><body><p><a href="'+escape(fallback)+'">Open Mods / Mod Menus</a></p></body></html>\n';
 const metadata=require('./host-page-metadata.cjs'),data=metadata.descriptor('hosts/'+platform+'/index.html');
 const game=scope==='gta5'?'GTA V':scope==='rdr2'?'Red Dead Redemption 2':null;
 return metadata.apply(html,'',{...data,name:platform.toUpperCase()+' '+(game?game+' ':'')+'Mods / Mod Menus',description:'Browse '+(game?game+' ':'')+'mods and mod menus in the shared '+platform.toUpperCase()+' catalogue. Choose the exact game update and compatible menu build.',keywords:[...data.keywords,...(game?[game]:[])],canonical,index:false});
}
module.exports={renderModRedirect};
