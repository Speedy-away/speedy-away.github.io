'use strict';
// Author-written orchestration only. No payload executes on the desktop.
const fs=require('node:fs/promises'),path=require('node:path');
const api=require('../assets/ps4-loader-client.js');
const client=require('../assets/host-console-client.js');
function send(address,data,{root,firmware,name,fetcher=globalThis.fetch,...timing}){
 const meta={profile:'elf-http',address,firmware,name,bytes:data.length,sha256:client.sha256(data),compatible:true};
 return api.sendAutoELF(meta,data,{origin:'http://127.0.0.1',normalizeAddress:client.normalizeAddress,sha256:client.sha256,fetch:fetcher,readBootstrap:()=>fs.readFile(path.join(root,api.elfBootstrap.url)),...timing});
}
module.exports={send};
