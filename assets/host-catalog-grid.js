/* Authored presentation helpers only. No requests, downloads or payload loading. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.HostCatalogGrid=api;}(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var ATTRIBUTES=['data-catalog-game','data-catalog-update','data-choose-group','data-catalog-category','data-launch'];
  var FALLBACKS={games:'/assets/images/host-catalog/games.svg',mods:'/assets/images/host-catalog/games.svg',updates:'/assets/images/host-catalog/updates.svg',payloads:'/assets/images/host-catalog/payloads.svg',loaders:'/assets/images/host-catalog/loaders.svg',tools:'/assets/images/host-catalog/tools.svg',files:'/assets/images/host-catalog/files.svg'};
  function text(value){return value==null?'':String(value);}
  function escape(value){return text(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function gameKey(value){var name=text(value).replace(/^\s+|\s+$/g,'');if(/^(?:GTA\s*(?:V|5)|Grand Theft Auto\s*(?:V|5))$/i.test(name))return 'gta5';if(/^(?:RDR\s*2|Red Dead Redemption\s*2)$/i.test(name))return 'rdr2';return name;}
  function version(action){var value=action&&action.gameVersion;return value==null||/^\s*$/.test(text(value))?'unspecified':text(value);}
  function localImage(value){value=text(value);if(value.length>512||!/^\/(?:WWB-HOST\/)?assets\/images\/[a-z0-9 _.-]+(?:\/[a-z0-9 _.-]+)*\.(?:png|jpe?g|webp|svg)$/i.test(value))return '';var parts=value.split('/');for(var i=1;i<parts.length;i++)if(parts[i]==='.'||parts[i]==='..')return '';return value;}
  function fallbackImage(category){return FALLBACKS[category]||FALLBACKS.tools;}
  function list(actions){return Array.isArray(actions)?actions.filter(function(a){return a&&typeof a==='object';}):[];}
  function selectedImage(actions,gameOnly){
    var rows=list(actions),i,value,keys=[],key;
    for(i=0;i<rows.length;i++){key=gameKey(rows[i].game);if(key&&keys.indexOf(key)<0)keys.push(key);}
    // Game tiles use existing game art even when their selected update has only
    // menu screenshots. An update or picture never establishes compatibility.
    if(gameOnly&&keys.length===1&&keys[0]==='gta5')return '/assets/images/gta52.png';
    if(gameOnly&&keys.length===1&&keys[0]==='rdr2')return '/assets/images/rdr2.png';
    for(i=0;i<rows.length;i++){value=localImage(rows[i].gameImage)||localImage(rows[i].gameArtwork);if(value)return value;}
    if(gameOnly)for(i=0;i<rows.length;i++)if(/game artwork|official game/i.test(text(rows[i].imageRole))){value=localImage(rows[i].image);if(value)return value;}
    if(gameOnly)return '';
    // Repository social-preview screenshots are not useful product artwork.
    for(i=0;i<rows.length;i++){value=localImage(rows[i].image);if(value&&!/\/social\//i.test(value)&&!/\/expansion-ps4-ps5\/(?:ftpsrv|klogsrv|websrv|elfldr)\.png$/i.test(value)&&!/\/consoles\//i.test(value)&&!/console artwork/i.test(text(rows[i].imageRole)))return value;}
    return '';
  }
  function toolImage(action){
    var label=text(action&&action.label).toLowerCase(),rules=[[/database restore|restore/,'restore'],[/backup/,'backup'],[/ftp|server|network/,'network'],[/log|history/,'logs'],[/dump/,'dump'],[/disable updates|block|aslr/,'lock'],[/enable updates/,'unlock'],[/browser/,'browser'],[/debug/,'debug'],[/usb/,'usb'],[/uart|dex|idu/,'terminal'],[/exit|shutdown|reboot/,'power'],[/rif|license|licence/,'key'],[/kernel|memory/,'memory']];
    for(var i=0;i<rules.length;i++)if(rules[i][0].test(label))return '/assets/images/host-catalog/'+rules[i][1]+'.svg';return '';
  }
  function representativeImage(actions){var rows=list(actions);return selectedImage(rows,false)||toolImage(rows[0])||fallbackImage(rows[0]&&rows[0].category);}
  function gameGroups(actions){
    var result=[],lookup=Object.create(null),rows=list(actions);
    for(var i=0;i<rows.length;i++){var action=rows[i],key=gameKey(action.game);if(!key)continue;if(!Object.prototype.hasOwnProperty.call(lookup,key)){var group={key:key,label:key==='gta5'?'GTA V':key==='rdr2'?'Red Dead Redemption 2':key,actions:[],image:''};lookup[key]=group;result.push(group);}lookup[key].actions.push(action);}
    result.forEach(function(group){group.image=selectedImage(group.actions,true)||FALLBACKS.games;});
    function rank(key){return key==='gta5'?0:key==='rdr2'?1:2;}
    result.sort(function(a,b){return rank(a.key)-rank(b.key)||a.label.toLowerCase().localeCompare(b.label.toLowerCase())||a.label.localeCompare(b.label);});
    return result;
  }
  function compareUpdates(a,b){
    if(a==='unspecified'||b==='unspecified')return a===b?0:a==='unspecified'?1:-1;
    var numeric=/^\d+(?:\.\d+)*$/,an=numeric.test(a),bn=numeric.test(b);if(an!==bn)return an?-1:1;
    if(an){var av=a.split('.'),bv=b.split('.');for(var i=0;i<Math.max(av.length,bv.length);i++){var ac=(av[i]||'0').replace(/^0+(?=\d)/,''),bc=(bv[i]||'0').replace(/^0+(?=\d)/,'');if(ac.length!==bc.length)return bc.length-ac.length;if(ac!==bc)return ac<bc?1:-1;}}
    // Equal numeric values remain distinct exact source strings, including
    // leading/trailing zeroes. Non-numeric source labels are never parsed ranges.
    return a===b?0:a<b?1:-1;
  }
  function updates(actions){var values=[];list(actions).forEach(function(action){var value=version(action);if(values.indexOf(value)<0)values.push(value);});return values.sort(compareUpdates);}
  function filterByGameUpdate(actions,key,update){return list(actions).filter(function(action){return gameKey(action.game)===key&&version(action)===update;});}
  function tileMarkup(options){
    options=options||{};var attribute=options.attribute||'data-choose-group';if(ATTRIBUTES.indexOf(attribute)<0)throw Error('Unsupported catalogue tile attribute.');
    var image=options.textOnly?'':localImage(options.image),label=text(options.label),id=text(options.id),detail=text(options.detail);
    return '<button type="button" class="host-catalog-tile'+(!image?' host-catalog-tile--text':'')+'" '+attribute+'="'+escape(id)+'"'+(options.disabled?' disabled aria-disabled="true"':'')+'>'+(options.textOnly?'':'<span class="host-catalog-tile__media">'+(image?'<img src="'+escape(image)+'" alt="" loading="lazy" decoding="async">':'<span class="host-catalog-tile__empty" aria-hidden="true"></span>')+'</span>')+'<span class="host-catalog-tile__label">'+escape(label)+'</span>'+(detail?'<span class="host-catalog-tile__detail">'+escape(detail)+'</span>':'')+'</button>';
  }
  return {gameGroups:gameGroups,updates:updates,filterByGameUpdate:filterByGameUpdate,representativeImage:representativeImage,tileMarkup:tileMarkup,gameKey:gameKey,localImage:localImage,fallbackImage:fallbackImage};
}));
