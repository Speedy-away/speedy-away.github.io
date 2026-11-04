// Add media only; retain every current page's actions, metadata and shared edits.
const fs=require('node:fs'),path=require('node:path');
const art=require('./ps4-ps5-card-images.cjs');
const root=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(dir+'/'+d.name):d.name.endsWith('.html')?[dir+'/'+d.name]:[]);}
function repair(){
 const files=[...walk('console/mods/ps4'),...walk('console/ps5/game-cheats'),'console/ps5/mods.html','console/ps5/game-cheats.html'];
 const report={checkedAt:new Date().toISOString(),scope:'PS4/PS5 mod catalogue, menu directory and native PS5 cheat cards',newBinaryDownloads:0,changedPages:[],addedImages:[],unresolved:[],brokenImages:[]};
 for(const file of files){
  const full=path.join(root,file),before=fs.readFileSync(full,'utf8');
  const pageGame=art.games.find(g=>file===`console/mods/ps4/${g.slug}/index.html`||file===`console/mods/ps4/call-of-duty/${g.slug}/index.html`);
  const ps5Slug=file.match(/^console\/ps5\/game-cheats\/([^/]+)\//)?.[1];
  const after=before.replace(/(<article\b[^>]*class="[^"]*\bguide-resource\b[^"]*"[^>]*>)([\s\S]*?)(<\/article>)/g,(all,open,body,close)=>{
   if(/<img\b/.test(body))return all;
   const title=body.match(/<h[234]\b[^>]*>(.*?)<\/h[234]>/)?.[1]||'';
   const id=open.match(/\bid="resource-([^"]+)"/)?.[1]||body.match(/href="[^"]*#(?:guide|resource)-([^"]+)/)?.[1];
   const catalogGame=open.match(/data-catalog-game="([^"]+)"/)?.[1];
   let item=id?art.resources.find(r=>r.id===id.replace(/-legacy$/,'')):null;
   let image=item?art.resourceImage(item):null;
   // MultiCOD cards prefer the original preview of their game-specific mapping.
   if(!image&&open.includes('multicod-card')&&pageGame){
    const families=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-multicod.json'),'utf8')).families;
    const family=families.find(f=>f.title===title);
    const mapping=family?.games.find(g=>g.gameId===pageGame.id);
    item=mapping&&art.resources.find(r=>r.id===mapping.resourceId);
    if(item)image=art.resourceImage(item);
   }
   const source=image?.src||art.gameImage(catalogGame)||art.gameImage(pageGame?.id)||art.gameImage(ps5Slug)||art.gameImage(null,title.replaceAll('&amp;','&'));
   if(!art.exists(source)){report.unresolved.push({file,title});return all;}
   image||={src:source,alt:(pageGame?.title||title.replaceAll('&amp;','&'))+' artwork',kind:'artwork'};
   report.addedImages.push({file,title,image:image.src,kind:image.kind});
   return open+art.markup(image)+body+close;
  });
  if(after!==before){fs.writeFileSync(full,after);report.changedPages.push(file);}
  for(const m of after.matchAll(/<img\b[^>]*src="(\/assets\/images\/[^"?#]+)"/g))if(!art.exists(m[1]))report.brokenImages.push({file,image:m[1]});
 }
 report.summary={pagesChecked:files.length,pagesChanged:report.changedPages.length,imagesAdded:report.addedImages.length,unresolved:report.unresolved.length,brokenImages:report.brokenImages.length};
 fs.writeFileSync(path.join(root,'docs/qa/ps4-ps5-card-image-repair.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report.summary));return report;
}
if(require.main===module)repair();
module.exports={repair};
