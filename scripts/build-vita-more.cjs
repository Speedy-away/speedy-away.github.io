const fs=require('node:fs');
const path=require('node:path');
const {page,section,steps,note,ext,link,esc}=require('./build-console-guides.cjs');
const root=path.resolve(__dirname,'..');
const catalogue=require('../docs/vita-more-catalogue.json');
const jobs=require('../docs/vita-more-jobs.json');
const metadata=require('../docs/vita-more-files.json');
const file='console/psvita/library.html';
const size=n=>n<1048576?(n/1024).toFixed(1)+' KiB':(n/1048576).toFixed(1)+' MiB';
function card(item){
 const job=jobs.items.find(x=>x.id===item.id),ready=metadata.items.find(x=>x.id===item.id);
 if(!job||!ready?.files.length)throw Error('Missing archived files: '+item.id);
 const files=ready.files;
 const formats=[...new Set(files.map(f=>f.verification.format))];
 const image=ready.image;const screenshot=ready.screenshot;
 const downloads=files.map(f=>{
  const type=f.name==='ioplus.skprx'?'Required dependency':f.name==='reVitaMotion.suprx'?'Optional gyro module':f.derivedFrom?'Install VPK':f.verification.format==='VPK'?'Install VPK':item.id==='minimal-theme'?'Theme ZIP':f.verification.format==='ZIP'?'Data ZIP':f.verification.format==='7Z'?'Original Vita archive':'Download '+f.verification.format;
  return `<a href="${esc(f.local)}" download data-original-href="${esc(f.sourceUrl)}"><span>${type} · ${esc(f.name)}</span><small>${size(f.bytes)} ↓</small></a>`;
 }).join('');
 return `<article class="vita-item" id="${item.id}" data-vita-item data-category="${job.category}" data-formats="${formats.join(' ')}" data-search="${esc([job.title,job.author,job.version,job.category,item.kind,item.summary,item.models,item.prerequisites,item.data,...item.paths,...formats].join(' ').toLowerCase())}">
 <div class="vita-item-header">${image?`<img src="${image.local}" alt="${esc(job.title)} · official artwork" width="76" height="76" loading="lazy">`:''}<div><span class="vita-kicker">${esc(item.kind)}</span><h3><a href="#${item.id}">${esc(job.title)}</a></h3><div class="vita-version">${esc(job.version)}</div></div></div>
 <ul class="vita-tags"><li>Native Vita</li>${formats.map(f=>`<li>${f}</li>`).join('')}<li>${esc(job.category)}</li></ul>${screenshot?`<img class="vita-preview" src="${screenshot.local}" alt="${esc(job.title)} · official project screenshot" loading="lazy">`:''}<p>${esc(item.summary)}</p>
 <dl class="vita-meta"><div><dt>Compatibility</dt><dd>${esc(item.models)}</dd></div><div><dt>Before installing</dt><dd>${esc(item.prerequisites)}</dd></div><div><dt>Game data</dt><dd>${esc(item.data)}</dd></div></dl>
 <details><summary>Setup & storage paths</summary><ol>${item.setup.map(s=>`<li>${esc(s)}</li>`).join('')}</ol>${item.paths.length?`<div class="vita-paths">${item.paths.map(p=>`<code>${esc(p)}</code>`).join('')}</div>`:''}</details>
 <div class="vita-downloads">${downloads}</div>
 <details class="vita-files"><summary>File details & SHA-256 · ${files.length} file${files.length===1?'':'s'}</summary>${files.map(f=>`<div><strong>${esc(f.name)}</strong><br>${esc(f.version)} · ${f.bytes.toLocaleString('en-GB')} bytes<br><code>${f.sha256}</code>${f.derivedFrom?`Extracted unchanged from ${esc(f.derivedFrom.name)}; original archive preserved.<br>`:''}${ext(f.sourceUrl,'Official source file')}</div>`).join('')}</details>
 <div class="guide-links">${item.sources.map((s,i)=>ext(s,i===0?'Author setup / release':i===1?'Project / compatibility':'Additional guidance')).join('')}</div><p class="vita-credit">${image?`Icon: ${ext(image.source.split('#')[0],esc(image.credit))}`:`Project by ${esc(job.author)}.`}${screenshot?`<br>Screenshot: ${ext(screenshot.source,esc(screenshot.credit))}`:''}</p></article>`;
}
function build(){
 const filters=`<div data-vita-library><div class="vita-toolbar"><label for="vita-query">Search projects<input id="vita-query" type="search" placeholder="Game, firmware, author, format…" autocomplete="off"></label><label for="vita-category">Category<select id="vita-category"><option value="">All categories</option>${['Games','Ports','Emulators','Apps','Themes','Plugins'].map(x=>`<option>${x}</option>`).join('')}</select></label><label for="vita-format">File format<select id="vita-format"><option value="">All formats</option>${['VPK','SUPRX','SKPRX','ZIP','7Z'].map(x=>`<option>${x}</option>`).join('')}</select></label><button type="button" data-vita-reset>Clear filters</button></div><div class="vita-results"><p data-vita-count role="status" aria-live="polite">${catalogue.items.length} projects</p><p>Author releases · checked 2 November 2026</p></div><p data-vita-empty hidden>No matching projects. Clear filters to see the full library.</p><div class="vita-grid">${catalogue.items.map(card).join('\n')}</div></div>`;
 page(file,'PS Vita Homebrew Library','Native games, emulators, apps, themes and plugins. Choose a ready Vita build, check its requirements, and follow the setup beside it.','/assets/images/vita-more/imago.png',[
 ['/console/psvita/','Vita hub'],['/console/psvita/library.html','Homebrew library'],['/console/psvita/apps.html','Essential apps'],['/console/psvita/jailbreak.html','Jailbreak guide'],['/console/psvita/cfw.html','CFW & Ensō'],['#install','Install & paths']
 ],section('start','Built for Vita',`<div class="vita-boundaries"><div><h3>Native homebrew</h3><p>Every project here runs as Vita software. VPK packages install as LiveArea bubbles; SUPRX and SKPRX files load through taiHEN.</p></div><div><h3>PSP through Adrenaline</h3><p>PSP EBOOT.PBP games and PSP plugins use a separate environment. ${link('/console/psvita/apps.html#adrenaline','Adrenaline setup')} covers that route.</p></div><div><h3>Your own game data</h3><p>Emulators include no commercial ROMs. Source ports identify their required data; free and shareware packs are labelled beside the download.</p></div></div>`) +
 section('library','Choose your next install',filters,'Search by title, author, firmware, format or game data. File details include exact sizes, source links and SHA-256 checksums.')+
 section('install','Install & storage paths',steps([
 ['Prepare your model and firmware','Use the existing Vita jailbreak and CFW guides first. Do not change firmware just to match a download. Numeric support is listed only where the author provides it. Vita 1000 needs usable memory-card storage; Vita 2000 and PS TV have internal storage.'],
 ['Move a VPK using VitaShell','Use VitaShell USB or FTP from your computer. ux0: is the active user-storage mount, whether it is an official card, internal storage or correctly configured SD2Vita. A folder such as ux0:downloads/ is a suggested transfer location.'],
 ['Install the package, then add its data','Open the VPK in VitaShell and complete the installation prompts. Data ZIPs are not installable VPKs: extract each one at the specific destination on its card, preserving folder names.'],
 ['Add plugins to the active tai configuration','Back up the active config before editing. Kernel SKPRX entries use *KERNEL; shell/user SUPRX entries use their author-specified section. ur0:tai/config.txt is the normal location on this site’s Ensō setup. If ux0:tai/config.txt is active, use its folder and paths consistently. Restart after a plugin change.']
 ])+note('<p><strong>Compatibility stays specific.</strong> PSVshell and reVita list 3.60 / 3.65; that does not establish support for the other apps. Entries without an author-published firmware range say so. Package checks establish file structure, not hardware performance.</p>')+`<div class="guide-links">${link('/console/psvita/jailbreak.html','Prepare homebrew access')}${link('/console/psvita/cfw.html','CFW setup')}${ext('https://github.com/TheOfficialFloW/VitaShell','VitaShell transfers')}${ext('https://vita.hacks.guide/','Model & firmware selector')}</div>`)+
 section('sources','Sources & credits',`<p>Builds come from the original authors, with the selected versions preserved locally. Each card links its upstream file and credits its original package icon or project screenshot. No downloaded build was executed and no physical Vita installation has been tested.</p><p>The former VitaDB domain showed a parked page during this review, so this collection uses direct author releases. Its availability is not assumed for setup.</p>`),'#library','Browse '+catalogue.items.length+' projects');
 const target=path.join(root,file);let html=fs.readFileSync(target,'utf8');
 html=html.replace('class="console-guide"','class="console-guide vita-library"').replace('</head>','<link rel="stylesheet" href="/assets/vita-more.css?v=1"><script defer src="/assets/vita-more.js?v=1"></script></head>');
 html=require('./apply-site-background.cjs').improve(html,target);fs.writeFileSync(target,html);
 console.log('Built '+file+' · '+catalogue.items.length+' projects');
}
if(require.main===module)build();module.exports={build};
