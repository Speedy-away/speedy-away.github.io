/* Deployment adapter only; original native scripts and payload bytes unchanged. */
(function(w){'use strict';var c=w.WWB_HOST_PROJECT;if(!c||w.wwbProjectRouting)return;w.wwbProjectRouting=true;
 function route(value){try{var u=new w.URL(String(value),w.location.href);if(u.origin!==w.location.origin&&u.origin!=='https://whatwhatboy.com')return value;var p=decodeURIComponent(u.pathname);if(p.indexOf(c.base+'/')===0)p=p.slice(c.base.length);var mapped=c.aliases[p];if(!mapped&&c.directories){var cut=p.lastIndexOf('/'),members=c.directories[p.slice(0,cut+1)],leaf=p.slice(cut+1)||'index.html';if(members&&leaf.indexOf('\n')<0&&leaf.indexOf('\r')<0&&members.indexOf('\n'+leaf+'\n')>=0)mapped=c.base+p;}return mapped?mapped+u.search+u.hash:value;}catch(e){return value;}}
 if(w.XMLHttpRequest){var open=w.XMLHttpRequest.prototype.open;w.XMLHttpRequest.prototype.open=function(method,value){var a=Array.prototype.slice.call(arguments);a[1]=/^(GET|HEAD)$/i.test(method)?route(value):value;return open.apply(this,a);};}
 if(w.fetch){var fetch=w.fetch;w.fetch=function(v,o){return fetch.call(this,typeof v==='string'?route(v):v,o);};}
 w.document.addEventListener('click',function(e){var n=e.target;while(n&&n.tagName!=='A')n=n.parentNode;if(n&&n.href)n.href=route(n.href);},true);
 w.document.addEventListener('DOMContentLoaded',function(){Array.prototype.forEach.call(w.document.querySelectorAll('a[href],script[src],link[href],img[src]'),function(n){var a=n.hasAttribute('src')?'src':'href',v=n.getAttribute(a),r=route(v);if(r!==v)n.setAttribute(a,r);});});
}(window));
