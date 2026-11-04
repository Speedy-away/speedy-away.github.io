'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../../assets/host-console-lite.js'),root=path.resolve(__dirname,'../..');
const ps4='Mozilla/5.0 (PlayStation 4 9.00) AppleWebKit/605.1.15',ps5='Mozilla/5.0 (PlayStation; PlayStation 5/7.61) AppleWebKit/605.1.15';
test('light presentation applies only to PS4/PS5 browsers and excludes native runtime documents',()=>{
 assert.equal(api.platform(ps4),'ps4');assert.equal(api.platform(ps5),'ps5');for(const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)','Mozilla/5.0 (PlayStation 3; 4.93)','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'])assert.equal(api.policy(ua,'/hosts/ps4/','en').enabled,false);
 for(const p of ['/hosts/ps4/','/WWB-HOST/hosts/ps5/files/','/WWB-HOST/hosts/tools/ps4-trainer/','/hosts/runtime/ps5-umtx/','/hosts/runtime/ps4-900/index.html'])assert.equal(api.policy(ps4,p,'en').enabled,true,p);
 for(const p of ['/hosts/runtime/ps5-umtx/web/index.html','/hosts/runtime/ps5-umtx/upstream/index.html','/WWB-HOST/hosts/runtime/karo-743646c9df9a-e3c0caf3db54/web/900L/index.html','/hosts/runtime/ps4-afterglow-acf25a831725/web/index.html'])assert.equal(api.policy(ps4,p,'en').enabled,false,p);
});
test('saved and browser-selected languages stay supported, while only English translation traversal is skipped',()=>{
 assert.equal(api.initialLanguage({languages:['de-DE','en-US']},{getItem:()=>null}),'de');assert.equal(api.initialLanguage({language:'en-US'},{getItem:()=>'ar'}),'ar');assert.equal(api.initialLanguage({language:'ja-JP'},{getItem:()=>{throw Error('Storage unavailable');}}),'ja');assert.equal(api.initialLanguage({languages:['xx-ZZ']},null),'en');
 const state=api.policy(ps4,'/hosts/ps4/','en');assert.equal(state.imageBatch,18);assert.equal(state.shouldRun('background'),false);assert.equal(state.shouldRun('global-search'),false);assert.equal(state.shouldObserveLanguage('en'),false);for(const code of ['de','ar','he','ja','pt']){assert.equal(state.shouldObserveLanguage(code),true);assert.equal(state.shouldRun('i18n-refresh',code),true);}for(const feature of ['host-search','native-controls','payload-loading','downloads','i18n-selector'])assert.equal(state.shouldRun(feature),true);assert.equal(api.policy('Windows','/hosts/ps4/','en').shouldRun('background'),true);
});
test('early console script only marks document policy: no request, timer, observer, canvas or payload side effects',()=>{
 const attrs={},classes=[],calls=[];const window={navigator:{userAgent:ps5,languages:['en-US']},location:{pathname:'/WWB-HOST/hosts/ps5/'},localStorage:{getItem:()=>null},document:{documentElement:{classList:{add:v=>classes.push(v)},setAttribute:(k,v)=>attrs[k]=v},createElement:()=>{calls.push('createElement');throw Error('Unexpected DOM creation');}},fetch:()=>calls.push('fetch'),setTimeout:()=>calls.push('timer'),requestAnimationFrame:()=>calls.push('animation'),MutationObserver:class{constructor(){calls.push('observer');}},XMLHttpRequest:class{constructor(){calls.push('xhr');}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/host-console-lite.js'),'utf8'),{window});assert.equal(window.WhatsiteConsoleLite.enabled,true);assert.deepEqual(classes,['host-console-lite']);assert.deepEqual(attrs,{'data-host-console':'ps5'});assert.deepEqual(calls,[]);
 const css=fs.readFileSync(path.join(root,'assets/host-console-lite.css'),'utf8');assert.match(css,/animation:none!important/);assert.match(css,/backdrop-filter:none!important/);assert.match(css,/min-height:44px/);assert.doesNotMatch(css,/@import|url\(|display:none[^}]*\.host-status|pointer-events:none/);
});
test('existing early performance flag and new policy both stop background before any canvas or body access',()=>{
 const source=fs.readFileSync(path.join(root,'assets/site-background.js'),'utf8');
 for(const flag of [{WWB_HOST_CONSOLE:true},{WhatsiteConsoleLite:{enabled:true}}]){let touched=0;const document={get body(){touched++;throw Error('Background touched console body');}};vm.runInNewContext(source,{window:flag,document});assert.equal(touched,0);}
});
test('global console startup keeps functional modules but omits search, typing, counters and smooth scrolling',()=>{
 const source=fs.readFileSync(path.join(root,'script.js'),'utf8'),events={},calls=[],window={WWB_HOST_CONSOLE:true},context={window,document:{addEventListener:(type,fn)=>events[type]=fn}};vm.createContext(context);vm.runInContext(source,context);
 const functions=['initSiteBackground','initResponsiveShell','initResponsiveTables','initSidebar','initSearch','initSidebarGroups','initHeroAnimations','initStatsCounters','initScrollEffects','initFaqAccordion','initFaqSearch','initBlogFilter','initSmoothScroll','initServiceWorker'];
 for(const name of functions)context[name]=()=>calls.push(name);events.DOMContentLoaded();assert.ok(calls.includes('initSidebar'));assert.ok(calls.includes('initFaqAccordion'));assert.ok(calls.includes('initServiceWorker'));for(const name of ['initSearch','initHeroAnimations','initStatsCounters','initSmoothScroll'])assert.ok(!calls.includes(name));
 window.WWB_HOST_CONSOLE=false;calls.length=0;events.DOMContentLoaded();assert.ok(calls.includes('initSearch'));assert.ok(calls.includes('initHeroAnimations'));assert.ok(calls.includes('initSmoothScroll'));
});
test('background injection and fade scans stop on console while the Back-to-top control still works',()=>{
 const source=fs.readFileSync(path.join(root,'script.js'),'utf8'),events={},scroll=[],button={classList:{add(){},remove(){}},addEventListener:(type,fn)=>events[type]=fn};let scans=0;
 const window={WWB_HOST_CONSOLE:true,scrollY:800,addEventListener(){},scrollTo:value=>scroll.push(value),matchMedia:()=>({matches:false})};const document={addEventListener(){},querySelectorAll(){scans++;throw Error('Unexpected decorative scan');},getElementById:()=>button};const context={window,document};vm.createContext(context);vm.runInContext(source,context);context.initSiteBackground();context.initScrollEffects();assert.equal(scans,0);events.click();assert.equal(scroll.length,1);assert.equal(scroll[0].behavior,'auto');assert.equal(scroll[0].top,0);
});
test('console English creates no translation observer; changing languages starts and stops the normal observer',()=>{
 const source=fs.readFileSync(path.join(root,'languages/i18n.js'),'utf8'),from=source.indexOf('  function startObserver() {'),end=source.indexOf('  // ------------------------------------------------------------- switching',from);assert.ok(from>0&&end>from);let created=0,observed=0,disconnected=0;
 class Observer{constructor(){created++;}observe(){observed++;}disconnect(){disconnected++;}}
 const context={window:{WWB_HOST_CONSOLE:true,MutationObserver:Observer},MutationObserver:Observer,document:{documentElement:{}},current:'en',DEFAULT_LANG:'en',observer:null,ATTRS:[]};vm.createContext(context);vm.runInContext(source.slice(from,end),context);context.startObserver();assert.equal(created,0);context.current='de';context.startObserver();assert.equal(created,1);assert.equal(observed,1);context.current='en';context.startObserver();assert.equal(disconnected,1);assert.equal(context.observer,null);context.current='ar';context.startObserver();assert.equal(created,2);
 context.current='en';context.window.WWB_HOST_CONSOLE=false;context.observer=null;context.startObserver();assert.equal(created,3);
 assert.match(source,/function refresh\(root\)\s*\{\s*if\(current===DEFAULT_LANG\)return;/);assert.match(source,/apply\(document\.body \|\| document\.documentElement, table\);/);
});
