'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const i18n=require('../../assets/host-native-workspace-i18n.js'),generator=require('../host-native-workspace.cjs');
function fixture(){
  function element(tag){const node={nodeType:1,tagName:tag.toUpperCase(),childNodes:[],attributes:{},style:{},listeners:{},getAttribute(k){return Object.hasOwn(this.attributes,k)?this.attributes[k]:null;},setAttribute(k,v){this.attributes[k]=String(v);},addEventListener(k,fn){this.listeners[k]=fn;},appendChild(child){child.parentNode=this;this.childNodes.push(child);return child;},insertBefore(child,before){child.parentNode=this;const pos=this.childNodes.indexOf(before);this.childNodes.splice(pos<0?0:pos,0,child);return child;}};Object.defineProperty(node,'textContent',{get(){return this.childNodes.map(n=>n.nodeType===3?n.nodeValue:n.textContent).join('');},set(v){this.childNodes=[];this.appendChild(text(String(v)));}});return node;}
  function text(value){return{nodeType:3,nodeValue:value,parentNode:null};}
  const html=element('html'),body=element('body');html.appendChild(body);
  const document={title:'PS4 files & payloads · whatsite',documentElement:html,body,readyState:'complete',createElement:element};
  function add(tag,value,id,parent=body){const el=element(tag);if(id)el.id=id;if(value!==undefined)el.appendChild(text(value));parent.appendChild(el);return el;}
  const header=add('th','Name'),listing=add('tbody',undefined,'workspace-list'),filename=add('button','Name',null,listing),path=add('p','/data/whatwhatboy/Name.bin','workspace-selected'),editor=add('textarea','[AutoRun]\r\n/data/payloads/Name.bin\r\n','workspace-editor'),code=add('code','/data/GoldHEN/payloads.ini','workspace-config'),status=add('p','No file selected.','workspace-status');
  function Observer(){}Observer.prototype.observe=function(){};Observer.prototype.disconnect=function(){};
  return{document,header,filename,path,editor,code,status,Observer};
}
test('native subset translates complete messages in all20languages and preserves arbitrary paths and hashes',()=>{
  const dictionaries=generator.nativeDictionaries(),path='/data/whatwhatboy/two  spaces.bin',hash='a'.repeat(64);
  assert.equal(Object.keys(dictionaries).length,20);
  for(const code of Object.keys(dictionaries)){
    const t=i18n.createLookup(dictionaries,code),source='Saved file verified: '+path+' · SHA-256 '+hash+'. No execution was requested. Read the folder to refresh the listing.';
    const translated=t(source);assert.notEqual(translated,source,code);assert(translated.includes(path),code);assert(translated.includes(hash),code);
    const error='The destination already exists. Choose a new name; existing files are preserved.';
    const composite=error+' Any backup or staging files are retained: '+path+' Read the console again before another change.';
    const result=t(composite);assert(!result.includes(error),code);assert(!result.includes('Any backup or staging files'),code);assert(result.includes(path),code);
    const diagnostic='Native  EIO diagnostic  /data/two  spaces.bin';
    assert(t(diagnostic+' Read the console again before another change.').includes(diagnostic),code);
  }
});
test('local picker changes controls and prompts while file names, paths and raw autoload bytes remain untouched',()=>{
  const f=fixture(),d=generator.nativeDictionaries(),stored={},oldPrompt=global.prompt;let seen;
  global.prompt=(message,value)=>{seen={message,value};return value;};
  try{
    const api=i18n.install(d,{document:f.document,language:'es',storage:{getItem:k=>stored[k],setItem:(k,v)=>stored[k]=v},MutationObserver:f.Observer});
    assert.notEqual(f.header.textContent,'Name');assert.equal(f.filename.textContent,'Name');assert.equal(f.path.textContent,'/data/whatwhatboy/Name.bin');assert.equal(f.editor.textContent,'[AutoRun]\r\n/data/payloads/Name.bin\r\n');assert.equal(f.code.textContent,'/data/GoldHEN/payloads.ini');
    assert.equal(f.document.body.childNodes[0].id,'workspace-language-picker');assert.equal(f.document.body.childNodes[0].childNodes[1].tagName,'SELECT');
    global.prompt('New filename','Name.bin');assert.notEqual(seen.message,'New filename');assert.equal(seen.value,'Name.bin');
    api.choose('en');assert.equal(f.header.textContent,'Name');assert.equal(f.status.textContent,'No file selected.');
    api.choose('ar');assert.equal(f.document.documentElement.dir,'rtl');assert.equal(stored['whatsite.workspace.lang'],'ar');
    api.choose('fr');assert.equal(f.document.documentElement.dir,'ltr');f.status.textContent='Actual native file read. No file has been changed.';api.refresh();assert.notEqual(f.status.textContent,'Actual native file read. No file has been changed.');
    api.disconnect();
  }finally{if(oldPrompt===undefined)delete global.prompt;else global.prompt=oldPrompt;}
});
test('embedded languages need no remote script and keep the native CSP and exact authored sources',()=>{
  const js=fs.readFileSync('assets/host-native-workspace.js','utf8'),local=fs.readFileSync('assets/host-native-workspace-i18n.js','utf8');
  assert.doesNotMatch(local,/\bfetch\s*\(|XMLHttpRequest|WebSocket|\.src\s*=/);
  for(const platform of ['ps4','ps5']){const html=generator.render(platform);assert(html.includes('window.WhatsiteWorkspaceDictionaries='));assert(html.includes(local));assert(html.includes(js));assert.doesNotMatch(html,/<script\b[^>]*\bsrc\s*=/i);assert.match(html,/connect-src 'self'/);assert.equal((html.match(/<script>/g)||[]).length,1);}
});
