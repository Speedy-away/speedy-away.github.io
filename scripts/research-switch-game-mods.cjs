// Fetch bounded official metadata. Never execute downloaded console files.
const fs = require('node:fs');
async function main(){
 const source='https://www.ctgpdx.com/download';
 const response=await fetch(source);const html=await response.text();
 const links=[...html.matchAll(/(?:href|src)="([^"]+)/g)].map(match=>match[1].replaceAll('&amp;','&')).filter(url=>/zip|drive|ctgp|googleusercontent|iframe/i.test(url));
 const candidates=[...new Set([...html.matchAll(/https?:[^\s"<>\\]+/g)].map(match=>match[0]).filter(url=>/ctgp|\.zip|drive\.google|sites\.google.*embed/i.test(url)))];
 const out={checkedAt:new Date().toISOString(),source,status:response.status,links,candidates,downloads:[]};
 for(const url of links.filter(url=>/\.zip(?:$|\?)/i.test(url))){const response=await fetch(url,{method:'HEAD'});out.downloads.push({url,status:response.status,resolved:response.url,type:response.headers.get('content-type'),bytes:response.headers.get('content-length')});}
 fs.writeFileSync('docs/switch-game-mods-ctgp-source.json',JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
