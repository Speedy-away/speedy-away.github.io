'use strict';
// Legacy browser navigation only. Never starts a native action or rewrites a file.
function resolveTarget(location,config){
 var pathname;
 try{pathname=decodeURIComponent(location.pathname||'/');}catch(_){return null;}
 if(pathname.charAt(0)!=='/'||/[\\\x00-\x1f]/.test(pathname)||/%(?:2e|2f|5c)/i.test(pathname)||pathname.split('/').some(function(p){return p==='.'||p==='..';}))return null;
 var path=pathname.replace(/^\/wwb-host(?=\/|$)/i,'')||'/',target;
 if(path==='/'||path==='/index.html'||path==='/hosts'||path==='/hosts/'||path==='/hosts/index.html')target='/';
 else{
  var aliases=config&&config.aliases||{};
  if(Object.prototype.hasOwnProperty.call(aliases,path))target=aliases[path];
  else if(Object.prototype.hasOwnProperty.call(aliases,path+'/'))target=aliases[path+'/'];
 }
 if(typeof target!=='string'||/[\\\x00-\x1f]/.test(target))return null;
 var decoded;try{decoded=decodeURIComponent(target);}catch(_){return null;}
 if(/[\\\x00-\x1f]/.test(decoded)||/%(?:2e|2f|5c)/i.test(decoded)||decoded.split(/[?#]/)[0].split('/').some(function(p){return p==='.'||p==='..';}))return null;
 if(target.charAt(0)==='/'){
  if(decoded.slice(0,2)==='//')return null;
  var search=String(location.search||''),hash=String(location.hash||'');
  if(search&&search.charAt(0)!=='?'||hash&&hash.charAt(0)!=='#')return null;
  target+=search+hash;
  return target===location.pathname+search+hash||decoded===pathname?null:target;
 }
 // Keep existing immutable downloads on their exact preserved release/revision.
 if(/^https:\/\/raw\.githubusercontent\.com\/Speedy-away\/(?:speedy-away\.github\.io|WWB-HOST|wwb-host|whatsite)\//.test(target)||/^https:\/\/github\.com\/Speedy-away\/(?:speedy-away\.github\.io|WWB-HOST|wwb-host)\/releases\/download\//.test(target))return target;
 if(/^https:\/\/raw\.githubusercontent\.com\/etaHEN\/PS5_Cheats\/ef295511ea4252474b16325618ffaafd3afb3cbb\/shn\/PPSA\d{5}_[\d.]+\.shn$/.test(target))return target;
 return null;
}
function originURL(origin){if(origin!=='https://speedy-away.github.io')throw Error('Unknown host origin');return origin+'/';}
function renderHomeRedirect(origin){
 const home=originURL(origin);
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WWB HOST</title><link rel="canonical" href="'+home+'"><script>location.replace("/"+location.search+location.hash);</script><noscript><meta http-equiv="refresh" content="0;url='+home+'"></noscript></head><body><p>WWB HOST is now at <a href="'+home+'">speedy-away.github.io</a>.</p></body></html>';
 return require('./host-page-metadata.cjs').apply(html,'hosts/index.html');
}
function render404(origin,revision){
 const home=originURL(origin);
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, follow"><title>WWB HOST page lookup</title></head><body><p id="status">Opening the current host page…</p><a href="'+home+'">Open WWB HOST</a><script src="/host-project-map.js?v='+revision+'"></script><script>(function(){var target=('+resolveTarget.toString()+')(location,window.WWB_HOST_PROJECT);if(target)location.replace(target);else document.getElementById("status").textContent="This file is not in the active site. Choose its preserved download from the host directory.";}());</script></body></html>';
}
module.exports={resolveTarget,renderHomeRedirect,render404};
