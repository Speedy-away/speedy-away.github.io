const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const dir='docs/discord-ps4-ps5-raw/platforms/';
const captures=[
 'retribution','forgotten-v1','myten-v1','project-vice','hi-tech-v2','iprofamily','west-toasted','project-concord','ziki-v5','itzjxshdzn','pandora','aspirin-azza','hi-tech-v1','killhitman40-v1','nato-v1','daftvader-legacy','project-goodbye','torqz','project-concord-older','tree-patch-v1','plant-patch','dundee','cabepex-v1-5','yardsale-v6-5','inspiration-v1','ivi40a3fusionz','x2ezyx','ghost-patch-v10'
];
const games=[
 {id:'minecraft',title:'Minecraft: PlayStation 3 Edition',short:'Minecraft',url:'/console/ps3/mods/minecraft/',image:'/assets/images/games/minecraft-legacy.png',aliases:['Minecraft','UltimateCraft','DownCraft','TCM Gang'],summary:'PS3 Minecraft menus with separate source-labelled console variants.'},
 {id:'red-dead-redemption',title:'Red Dead Redemption',short:'Red Dead Redemption',url:'/console/ps3/mods/red-dead-redemption/',image:'/assets/images/game-patches/red-dead-redemption-official.jpg',aliases:['RDR','Red Dead Redemption','Demonic'],summary:'Red Dead Redemption PS3 menu files and source requirements.'},
 {id:'skate-3',title:'Skate 3',short:'Skate 3',url:'/console/ps3/mods/skate-3/',image:'/assets/images/consoles/ps3.png',aliases:['Skate 3','Skate III'],summary:'Skate 3 PS3 menu source, archived files and compatibility requirements.'},
 {id:'dead-rising-2',title:'Dead Rising 2',short:'Dead Rising 2',url:'/console/ps3/mods/dead-rising-2/',image:'/assets/images/consoles/ps3.png',aliases:['Dead Rising 2','Zed Pwn3d'],summary:'Dead Rising 2 PS3 source-listed mods and requirements.'},
 {id:'multicod',title:'Call of Duty multi-game packs',short:'Multicod',url:'/console/ps3/mods/multicod/',image:'/assets/images/covers/cod-black-ops-2.jpg',aliases:['Multicod','multi COD','Jimbo','MatrixMods'],summary:'PS3 multi-game archives with separate DEX and HEN build labels.'},
 {id:'cod4',parent:'call-of-duty',title:'Call of Duty 4: Modern Warfare',short:'COD4',url:'/console/ps3/mods/call-of-duty/cod4/',image:'/assets/images/covers/cod4.jpg',aliases:['COD4','COD 4','Call of Duty 4','Modern Warfare 2007'],summary:'COD4 PS3 SPRX, campaign and patch menus from captured forum posts.'},
 {id:'world-at-war',parent:'call-of-duty',title:'Call of Duty: World at War',short:'World at War',url:'/console/ps3/mods/call-of-duty/world-at-war/',image:'/assets/images/custom-mod-art/mods-ps3.jpg',aliases:['WAW','World at War','COD5','Nazi Zombies'],summary:'World at War PS3 SPRX, zombie patches and multiplayer menu archives.'},
 {id:'modern-warfare-2',parent:'call-of-duty',title:'Call of Duty: Modern Warfare 2 (2009)',short:'MW2 (2009)',url:'/console/ps3/mods/call-of-duty/modern-warfare-2/',image:'/assets/images/covers/cod-mw2-2009.jpg',aliases:['MW2','MW2 2009','Modern Warfare 2','Spec Ops','Oldschool'],summary:'MW2 PS3 SPRX, patch, Oldschool and campaign resources with their source build labels.'}
];
const guideExtras={
 'retribution':{compatibility:'Source archive labelled CFW; exact title update and region not specified.',guideBlocks:[{type:'steps',title:'Archive readme: installation',items:[{title:'Preserve original files',text:'Keep a copy of the game’s existing EBOOT.BIN and confirm the correct game directory and build.'},{title:'Copy the documented files',text:'Place Retribution.sprx in /dev_hdd0/tmp/ and the supplied EBOOT.BIN in the matching Modern Warfare USRDIR directory.'}]},{type:'list',title:'Readme controls',items:['Host menu: L1 + R3 opens; X selects; R1/L1 scroll; Square goes back.','Non-host menu: D-pad Left opens; Square selects; L2/R2 scroll; Circle goes back.']}]},
 'forgotten-v1':{compatibility:'Archive includes separately labelled CEX, DEX and HEN EBOOT variants and CFW/HEN SPRX folders. Match the pair to your system; firmware and game update are unspecified.',tags:['CEX','DEX','HEN','CFW'],guideBlocks:[{type:'steps',title:'Archive readme: Forgotten V1',items:[{title:'Choose the matching build',text:'Preserve the original EBOOT.BIN. Use the labelled CEX, DEX or HEN EBOOT and the corresponding CFW or HEN SPRX folder.'},{title:'Display and file destinations',text:'The readme requires 1280 × 720 display resolution. The EBOOT goes in /dev_hdd0/game/yourgame/USRDIR/ and cod4_Forgotten.sprx goes in /dev_hdd0/tmp/.'},{title:'Open',text:'The readme gives L1 + Knife as the menu shortcut.'}]},{type:'text',title:'Known issue in the readme',text:'Using the menu keyboard to change a name can leave the keyboard stuck when changing a clan tag in the pregame lobby.'}]},
 'myten-v1':{description:'Myten v1 campaign archive, ported to PS3 by killhitman40. Static archive inspection found code_post_gfx.ff and common.ff; no installation readme was supplied.',guideBlocks:[{type:'text',title:'Archive contents and requirements',text:'The captured ZIP contains code_post_gfx.ff and common.ff. The source does not specify a title ID, game update, firmware build or installation destination. Confirm those requirements before replacing game files and preserve the originals.'}]}
};
// This list is explicit: temporary forum observations never become resource cards.
const posts=captures.flatMap(name=>{
 const capture='ps3-cod4-'+name,file=path.join(root,dir+capture+'.json');
 if(!fs.existsSync(file))return [];
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 const sprx=['retribution','forgotten-v1'].includes(name);
 return [{id:'discord-'+capture,capture,title:data.postTitle,gameId:'cod4',category:sprx?'sprx':'script',tags:[name==='myten-v1'?'Campaign':sprx?'SPRX':'Patch menu'],...(name==='myten-v1'?{filename:'COD4-Myten-v1.zip'}:{}),...(name==='daftvader-legacy'?{note:'The source explicitly states “Download: N/A”. No replacement download has been substituted.'}:{}),...(guideExtras[name] || {})}];
});
for(const capture of ['ps3-waw-nightfire','ps3-waw-external-3','ps3-waw-paradise','ps3-waw-zm-citius-album','ps3-waw-zm-coolbunny-3-9-newer','ps3-waw-zm-elasticity-v1','ps3-waw-zm-mindfxcked-v1','ps3-waw-zm-coolbunny-3-9-older','ps3-waw-zm-infinity-v1-2','ps3-waw-zm-project-sunny','ps3-waw-zm-sphinx-v2','ps3-waw-zm-predator-v1','ps3-waw-zm-toxiicity-v1','ps3-waw-zm-alpatch','ps3-waw-zm-devil-modz-v2','ps3-waw-zm-devils-revote','ps3-waw-zm-green-diamond','ps3-waw-zm-physics-flex-v2','ps3-waw-zm-discarded-v2','ps3-waw-zm-discarded-v3','ps3-waw-zm-discarded-v4']){
 const file=path.join(root,dir+capture+'.json');if(!fs.existsSync(file))continue;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 posts.push({id:'discord-'+capture,capture,title:data.postTitle,gameId:'world-at-war',gameName:'World at War',category:capture.includes('-zm-')?'script':'sprx',tags:[capture.includes('-zm-')?'Zombies':'SPRX']});
}
for(const name of ['cloud-v7','sub-patch','soooo-stooooned','so-simple','hostermodz-v10','forflah-v3','forflah-v2','forflah','jamey-karoolus','project-intoxicated','swa-v1','lace-patch','caked-up-2-5','revolution','killhitman40-v3-newer','killhitman40-v3-older','purple-water-v1','devil-modz-v2-2','demonic-v3','vortexgaming','hidden-gold-v5-newer','hidden-gold-v5-older','purple-kush-v4','purple-kush-v3','purple-kush-v2','killsagain-v2','hazard-zone-v5','imsnayxohd-v1','project-trinity','hidden-gold-v3','hidden-gold-v4-1','bzh35','xraw-v5']){
 const capture='ps3-waw-mp-'+name,file=path.join(root,dir+capture+'.json');if(!fs.existsSync(file))continue;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));posts.push({id:'discord-'+capture,capture,title:data.postTitle,gameId:'world-at-war',gameName:'World at War',category:'script',tags:['Multiplayer','Patch menu']});
}
for(const name of ['stimulus-v1-1','xclickymodz','snow-engine','matrix-nonhost','superman-v1','ressurection','parallax','matrix-azza-v1','superman-v3','rewind-v1','superman-v2','marshal-v1','myster-cheats-v2','elite-bot','fury-v2','atlantic','supremacy-v5','inphect-package','dank-superman','bonk-croissant','zircon-1-5','teh1337','hestia','nightmare','cylerem','infinity-v1','insidious-v2','paradox-v4','ob','fierce','black-ice-v2','matrix-azza-v1-older','myster-cheats-v2-older','atlantic-older','matrix-azza-v2','asp-engine','insanity','marshal-v1-older','reflex-engine-2-5','insidious-v1','superman-v1-older','zerotwo-v3','paradise-v1-4','darkks-package','inphect-package-older','tactic','cotton-candy','synergy','shake','parallax-older']){
 const capture='ps3-mw2-'+name,file=path.join(root,dir+capture+'.json');if(!fs.existsSync(file))continue;
 const data=JSON.parse(fs.readFileSync(file,'utf8')),label=data.postTitle.match(/\[(CFW(?:\/HEN)?)\]/)?.[1];
 posts.push({id:'discord-'+capture,capture,title:data.postTitle,gameId:'modern-warfare-2',gameName:'Modern Warfare 2',category:'sprx',version:data.postTitle.match(/\bv\d+(?:\.\d+)*/i)?.[0] || '',...(label?{compatibility:label+' labelled source. Exact firmware, region and game update not specified.',tags:label.split('/')}:{})});
}
const approvedLog=path.join(root,dir+'reviewed-posts-log.json');
if(fs.existsSync(approvedLog))for(const entry of JSON.parse(fs.readFileSync(approvedLog,'utf8'))){
 if(entry.collection!=='ps3' || posts.some(post=>post.capture===entry.capture))continue;
 const capture=JSON.parse(fs.readFileSync(path.join(root,dir+entry.capture+'.json'),'utf8'));
 if(capture.postTitle!==entry.title || !capture.postUrl)throw Error('Reviewed capture changed: '+entry.capture);
 posts.push(entry);
}
fs.writeFileSync(path.join(root,dir+'ps3-reviewed-posts.json'),JSON.stringify({games,posts},null,2)+'\n');
console.log('Prepared '+posts.length+' reviewed PS3 capture references.');
