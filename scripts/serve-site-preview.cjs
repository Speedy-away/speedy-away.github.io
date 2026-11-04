// Loopback-only public site preview. Never serves private research or executes files.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.WWB_PREVIEW_ROOT||path.join(__dirname,'..')),realRoot=fs.realpathSync(root);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.zip':'application/zip','.7z':'application/x-7z-compressed','.rar':'application/vnd.rar','.pdf':'application/pdf'};
const inside=(base,file)=>{const rel=path.relative(base,file);return !rel.startsWith('..')&&!path.isAbsolute(rel);};
const server=http.createServer((req,res)=>{
 try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!['GET','HEAD'].includes(req.method)||name.includes('\\')||/(?:^|\/)\.|^\/(?:docs|scripts|node_modules|tests)(?:\/|$)/i.test(name)){res.writeHead(403);res.end();return;}
  let target=path.resolve(root,'.'+name);
  if(!inside(root,target)){res.writeHead(403);res.end();return;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  const runtime=name.startsWith('/hosts/runtime/');
  const extension=path.extname(target).toLowerCase(),runtimeTypes={'.mjs':'text/javascript; charset=utf-8','.manifest':'text/cache-manifest','.cache':'text/cache-manifest','.appcache':'text/cache-manifest','.bin':'application/octet-stream','.elf':'application/octet-stream','.bz2':'application/octet-stream'};
  const download=name.startsWith('/downloads/'),type=types[extension]||(runtime&&runtimeTypes[extension])||(download?'application/octet-stream':null);
  if(!type||!fs.existsSync(target)||!fs.statSync(target).isFile()){res.writeHead(404);res.end();return;}
  if(!inside(realRoot,fs.realpathSync(target))){res.writeHead(403);res.end();return;}
  const headers={'Content-Type':type,'Content-Length':fs.statSync(target).size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(runtime)headers['Cache-Control']='no-cache, must-revalidate';
  if(download&&!['.html','.json'].includes(path.extname(target).toLowerCase()))headers['Content-Disposition']="attachment; filename*=UTF-8''"+encodeURIComponent(path.basename(target));
  res.writeHead(200,headers);if(req.method==='HEAD')res.end();else fs.createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(400);res.end();}
});
const requestedPort=Number(process.env.WHATSITE_PREVIEW_PORT||0);
if(!Number.isInteger(requestedPort)||requestedPort<0||requestedPort>65535)throw Error('Invalid preview port');
server.listen(requestedPort,'127.0.0.1',()=>console.log('Local site preview: http://127.0.0.1:'+server.address().port+'/hosts/ps4/firmware/'));
