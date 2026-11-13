const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs');
const api=require('../../assets/console-direct-client.js'),builder=require('../host-native-workspace.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
class Form {constructor(){this.parts=[];}append(...args){this.parts.push(args);}}
function fixture(platform='ps4',options={}){
  const files=new Map(),dirs=new Set(['/data','/data/payloads','/data/whatwhatboy','/data/GoldHEN','/data/pldmgr','/data/pldmgr/payloads','/data/pldmgr/payloads/local']),calls=[];
  const config=api.settings[platform].config,initial=platform==='ps4'?'; keep this comment\r\n[Other]\r\nunknown = 7\r\n[AutoRun]\r\n/user/data/payloads/first.bin = 1\r\n':'local/first\n!2500\nrepo/second\n';files.set(config,Buffer.from(initial));
  const parent=p=>p.slice(0,p.lastIndexOf('/')),name=p=>p.slice(p.lastIndexOf('/')+1),success=()=>JSON.stringify({result:{success:true,error:null}});
  async function transport(method,route,body,type,limit,changed){
    calls.push({method,route,body,type,limit,changed});if(options.before)options.before({method,route,body,type,files,dirs,calls});
    assert.ok(!/loadpayload|\/api\/run|\/remove|\/copy|\/install|download_url/.test(route),'No executing/removing/proxy route');
    if(route.startsWith('/__local__/downloadFile?')){assert.equal(method,'GET');const p=new URL(route,'http://console').searchParams.get('path');assert.ok(files.has(p));return Uint8Array.from(files.get(p));}
    const input=typeof body==='string'?JSON.parse(body):null;
    if(route==='/__local__/list'){assert.deepEqual(Object.keys(input).sort(),['onlyFolders','path']);assert.equal(input.onlyFolders,false);const items=[];for(const p of dirs)if(parent(p)===input.path)items.push({name:name(p),type:'dir',size:''});for(const[p,b]of files)if(parent(p)===input.path)items.push({name:name(p),type:'file',size:String(b.length)});return JSON.stringify({result:items});}
    if(route==='/__local__/getContent')return JSON.stringify({result:files.get(input.item).toString('utf8')});
    if(route==='/__local__/createFolder'){if(!options.ignoreCreate)dirs.add(input.newPath);return success();}
    if(route==='/__local__/rename'){if(!options.ignoreRename){assert.ok(files.has(input.item));files.set(input.newItemPath,files.get(input.item));files.delete(input.item);}return success();}
    if(route==='/__local__/edit'){files.set(input.item,Buffer.from(input.content));if(options.corruptStage)files.set(input.item,Buffer.from('corrupt'));return success();}
    if(route==='/__local__/upload'){assert.ok(body instanceof Form);assert.deepEqual(body.parts.map(p=>p[0]),['destination','_chunkSize','_chunkNumber','_totalSize','_currentChunkSize','file']);assert.equal(body.parts[2][1],'0');const p=body.parts[0][1]+'/'+body.parts[5][2],b=Buffer.from(await body.parts[5][1].arrayBuffer());files.set(p,options.corruptUpload?Buffer.from('corrupt'):b);return success();}
    throw Error('Unexpected route '+route);
  }
  const location={protocol:'http:',hostname:'192.168.1.50',port:api.settings[platform].port,pathname:api.settings[platform].installPath};
  const client=api.createClient({platform,location,transport,formDataFactory:()=>new Form(),Blob});
  return {client,files,dirs,calls,config,initial,location,transport};
}

module.exports={fixture};
