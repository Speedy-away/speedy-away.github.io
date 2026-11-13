'use strict';
// Selected bytes are held in memory and forwarded only after pairing and validation.
const crypto=require('node:crypto');
const loader=require('../assets/ps4-loader-client.js');
const {normalizeAddress}=require('../assets/host-console-client.js');
function error(code,message){return Object.assign(new Error(message),{code});}
function readBytes(req,size,timeoutMs=10000){return new Promise((resolve,reject)=>{
  let count=0,done=false;const parts=[];
  const timer=setTimeout(()=>finish(error('upload-timeout','The file upload timed out. Nothing was sent.')),timeoutMs);
  function finish(err){if(done)return;done=true;clearTimeout(timer);req.removeListener('data',data);req.removeListener('end',end);req.removeListener('aborted',aborted);req.removeListener('error',aborted);req.once('error',()=>{});if(err){parts.length=0;req.resume();reject(err);}else resolve(Buffer.concat(parts,count));}
  function data(b){count+=b.length;if(count>size)return finish(error('file-size-mismatch','The upload exceeds the declared size.'));parts.push(b);}
  function end(){finish(count===size?null:error('file-size-mismatch','The upload is incomplete.'));}
  function aborted(){finish(error('upload-interrupted','The upload was interrupted. Nothing was sent.'));}
  req.on('data',data);req.once('end',end);req.once('aborted',aborted);req.once('error',aborted);
});}
async function receive(req,context){
  const {busy,resolveAddress,sendELF,sendBIN,sendTCPBIN}=context;let key,acquired=false;
  try{
    if(req.headers.origin!=='http://'+req.headers.host)throw error('origin-rejected','Open the local sender page.');
    if(req.headers['content-type']!=='application/octet-stream'||req.headers['content-encoding'])throw error('binary-body-required','Upload uncompressed payload bytes.');
    const raw=req.headers['x-whatsite-loader'];
    if(typeof raw!=='string'||raw.length>2048||/[^\x20-\x7e]/.test(raw))throw error('invalid-metadata','Invalid loader metadata.');
    let meta;try{meta=JSON.parse(raw);}catch(_){throw error('invalid-metadata','Invalid loader metadata.');}
    loader.validate(meta);normalizeAddress(meta.address);
    if(req.headers['content-length']!==undefined&&String(meta.bytes)!==req.headers['content-length'])throw error('file-size-mismatch','The upload size is incorrect.');
    const bytes=await readBytes(req,meta.bytes,context.timeoutMs);
    loader.validate(meta,bytes);
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    if(sha256!==meta.sha256)throw error('checksum-mismatch','The file checksum changed. Nothing was sent.');
    const address=await resolveAddress(meta.address);key=address;
    if(busy.has(key))throw error('console-busy','A transfer to this console is already in progress.');
    busy.add(key);acquired=true;
    const out=meta.profile==='bin-tcp'?await sendTCPBIN(address,bytes):meta.profile==='elf-tcp'?await sendELF(address,bytes):meta.profile==='goldhen-http'?await sendBIN(address,bytes):await loader.sendHTTP({...meta,address},bytes,{normalizeAddress,fetch:context.fetcher||globalThis.fetch,origin:'http://127.0.0.1',timeoutMs:context.timeoutMs});
    return {...out,sha256,address,profile:meta.profile};
  }finally{if(acquired)busy.delete(key);}
}
module.exports={receive,readBytes};
