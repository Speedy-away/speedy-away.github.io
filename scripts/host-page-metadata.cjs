'use strict';
// Authored browsing-page metadata only; native runtimes and downloads stay untouched.
const fs=require('node:fs'),path=require('node:path');
const ORIGIN='https://speedy-away.github.io',BRAND='WWB HOST';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const consoleImage=platform=>({path:'/assets/images/host-selector/whatwhatboy-'+platform+'.jpg',width:1672,height:941,alt:platform==='ps4'?'PlayStation 4 console and DualShock 4 controller':'PlayStation 5 console and DualSense controller'});
const emptyFirmwareAliases={ps4:['14.02'],ps5:['14.0','14.00','14.10','14.20']};
const emptyFirmwareKeywords=platform=>platform==='ps5'?['PS5 firmware compatibility','PS5 14.00 firmware','PS5 14.10 firmware','PS5 14.20 firmware','unsupported firmware information']:emptyFirmwareAliases[platform].flatMap(version=>[platform.toUpperCase()+' '+version+' jailbreak',platform.toUpperCase()+' '+version+' WebKit',platform.toUpperCase()+' '+version+' WebKit exploit',platform.toUpperCase()+' '+version+' firmware']).concat(platform==='ps4'?['Afterglow','built-in browser loader']:['empty firmware choices','no exploit provided']);
const emptyFirmwareDescription={ps4:'PS4 14.02 includes built-in Afterglow with GoldHEN, ps4-hen and optional offline caching.',ps5:'14.00 (14.0), 14.10 and 14.20 are empty firmware choices with no exploit or payload provided.'};
const ps41402Keywords=['PS4 jailbreak 14.02','PlayStation 4 14.02 jailbreak','PS4 14.02 GoldHEN','PS4 14.02 ps4-hen','PS4 14.02 offline cache','PS4 14.02 BIN loader','PS4 14.02 ELF loader','Afterglow PS4 14.02','WebKitty PS4','ps4-hen','automatic offline cache'];
const pages={
 'index.html':{name:'PS4 & PS5 Hosts, Payloads & Mods',description:'Independent PS4 and PS5 browser hosts, firmware selection, payload downloads, homebrew tools, GoldHEN cheats and game patches. Check exact compatibility.',keywords:['PS4 host','PS5 host','PS4 jailbreak host','PS5 jailbreak host','PlayStation 4 host','PlayStation 5 host','offline console host','PlayStation homebrew','jailbreak hosts','payloads','mod menus','game patches','GoldHEN',...emptyFirmwareKeywords('ps4'),...ps41402Keywords,...emptyFirmwareKeywords('ps5')],image:consoleImage('ps5')},
 'hosts/credits/index.html':{name:'Credits & Sources',description:'Original projects, authors, artwork credits and source links behind WWB HOST, the community PS4 and PS5 host and download directory.',keywords:['WWB HOST credits','PlayStation community','open source','project authors','artwork credits']},
 'hosts/tools/ps4-trainer/index.html':{name:'PS4 Offline Trainer',description:'Browse PS4 trainer definitions by game, exact CUSA title ID and update. Choose compatible cheats for an already running WebRTE service.',keywords:['PS4 trainer','offline trainer','PS4 cheats','WebRTE','CUSA','game updates'],image:{path:'/assets/images/home/ps4-offline-trainer-cover-v1.jpg',width:960,height:600,alt:'PS4 controller beside a trainer menu illustration'}},
 'hosts/tools/esp-flasher/index.html':{name:'ESP Web Flasher',description:'Flash reviewed ESP firmware in a compatible desktop browser using Web Serial. Choose your device and exact firmware build before writing.',keywords:['ESP web flasher','Web Serial','ESP firmware','PS4 host','self hosting']},
 'hosts/karo/index.html':{name:'Retained Original Loader Builds',description:'Browse preserved original PS4 and PS5 loader builds, exact firmware requirements, source credits and downloads of older versions.',keywords:['preserved PlayStation hosts','original loader builds','firmware compatibility','older versions'],index:false},
 'hosts/karo/updates/index.html':{name:'Console Updates',description:'Find current PS4 and PS5 browser hosts and verified payload downloads.',keywords:['console updates','GoldHEN','PS4 firmware','PS5 ELF'],index:false},
 'hosts/updates/index.html':{name:'Console Updates',description:'Browse local PS4 and PS5 browser hosts, exact firmware requirements, and verified payload downloads.',keywords:['console updates','WebKit','GoldHEN','PS4 firmware','PS5 ELF'],index:false},
 'hosts/karo/versions.html':{name:'Retained Loader Versions',description:'Preserved older PS4 and PS5 loader downloads with their original build identities. Select the exact version and matching firmware.',keywords:['retained loader versions','PS4 host archive','PS5 host archive','exact build downloads'],index:false}
};
for(const platform of ['ps4','ps5']){
 const label=platform.toUpperCase(),base='hosts/'+platform+'/',common=[label,'PlayStation '+platform.slice(-1),label+' host',label+' homebrew',label+' firmware compatibility'];
 const add=(part,name,description,keywords)=>pages[base+part+'index.html']={name:label+' '+name,description,keywords:[...new Set([...common,...keywords,...keywords.filter(k=>!/^PS[45]\b|^PlayStation\b/.test(k)).map(k=>label+' '+k)])],platform,image:consoleImage(platform)};
 add('','Jailbreak Hosts, Payloads & Mods','Choose compatible '+label+' browser hosts, firmware builds, payload downloads, homebrew tools, mods and game patches. '+emptyFirmwareDescription[platform],['jailbreak hosts','firmware selector','payloads','mods','mod menus','game patches',...(platform==='ps4'?['GoldHEN','PS4 trainer',...ps41402Keywords]:['PS4 games on PS5']),...emptyFirmwareKeywords(platform)]);
 add('patches/','Game Patches',platform==='ps4'?'Browse the complete PS4 game patch collection: FPS, graphics, camera and other options. Match your title ID and update, then load or download XML.':'Browse native PS5 and PS4-on-PS5 game patches, including FPS, graphics and other source options. Match your title ID and update, then load or download XML.',['game patches','FPS unlock','frame pacing','graphics patches','title ID','XML patches']);
 add('payload-manager/','Payload Manager','Browse '+label+' payload builds and their exact requirements. Load or download compatible ELF and BIN files using the matching console tools.',['payload manager','ELF payloads','BIN payloads','payload downloads']);
 add('files/','File Manager','Open the installed native '+label+' file workspace with its matching tools. Check the required service and firmware before managing console files.',['file manager','console files','native workspace']);
 add('packages/','Package Library','Browse reviewed '+label+' homebrew PKGs, check compatibility and save packages through the installed console downloader.',['package installer','PKG files','console tools']);
 add('downloads/','Download Centre','Find exact '+label+' app, payload, mod and game patch downloads with version, compatibility and checksum details.',['console downloads','payloads','homebrew','mod files','game patches']);
 add('lua/','Lua Game Loader','Review the native '+label+' game-save entry and its requirements before loading a compatible Lua payload. Match the supported game and version.',['Lua loader','Lua payloads','game save entry']);
 add('firmware/','Firmware & WebKit Hosts','Review exact '+label+' firmware requirements. '+emptyFirmwareDescription[platform],['firmware selector','WebKit hosts','browser exploit','firmware compatibility',...emptyFirmwareKeywords(platform)]);
}
pages['hosts/ps4/14.02-guide/index.html']={name:'PS4 14.02 Jailbreak, GoldHEN & Offline Cache',description:'PS4 14.02 jailbreak guide: built-in WebKit Exploit, GoldHEN or ps4-hen, BIN/ELF loader tools, autostart and offline cache settings.',keywords:['PS4 14.02 jailbreak','PS4 14.02 WebKit exploit','Afterglow','WebKitty',...ps41402Keywords],platform:'ps4',image:consoleImage('ps4')};
pages['hosts/ps4/afterglow-1402/index.html']={name:'PS4 14.02 WebKit Exploit',description:'Built-in PS4 14.02 WebKit Exploit powered by Afterglow. Choose GoldHEN or ps4-hen, optional autostart and offline caching.',keywords:['PS4 14.02 jailbreak','WebKit Exploit','Afterglow','GoldHEN','ps4-hen','offline cache',...ps41402Keywords],platform:'ps4',image:consoleImage('ps4'),index:false};
pages['hosts/ps4/loaders/index.html']={name:'PS4 BIN & ELF Loaders',description:'Send PS4 BIN and ELF payloads through the matching GoldHEN HTTP, ELF HTTP or paired TCP loader. Keep firmware and payload compatibility separate.',keywords:['PS4 BIN loader','PS4 ELF loader','WebKitty','GoldHEN','PS4 14.02 BIN loader','PS4 14.02 ELF loader','9020','9021','9090'],platform:'ps4',image:consoleImage('ps4')};
pages['hosts/ps4/cheats/index.html']={name:'PS4 GoldHEN Cheats',description:'Download PS4 GoldHEN cheat files for the exact CUSA title ID and game update. Keep each cheat definition matched to its supported version.',keywords:['PS4 cheats','GoldHEN cheats','CUSA','game updates','cheat files'],platform:'ps4',image:consoleImage('ps4')};
function descriptor(name,html=''){
 if(pages[name])return {...pages[name],canonical:ORIGIN+'/'+name.replace(/index\.html$/,'')};
 if(name==='hosts/index.html')return {...pages['index.html'],canonical:ORIGIN+'/',index:false};
 if(/^hosts\/ps[45]\/(?:exploit\/[^/]+|afterglow)\/index\.html$/.test(name)){
  const platform=name.split('/')[1],label=platform.toUpperCase(),match=html.match(/<title>([\s\S]*?)<\/title>/i),title=(match?match[1].replace(/\s*\|.*$/,''):label+' Browser Host').replaceAll('\ufffd','–');
  return {name:title,description:'Review the exact '+label+' firmware and original loader requirements for this browser entry. Start the supported host only on the matching console.',keywords:[label+' browser host','WebKit exploit','exact firmware','PlayStation homebrew'],platform,image:consoleImage(platform),index:false,canonical:ORIGIN+'/'+name.replace(/index\.html$/,'')};
 }
 return null;
}
function markup(data){
 const title=data.name+' | '+BRAND,image=data.image||consoleImage('ps5'),url=data.canonical,keywords=[...new Set([...data.keywords,BRAND,'whatwhatboy'])].join(', '),robots=data.index===false?'noindex, follow':'index, follow, max-image-preview:large';
 const meta=(key,value,property=false)=>'<meta '+(property?'property':'name')+'="'+key+'" content="'+escape(value)+'">';
 const schema={'@context':'https://schema.org','@graph':[{'@type':'WebSite','@id':ORIGIN+'/#website',url:ORIGIN+'/',name:BRAND,alternateName:'whatwhatboy PS4 / PS5 Host',inLanguage:require('./host-locales.cjs').codes},{'@type':'WebPage','@id':url+'#webpage',url,name:title,description:data.description,inLanguage:data.language||'en',isPartOf:{'@id':ORIGIN+'/#website'},keywords,about:{'@type':'Thing',name:data.platform?'PlayStation '+data.platform.slice(-1)+' browser hosts and homebrew':'PlayStation browser hosts and homebrew'},image:ORIGIN+image.path}]};
 if(url!==ORIGIN+'/'){
  const items=[{name:BRAND,item:ORIGIN+'/'}];
  if(data.platform&&url!==ORIGIN+'/hosts/'+data.platform+'/')items.push({name:data.platform.toUpperCase(),item:ORIGIN+'/hosts/'+data.platform+'/'});
  items.push({name:data.name,item:url});schema['@graph'].push({'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement:items.map((item,index)=>({'@type':'ListItem',position:index+1,...item}))});schema['@graph'][1].breadcrumb={'@id':url+'#breadcrumb'};
 }
 return ['<title>'+escape(title)+'</title>',meta('description',data.description),meta('keywords',keywords),meta('author','whatwhatboy'),meta('robots',robots),'<link rel="canonical" href="'+escape(url)+'">',meta('og:type','website',true),meta('og:site_name',BRAND,true),meta('og:locale',require('./host-locales.cjs').locales[data.language||'en'],true),meta('og:url',url,true),meta('og:title',title,true),meta('og:description',data.description,true),meta('og:image',ORIGIN+image.path,true),meta('og:image:secure_url',ORIGIN+image.path,true),meta('og:image:type','image/jpeg',true),meta('og:image:width',image.width,true),meta('og:image:height',image.height,true),meta('og:image:alt',image.alt,true),meta('twitter:card','summary_large_image'),meta('twitter:title',title),meta('twitter:description',data.description),meta('twitter:image',ORIGIN+image.path),meta('twitter:image:alt',image.alt),'<script id="site-page-schema" type="application/ld+json">'+JSON.stringify(schema).replaceAll('<','\\u003c')+'</script>'].join('\n');
}
function apply(html,name,override){
 const data=override||descriptor(name,html);if(!data||!/<head\b[^>]*>[\s\S]*?<\/head>/i.test(html))return html;
 return html.replace(/(<head\b[^>]*>)([\s\S]*?)(<\/head>)/i,(_,open,head,close)=>{
  head=head.replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/gi,'').replace(/<meta\b[^>]*>\s*/gi,tag=>{const key=tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];return key&&/^(?:description|keywords|author|robots|googlebot|og:.*|twitter:.*)$/i.test(key)?'':tag;}).replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi,'').replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>\s*/gi,'');
  return open+head+markup(data)+'\n'+close;
 });
}
function sitemap(){return require('./host-locales.cjs').sitemap(pages);}
function robots(){return 'User-agent: *\nAllow: /\nDisallow: /hosts/runtime/\nDisallow: /downloads/\nDisallow: /docs/\n\nSitemap: '+ORIGIN+'/sitemap.xml\n';}
function main(){const root=path.resolve(__dirname,'..'),walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?(entry.name==='runtime'?[]:walk(path.join(dir,entry.name))):[path.join(dir,entry.name)]);let changed=0;
 for(const name of ['index.html',...walk(path.join(root,'hosts')).filter(file=>file.endsWith('.html')).map(file=>path.relative(root,file).replaceAll('\\','/'))]){const file=path.join(root,name),before=fs.readFileSync(file,'utf8'),after=apply(before,name);if(after!==before){fs.writeFileSync(file,after);changed++;}}
 fs.writeFileSync(path.join(root,'sitemap.xml'),sitemap());fs.writeFileSync(path.join(root,'robots.txt'),robots());console.log(JSON.stringify({metadataPagesChanged:changed,indexablePages:Object.values(pages).filter(data=>data.index!==false).length,nativeFilesChanged:0,downloadFilesChanged:0}));
}
if(require.main===module)main();module.exports={ORIGIN,BRAND,pages,descriptor,markup,apply,sitemap,robots};
