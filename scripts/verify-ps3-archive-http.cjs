// Read-only integration check against real archived bytes on an ephemeral
// loopback listener. The package is never installed or executed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {loadArchiveCatalogue,createArchiveServer}=require('./serve-ps3-downloads.cjs');
const root=path.resolve(__dirname,'..');
async function main(){
  const files=loadArchiveCatalogue();
  const server=createArchiveServer({files,host:'127.0.0.1'});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  const get=(url,options={})=>fetch(origin+url,{...options,signal:AbortSignal.timeout(120000)});
  try{
    const catalogue=await(await get('/catalog.json?resource=gta-iv-texture-installer-v2')).json();
    assert.equal(catalogue.platform,'PS3');
    assert.equal(catalogue.files.length,2);
    assert.ok(!/[A-Z]:[\\/]|backupPath|archivePath|resolvedUrl|retainedTransferPath/.test(JSON.stringify(catalogue)));
    const pkg=catalogue.files.find(file=>/\.pkg$/i.test(file.filename));
    const rar=catalogue.files.find(file=>/\.rar$/i.test(file.filename));
    assert.ok(pkg&&rar);
    assert.equal(pkg.bytes,539571872);assert.equal(rar.bytes,539573839);
    const headers=[];
    for(const file of [pkg,rar]){
      const response=await get(file.url,{method:'HEAD'});
      assert.equal(response.status,200);assert.equal(Number(response.headers.get('content-length')),file.bytes);
      assert.equal(response.headers.get('x-checksum-sha256'),file.sha256);
      assert.equal(response.headers.get('accept-ranges'),'bytes');
      headers.push({filename:file.filename,bytes:file.bytes,sha256:file.sha256});
    }
    const partial=await get(pkg.url,{headers:{Range:'bytes=0-191'}});
    assert.equal(partial.status,206);
    const header=Buffer.from(await partial.arrayBuffer());
    assert.equal(header.length,192);assert.equal(header.subarray(0,4).toString('hex'),'7f504b47');assert.equal(header.readUInt16BE(6),1);
    const tail=await get(pkg.url,{headers:{Range:'bytes=-32'}});
    assert.equal(tail.status,206);const actual=Buffer.from(await tail.arrayBuffer());
    const original=files.find(file=>file.id===pkg.id),expected=Buffer.alloc(32),fd=fs.openSync(original.archivePath,'r');
    try{fs.readSync(fd,expected,0,32,pkg.bytes-32);}finally{fs.closeSync(fd);}
    assert.deepEqual(actual,expected);
    const apache=await get(pkg.directoryUrl);assert.equal(apache.status,200);
    const html=await apache.text();assert.ok(html.includes('<table>')&&html.includes(encodeURIComponent(pkg.filename)));
    const directAlias=await get(pkg.ezremoteUrl,{method:'HEAD'});assert.equal(directAlias.status,200);
    assert.equal(Number(directAlias.headers.get('content-length')),pkg.bytes);
    for(const resourceId of ['ps3-pro-lite-492','gta-v-fbi4z-v2']){
      const extra=await(await get('/catalog.json?resource='+resourceId)).json();
      const file=extra.files.find(entry=>resourceId==='ps3-pro-lite-492'?/\.pkg$/i.test(entry.filename):/\.rpf$/i.test(entry.filename));
      assert.ok(file,'Missing new archived console file '+resourceId);
      const response=await get(file.url,{method:'HEAD'});assert.equal(response.status,200);assert.equal(Number(response.headers.get('content-length')),file.bytes);assert.equal(response.headers.get('x-checksum-sha256'),file.sha256);
      const bytes=await get(file.url,{headers:{Range:resourceId==='ps3-pro-lite-492'?'bytes=0-191':'bytes=0-3'}});assert.equal(bytes.status,206);
      const prefix=Buffer.from(await bytes.arrayBuffer());
      if(resourceId==='ps3-pro-lite-492'){assert.equal(prefix.subarray(0,4).toString('hex'),'7f504b47');assert.equal(prefix.readUInt16BE(6),1);assert.equal(prefix.readBigUInt64BE(0x18),BigInt(file.bytes));assert.ok(/4\.92/.test(file.compatibility));}
      else assert.equal(prefix.toString('ascii'),'RPF7');
      headers.push({resourceId,filename:file.filename,bytes:file.bytes,sha256:file.sha256});
    }
    const incomplete=await(await get('/catalog.json?resource=ghosts-daydream-116')).json();assert.equal(incomplete.files.length,0);
    for(const [resourceId,extension] of [['dead-island-dev-installer-v2','pkg'],['gta-iv-ultimate-common-npeb00882','edat'],['gta-iv-ultimate-common-npub30702','edat'],['aw-salvation-hen-digital','sprx'],['cod4-texture-installer-super-lite','pkg']]){
      const catalogue=await(await get('/catalog.json?resource='+resourceId)).json();
      const file=catalogue.files.find(entry=>entry.filename.toLowerCase().endsWith('.'+extension));
      assert.ok(file,'Missing fourth-batch archived console file '+resourceId);
      const response=await get(file.url,{method:'HEAD'});assert.equal(response.status,200);assert.equal(Number(response.headers.get('content-length')),file.bytes);assert.equal(response.headers.get('x-checksum-sha256'),file.sha256);
      const partial=await get(file.ezremoteUrl,{headers:{Range:'bytes=0-191'}});assert.equal(partial.status,206);
      const actual=Buffer.from(await partial.arrayBuffer()),expected=Buffer.alloc(192),record=files.find(entry=>entry.id===file.id),fd=fs.openSync(record.archivePath,'r');
      try{fs.readSync(fd,expected,0,192,0);}finally{fs.closeSync(fd);}
      assert.deepEqual(actual,expected);
      if(extension==='pkg'){assert.equal(actual.subarray(0,4).toString('hex'),'7f504b47');assert.equal(actual.readUInt16BE(6),1);assert.equal(actual.readBigUInt64BE(0x18),BigInt(file.bytes));}
      if(extension==='sprx')assert.ok(['53434500','7f454c46'].includes(actual.subarray(0,4).toString('hex')));
      headers.push({resourceId,filename:file.filename,bytes:file.bytes,sha256:file.sha256});
    }
    const report={reviewed:'2026-11-02',mode:'Real archive files served read-only through an ephemeral loopback HTTP listener',filesAvailable:files.length,resource:'gta-iv-texture-installer-v2',verifiedFiles:headers,checks:['PS3-only sanitized catalogue','Full-file SHA-256 verified before HEAD response','Exact PKG and RAR Content-Length','192-byte PS3 PKG header range','32-byte suffix equals archived file','Apache directory and original-case filename URL','Legacy4.92 PKG type and declared size','New ready RPF7 byte-range delivery','Incomplete distribution excluded from ready catalogue','Fourth-batch PKG/SPRX and separate EDAT variants served as exact archived bytes through ezRemote URLs'],hardwareExecutionTested:false};
    fs.writeFileSync(path.join(root,'docs/ps3-archive-http-verification.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
