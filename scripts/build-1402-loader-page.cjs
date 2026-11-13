'use strict';
// Assemble the authored, firmware-specific loader page without running native code.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function build(root,base,write){
 const report=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-loader-support.json'))),files={firmware:'14.02'};
 for(const [key,file]of Object.entries(report.files)){
  const bytes=fs.readFileSync(path.join(root,file.url));if(bytes.length!==file.bytes||hash(bytes)!==file.sha256)throw Error('Loader dependency changed: '+file.name);
  write(base+'/web/'+file.name,bytes);files[key]={...file,url:file.name};
 }
 const sender=fs.readFileSync(path.join(root,report.sender.url));if(hash(sender)!==report.sender.sha256)throw Error('Sender package changed');
 write(base+'/web/ps4-loader-sender.zip',sender);
 for(const name of ['host-console-client.js','ps4-loader-client.js','ps4-loaders.js','ps4-loaders.css'])write(base+'/web/'+name,fs.readFileSync(path.join(root,'assets',name)));
 write(base+'/web/WEBKITTY-LICENSE',fs.readFileSync(path.join(root,'downloads/host-payloads/webkitty',report.sourceCommit.slice(0,12),'LICENSE')));
 let html=fs.readFileSync(path.join(root,'scripts/templates/ps4-loaders.html'),'utf8');
 html=html.replace(/\/assets\/(host-console-client\.js|ps4-loader-client\.js|ps4-loaders\.js|ps4-loaders\.css)/g,'$1')
 .replace('@@FILES@@',JSON.stringify(files)).replace('@@SENDER@@','ps4-loader-sender.zip').replace('@@ELFBIN@@',files.bin.url).replace('@@ELF@@',files.elf.url)
 .replace(/<details>[\s\S]*?<\/details>/,'')
 .replace('href="/hosts/ps4/afterglow-1402/"','href="index.html"')
 .replace('<h1>BIN &amp; ELF loaders</h1>','<h1>14.02 BIN &amp; ELF loaders</h1>')
 .replace('PLAYSTATION 4 · PAYLOAD TOOLS','PLAYSTATION 4 · FIRMWARE 14.02')
 .replace('Start your jailbreak, enable the matching loader, then send one compatible payload.','Run WebKit Exploit first, enable the HEN BIN loader, then send a compatible payload. This page and its ELF-loader files are included when you cache 14.02.')
 .replace('placeholder="14.02" pattern=','value="14.02" readonly pattern=')
 .replace(/<option value="bin-tcp">[^<]*<\/option>/,'')
 .replace('http://127.0.0.1:8766/hosts/ps4/loaders/','http://127.0.0.1:8766/hosts/ps4/loaders/?firmware=14.02');
 write(base+'/web/loaders.html',html);
 return {page:'loaders.html',firmware:'14.02',files:Object.values(report.files).map(f=>({path:f.name,sha256:f.sha256,bytes:f.bytes})),senderSHA256:report.sender.sha256};
}
module.exports={build};
