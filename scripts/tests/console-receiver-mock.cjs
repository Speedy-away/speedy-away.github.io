// Loopback-only contract fixture. It never fetches a download or writes a file.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const queue = [];
const folders = new Set(['/', '/data', '/mnt', '/mnt/usb1', '/mnt/ext0']);
const state = item => Date.now() - item.started > 1500 ? 4 : 1;
const children = folder => [...folders].filter(item => item !== folder && path.posix.dirname(item) === folder).map(item => ({name:path.posix.basename(item),type:'dir',size:''})).concat(queue.filter(item => state(item)===4 && path.posix.dirname(item.dest_path)===folder).map(item=>({name:path.posix.basename(item.dest_path),type:'file',size:String(item.size)})));
const listing = folder => [{name:'.',mode:'d',size:0,mtime:0},...children(folder).map(item=>({name:item.name,mode:item.type==='dir'?'d':'-',size:Number(item.size)||0,mtime:0}))];
function reply(res, body, type = 'application/json') {
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', 'no-store');
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
function companion(res,platform) {
  return reply(res,fs.readFileSync(path.join(root,`console/${platform}/whatsite-${platform}.html`),'utf8').replace('<body>','<body><aside style="padding:14px;background:#5c4200;color:#fff;text-align:center">TEST RECEIVER · synthetic metadata only; no files are downloaded, created or extracted</aside>'),'text/html; charset=utf-8');
}
function managerAPI(req,res) {
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method!=='POST'||!['/__local__/list','/__local__/createFolder','/__local__/extract'].includes(url.pathname))return false;
  let body='';req.on('data',chunk=>{body+=chunk;});req.on('end',()=>{
    try{
      const data=JSON.parse(body);
      if(url.pathname==='/__local__/list')return reply(res,{result:children(data.path)});
      if(url.pathname==='/__local__/extract')return reply(res,{result:{success:false,error:'MOCK: archive extraction is not executed. Use the deterministic metadata-only unit fixture to verify this contract.'}});
      if(!/^\/(?:data|mnt\/(?:usb1|ext0))(?:\/[a-z0-9 _().+-]+)+$/i.test(data.newPath)||data.newPath.split('/').some(part=>part==='..')||!folders.has(path.posix.dirname(data.newPath)))throw Error('Invalid or missing mock parent');
      folders.add(data.newPath);return reply(res,{result:{success:true,error:null}});
    }catch(error){return reply(res,{result:{success:false,error:error.message}});}
  });return true;
}
const receiver = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:6701');
  if (req.method === 'HEAD') {
    const match = queue.find(item => item.dest_path === decodeURIComponent(url.pathname) && state(item) === 4);
    res.statusCode = match ? 200 : 404;
    if (match) res.setHeader('Content-Length', match.size);
    return res.end();
  }
  if (url.pathname === '/version') return reply(res, 'MOCK', 'text/plain');
  if (url.pathname === '/get_download_state') return reply(res, queue.map(item => ({path: item.dest_path, bytes_transfered: state(item) === 4 ? item.size : Math.floor(item.size / 2), file_size: item.size, state: state(item), timestamp: item.started / 1000})));
  if (url.pathname === '/mock-requests') return reply(res, queue);
  if (url.pathname === '/download_url' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (![6, 7].includes(data.type) || !data.url || !data.src_path || !data.dest_path || !Number.isFinite(data.size)) throw Error('Invalid contract');
        queue.push({...data, started: Date.now()});
        reply(res, '', 'text/plain');
      } catch { reply(res, {result: {success: false, error: 'Invalid request'}}); }
    });
    return;
  }
  const platform = url.pathname === '/data/whatsite-ps4.html' ? 'ps4' : url.pathname === '/whatsite-ps5.html' ? 'ps5' : null;
  if (platform) return companion(res,platform);
  res.statusCode = 404;
  res.end();
});
const websrv = http.createServer((req, res) => {
  if(managerAPI(req,res))return;
  const url=new URL(req.url,'http://127.0.0.1:8080');
  if(url.pathname==='/data/whatsite-ps4.html')return companion(res,'ps4');
  if(url.pathname==='/index.html')return reply(res,'<h1>TEST PS4 ezRemote Client</h1><p>Metadata-only fixture; no console filesystem.</p>','text/html; charset=utf-8');
  if(url.pathname.startsWith('/fs/'))res.setHeader('Access-Control-Allow-Origin','*');
  // Explicitly synthetic device metadata for UI QA, never the computer's mounts.
  if (req.url === '/fs/mnt/?fmt=json') return reply(res, [{name:'.',mode:'d'},{name:'usb0',mode:'d'},{name:'usb1',mode:'m'},{name:'ext0',mode:'m'}]);
  const folder=decodeURIComponent(url.pathname.slice(3)).replace(/\/$/,'')||'/';
  if(url.pathname.startsWith('/fs/')&&folders.has(folder)){
    if(url.searchParams.get('fmt')==='json')return reply(res,listing(folder));
    return reply(res,'<h1>TEST FILE LISTING</h1><p>Synthetic metadata only; no console files or downloaded payloads.</p>','text/html; charset=utf-8');
  }
  res.statusCode = 404;
  res.end();
});
const ps5client=http.createServer((req,res)=>{
  if(managerAPI(req,res))return;
  const url=new URL(req.url,'http://127.0.0.1:9090');
  if(url.pathname==='/data/homebrew/ezremote-client/assets/whatsite-ps5.html')return companion(res,'ps5');
  if(url.pathname==='/index.html')return reply(res,'<h1>TEST PS5 ezRemote Client</h1><p>Metadata-only fixture; no console filesystem.</p>','text/html; charset=utf-8');
  res.statusCode=404;res.end();
});
receiver.listen(6701, '127.0.0.1', () => console.log('Mock console receiver: http://127.0.0.1:6701 (metadata only)'));
websrv.listen(8080, '127.0.0.1', () => console.log('Mock PS5 websrv / PS4 client routes: http://127.0.0.1:8080 (synthetic fixture only)'));
ps5client.listen(9090,'127.0.0.1',()=>console.log('Mock PS5 ezRemote Client: http://127.0.0.1:9090 (metadata only)'));
process.on('SIGINT', () => { receiver.close(); websrv.close(); ps5client.close(); });
