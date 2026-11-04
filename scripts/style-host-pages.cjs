'use strict';
// Presentation only. Native runtimes and immutable downloads are never edited.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function artwork(name){
 if(name.includes('/ps4-trainer/'))return ['home/ps4-offline-trainer-cover-v1.jpg','PS4 Offline Trainer illustration'];
 if(name.includes('/karo/'))return ['exploit-hosts/ps4-KaroIMG.png','KARO host'];
 if(name.includes('/gta5/'))return ['gta52.png','Grand Theft Auto V artwork'];
 if(name.includes('/rdr2/'))return ['rdr2.png','Red Dead Redemption 2 artwork'];
 if(name.includes('/tools/'))return ['host-catalog/tools.svg','Console tools'];
 if(name.includes('/firmware/'))return ['host-catalog/loaders.svg','Firmware and loaders'];
 if(name.includes('/payload-manager/')||name.includes('/lua/'))return ['host-catalog/payloads.svg','Console payloads'];
 if(name.includes('/files/')||name.includes('/packages/'))return ['host-catalog/files.svg','Console files'];
 if(name.includes('/other-games/'))return ['host-catalog/games.svg','Game menus'];
 if(name.includes('/ps5/'))return ['host-selector/whatwhatboy-ps5.jpg','PlayStation 5 console and DualSense controller'];
 if(name.includes('/ps4/'))return ['host-selector/whatwhatboy-ps4.jpg','PlayStation 4 console and DualShock 4 controller'];
 return ['logo.png','WWB HOST'];
}
function themeHTML(html,name){
 if(!/^hosts\/(?!runtime\/).+\.html$/.test(name))return html;
 html=html.replace(/host-pages\.css\?v=\d+/g,'host-pages.css?v=2');
 if(!html.includes('host-pages.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/host-pages.css?v=2">\n</head>');
 if(!/<body[^>]*class="[^"]*\bwwb-host-page\b/.test(html))html=html.replace(/<body([^>]*)>/,(_,attrs)=>'<body'+(/class="/.test(attrs)?attrs.replace(/class="/, 'class="wwb-host-page '):attrs+' class="wwb-host-page"')+'>');
 html=html.replace(/wwb-host-page wwb-host-page /g,'wwb-host-page ');
 if(!html.includes('class="host-taskbar"'))html=html.replace(/<body[^>]*>/,m=>m+'<nav class="host-taskbar" aria-label="Host navigation"><a class="host-taskbar-brand" href="/index.html">WWB HOST</a><a href="/hosts/ps4/">PS4</a><a href="/hosts/ps5/">PS5</a><a href="/hosts/karo/">KARO</a><a href="https://whatwhatboy.com/">Main site</a></nav>');
 html=html.replace(/(<a\b[^>]*class="host-taskbar-brand"[^>]*>)[^<]*(<\/a>)/g,'$1WWB HOST$2');
 html=html.replace(/(<a\b[^>]*class="host-top-brand"[^>]*>)[\s\S]*?<\/a>/g,'$1<img src="/assets/images/logo.png" alt="" width="32" height="32"><span>WWB HOST</span></a>');
 html=html.replace(/<a\b[^>]*class="(?:host-taskbar-brand|host-top-brand)"[^>]*>/g,tag=>tag.replace(/href="[^"]*"/,'href="https://speedy-away.github.io/wwb-host/"'));
 // compact-launcher-heading: firmware families and launch controls need no decorative hero.
 if(/\/(?:exploit|afterglow|firmware)\//.test(name))return html;
 const start=html.indexOf('<main');if(start<0||html.includes('data-wwb-image-heading'))return html;
 let before=html.slice(0,start),content=html.slice(start),[src,alt]=artwork(name);const image='<figure class="wwb-heading-art"><img src="/assets/images/'+src+'" alt="'+alt+'" decoding="async" width="640" height="360"></figure>';
 if(/<header\b/.test(content))content=content.replace(/<header([^>]*)>([\s\S]*?)<\/header>/,(_,attrs,inner)=>'<header'+attrs+' data-wwb-image-heading><div class="wwb-heading-copy">'+inner+'</div>'+image+'</header>');
 else content=content.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/,(_,attrs,title)=>'<header data-wwb-image-heading><div class="wwb-heading-copy"><h1'+attrs+'>'+title+'</h1></div>'+image+'</header>');
 return before+content;
}
function contract(html){return JSON.stringify({ids:[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]).sort(),actions:[...html.matchAll(/<script\b[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]),controls:[...html.matchAll(/<(?:button|input|select|option)\b[^>]*>/g)].map(m=>m[0]),downloads:[...html.matchAll(/href="([^"]+)"[^>]*\bdownload\b/g)].map(m=>m[1])});}
function main(){const root=path.resolve(__dirname,'..');function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?e.name==='runtime'?[]:walk(path.join(d,e.name)):[path.join(d,e.name)]);}const files=walk(path.join(root,'hosts')).filter(f=>f.endsWith('.html')),records=[];for(const file of files){const name=path.relative(root,file).replaceAll('\\','/'),before=fs.readFileSync(file,'utf8'),after=themeHTML(before,name);assert.equal(contract(after),contract(before),'Action/ID/control contract changed: '+name);assert.ok(themeHTML(after,name)===after,'Theme must be idempotent: '+name);const [image]=artwork(name);assert.ok(fs.existsSync(path.join(root,'assets/images',image)));if(after!==before)fs.writeFileSync(file,after);records.push({page:name,image:'/assets/images/'+image,actionContractSHA256:sha(contract(before))});}const report={updatedAt:new Date().toISOString(),pages:records.length,theme:'Forest/mint, sharp borders, image headings, native HTML/CSS; matches the root home.',actionContractsUnchanged:true,nativeRuntimeFilesChanged:0,downloadFilesChanged:0,browserRenderVerified:false,hardwareExecutionVerified:false,records};fs.writeFileSync(path.join(root,'docs/migration/page-theme-review.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,records:undefined}));}
if(require.main===module)main();module.exports={themeHTML,artwork,contract};
