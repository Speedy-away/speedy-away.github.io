/* Authored presentation policy. No requests, timers, observers or native code. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WhatsiteConsoleLite=api.install(root);
}(typeof window!=='undefined'?window:this,function(){
  'use strict';
  var languages=['en','es','pt','fr','de','ru','tr','pl','it','zh','ja','ko','th','vi','id','hi','sr','nl','ka','ar','he'];
  function platform(userAgent){var match=String(userAgent||'').match(/PlayStation\s*(4|5)(?:[\/;\s)]|$)/i);return match?'ps'+match[1]:null;}
  function eligiblePath(pathname){
    var pathname=String(pathname||'').replace(/^\/WWB-HOST(?=\/|$)/i,'');
    if(!/\/hosts\/runtime\//i.test(pathname))return true;
    // Only these first-party landing documents can opt into presentation work.
    // Downloaded web/upstream code, caches and every original KARO page stay out.
    return /^\/hosts\/runtime\/(?:ps4-900|ps4-psfree-700-960|ps5-umtx)\/(?:index\.html)?$/i.test(pathname);
  }
  function initialLanguage(navigator,storage){
    var saved=null;try{saved=storage&&storage.getItem('scooby.lang');}catch(_){}
    if(languages.indexOf(saved)!==-1)return saved;
    var choices=navigator&&navigator.languages||[navigator&&navigator.language||''];
    for(var i=0;i<choices.length;i++){var base=String(choices[i]).toLowerCase().split('-')[0];if(languages.indexOf(base)!==-1)return base;}
    return 'en';
  }
  function policy(userAgent,pathname,language){
    var target=platform(userAgent),enabled=!!target&&eligiblePath(pathname);
    var state={enabled:enabled,platform:target,initialLanguage:language||'en',imageBatch:enabled?18:70};
    state.shouldRun=function(feature,currentLanguage){
      if(!enabled)return true;
      if(feature==='background'||feature==='decorative-motion'||feature==='global-search'||feature==='smooth-scroll')return false;
      if(feature==='i18n-observer'||feature==='i18n-refresh')return String(currentLanguage||state.initialLanguage).toLowerCase()!=='en';
      return true;
    };
    state.shouldObserveLanguage=function(currentLanguage){return state.shouldRun('i18n-observer',currentLanguage);};
    return state;
  }
  function install(win){
    var nav=win.navigator||{},storage;try{storage=win.localStorage;}catch(_){}
    var state=policy(nav.userAgent,win.location&&win.location.pathname,initialLanguage(nav,storage)),html=win.document&&win.document.documentElement;
    if(state.enabled&&html){
      if(html.classList)html.classList.add('host-console-lite');
      else html.className=(html.className||'')+' host-console-lite';
      html.setAttribute('data-host-console',state.platform);
    }
    return state;
  }
  return{platform:platform,eligiblePath:eligiblePath,initialLanguage:initialLanguage,policy:policy,install:install};
}));
