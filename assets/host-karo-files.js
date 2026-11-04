/* Authored directory lists only: never executes a loader or reads a console. */
(function(factory){if(typeof module==='object'&&module.exports)module.exports=factory();else{window.HostKaroFiles=factory();window.HostKaroFiles.mount(window,document);}}(function(){
 'use strict';
 function matches(rows,term){term=String(term||'').toLowerCase().trim();return rows.filter(function(row){return !term||row.search.indexOf(term)>=0;});}
 function mount(win,doc){
  var cache={},pending={},consoleBrowser=/PlayStation [45]/i.test(win.navigator.userAgent),size=consoleBrowser?24:60,groups=doc.querySelectorAll('details[data-karo-fragment]'),active=null,timer=null,sequence=0;
  function get(url,done,fail){
   if(cache[url]){done(cache[url]);return;}
   if(pending[url]){pending[url].push({done:done,fail:fail});return;}
   pending[url]=[{done:done,fail:fail}];var xhr=new win.XMLHttpRequest(),settled=false;
   function finish(data){if(settled)return;settled=true;var callbacks=pending[url];delete pending[url];if(data)cache[url]=data;for(var i=0;i<callbacks.length;i++)if(data)callbacks[i].done(data);else callbacks[i].fail();}
   xhr.open('GET',url,true);xhr.timeout=20000;
   xhr.onload=function(){if(settled)return;var data;try{if(xhr.status!==200)throw Error('File list unavailable');data=JSON.parse(xhr.responseText);if(!data||!Array.isArray(data.rows)&&typeof data.html!=='string')throw Error('Invalid file list');}catch(e){finish(null);return;}finish(data);};
   xhr.onerror=xhr.ontimeout=function(){finish(null);};xhr.send();
  }
  function render(box,rows,context){box.textContent='';var list=doc.createElement('div'),more=doc.createElement('button'),visible=0;list.className='karo-file-list';more.type='button';more.textContent='Show more files';function append(){var end=Math.min(visible+size,rows.length),html='';for(;visible<end;visible++){if(context)html+='<p class="muted">Folder: '+rows[visible].context.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</p>';html+=rows[visible].html;}var chunk=doc.createElement('div');chunk.innerHTML=html;list.appendChild(chunk);more.hidden=visible>=rows.length;}more.addEventListener('click',append);box.appendChild(list);box.appendChild(more);if(!rows.length){var empty=doc.createElement('p');empty.textContent='No matching files.';list.appendChild(empty);}append();}
  function load(group){if(!group.open||group.getAttribute('data-karo-loaded'))return;var box=group.querySelector('.host-karo-fragment');if(!box)return;if(consoleBrowser&&active&&active!==group){active.open=false;var old=active.querySelector('.host-karo-fragment');if(old&&active._fallback){old.innerHTML=active._fallback;active.removeAttribute('data-karo-loaded');}}active=group;if(!group._fallback)group._fallback=box.innerHTML;group.setAttribute('data-karo-loaded','pending');get(group.getAttribute('data-karo-fragment'),function(data){if(consoleBrowser&&!group.open){group.removeAttribute('data-karo-loaded');return;}if(data.rows)render(box,data.rows,false);else box.innerHTML=data.html;group.setAttribute('data-karo-loaded','true');},function(){group.removeAttribute('data-karo-loaded');box.innerHTML=group._fallback;});}
  for(var i=0;i<groups.length;i++)(function(group){group.addEventListener('toggle',function(){load(group);});var summary=group.querySelector('summary');if(summary)summary.addEventListener('click',function(){win.setTimeout(function(){load(group);},0);});if(group.open)load(group);}(groups[i]));
  var input=doc.getElementById('karo-search'),meta=doc.querySelector('meta[name="host-karo-file-index"]'),results;
  function search(term){if(!meta||!input)return;win.clearTimeout(timer);var request=++sequence;timer=win.setTimeout(function(){if(!results){results=doc.createElement('section');results.setAttribute('aria-label','Payload search results');input.parentNode.insertBefore(results,input.nextSibling);}var query=String(term||'').trim();results.hidden=!query;if(!query){results.textContent='';return;}results.textContent='Searching payload files…';get(meta.getAttribute('content'),function(data){if(request===sequence)render(results,matches(data.rows,query),true);},function(){if(request===sequence)results.textContent='File search unavailable. Open a folder’s file list below.';});},140);}
  // The loader controller delegates its existing search event here.
  return {search:search};
 }
 var api={matches:matches,mount:function(win,doc){var instance=mount(win,doc);api.search=instance.search;return instance;}};return api;
}));
