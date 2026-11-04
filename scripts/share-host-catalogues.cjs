'use strict';
const crypto=require('node:crypto');
// Authored records only. Keep every value and original compatibility pin.
function share(html,{base,emit}){
 const data=html.match(/<script\b[^>]*id="host-actions-data"[^>]*>([\s\S]*?)<\/script>/i),controller=html.match(/<script\b[^>]*\bdefer\b[^>]*src="[^"]*\/host-dashboard\.js[^\"]*"[^>]*><\/script>/i);
 if(!data||!controller)return html;
 const catalog=JSON.parse(data[1]);if(!Array.isArray(catalog.actions))return html;
 const serialized=JSON.stringify(catalog.actions).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029'),key=crypto.createHash('sha256').update(serialized).digest('hex'),file='assets/host-catalogues/'+key+'.js';
 emit(file,'window.WWB_HOST_ACTION_DATA={key:"'+key+'",actions:'+serialized+'};');
 const config={...catalog,actionsKey:key};delete config.actions;
 return html.replace(data[0],data[0].replace(data[1],JSON.stringify(config).replace(/</g,'\\u003c'))).replace(controller[0],'<script defer src="'+base+'/'+file+'"></script>'+controller[0]);
}
module.exports={share};
