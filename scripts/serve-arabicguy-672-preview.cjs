'use strict';
// Serve the authored, inert-on-desktop controller only; never upstream code.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),build=JSON.parse(fs.readFileSync(path.join(root,'docs/host-reviews/ps4/6.72/arabicguy/prepared.json'),'utf8')),bytes=fs.readFileSync(path.join(root,build.immutablePath));
if(crypto.createHash('sha256').update(bytes).digest('hex')!==build.sha256)throw Error('Controller identity changed');
const server=http.createServer((req,res)=>{if(req.method!=='GET'||req.url!=='/controller/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);});
server.listen(0,'127.0.0.1',()=>console.log('Authored controller preview: http://127.0.0.1:'+server.address().port+'/controller/'));
