// Temporary loopback-only QA preview. Uses a free port and serves current files.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.zip':'application/zip','.7z':'application/x-7z-compressed','.rar':'application/vnd.rar'};
const server=http.createServer((req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');const name=decodeURIComponent(url.pathname);
    if(!['GET','HEAD'].includes(req.method)||/(?:^|\/)\.|^\/(?:docs|scripts|node_modules)(?:\/|$)/i.test(name)){res.writeHead(403);res.end();return;}
    let target=path.resolve(root,'.'+name);const relative=path.relative(root,target);
    if(relative.startsWith('..')||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}
    if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
    const type=types[path.extname(target).toLowerCase()];if(!type||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':type,'Content-Length':fs.statSync(target).size,'Cache-Control':'no-store'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
  }catch{res.writeHead(400);res.end();}
});
server.listen(0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port+'/console/xbox360/library.html'));
