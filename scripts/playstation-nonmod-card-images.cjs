// Targeted media repair for existing PlayStation tool cards. Never edits actions.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const rules={
 'console/ps3/cfw.html':{'PS3 OFW · official firmware':['/assets/images/consoles/ps3.png','PlayStation 3 console artwork'],'PS3 CFW · custom firmware':['/assets/images/consoles/ps3.png','PlayStation 3 console artwork']},
 'console/ps3/jailbreaks.html':{'PS3 OFW · official firmware':['/assets/images/consoles/ps3.png','PlayStation 3 console artwork'],'PS3 CFW · custom firmware':['/assets/images/consoles/ps3.png','PlayStation 3 console artwork']},
 'console/ps3/downloads.html':{'PS3 OFW · official firmware':['/assets/images/consoles/ps3.png','PlayStation 3 console artwork'],'PS3 CFW · custom firmware':['/assets/images/consoles/ps3.png','PlayStation 3 console artwork'],'Desktop RTM helpers':['/assets/images/menu-previews/ps3-base/project-safe-candidate-XGKwgja1B00.jpg','Example PS3 desktop RTM helper: Project Safe source showcase']},
 'console/ps4/emulators.html':{'Resonance · Dreamcast':['/assets/images/xbox-one-series/flycast.png','Flycast upstream emulator logo; Resonance is its PS4 port']},
 'console/ps5/emulators.html':{'PSFlycast · Dreamcast':['/assets/images/xbox-one-series/flycast.png','Flycast upstream emulator logo; PSFlycast is its PS5 port']},
 'console/ps5/relapse.html':{'etaHEN':['/assets/images/console-software/etahen.jpg','Official etaHEN project artwork']},
 'console/ps5/y2jb.html':{'Y2JB Installer':['/assets/images/console-software/y2jb-installer-official.png','Official Y2JB Installer app icon'],'itsPLK Autoloader':['/assets/images/console-software/y2jb-autoloader-official.png','Official itsPLK Y2JB Autoloader screenshot; source v0.5 interface reference']},
 'console/ps5/themes.html':{'etaHEN plugin':['/assets/images/console-software/ps5-themes-official.png','Official PS5 Themes project icon'],'Standalone ELF':['/assets/images/console-software/ps5-themes-official.png','Official PS5 Themes project icon']}
};
const exceptions=[
 {file:'console/ps5/relapse.html',title:'DNS tool',reason:'The supplied archive has no verified tool identity or project-specific image. Its download and setup explanation remain text-only.'},
 {file:'console/ps5/y2jb.html',title:'Maj0r’s Y2JB',reason:'This is the original userland entry-point code and manual-reference card. The project repository contains no images; the different itsPLK autoloader screenshot is not substituted.'},
 {file:'console/ps5/themes.html',title:'Recovery stop ELF',reason:'Headless emergency-stop action with no interface. Keeping its recovery explanation text-only distinguishes it from launching the theme manager.'}
];
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function decorate(file,html,added=[]){
 const mapping=rules[file];if(!mapping)return html;
 return html.replace(/(<article\b[^>]*class="[^"]*\bguide-resource\b[^"]*"[^>]*>)([\s\S]*?)(<\/article>)/g,(all,open,body,close)=>{
  if(/<img\b/.test(body))return all;
  const title=body.match(/<h3\b[^>]*>(.*?)<\/h3>/)?.[1];const image=mapping[title];if(!image)return all;
  const local=path.join(root,'.'+image[0]);if(!fs.existsSync(local))throw Error('Missing image '+image[0]);
  const bytes=fs.readFileSync(local);added.push({file,title,image:image[0],alt:image[1],bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  return open+`<img src="${esc(image[0])}" alt="${esc(image[1])}" loading="lazy" decoding="async" data-playstation-resource-image>`+body+close;
 });
}
function repairFiles(files=Object.keys(rules)){
 const added=[],changedPages=[];
 for(const file of files){const target=path.join(root,file);if(!fs.existsSync(target))continue;const before=fs.readFileSync(target,'utf8'),after=decorate(file,before,added);if(after!==before){if(after.replace(/<img\b[^>]*data-playstation-resource-image[^>]*>/g,'')!==before.replace(/<img\b[^>]*data-playstation-resource-image[^>]*>/g,''))throw Error('Non-media change '+file);fs.writeFileSync(target,after);changedPages.push(file);}}
 return {added,changedPages};
}
if(require.main===module){const result=repairFiles();const report={checkedAt:new Date().toISOString(),...result,exceptions,summary:{cardsInspected:17,imagesAdded:result.added.length,pagesChanged:result.changedPages.length,deliberateTextOnly:exceptions.length,newBinaryDownloads:0},validation:'Removed inserted image tags and verified all pre-existing page bytes unchanged.'};fs.writeFileSync(path.join(root,'docs/qa/playstation-nonmod-card-image-repair.json'),JSON.stringify(report,null,2)+'\n');console.log(report.summary);}
module.exports={rules,exceptions,decorate,repairFiles};
