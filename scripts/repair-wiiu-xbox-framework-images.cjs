// Image-only edits: retain existing shared page content and download routes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const xbox=JSON.parse(fs.readFileSync(path.join(root,'docs/xbox-framework-image-provenance.json'))).images;
const images={
 'Pretendo Network':'/assets/images/wiiu-homebrew/Inkay.png',
 'Already on vWii?':'/assets/images/wiiu-homebrew/evWii.png',
 'Wrong network or no connection':'/assets/images/wiiu-homebrew/Inkay.png',
 'Account and save data':'/assets/images/wiiu-homebrew/SaveMiiProcessMod.png',
 'Return to the original network':'/assets/images/wiiu-homebrew/Inkay.png',
 'Second Wind · Breath of the Wild':'/assets/images/wiiu-homebrew/second-wind-quest.png',
 'Wii game matchmaking':'/assets/images/wii-games-online/wiimmfipatcher.png',
 'Mario Kart Wii · CTGP-R':'/assets/images/wii-games-online/ctgp-revolution.png',
 'Native Wii U games':'/assets/images/wiiu-homebrew/Inkay.png',
 "mkwcat's NSMBW project":'/assets/images/wiiu-games-batch2/vwii-riivolution.png'
};
const files=['console/wiiu/mods.html','console/wiiu/online.html','console/wiiu/vwii.html','console/wiiu/game-downloads.html','console/xbox-one-series/dependencies.html','console/xbox-one-series.html'];
const links=html=>[...html.matchAll(/\b(?:href|data-original-href|data-sha256)="[^"]*"/g)].map(x=>x[0]);
const changed=[];
for(const file of files){
 const target=path.join(root,file);if(!fs.existsSync(target))continue;
 const original=fs.readFileSync(target,'utf8');let added=0;
 const html=original.replace(/<article\b[^>]*>[\s\S]*?<\/article>/g,article=>{
  if(/<img\b/i.test(article))return article;
  const title=(article.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1]||'').replace(/<[^>]*>/g,'').replaceAll('&amp;','&');
  const framework=file.includes('xbox-one-series')?xbox.find(x=>article.includes(x.packageSha256)):null;
  const image=framework?.image||images[title];if(!image)return article;
  if(!fs.existsSync(path.join(root,'.'+image)))throw Error('Missing artwork '+image);
  const alt=framework?title+' package logo':title==="mkwcat's NSMBW project"?'Riivolution patch loader icon':title==='Second Wind · Breath of the Wild'?'Second Wind expansion project logo':title.includes('Pretendo')||title==='Wrong network or no connection'||title==='Return to the original network'||title==='Native Wii U games'?'Inkay Pretendo plugin icon':title==='Already on vWii?'?'evWii plugin icon':title==='Account and save data'?'SaveMii save backup tool icon':title==='Wii game matchmaking'?'Wiimmfi patcher icon':'CTGP Revolution project icon';
  const img=`<img${framework?' class="xbox-framework-icon"':''} src="${image}" alt="${alt}" loading="lazy"${framework?' width="48" height="48" style="width:48px;height:48px;object-fit:contain"':''}>`;
  added++;return article.replace(/^(<article\b[^>]*>)/,'$1'+img);
 });
 if(JSON.stringify(links(html))!==JSON.stringify(links(original)))throw Error('Link mutation '+file);
 if(html!==original)fs.writeFileSync(target,html);
 changed.push({file,imagesAdded:added});
}
const logo=path.join(root,'assets/images/wiiu-homebrew/second-wind-quest.png'),bytes=fs.readFileSync(logo);
const report={checkedAt:new Date().toISOString(),changed,totalAdded:changed.reduce((n,x)=>n+x.imagesAdded,0),exceptions:[],verification:'Existing source/download/checksum links preserved byte-for-byte. All added image paths exist. Package logos extracted as data; no packages executed.',secondWindArtwork:{image:'/assets/images/wiiu-homebrew/second-wind-quest.png',sourcePage:'https://gamingreinvented.com/interview/lets-interview-the-dev-team-for-botw-second-wind/',sourceImage:'https://gamingreinvented.com/wp-content/uploads/2022/03/SecondWindQuest.png',kind:'Original expansion logo used by developer interview; not a compatibility screenshot',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
fs.writeFileSync(path.join(root,'docs/qa/wiiu-xbox-framework-image-repair.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
