(function(){
 'use strict';
 var engine=window.WhatsiteNativeWorkspace,client=engine.createClient({platform:'ps4',location:location}),files={},serial=0,snapshot=null;
 function bytes(file){return new Promise(function(resolve,reject){if(file.size>8*1024*1024)return reject(Error('Verified uploads are limited to 8 MiB. Use Open native file manager for larger files.'));var r=new FileReader();r.onload=function(){resolve(new Uint8Array(r.result));};r.onerror=function(){reject(Error('Cannot read this file.'));};r.readAsArrayBuffer(file);});}
 window.WWBDirect={
 ready:client.isNative,
 stage:function(file){return bytes(file).then(function(data){var id=String(++serial);files[id]={data:data,name:file.name};return {id:id,name:file.name,bytes:data.length};});},
 api:function(route,data,blob){
  if(!client.isNative)return Promise.reject(Error('Upload this HTML file to /data/wwb-console-files.html on your PS4 and open it through ezRemote.'));
  data=data||{};
  if(route==='status')return Promise.resolve({archive:false,message:'Direct console connection. No computer helper.'});
  if(route==='list')return client.list(data.path).then(function(rows){return {path:data.path,files:rows.map(function(r){return {name:r.name,size:Number(r.size),directory:r.type==='dir',link:false};})};});
  if(route==='mkdir')return client.createFolder(data.path);
  if(route==='move')return client.renameFile(data.from,data.to);
  if(route==='download')return client.readBinary(data.path).then(function(b){return new Blob([b]);});
  if(route==='upload'){var f=files[data.id];if(!f)return Promise.reject(Error('Choose a local file first.'));var i=data.path.lastIndexOf('/');return client.uploadPayload(data.path.slice(0,i),data.path.slice(i+1),f.data);}
  if(route==='ini-read')return client.readConfig().then(function(s){snapshot=s;return {text:s.text,sha256:s.sha256,exists:!s.missing};});
  if(route==='ini-save'){if(!snapshot||data.sha256!==snapshot.sha256)return Promise.reject(Error('Read the console configuration before saving.'));return client.saveConfig(snapshot,data.text).then(function(r){snapshot=null;return {path:r.path,backup:r.backupPath,sha256:r.sha256,text:data.text};});}
  return Promise.reject(Error('Use the console’s native file manager for archive extraction and larger files.'));
 }
 };
}());
