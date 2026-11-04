const fs=require('node:fs'),path=require('node:path');
const {section,grid,link,ext,steps}=require('./build-console-guides.cjs');
const root=path.resolve(__dirname,'..'),base='/console/retro/wii/';
const navigation=[['super-smash-bros-brawl','Super Smash Bros. Brawl'],['super-mario-galaxy','Super Mario Galaxy'],['super-mario-galaxy-2','Super Mario Galaxy 2']].map(([slug,title])=>[base+slug+'.html',title]);
function catalog(){const file=path.join(root,'docs/wii-brawl-galaxy-catalog.json');return fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).entries:[];}
function hubCards(){return navigation.map(([url,title],i)=>`<article class="guide-resource"><img src="/assets/images/wii-brawl-galaxy/${['project-plus.webp','galaxy-daredevil.webp','neo.webp'][i]}" alt="${title} mod project artwork" loading="lazy"><h3>${title}</h3><p>${['Project+ and Brawl Minus console builds, with separate SD setups and NTSC-U game requirements.','Daredevil Mode and Super Lillie Galaxy, with disc regions, save choices and performance notes.','Neo Mario Galaxy, The New Green Stars and Daredevil Mode, with Riivolution and save setup.'][i]}</p><div class="guide-links">${link(url,'Mods, downloads & setup')}</div></article>`);}
function build({render,library,entries,note}){
 const riivolution=entries.find(x=>x.id==='riivolution');
 const galaxySteps=steps([
  ['Match the original game','Galaxy uses <code>RMG</code>; Galaxy 2 uses <code>SB4</code>. Use the region supported by the selected patch. A Galaxy 2 mod does not patch the first game.'],
  ['Prepare Homebrew Channel and Riivolution','Use your model’s maintained homebrew guide. Extract the Riivolution ZIP so <code>/apps/riivolution/boot.elf</code> is on FAT32 SD. These patches use an original disc.'],
  ['Extract the complete mod','Use a PC/phone archive tool for ZIP or 7z. Copy the mod’s data folder and its <code>riivolution</code> folder to SD root, preserving names. Keep an independent backup before copying files.'],
  ['Choose saves before launch','Back up the game save first. For Daredevil, choose <strong>With SD save</strong> to keep the mod’s redirected save separate; <strong>With Wii save</strong> uses the console save. New Green Stars deliberately replaces progress with a 120-star start.'],
  ['Launch one overhaul','Insert the matching game disc, launch Riivolution from Homebrew Channel, enable the selected mod and disable other overhauls. Select the mod’s supported language and save options, then Launch.']
 ]);
 const help=`<div class="guide-links">${ext('https://wii.hacks.guide/get-started.html','Model-specific homebrew setup')}${ext('https://riivolution.github.io/wiki/Riivolution/','Riivolution installation')}${link(base+'online.html','Wii online services')}</div>`;
 render('super-smash-bros-brawl','Super Smash Bros. Brawl Mods','Project+ and Brawl Minus Wii console downloads, original-game requirements, SD preparation and launch guides.','/assets/images/wii-brawl-galaxy/project-plus.webp',
  section('start','Choose a Brawl overhaul',note+`<p>Use one complete mod distribution on a dedicated SD setup. These console packages are separate from Dolphin netplay builds. Keep the original Brawl save, stage data and each mod’s files backed up.</p>`)+
  section('setup','Brawl · console setup',steps([
   ['Check the disc','The packages target NTSC-U Super Smash Bros. Brawl, <code>RSBE01</code>. Do not rename a PAL/Japanese game ID to make it look compatible.'],
   ['Prepare a separate SD card','Extract the selected console package. For Project+, open its outer Project+ v3.2.1 (Wii Lite) folder and copy the apps, Project+ and private folders to SD root. For Minus, open Brawl Minus v5.1.5 Console and copy its contents to SD root. Keep each launcher and its mod data together. Project+ Lite is the full Wii gameplay release with compressed music for a 2 GB SD card; allow space beyond the ZIP size.'],
   ['Use the included launcher','With Homebrew Channel already working, launch that mod’s supplied app with the matching disc inserted. Follow its packaged instructions for its disc route. Hackless and USB methods have different storage requirements; use the linked official guide for those routes.'],
   ['Update as a complete package','Keep the previous SD contents backed up. Brawl Minus 5.1.5 requires a fresh download; the creator says it cannot auto-update from 5.1. Do not combine files from Project+, Minus or older releases.']
  ])+`<div class="guide-links">${ext('https://projectplusgame.com/faq','Project+ hardware and method matrix')}${ext('https://projectplusgame.com/download','Project+ downloads and guides')}${ext('https://forums.brawlminus.net/threads/brawl-minus-5-1-5-is-here.1691/','Brawl Minus release instructions')}</div>`)+
  section('online','Brawl · online play',`<p>For the original game, see the supported Wiimmfi disc/DNS methods and current service compatibility. Do not use an overhaul against unmodified Brawl players. The publishers’ Dolphin netplay packages are separate PC builds and are not included here.</p>${link(base+'online.html#wiimmfi-dns','Wiimmfi disc and DNS setup')}`)+library(entries.filter(x=>x.group==='Super Smash Bros. Brawl')));
 for(const [slug,game,title,image,intro]of [
  ['super-mario-galaxy','Super Mario Galaxy','Super Mario Galaxy Mods','galaxy-daredevil.webp','Daredevil Mode changes the original Galaxy challenge rules. Super Lillie Galaxy replaces characters and adds visual, dialogue and music changes; its creator recommends Dolphin because Toy Time Galaxy can lag substantially on Wii.'],
  ['super-mario-galaxy-2','Super Mario Galaxy 2','Super Mario Galaxy 2 Mods','neo.webp','Neo Mario Galaxy supplies a new adventure. The New Green Stars changes star locations and deliberately starts from modified progress. Daredevil Mode adds a separate difficulty challenge.']
 ])render(slug,title,game+' mod downloads, verified region selectors, Riivolution setup and save requirements.','/assets/images/wii-brawl-galaxy/'+image,
  section('start','Choose your Galaxy mod',note+`<p>${intro}</p><p><strong>Offline adventures:</strong> these mods do not add network multiplayer.</p>`)+section('setup','Riivolution · step by step',galaxySteps+help)+library([...entries.filter(x=>x.group===game),...(riivolution?[riivolution]:[])],'Game patches & required launcher'));
}
module.exports={navigation,catalog,hubCards,build};
