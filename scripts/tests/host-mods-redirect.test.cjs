'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {renderModRedirect}=require('../host-mods-redirect.cjs'),root=path.resolve(__dirname,'../..');
function run(platform,scope,{origin='https://speedy-away.github.io',prefix='',search='',hash='',index=false}={}){
 const html=renderModRedirect(platform,scope),href=origin+prefix+'/hosts/'+platform+'/'+scope+'/'+(index?'index.html':'')+search+hash;let target;
 for(const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInNewContext(script[1],{URL,URLSearchParams,location:{href,search,hash,replace(value){target=value;}}});
 return {html,target:new URL(target,href)};
}
test('all six old game bookmarks join the shared same-origin catalogue with forced view and expected title scope',()=>{
 for(const platform of ['ps4','ps5'])for(const scope of ['gta5','rdr2','other-games'])for(const index of [false,true]){
  const {target}=run(platform,scope,{index,search:'?view=tools&game=wrong&update=1.57&version=menu-exact&note=a%20b',hash:'#selected-build'});
  assert.equal(target.origin,'https://speedy-away.github.io');assert.equal(target.pathname,'/hosts/'+platform+'/');assert.equal(target.searchParams.get('view'),'mods');
  assert.equal(target.searchParams.get('game'),scope==='other-games'?null:scope);assert.equal(target.searchParams.get('update'),'1.57');assert.equal(target.searchParams.get('version'),'menu-exact');assert.equal(target.searchParams.get('note'),'a b');assert.equal(target.hash,'#selected-build');
 }
});
test('loopback sender routes stay local, default anchors point to actions and query values cannot redirect elsewhere',()=>{
 for(const platform of ['ps4','ps5'])for(const scope of ['gta5','rdr2','other-games']){
  const {target}=run(platform,scope,{origin:'http://127.0.0.1:8766',prefix:'/sender',search:'?next=https%3A%2F%2Fevil.invalid&view=loaders&view=tools&game=wrong'});
  assert.equal(target.origin,'http://127.0.0.1:8766');assert.equal(target.pathname,'/sender/hosts/'+platform+'/');assert.equal(target.hash,'#actions');assert.deepEqual(target.searchParams.getAll('view'),['mods']);assert.equal(target.searchParams.get('next'),'https://evil.invalid');
 }
});
test('authored legacy pages are exact inert redirect outputs and unknown platforms or scopes are rejected',()=>{
 for(const platform of ['ps4','ps5'])for(const scope of ['gta5','rdr2','other-games']){
  const html=renderModRedirect(platform,scope);assert.equal(fs.readFileSync(path.join(root,'hosts',platform,scope,'index.html'),'utf8'),html);
  assert.ok(html.includes('rel="canonical" href="https://speedy-away.github.io/hosts/'+platform+'/?view=mods'));assert.doesNotMatch(html,/host-actions-data|host-dashboard\.js|data-launch|native-start/);
 }
 for(const args of [['ps3','gta5'],['ps4','unknown'],['../ps5','rdr2'],['ps5','gta5<script>']])assert.throws(()=>renderModRedirect(...args));
});
