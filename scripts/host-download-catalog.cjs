'use strict';
// Independent-host maintenance preserves the migrated catalogue instead of
// rebuilding it from main-site source manifests which are intentionally absent.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function collect({root=path.resolve(__dirname,'..')}={}){
 const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
 const document=read('docs/console-download-catalog.json');
 const manifest=read('docs/ps5-web-file-manager.json'),asset=manifest.assets.find(x=>x.role==='manager');
 const action=read('docs/host-actions-ps5.json').actions.find(x=>x.id==='ps5-web-file-manager');
 if(!asset||!action||asset.local!==action.downloadURL||asset.sha256!==action.sha256||asset.bytes!==action.bytes||manifest.version!==action.version)throw Error('File manager release metadata differs');
 if(!/^\/downloads\/host-payloads\/ps5-web-file-manager\/v[\d.]+\/[^/]+\.elf$/.test(asset.local))throw Error('Unexpected file manager asset path');
 const bytes=fs.readFileSync(path.join(root,asset.local.slice(1)));
 if(bytes.length!==asset.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==asset.sha256||bytes.subarray(0,4).toString('hex')!=='7f454c46')throw Error('File manager release bytes differ');
 const expected=manifest.repository+'/releases/download/'+manifest.version+'/'+asset.name;
 if(asset.sourceURL!==expected||action.sourceURL!==expected||!/^https:\/\/github\.com\/owendswang\/ps5-web-file-manager\/releases\/download\/v[\d.]+\/[^/]+\.elf$/.test(expected))throw Error('Expected version-pinned upstream asset');
 const item={id:action.id,name:action.label,filename:asset.name,url:asset.sourceURL,bytes:asset.bytes,sha256:asset.sha256,version:manifest.version,category:'payloads',compatibility:action.requirements[0],image:'/assets/images/consoles/playstation.jpg',page:'/hosts/ps5/files/',platforms:['ps5'],description:'Native PS5 web file manager with console and USB browsing, transfers, text editing and remote connections.',source:manifest.repository};
 const old=document.items.find(x=>x.id===item.id);
 if(old&&(old.sha256!==item.sha256||old.version!==item.version))throw Error('Preserve the older manager under its own versioned ID before adding a different release');
 document.items=old?document.items.map(x=>x.id===item.id?item:x):document.items.concat(item);
 document.sources=[...new Set([...(document.sources||[]),'docs/host-actions-ps5.json','docs/ps5-web-file-manager.json'])];
 return document;
}
module.exports={collect};
