// Preserve original icons embedded in pinned NROs when the store icon is absent.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {inspectZip}=require('./archive-switch-homebrew.cjs');
const {inspectNro}=require('./verify-switch-themes.cjs');
const root=path.resolve(__dirname,'..'),images=[];
for(const id of ['ftpsrv','Switch_90DNS_Tester','Cpp-Snake-NX']){
 const r=require('../docs/switch-homebrew-downloads.json').apps.find(r=>r.id===id);
 const f=r.officialNro||r.nro||r.package;
 const raw=fs.readFileSync(path.join(root,f.local));
 if(raw.length!==f.bytes||crypto.createHash('sha256').update(raw).digest('hex')!==f.sha256)throw Error('Pinned file differs');
 const member=/\.zip$/i.test(f.name)?inspectZip(raw,256*1024*1024).find(m=>/\.nro$/i.test(m.path)):null;
 const nro=member?member.data:raw;inspectNro(nro);
 const asset=nro.readUInt32LE(0x18);if(nro.toString('ascii',asset,asset+4)!=='ASET')throw Error('No embedded icon');
 const offset=Number(nro.readBigUInt64LE(asset+8)),size=Number(nro.readBigUInt64LE(asset+16));
 if(offset<0||size<2||size>4*1024*1024||asset+offset+size>nro.length)throw Error('Icon bounds');
 const b=nro.subarray(asset+offset,asset+offset+size);if(b[0]!==255||b[1]!==216)throw Error('Expected JPEG icon');
 const localPath='/assets/images/switch-homebrew/'+id+'-embedded.jpg';
 const target=path.join(root,localPath);if(fs.existsSync(target)&&!fs.readFileSync(target).equals(b))throw Error('Refusing icon replacement');
 if(!fs.existsSync(target))fs.writeFileSync(target,b,{flag:'wx'});
 images.push({id,localPath,source:f.source,member:(member?.path||f.name)+' embedded ASET icon',size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex'),credit:'Original '+r.title+' icon embedded in its pinned Switch NRO',storeIconStatus:404});
}
fs.writeFileSync(path.join(root,'docs/switch-app-embedded-image-sources.json'),JSON.stringify({checkedAt:new Date().toISOString(),images},null,2)+'\n');
console.log('Preserved embedded project icons:',images.length);
