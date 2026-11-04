// Read only source HTML. Embedded code is decoded as text and never evaluated.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),cache=path.join(root,'docs/tmp/virusmike-ps4-next');
const home='https://sites.google.com/view/im-virusmike-exe/ps4-all-you-need';
const snapshotName=url=>url===home?'index.html':(url.startsWith(home+'/')?'':'root-')+new URL(url).pathname.split('/').pop()+'.html';
const decode=value=>String(value).replace(/&(?:amp|quot|apos|lt|gt|#39|#\d+|#x[\da-f]+);/gi,entity=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'"}[entity.toLowerCase()]??String.fromCodePoint(parseInt(entity.slice(entity[2]?.toLowerCase()==='x'?3:2,-1),entity[2]?.toLowerCase()==='x'?16:10))));
const plain=value=>decode(value.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function scan(html,url){
  const embeds=[...html.matchAll(/data-code="([^"]*)"/g)].map(match=>decode(match[1]));
  const links=[];
  for(const [index,text] of [html,...embeds].entries()){
    for(const match of text.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)){
      let target;try{target=new URL(decode(match[2]),url)}catch{continue}
      if(!/^https?:$/.test(target.protocol))continue;
      const original=target.href;
      if(/(?:^|\.)google\.com$/.test(target.hostname)&&target.pathname==='/url')try{target=new URL(target.searchParams.get('q')||target.searchParams.get('url'));}catch{}
      const heading=[...text.slice(Math.max(0,match.index-5000),match.index).matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi)].at(-1)?.[1];
      links.push({url:target.href,...(original!==target.href?{redirectUrl:original}:{}),label:plain(match[3]),heading:plain(heading||''),kind:index?'decoded-embed':'page'});
    }
    if(index)for(const match of text.matchAll(/https?:\/\/[^\s"'<>]+/g)){
      let target;try{target=new URL(decode(match[0]))}catch{continue}
      if(!links.some(link=>link.url===target.href))links.push({url:target.href,label:'Literal URL in decoded embed',heading:'',kind:'decoded-embed-literal'});
    }
  }
  return {embedCount:embeds.length,links:[...new Map(links.map(link=>[link.kind+' '+link.url+' '+link.label,link])).values()]};
}
function fetch(url,target){return new Promise(resolve=>cp.execFile('curl.exe',['-L','--max-time','40','--retry','1','-sS','-w','%{http_code}','-o',target,url],{maxBuffer:1024*1024},(error,stdout)=>resolve({status:Number(stdout)||null,error:error?.message||null})));}
async function run(){
  fs.mkdirSync(cache,{recursive:true});const queue=[home],seen=new Set(),pages=[];
  if(process.argv.includes('--cached')){
    const file=path.join(cache,'source-pages.json'),previous=JSON.parse(fs.readFileSync(file,'utf8'));
    previous.pages=previous.pages.map(page=>({...page,...scan(fs.readFileSync(path.join(root,page.snapshot),'utf8'),page.url)}));
    fs.writeFileSync(file,JSON.stringify(previous,null,2)+'\n');
    console.log('Reparsed '+previous.pages.length+' cached source pages without network access.');return;
  }
  while(queue.length && pages.length<35){
    const url=queue.shift();if(seen.has(url))continue;seen.add(url);
    const target=path.join(cache,snapshotName(url));
    const result=await fetch(url,target);const html=fs.existsSync(target)?fs.readFileSync(target,'utf8'):'';const parsed=scan(html,url);
    const page={url,checkedAt:new Date().toISOString(),...result,snapshot:path.relative(root,target).replaceAll('\\','/'),bytes:Buffer.byteLength(html),sha256:crypto.createHash('sha256').update(html).digest('hex'),...parsed};pages.push(page);
    console.log(JSON.stringify({url,status:result.status,embeds:parsed.embedCount,links:parsed.links.length}));
    if(result.status!==200)continue;
    for(const link of parsed.links){const child=new URL(link.url);child.search='';child.hash='';const clean=child.href;
      if((clean.startsWith(home+'/') || clean==='https://sites.google.com/view/im-virusmike-exe/ps4-pkg-apps')&&!seen.has(clean)&&!queue.includes(clean))queue.push(clean);
    }
  }
  fs.writeFileSync(path.join(cache,'source-pages.json'),JSON.stringify({reviewedAt:new Date().toISOString(),source:home,scope:'Only URLs observed in fetched source anchors or decoded data-code embeds. No guessed child URLs. No external gates followed or source code executed.',remainingObservedUrls:queue,pages},null,2)+'\n');
  console.log(JSON.stringify({pages:pages.length,remaining:queue.length}));
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1});
module.exports={decode,plain,scan,snapshotName};
