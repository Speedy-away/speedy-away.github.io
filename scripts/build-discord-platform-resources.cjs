// Additive Xbox 360 / PC resource pages backed by reviewed source captures.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {publicMirror}=require('./download-mirror-policy.cjs');
const ui=require('./build-console-guides.cjs'),renderer=require('./console-resource-renderer.cjs').createResourceRenderer({root});
const menuMedia=require('./console-menu-media.cjs').createMenuMedia({root});
const read=(file,fallback)=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8').replace(/^\uFEFF/,'')):fallback;
const h=value=>ui.esc(String(value??'')).replaceAll('>','&gt;');
const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}};
const unique=values=>[...new Set(values)];
function filesFor(item,inventory){
 const urls=new Set((item.downloads||[]).map(x=>x.url));
 const files=inventory.filter(x=>x.resourceId===item.id||x.id===item.id||urls.has(x.url)||urls.has(x.sourceUrl)).flatMap(owner=>(owner.files||[]).map(file=>({...file,owner})));
 const seen=new Set();return files.filter(file=>{if(seen.has(file.local||file.backupPath))return false;seen.add(file.local||file.backupPath);return true;});
}
function search(item,games){return [item.name,item.description,item.version,item.gameUpdate,item.compatibility,item.region,...item.tags,...item.keywords,...games.filter(g=>item.gameIds.includes(g.id)).map(g=>g.title),...(item.guideBlocks||[]).flatMap(b=>[b.title,b.text,...(b.items||[]).map(x=>typeof x==='string'?x:x.title+' '+x.text)])].filter(Boolean).join(' ').toLowerCase();}
function card(item,games,inventory){
 const files=filesFor(item,inventory),available=files.filter(f=>{const stored=publicMirror(f.local,root);return stored&&stored.bytes===f.bytes;});
 const links=available.map(f=>`<div class="menu-download"><a href="${h(f.local)}" download data-sha256="${h(f.sha256)}" data-i18n-skip translate="no">${h(f.name)}</a> <small>${(f.bytes/1048576).toFixed(2)} MiB</small></div>`).join('');
 const cross=item.gameIds.length>1?`<h4>Source-confirmed games</h4><div class="guide-links">${games.filter(g=>item.gameIds.includes(g.id)).map(g=>ui.link(g.page+'#'+item.id,h(g.title))).join('')}</div>`:'';
 const failureReferences=(item.referenceGameIds||[]).length?'<p><strong>'+h(item.referenceGameLabel||'Source reports unavailable or broken for:')+'</strong> '+games.filter(g=>item.referenceGameIds.includes(g.id)).map(g=>h(g.title)).join(', ')+'. Read the documented limitations.</p>':'';
 const refs=(item.references||[]).filter(x=>safe(x.url)).map(x=>ui.ext(x.url,h(x.label||'Source reference'))).join('');
 const attempted=inventory.filter(x=>x.resourceId===item.id||(item.downloads||[]).some(d=>d.url===x.url));
 const originals=(item.downloads||[]).filter(d=>safe(d.url)&&!d.url.includes('cdn.discordapp.com')&&attempted.some(a=>a.url===d.url)).map(d=>ui.ext(d.url,h(d.label))).join('');
 const status=item.readiness==='incomplete'?'Source mismatch or incomplete distribution · read requirements':available.length?available.length+' archived file download'+(available.length===1?'':'s'):files.some(f=>f.backupPath)?'Saved in local backup · use the original source link below':item.downloads.length?'No local build archived · see source status':'Source reference';
 const guideId='guide-'+item.id;
 const guide=`<div class="guide-links"><a href="#${h(guideId)}" data-guide-open>Guide &amp; requirements</a></div><section id="${h(guideId)}" data-guide-panel data-guide-title="${h(item.name+' · Guide & requirements')}"><p>${h(item.description)}</p><dl class="ps3-meta"><dt>Game update</dt><dd>${h(item.gameUpdate)}</dd><dt>Build / region</dt><dd>${h(item.compatibility)} ${h(item.region)}</dd></dl><p>${h(status)}</p>${item.note?`<p>${h(item.note)}</p>`:''}${cross}${failureReferences}${menuMedia.details(item)}${(item.guideBlocks||[]).map(renderer.guideBlock).join('')}</section>`;
 const game=games.find(g=>g.id===item.gameId)||games.find(g=>item.gameIds.includes(g.id));
 const media=menuMedia.figure(item,game?.image,game?.title);
 const details=`<details class="menu-card-links"><summary>Setup &amp; source</summary><dl class="ps3-meta"><dt>Source version</dt><dd>${h(item.version||'Not specified')}</dd><dt>Game update</dt><dd>${h(item.gameUpdate||'Not specified by source')}</dd><dt>Build / region</dt><dd>${h(item.compatibility)} ${h(item.region)}</dd></dl><p>${h(status)}</p>${item.note?`<p>${h(item.note)}</p>`:''}${cross}${failureReferences}${guide}<div class="guide-links">${originals}${refs}${ui.ext(item.source,'Original Discord post (sign-in may be needed)')}</div></details>`;
 return `<article class="guide-resource menu-card" id="${h(item.id)}" data-ps3-entry data-game="${h(item.gameId)}" data-games="${h(unique([item.gameId,...item.gameIds,...(item.indexIds||[])]).join(' '))}" data-type="${h(item.category)}" data-search="${h(search(item,games))}">${media}<h3>${h(item.name)}</h3><p class="menu-description">${h(item.description)}</p>${item.readiness==='incomplete'?'<p class="menu-card-note">Source limitations · read setup</p>':''}<div class="menu-downloads">${links}</div>${details}</article>`;
}
function filters(items,games){return `<div class="ps3-filter"><div><label for="ps3Search">Search menus, builds or compatibility</label><input id="ps3Search" type="search" placeholder="Menu name, title update or file format"></div><div><label for="ps3Game">Game or collection</label><select id="ps3Game"><option value="">All resources</option>${games.map(g=>`<option value="${h(g.id)}">${h(g.title)}</option>`).join('')}</select></div><div><label for="ps3Type">Resource type</label><select id="ps3Type"><option value="">All types</option>${unique(items.map(x=>x.category)).map(x=>`<option value="${h(x)}">${h(x)}</option>`).join('')}</select></div></div><p id="ps3Count" role="status">${items.length} resources</p><p id="ps3Empty" hidden>No matching resources.</p>`;}
function insert(file,content,marker){
 if(!fs.existsSync(file))throw Error('Missing host page '+file);
 let html=fs.readFileSync(file,'utf8');const start='<!-- BEGIN '+marker+' -->',end='<!-- END '+marker+' -->',block=start+content+end;
 if(html.includes(start)){const a=html.indexOf(start),b=html.indexOf(end,a);if(b<0)throw Error('Unterminated '+marker);html=html.slice(0,a)+block+html.slice(b+end.length);}else{if(!html.includes('<div id="content">'))throw Error('Missing content boundary '+file);html=html.replace('<div id="content">','<div id="content">'+block);}
 if(!html.includes('/assets/console-menu-catalog.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/console-menu-catalog.css?v=1"></head>');
 fs.writeFileSync(file,require('./search-page-output.cjs').finish(file,html));
}
function build(collection,{onlyPages}={}){
 if(!['xbox360','pc'].includes(collection))throw Error('Unsupported collection');
 let data=read('docs/discord-'+collection+'-resources.json',{games:[],resources:[]});if(!data.resources.length)return;
 const grouped=collection==='xbox360'?require('./console-mod-navigation.cjs').xbox(data):null;
 if(grouped)data={...data,games:grouped.games,resources:grouped.resources};
 const platform=collection==='xbox360'?'Xbox 360':'PC',base=collection==='xbox360'?'/console/xbox360/mods/':'/pc/discord-mods/';
 const hub=collection==='xbox360'?'console/xbox360/mods.html':'pc/index.html';
 const outputs=new Set([base.slice(1)+'index.html',hub,...data.games.map(game=>game.page.slice(1)),...(grouped?[grouped.cod,grouped.multi,grouped.myten].map(g=>g.page.slice(1)):[])]);
 let selected;
 if(onlyPages!==undefined){
  if(!Array.isArray(onlyPages)||!onlyPages.length)throw Error('onlyPages must be a non-empty array of generated page paths');
  selected=new Set(onlyPages.map(file=>typeof file==='string'?file.replace(/^\//,''):''));
  for(const file of selected)if(!outputs.has(file))throw Error('Unsupported generated page '+file);
 }
 const requested=file=>!selected||selected.has(file.replace(/^\//,''));
 const nav=collection==='xbox360'?require('./build-xbox360-pages.cjs').xbox360nav:[['/pc/','PC hub'],[base+'index.html','Source-reviewed menus']];
 const inventory=read('docs/download-audit.json',{items:[]}).items;
 const help=ui.note('<p>Choose the game and its exact update first. A multi-game collection only lists games explicitly confirmed in the source or archive. Downloading a file does not install or run it. Preserve the original archive and game files.</p>');
 const assets='<link rel="stylesheet" href="/assets/ps3-catalog.css?v=1"><link rel="stylesheet" href="/assets/console-menu-catalog.css?v=1"><script defer src="/assets/ps3-catalog.js?v=1"></script>';
 const menuGrid=items=>ui.grid(...items.map(x=>card(x,data.games,inventory))).replace('class="games-grid"','class="games-grid menu-resource-grid"');
 const gameCard=g=>ui.resource(h(g.title),h(g.summary||(g.kind==='collection'?'Multi-game resources with supported titles listed per build.':g.kind==='tools'?'Tools and service links with their own setup requirements.':'Mod menus and downloads for '+g.title+'.')),ui.link(g.page,'Browse '+g.title),g.image);
 const gameGrid=games=>ui.grid(...games.map(gameCard)).replace('class="games-grid"','class="games-grid menu-game-grid"');
 const directory=base+'index.html';
 const overview=grouped?ui.section('games','Choose your Xbox 360 game or tool',gameGrid(grouped.overview)):'';
 if(requested(directory))ui.page(directory.slice(1),platform+' Mods & Mod Menus',platform+' game menus, tools, source references and separately labelled original downloads.',data.games[0].image,nav,overview+ui.section('resources','Search '+platform+' resources',help+filters(data.resources,data.games)+menuGrid(data.resources))+assets,grouped?'#games':'#resources',grouped?'Choose a game':'Search resources');
 if(grouped){
  if(requested(grouped.cod.page))ui.page(grouped.cod.page.slice(1),'Xbox 360 Call of Duty Mods','Choose a Call of Duty game for Xbox 360 mod menus, supported builds and downloads.',grouped.cod.image,nav,ui.section('games','Call of Duty · Xbox 360',gameGrid(grouped.codGames))+ui.section('collections','Multi-game collections',gameGrid([data.games.find(g=>g.id==='multicod'),grouped.multi].filter(Boolean)))+assets,'#games','Choose a Call of Duty game');
  if(requested(grouped.multi.page))ui.page(grouped.multi.page.slice(1),'Xbox 360 Multi-game Tools & Mod Menus','Browse Myten versions and Call of Duty multi-game collections with source-confirmed game support.',grouped.multi.image,nav,ui.section('families','Multi-game tools & mod menus',gameGrid([grouped.myten,data.games.find(g=>g.id==='multicod')].filter(Boolean)))+assets,'#families','Choose a family');
  if(requested(grouped.myten.page)){
   const entries=data.resources.filter(item=>/\bmyten\b/i.test(item.name));
   ui.page(grouped.myten.page.slice(1),'Myten · Xbox 360 Multi-game Menus','Myten versions and original downloads, with each build’s documented game support and requirements.',grouped.myten.image,nav,ui.section('resources','Myten versions',help+filters(entries,data.games)+menuGrid(entries))+assets,'#resources','Browse Myten versions');
  }
 }
 for(const game of data.games){
  if(!requested(game.page))continue;
  const entries=data.resources.filter(x=>x.gameId===game.id||x.gameIds.includes(game.id)||(x.indexIds||[]).includes(game.id)||(x.referenceGameIds||[]).includes(game.id));if(!entries.length)continue;
  const content=ui.section('discord-resources',game.title+' · reviewed sources',help+filters(entries,[game])+menuGrid(entries))+assets;
  const file=path.join(root,game.page.slice(1));
  if(collection==='xbox360'&&game.id==='cod4'&&fs.existsSync(file))insert(file,content,'DISCORD PLATFORM RESOURCES');
  else ui.page(game.page.slice(1),game.title+' · '+platform+' Resources',game.title+' '+platform+' mod menus, original files, compatibility notes and guides.',game.image,nav,content,'#discord-resources','Browse resources');
 }
 if(requested(hub))insert(path.join(root,hub),ui.section('discord-game-catalogue',grouped?'Choose your Xbox 360 game or tool':'Source-reviewed games & tools',gameGrid(grouped?grouped.overview:data.games)+`<div class="guide-links">${ui.link(directory,'Search all reviewed resources')}</div>`),'DISCORD PLATFORM GAME INDEX');
 if(!selected)fs.writeFileSync(path.join(root,'docs/seo/'+collection+'-discord-resources.json'),JSON.stringify({reviewed:data.reviewed,resources:data.resources.map(item=>({id:item.id,name:item.name,gameIds:item.gameIds,search:search(item,data.games),pages:data.games.filter(g=>g.id===item.gameId||item.gameIds.includes(g.id)).map(g=>g.page+'#'+item.id)}))},null,2)+'\n');
 const sitemapPath=path.join(root,'sitemap.xml');
 if(fs.existsSync(sitemapPath)){
  let sitemap=fs.readFileSync(sitemapPath,'utf8'),original=sitemap;
  for(const output of outputs){
   if(!requested(output)||!fs.existsSync(path.join(root,output)))continue;
   const html=fs.readFileSync(path.join(root,output),'utf8');
   const canonical=html.match(/<link\b[^>]*rel="canonical"[^>]*href="(https:\/\/whatwhatboy\.com\/[^"<>]*)"/i)?.[1];
   if(canonical&&!sitemap.includes('<loc>'+canonical+'</loc>'))sitemap=sitemap.replace('</urlset>','  <url><loc>'+canonical+'</loc></url>\n</urlset>');
  }
  if(sitemap!==original)fs.writeFileSync(sitemapPath,sitemap);
 }
 console.log('Built '+platform+' reviewed source pages: '+data.resources.length+' resources, '+data.games.length+' games/collections.');
}
if(require.main===module)for(const collection of process.argv.slice(2).length?process.argv.slice(2):['xbox360','pc'])build(collection);
module.exports={build,filesFor,search};
