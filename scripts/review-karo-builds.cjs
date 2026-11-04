'use strict';
// Read original source as data. Never launch a runtime or execute a payload.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'docs/host-reviews/karo'),repo='KAR0218/KAR0218.github.io';
const commit='743646c9df9ab4c83821b660c12e23a3dda57b49';
const folders=['505','505Gold','672','672A','672L','702','702L','755','755L','900C','900CM','900L','900N','900NA','900NM','900New','G702','G755','G900','Goldhen505','Goldhen672','binloader','g2all','g2allpro','g2allproold','nobd','ps5','restore','restore2'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function get(url,max=8*1024*1024){const r=await fetch(url,{signal:AbortSignal.timeout(60000),headers:{'User-Agent':'whatsite-karo-static-review'}});const b=Buffer.from(await r.arrayBuffer());if(b.length>max)throw Error('Response exceeds evidence bound');return{url,status:r.status,bytes:b.length,sha256:sha(b),data:b};}
async function main(){
 const meta=await get('https://api.github.com/repos/'+repo);if(meta.status!==200)throw Error('Metadata HTTP '+meta.status);const metadata=JSON.parse(meta.data);
 const replies=await Promise.all(['commits/'+metadata.default_branch,'releases?per_page=100','git/trees/'+commit+'?recursive=1'].map(p=>get('https://api.github.com/repos/'+repo+'/'+p)));
 if(replies.some(r=>r.status!==200))throw Error('Metadata request failed');const [head,releases,treeDoc]=replies.map(r=>JSON.parse(r.data));if(treeDoc.truncated)throw Error('Truncated tree');
 const tree=treeDoc.tree.map(({path,sha,size,type})=>({path,sha,size,type})),base=path.join(root,'tmp/karo-review',commit);fs.mkdirSync(base,{recursive:true});
 const report={checkedAt:new Date().toISOString(),repo,commit,upstreamHead:head.sha,branch:metadata.default_branch,license:metadata.license,releases:releases.map(r=>({tag:r.tag_name,url:r.html_url,assets:r.assets.map(a=>({name:a.name,url:a.browser_download_url,bytes:a.size}))})),folders,tree,files:[],method:'Screenshot-pinned tree and original entry/dispatch text only, not a clone or source archive; no code evaluation or console contact.'};
 const selected=tree.filter(f=>f.type==='blob'&&folders.includes(f.path.split('/')[0])&&(/(?:^|\/)(?:index|payloads|config)\.(?:html|js|mjs)$/.test(f.path)||/^(?:LICENSE|COPYING|README)(?:\.|$)/i.test(f.path)));
 let cursor=0;async function worker(){while(cursor<selected.length){const f=selected[cursor++],url='https://raw.githubusercontent.com/'+repo+'/'+commit+'/'+f.path,target=path.join(base,f.path);let r;if(fs.existsSync(target)){const data=fs.readFileSync(target);r={url,status:200,bytes:data.length,sha256:sha(data),data};}else r=await get(url);if(r.status===200){const blob=crypto.createHash('sha1').update(Buffer.from('blob '+r.bytes+'\0')).update(r.data).digest('hex');if(blob!==f.sha||r.bytes!==f.size)throw Error('Pinned Git identity mismatch '+f.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,r.data);}delete r.data;report.files.push({path:f.path,gitBlobSHA1:f.sha,...r});}}
 await Promise.all(Array.from({length:6},worker));report.files.sort((a,b)=>a.path.localeCompare(b.path));fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'source-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({commit,upstreamHead:head.sha,folders:folders.length,entries:report.files.length,releases:releases.length,unavailable:report.files.filter(f=>f.status!==200)}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});module.exports={root,dir,repo,commit,folders,sha,get};
