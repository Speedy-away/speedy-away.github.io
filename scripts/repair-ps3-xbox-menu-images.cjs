// Replace card media only: preserve current downloads, compatibility and shared edits.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const media=require('./console-menu-media.cjs').createMenuMedia({root});
const items=new Map(['ps3-mod','discord-ps3','discord-xbox360','xbox360-mod'].flatMap(name=>JSON.parse(fs.readFileSync(path.join(root,'docs',name+'-resources.json'),'utf8')).resources).map(item=>[item.id,item]));
const legacyXbox=JSON.parse(fs.readFileSync(path.join(root,'docs/xbox360-mod-resources.json'),'utf8')).resources;
const gameTitles=new Map([...require('./build-ps3-catalog.cjs').games,...JSON.parse(fs.readFileSync(path.join(root,'docs/discord-xbox360-resources.json'),'utf8')).games].map(game=>[game.id,game.title]));
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(dir+'/'+item.name):item.name.endsWith('.html')?[dir+'/'+item.name]:[]);}
const files=[...walk('console/ps3/mods'),...walk('console/xbox360/mods'),'console/ps3/desktop-tools.html','console/ps3/mods.html','console/xbox360/mods.html'];
const report={checkedAt:new Date().toISOString(),scope:'PS3 and Xbox 360 menu card media only',changedPages:[],changedCards:0,resources:[]};
const seen=new Set();
for(const file of files){
 const full=path.join(root,file);if(!fs.existsSync(full))continue;
 const before=fs.readFileSync(full,'utf8');
 const after=before.replace(/(<article\b[^>]*>)([\s\S]*?)(<\/article>)/g,(all,open,body,close)=>{
  const id=open.match(/\bid="([^"]+)"/)?.[1]||(file==='console/xbox360/mods/call-of-duty/cod4/index.html'?legacyXbox.find(item=>body.includes('<h3>'+item.name+'</h3>'))?.id:null),item=items.get(id);
  if(!item||!media.forItem(item))return all;
  const old=body.match(/<figure\b[^>]*class="menu-preview"[^>]*>[\s\S]*?<\/figure>/)?.[0];
  const figure=media.figure(item,undefined,gameTitles.get(item.gameId||item.gameIds?.[0]));
  if(!figure)return all;
  let next=old?body.replace(old,figure):figure+body;
  // The source note belongs in the existing Guide panel.
  const note=media.details(item);
  if(/<p class="menu-preview-note">[\s\S]*?<\/p>/.test(next))next=next.replace(/<p class="menu-preview-note">[\s\S]*?<\/p>/,note);
  else if(note&&next.includes('data-guide-panel'))next=next.replace(/(<section\b[^>]*data-guide-panel[^>]*>)/,'$1'+note);
  const output=open+next+close;
  if(output!==all){report.changedCards++;seen.add(id);}
  return output;
 });
 const withoutMedia=html=>html.replace(/<figure\b[^>]*class="menu-preview"[^>]*>[\s\S]*?<\/figure>/g,'').replace(/<p class="menu-preview-note">[\s\S]*?<\/p>/g,'');
 if(withoutMedia(before)!==withoutMedia(after))throw Error('Non-media content changed: '+file);
 if(after!==before){fs.writeFileSync(full,after);report.changedPages.push(file);}
}
report.resources=[...seen];
fs.writeFileSync(path.join(root,'docs/qa/ps3-xbox-menu-image-repair.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({changedPages:report.changedPages.length,changedCards:report.changedCards,resources:seen.size}));
