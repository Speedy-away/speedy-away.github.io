const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const apollo=require('./apollo-tools.cjs');
let updated=0;
for(const file of require('./site-public-pages.cjs').pages()){
 const html=fs.readFileSync(file,'utf8');if(require('./page-search-tags.cjs').protectedFile(file,html)||!html.includes('id="sidebar"')||html.includes('data-tooltip="PS Vita"'))continue;
 const link='<li><a href="/console/psvita/index.html" class="nav-link nav-sublink" data-tooltip="PS Vita"><img src="/assets/images/platform-logos/psvita.svg" class="nav-platform-logo" width="44" height="22" alt="" aria-hidden="true"><span>PS Vita</span></a></li>';
 const anchor=/<li><a href="[^"]*ps3(?:\.html|\/(?:index\.html)?)" class="nav-link nav-sublink[^\"]*"[^>]*>[\s\S]*?<\/a><\/li>/;
 if(!anchor.test(html))throw Error('Missing PS3 sidebar anchor: '+file);
 fs.writeFileSync(file,require('./search-page-output.cjs').finish(file,html.replace(anchor,'$&'+link)));updated++;
}
require('./build-vita-guides.cjs').buildVitaGuides();
for(const [platform,file,anchor] of [
 ['ps3',fs.existsSync(path.join(root,'console/ps3/save-tools.html'))?'console/ps3/save-tools.html':'console/ps3.html','<!-- END UPDATED CONSOLE RESOURCES -->'],
 ['ps4','console/ps4/index.html','</div>\n<footer class="guide-footer">']
]){
 let html=fs.readFileSync(path.join(root,file),'utf8');
 const start='<!-- BEGIN APOLLO '+platform.toUpperCase()+' -->',end='<!-- END APOLLO '+platform.toUpperCase()+' -->';
 if(html.includes(start)){const a=html.indexOf(start),b=html.indexOf(end,a)+end.length;html=html.slice(0,a)+apollo.section(platform)+html.slice(b);}
 else if(platform==='ps3'&&file.endsWith('/save-tools.html')){if(!/<section\b[^>]*id="save-tools"/.test(html))throw Error('Missing PS3 save-tool section');html=html.replace(/<section\b(?=[^>]*id="save-tools")[^>]*>[\s\S]*?<\/section>/,apollo.section(platform));}
 else{if(!html.includes(anchor))throw Error('Missing Apollo insertion point: '+file);html=html.replace(anchor,apollo.section(platform)+'\n'+anchor);}
 if(!html.includes('/assets/console-guides.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/console-guides.css?v=1">\n</head>');
 if(platform==='ps4'&&!html.includes('href="/console/ps4/#save-tools"'))html=html.replace(/(<nav class="guide-nav"[^>]*>[\s\S]*?)(<\/nav>)/,'$1<a href="/console/ps4/#save-tools">Save Tools</a>$2');
 if(platform==='ps3'&&file.endsWith('ps3.html')&&!html.includes('aria-label="Apollo Save Tool"'))html=html.replace(/(<div class="hero-buttons">[\s\S]*?)(<\/div>)/,'$1<a href="#save-tools" class="btn btn-outline" aria-label="Apollo Save Tool"><i class="fas fa-save"></i> Apollo Save Tool</a>$2');
 fs.writeFileSync(path.join(root,file),require('./search-page-output.cjs').finish(file,html));
}
const hub=path.join(root,'console/index.html');let html=fs.readFileSync(hub,'utf8');
if(!html.includes('<!-- CONSOLE DIRECTORY START -->')) {
const start=html.indexOf('<div class="game-card" data-search="playstation vita'),end=html.indexOf('<div class="game-card" data-search="steam deck',start);
if(start<0||end<0)throw Error('Missing Vita hub card');
let card=html.slice(start,end).replace('src="../assets/images/consoles/ps3.png"','src="'+apollo.image+'"').replace('href="../pc/playstation-emulators.html#psp"','href="psvita/index.html"').replace('HENkaku, homebrew applications, emulators, and game modifications for PS Vita.','Jailbreak guides, CFW setup, VitaShell, Adrenaline and homebrew apps for PS Vita.').replace('<span class="feature">HENkaku</span>','<span class="feature">Apollo</span>').replace('<span class="feature">Emulation</span>','<span class="feature">Save Tools</span>');
html=html.slice(0,start)+card+html.slice(end);fs.writeFileSync(hub,require('./search-page-output.cjs').finish(hub,html));
}
console.log('Added Apollo to PS3/PS4, built PS Vita, updated hub and '+updated+' sidebar pages.');
