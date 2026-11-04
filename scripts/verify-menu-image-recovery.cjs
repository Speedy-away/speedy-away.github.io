const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),media=require('./console-menu-media.cjs').createMenuMedia({root});
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(dir+'/'+d.name):d.name.endsWith('.html')?[dir+'/'+d.name]:[]);}
const files=[...walk('console/ps3/mods'),...walk('console/xbox360/mods'),...walk('console/mods/ps4'),...walk('console/ps5/game-cheats'),'console/ps3/desktop-tools.html','console/ps3/mods.html','console/xbox360/mods.html','console/ps5/mods.html','console/ps5/game-cheats.html'];
const report={checkedAt:new Date().toISOString(),pages:files.length,localImages:0,cards:0,brokenImages:[],cardsWithoutImages:[],sourceCoverage:{},hashFailures:[]};
for(const file of files){
 const html=fs.readFileSync(path.join(root,file),'utf8');
 for(const match of html.matchAll(/<img\b[^>]*src="([^"#?]+)[^"]*"/g)){
  const src=match[1];if(!src.startsWith('/'))continue;report.localImages++;
  if(!fs.existsSync(path.join(root,'.'+decodeURIComponent(src))))report.brokenImages.push({file,src});
 }
 for(const match of html.matchAll(/<article\b[^>]*class="[^"]*\bguide-resource\b[^>]*>[\s\S]*?<\/article>/g)){
  report.cards++;if(!/<img\b/.test(match[0]))report.cardsWithoutImages.push({file,id:match[0].match(/\bid="([^"]+)"/)?.[1]});
 }
}
for(const platform of ['ps3','xbox360']){
 const resources=[...read(`docs/discord-${platform}-resources.json`).resources,...(platform==='xbox360'?read('docs/xbox360-mod-resources.json').resources:[])];
 const unavailable=[];
 for(const item of resources){const image=media.forItem(item);if(!image){unavailable.push({id:item.id,status:item.status,source:item.source});continue;}
  const bytes=fs.readFileSync(path.join(root,'.'+image.path));if(crypto.createHash('sha256').update(bytes).digest('hex')!==image.sha256)report.hashFailures.push(item.id);
 }
 report.sourceCoverage[platform]={resources:resources.length,verifiedPreviews:resources.length-unavailable.length,unavailable};
}
fs.writeFileSync(path.join(root,'docs/qa/menu-image-recovery-final.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.brokenImages.length||report.cardsWithoutImages.length||report.hashFailures.length)process.exitCode=1;
