const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const skip=new Set(['.git','.agents','.codex','.claude','.playwright','.playwright-cli','node_modules','assets','docs','design-references','languages','i18n-tools','scripts','tmp']);
function files(dir){if(/^hosts\/runtime(?:\/|$)/.test(path.relative(root,dir).replaceAll('\\','/')))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(skip.has(e.name)?[]:files(path.join(dir,e.name))):e.name.endsWith('.html')?[path.join(dir,e.name)]:[]);}
const decode=s=>s.replaceAll('&amp;','&').replaceAll('&quot;','"');
const failures=[];let pages=0,links=0;
const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
for(const file of files(root)){
 const html=fs.readFileSync(file,'utf8');
 if(/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)||/http-equiv="refresh"/i.test(html))continue;
 const relative=path.relative(root,file).replaceAll('\\','/');pages++;
 const ids=[...html.matchAll(/\bid="([^"]*)"/g)].map(m=>m[1]);
 if(new Set(ids).size!==ids.length)failures.push(relative+': duplicate IDs');
 if(/alert\(['"][^'"]*would be here/i.test(html))failures.push(relative+': placeholder action');
 for(const match of html.matchAll(/\b(?:href|src)="([^"]*)"/g)){
  const value=decode(match[1]);if(!value||value==='#'||/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(value))continue;
  const url=new URL(value,'https://whatwhatboy.com/'+relative);if(url.origin!=='https://whatwhatboy.com')continue;
  let target;try{target=path.join(root,decodeURIComponent(url.pathname));}catch{failures.push(relative+': malformed URL '+value);continue;}
  if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');
  links++;
  if(!fs.existsSync(target)){failures.push(relative+': missing '+value);continue;}
  if(url.hash&&target.endsWith('.html')){const body=fs.readFileSync(target,'utf8'),anchor=decodeURIComponent(url.hash.slice(1));if(!body.includes('id="'+anchor+'"')&&!body.includes('name="'+anchor+'"'))failures.push(relative+': missing anchor '+value);}
 }
 const canonical=html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i)?.[1];
 if(canonical&&!sitemap.includes('<loc>'+canonical+'</loc>'))failures.push(relative+': canonical absent from sitemap '+canonical);
}
for(const failure of failures)console.error(failure);
console.log('Audited '+pages+' public pages and '+links+' local links/assets; '+failures.length+' issue(s).');
process.exitCode=failures.length?1:0;
