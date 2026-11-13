#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), fsp = require('node:fs/promises'), path = require('node:path');
const os = require('node:os'), http = require('node:http'), crypto = require('node:crypto');
const {spawn} = require('node:child_process');
const {pipeline} = require('node:stream/promises');
const {Transform} = require('node:stream');
const core = require('./console-files-core.cjs');
const MAX_UPLOAD = 256 * 1024 * 1024;
function sevenZip() {
  const choices = [process.env.WWB_7ZIP, 'C:/Program Files/7-Zip/7z.exe', '/usr/bin/7zz', '/usr/bin/7z', '/opt/homebrew/bin/7zz'];
  return choices.find(p => p && fs.existsSync(p)) || null;
}
function run7z(executable, args, max = 8 * 1024 * 1024) {
  return new Promise((resolve,reject) => {
    if (!executable) return reject(Error('Install 7-Zip on the helper computer, then restart the helper.'));
    const child = spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
    const parts=[]; let total=0, errorText='', failed=false;
    const stop=message=>{if(failed)return;failed=true;child.kill();reject(Error(message));};
    const timer=setTimeout(()=>stop('Archive operation timed out.'),60000);
    child.stdout.on('data',b=>{total+=b.length;if(total>max)stop('Archive output exceeds the allowed size.');else parts.push(b);});
    child.stderr.on('data',b=>{if(errorText.length<4096)errorText+=b;});
    child.on('error',e=>{clearTimeout(timer);stop(e.message);});
    child.on('close',code=>{clearTimeout(timer);if(failed)return;if(code!==0)return reject(Error('Archive could not be read. Password-protected, damaged or incomplete multipart archives are not supported. '+errorText.slice(0,180)));resolve(Buffer.concat(parts));});
  });
}
function json(res,code,data){res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req){let chunks=[],n=0;for await(const b of req){n+=b.length;if(n>2*1024*1024)throw Error('Request is too large.');chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
async function receive(req,file){let bytes=0;await pipeline(req,new Transform({transform(chunk,_,done){bytes+=chunk.length;if(bytes>MAX_UPLOAD)return done(Error('Files must be 256 MiB or smaller.'));done(null,chunk);}}),fs.createWriteStream(file,{flags:'wx'}));return bytes;}
function createServer(options={}) {
  const root=options.root||path.resolve(__dirname,'..'), token=options.token||crypto.randomBytes(12).toString('hex');
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'wwb-console-files-'));
  const uploads=new Map(), archives=new Map();
  const hosts=new Set(['127.0.0.1','localhost',...Object.values(os.networkInterfaces()).flat().filter(x=>x.family==='IPv4').map(x=>x.address)]);
  const executable=sevenZip(); let busy=false, stagedBytes=0;
  const clientFactory=options.clientFactory||(()=>new(require('./vendor/basic-ftp/dist/index.js').Client)(20000));
  async function ftp(config, action) {
    const client=clientFactory();
    try {await client.access(core.settings(config));return await action(client);} finally {client.close();}
  }
  const server=http.createServer(async(req,res)=>{
    let target;
    try {
      const authority=String(req.headers.host||'');
      if(!hosts.has(authority.split(':')[0]))return json(res,403,{error:'Open the helper using its printed local address.'});
      target=new URL(req.url,'http://'+authority);
      if(req.headers.origin&&req.headers.origin!=='http://'+authority)return json(res,403,{error:'Open this page directly from the helper.'});
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Cross-site request rejected.'});
      if(!target.pathname.startsWith('/api/')) {
        if(req.method!=='GET')return json(res,405,{error:'Use GET.'});
        const files={'/':'assets/console-files.html','/assets/console-files.css':'assets/console-files.css','/assets/console-files-ui.js':'assets/console-files-ui.js','/assets/console-plugins.js':'assets/console-plugins.js'};
        const file=files[target.pathname];if(!file)return json(res,404,{error:'Not found.'});
        res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'"});
        return fs.createReadStream(path.join(root,file)).pipe(res);
      }
      const supplied=String(req.headers['x-wwb-pair']||'');
      if(supplied.length!==token.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(token)))return json(res,401,{error:'Enter the pairing code printed by the helper.'});
      if(req.method==='GET'&&target.pathname==='/api/status')return json(res,200,{ready:true,archive:Boolean(executable),maxUpload:MAX_UPLOAD,message:'Paired with the file helper.'});
      if(req.method!=='POST')return json(res,405,{error:'Use an explicit POST action.'});
      if(busy)return json(res,409,{error:'A transfer is in progress. Wait for it to finish.'});
      busy=true;
      try {
        if(target.pathname==='/api/stage') {
          const name=core.filename(decodeURIComponent(req.headers['x-file-name']||''));
          if(uploads.size>=100||stagedBytes>=1024**3)throw Error('Staging is full. Restart the helper to clear temporary files.');
          const id=crypto.randomBytes(16).toString('hex'), file=path.join(folder,id);
          let bytes;
          try {bytes=await receive(req,file);}catch(e){await fsp.rm(file,{force:true});throw e;}
          uploads.set(id,{name,file,bytes});stagedBytes+=bytes;
          return json(res,200,{id,name,bytes});
        }
        const data=await body(req);let result;
        if(target.pathname==='/api/archive') {
          const saved=uploads.get(data.id);if(!saved)throw Error('Choose an archive first.');
          if(!/\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/i.test(saved.name))throw Error('Choose ZIP, RAR, 7z, TAR, GZ, TGZ, BZ2 or XZ.');
          const entries=core.archiveEntries((await run7z(executable,['l','-slt','-ba','-sccUTF-8','--',saved.file])).toString('utf8'));
          archives.set(data.id,entries);result={entries:entries.map((e,i)=>({index:i,name:e.name,bytes:e.bytes}))};
        } else if(target.pathname==='/api/extract') {
          const saved=uploads.get(data.id), entry=archives.get(data.id)?.[data.index];
          if(!saved||!entry||!Number.isInteger(data.index))throw Error('Inspect the archive and select a file first.');
          if(stagedBytes+entry.bytes>1024**3||uploads.size>=100)throw Error('Staging is full. Restart the helper to clear temporary files.');
          const bytes=await run7z(executable,['x','-so','-spd','-y','--',saved.file,entry.member],Math.max(entry.bytes,1));
          if(bytes.length!==entry.bytes)throw Error('Extracted size did not match the archive listing.');
          const id=crypto.randomBytes(16).toString('hex'), file=path.join(folder,id), name=core.filename(path.posix.basename(entry.name));
          await fsp.writeFile(file,bytes,{flag:'wx'});uploads.set(id,{name,file,bytes:bytes.length});stagedBytes+=bytes.length;result={id,name,bytes:bytes.length};
        } else if(target.pathname==='/api/staged-download') {
          const saved=uploads.get(data.id);if(!saved)throw Error('Staged file is no longer available.');
          res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':saved.bytes,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(saved.name),'Cache-Control':'no-store'});
          await pipeline(fs.createReadStream(saved.file),res);return;
        } else {
          result=await ftp(data.connection,async client=>{
            if(target.pathname==='/api/list') {
              const directory=core.remote(data.path||'/data');
              return {path:directory,files:(await client.list(directory)).filter(f=>f.name!=='.'&&f.name!=='..').map(f=>({name:f.name,size:f.size,directory:f.isDirectory,link:f.isSymbolicLink}))};
            }
            if(target.pathname==='/api/upload') {
              const saved=uploads.get(data.id);if(!saved)throw Error('Choose a local file or extract an archive member first.');
              return core.upload(client,saved.file,core.remote(data.path,true),saved.bytes);
            }
            if(target.pathname==='/api/move') {
              const from=core.remote(data.from,true),to=core.remote(data.to,true);
              if(from===to)throw Error('Choose a different destination.');
              if(await core.exists(client,to))throw Error('Destination exists. No files were replaced.');
              await client.rename(from,to);return {path:to};
            }
            if(target.pathname==='/api/mkdir') {const destination=core.remote(data.path,true);await client.ensureDir(destination);return {path:destination};}
            if(target.pathname==='/api/ini-read')return core.readIni(client);
            if(target.pathname==='/api/ini-save')return core.saveIni(client,data.text,data.sha256);
            if(target.pathname==='/api/download') {
              const file=core.remote(data.path),size=await client.size(file);
              if(size>MAX_UPLOAD)throw Error('Browser downloads are limited to 256 MiB. Use a desktop FTP client for larger files.');
              res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(path.posix.basename(file)),'Cache-Control':'no-store'});
              await client.downloadTo(res,file);return null;
            }
            throw Error('Unknown file action.');
          });
        }
        if(!res.headersSent)json(res,200,result);
      } finally {busy=false;}
    } catch(error) {if(!res.headersSent)json(res,400,{error:error.message});else res.destroy(error);}
  });
  server.requestTimeout=5*60*1000;
  server.on('close',()=>{fsp.rm(folder,{recursive:true,force:true}).catch(()=>{});});
  return {server,token,folder};
}
if(require.main===module) {
  const lan=process.argv.includes('--lan'),port=Number(process.env.WWB_FILES_PORT||8787);
  const {server,token}=createServer();
  server.listen(port,lan?'0.0.0.0':'127.0.0.1',()=>{
    console.log('WWB console files — http://127.0.0.1:'+port+'\nPairing code: '+token);
    if(lan)for(const info of Object.values(os.networkInterfaces()).flat())if(info.family==='IPv4'&&!info.internal)console.log('Phone / tablet: http://'+info.address+':'+port);
    console.log('Keep this terminal open. FTP must be enabled on your console. Ctrl+C stops the helper.');
  });
  // Let pending temporary-file cleanup finish before Node exits naturally.
  process.on('SIGINT',()=>server.close());
}
module.exports={createServer,run7z,sevenZip};
