const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'docs/discord-ps4-ps5-raw/platforms');
function postCards(tree){return [...tree.split('\nDocument text:')[0].matchAll(/(\d+) button Post (.+), (\d+) messages?\b/g)].map(match=>({index:Number(match[1]),title:match[2],replies:Number(match[3])}));}
function audit(prefix){
 if(!/^[a-z0-9-]+$/.test(prefix))throw Error('Use a captured filename prefix');
 const counts=new Map(),replies=new Map();
 for(const name of fs.readdirSync(directory).filter(name=>name.startsWith(prefix)&&name.endsWith('.ax.txt'))){
  const perView=new Map();
  for(const post of postCards(fs.readFileSync(path.join(directory,name),'utf8'))){perView.set(post.title,(perView.get(post.title)||0)+1);replies.set(post.title,Math.max(replies.get(post.title)||0,post.replies));}
  for(const [title,count] of perView)counts.set(title,Math.max(counts.get(title)||0,count));
 }
 const registry=JSON.parse(fs.readFileSync(path.join(directory,'ps3-reviewed-posts.json'),'utf8'));
 const log=path.join(directory,'reviewed-posts-log.json');
 if(fs.existsSync(log))for(const spec of JSON.parse(fs.readFileSync(log,'utf8')))if(!registry.posts.some(existing=>existing.capture===spec.capture))registry.posts.push(spec);
 const read=new Map();
 for(const spec of registry.posts.filter(spec=>spec.capture.startsWith(prefix))){
  const record=JSON.parse(fs.readFileSync(path.join(directory,spec.capture+'.json'),'utf8'));
  if(!record.postUrl || record.postTitle!==spec.title)continue;
  if(!read.has(record.postTitle))read.set(record.postTitle,new Set());read.get(record.postTitle).add(record.postUrl);
 }
 // Deleted original posts are retained as unavailable references with their captured permalink.
 const overlay=JSON.parse(fs.readFileSync(path.join(root,'docs/discord-ps3-resources.json'),'utf8'));
 for(const item of overlay.resources.filter(item=>item.id.startsWith('discord-'+prefix)&&item.tags?.includes('Deleted source'))){if(!read.has(item.name))read.set(item.name,new Set());read.get(item.name).add(item.source);}
 const missing=[...counts].filter(([title,count])=>(read.get(title)?.size || 0)<count).map(([title,observed])=>({title,observed,read:read.get(title)?.size || 0,replies:replies.get(title)}));
 return {prefix,observedPosts:[...counts.values()].reduce((sum,count)=>sum+count,0),reviewedPosts:[...read.values()].reduce((sum,urls)=>sum+urls.size,0),missing,scope:'Observed cards only; reaching the final forum page is verified separately.'};
}
if(require.main===module){const prefix=process.argv.find(arg=>arg.startsWith('--prefix='))?.slice(9);if(!prefix)throw Error('Supply --prefix=ps3-mw2');console.log(JSON.stringify(audit(prefix),null,2));}
module.exports={postCards,audit};
