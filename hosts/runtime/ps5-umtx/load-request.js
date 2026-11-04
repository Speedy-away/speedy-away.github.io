/* Authored navigation request only. No exploit or payload code. */
(function(w,d){'use strict';var key='wwb.ps5.load.request.v1',requested=false;
 function arm(firmware){try{if(!w.whatsiteRuntimeAllowed||firmware!==w.whatsiteRuntimeFirmware)return false;w.sessionStorage.setItem(key,JSON.stringify({firmware:firmware,createdAt:Date.now()}));return true;}catch(e){var s=d.getElementById('runtime-status');if(s)s.textContent='Session storage is unavailable. Enable it to load.';return false;}}
 if(/\/hosts\/runtime\/ps5-umtx\/web\/index\.html$/.test(w.location.pathname)){
  try{var raw=w.sessionStorage.getItem(key);w.sessionStorage.removeItem(key);var intent=raw?JSON.parse(raw):null,nav=w.performance&&w.performance.getEntriesByType?w.performance.getEntriesByType('navigation')[0]:null,oldNav=w.performance&&w.performance.navigation;
   var ref=new URL(d.referrer),fromHost=ref.origin===w.location.origin&&(/\/hosts\/ps5\//.test(ref.pathname)||/\/hosts\/runtime\/ps5-umtx\/(?:index\.html)?$/.test(ref.pathname));
   requested=!!(w.whatsiteRuntimeAllowed&&intent&&intent.firmware===w.whatsiteRuntimeFirmware&&Number.isFinite(intent.createdAt)&&Date.now()-intent.createdAt>=0&&Date.now()-intent.createdAt<60000&&fromHost&&(!nav||nav.type==='navigate')&&(!oldNav||oldNav.type===0));
  }catch(e){requested=false;}
 }
 w.WWBPS5Load={arm:arm,requested:requested};
})(window,document);
