/* AppCache-only bridge for PS4; no console modules are loaded. */
(function(){'use strict';var cache=window.applicationCache,saved=!!cache&&(cache.status===1||cache.status===4);
 function send(state,fields){var data={type:'afterglow-cache',state:state,saved:saved};Object.keys(fields||{}).forEach(function(k){data[k]=fields[k];});parent.postMessage(data,location.origin);}
 if(!cache){send('error',{reason:'AppCache unavailable'});return;}
 cache.addEventListener('checking',function(){send('checking');});
 cache.addEventListener('downloading',function(){send('progress',{loaded:0,total:0});});
 cache.addEventListener('progress',function(e){send('progress',{loaded:e.loaded,total:e.total});});
 ['cached','noupdate'].forEach(function(e){cache.addEventListener(e,function(){saved=true;send('ready');});});
 cache.addEventListener('updateready',function(){try{cache.swapCache();saved=true;send('ready',{updated:true});}catch(e){send('error',{reason:'Could not activate the saved update'});}});
 cache.addEventListener('error',function(){send('error',{reason:'connection or storage error; retry caching'});});
 cache.addEventListener('obsolete',function(){send('empty');});
 if(cache.status===4){try{cache.swapCache();send('ready',{updated:true});}catch(e){send('error',{reason:'Could not activate the saved update'});}}
 else if(cache.status===1){send('checking');try{cache.update();}catch(e){send('error',{reason:'Could not check for updates'});}}
}());
