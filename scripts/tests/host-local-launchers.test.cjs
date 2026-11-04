'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const builder=require('../host-local-launchers.cjs'),api=require('../../assets/host-local-launcher.js');
const base='/hosts/runtime/karo-743646c9df9a-e3c0caf3db54/web/';
const entry=(id,fw='9.00',extra={})=>({id,path:'G900/index.html',scope:'G900/',platform:'ps4',kind:'loader',label:'KARO fixture',firmwares:[fw],contract:'Original source contract.',...extra});
const build=entries=>({commit:'743646c9df9ab4c83821b660c12e23a3dda57b49',runtime:base,entries});
test('groups keep exact firmware arrays, separate incompatible native entries and exclude restore/noBD utilities',()=>{
 const entries=[entry('karo-g900'),entry('other','7.00',{ranges:[['7.00','9.60']],path:'g2all/index.html',scope:'g2all/'}),entry('restore','9.00',{kind:'restore'}),entry('nobd','9.00',{kind:'nobd'}),entry('ps5-entry','4.51',{platform:'ps5',path:'ps5/UMTX/index.html',scope:'ps5/UMTX/'}),entry('blocked','9.00',{blockedReason:'Missing source'})],before=JSON.stringify(entries);
 const groups=builder.routeGroups(build(entries));assert.equal(groups.length,3);assert.deepEqual(groups[1].firmwares,['7.00']);assert.deepEqual(groups[1].sourceRanges,[['7.00','9.60']]);assert.equal(groups[0].payloadChoice.length,1);assert.equal(groups[0].payloadChoice[0].id,'goldhen');assert.equal(groups[1].payloadChoice,null);assert.equal(groups[2].platform,'ps5');assert.equal(JSON.stringify(entries),before);
});
test('Afterglow groups only its two exact versions with real HEN choices and keeps its own landing guard',()=>{
 const groups=builder.routeGroups(build([]),{entry:'/hosts/runtime/ps4-afterglow-acf25a831725/web/index.html',firmwares:['13.52','14.00'],commit:'acf25a831725f0d44fcb64725d4ce35acbba8f9d'});assert.equal(groups.length,1);assert.deepEqual(groups[0].firmwares,['13.52','14.00']);assert.deepEqual(groups[0].payloadChoice.map(x=>x.id),['hen','goldhen']);assert.equal(groups[0].ticket,'existing-afterglow-landing');assert.throws(()=>builder.render(groups[0]));
});
test('public page offers only genuine GoldHEN, Load and collapsed credits without source or runtime download buttons',()=>{
 const route=builder.routeGroups(build([entry('karo-g900')]))[0],html=builder.render(route);assert.match(html,/PS4 WebKit Exploit - 9\.00/);assert.match(html,/name="hen" value="goldhen" checked/);assert.match(html,/>Load exploit<\/button>/);assert.match(html,/<details><summary>Source &amp; credits/);assert.doesNotMatch(html,/value="hen"|Download source|Download runtime|<iframe|\.zip|setTimeout|type="module"/);
});
test('runtime configuration rejects external, traversing, mismatched or non-native public paths',()=>{
 const data={runtime:base,entry:entry('karo-g900')},location=new URL('https://example.test/hosts/ps4/exploit/karo-g900/');assert.equal(api.config(data,location).runtime,base);assert.equal(api.config({...data,runtime:'/WWB-HOST'+base},location).runtime,'/WWB-HOST'+base);
 for(const runtime of ['https://evil.test'+base,'//evil.test'+base,base+'?run=1',base.replace('/web/','/web/../web/'),'/hosts/ps4/'])assert.throws(()=>api.config({...data,runtime},location));assert.throws(()=>api.config({...data,entry:{...data.entry,path:'G900/../G900/index.html'}},location));
});
test('new public launcher starts inert, gates exact browser firmware and delegates one trusted confirmed Load to existing guard',()=>{
 function fixture(ua='PlayStation 4/9.00'){
  const ids={},events={},calls=[],navigation=[];for(const id of ['data','load','confirm','status','restarted','clear'])ids['host-local-'+id]={disabled:false,checked:false,textContent:'',addEventListener:(name,fn)=>events[id+':'+name]=fn};ids['host-local-data'].textContent=JSON.stringify({runtime:base,entry:entry('karo-g900')});
  const win={navigator:{userAgent:ua},location:{href:'https://example.test/hosts/ps4/exploit/karo-g900/',origin:'https://example.test'},localStorage:{getItem:()=>null},addEventListener:(n,f)=>events[n]=f,WhatsiteKaro:{LOCK:'lock',consoleInfo:s=>{const m=s.match(/PlayStation (4|5)\/(\d+\.\d+)/);return m&&{platform:'ps'+m[1],firmware:m[2]};},authorize:(w,e,b,consent,trusted)=>{calls.push({e,b,consent,trusted});if(!trusted)throw Error('Trusted input required');return b+e.path;},clear:()=>calls.push('clear')}};Object.defineProperty(win.location,'href',{get:()=> 'https://example.test/hosts/ps4/exploit/karo-g900/',set:v=>navigation.push(v)});api.install(win,{getElementById:id=>ids[id]});return{ids,events,calls,navigation};
 }
 for(const ua of ['Desktop','PlayStation 5/9.00','PlayStation 4/9.03']){const f=fixture(ua);f.ids['host-local-confirm'].checked=true;f.events['confirm:change']();assert.equal(f.ids['host-local-load'].disabled,true);f.events['load:click']({isTrusted:true});assert.equal(f.calls.length,0);}
 const f=fixture();assert.equal(f.calls.length,0);assert.equal(f.navigation.length,0);assert.equal(f.ids['host-local-load'].disabled,true);f.ids['host-local-confirm'].checked=true;f.events['confirm:change']();assert.equal(f.ids['host-local-load'].disabled,false);f.events['load:click']({isTrusted:true});assert.equal(f.calls.length,1);assert.equal(f.calls[0].trusted,true);assert.deepEqual(f.navigation,[base+'G900/index.html']);assert.equal(f.ids['host-local-load'].disabled,true);
});
