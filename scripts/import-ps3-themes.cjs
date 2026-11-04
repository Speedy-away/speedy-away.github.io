/** Curated Themezer PS3 P3T intake. Downloads are inspected as data, never run. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {createArchive} = require('./console-expansion-archive.cjs');
const root = path.resolve(__dirname, '..');
const scope = 'ps3-themes';
const snapshot = '2026-11-02';
const selected = new Set(['1E74D','1E702','1D87B','1E4B0','1D2DE','1D083','1D560','1C8BC','1E4EB','1D451','1E45F','1CB5E']);
const additions = {
 '1BBAC':'crystal-clear-abstract-1BBAC','1BD7F':'buuf-2-0-1BD7F',
 '1C8EB':'somatic-1C8EB','1BA2D':'outline-1BA2D',
 '1D06E':'fallout-nv-custom-dynamic-1D06E','1D090':'uncharted-dynamic-theme-1D090',
 '1D765':'lbp-dynamic-2-1D765','1DB82':'bayonetta-dynamic-theme-2-1DB82',
 '1E5C8':'playstation-2-2-1E5C8','1DEFC':'playstation-2-1DEFC',
 '1DA36':'scarface-dynamic-1DA36','1D7B2':'ios-5-1D7B2',
 '1D99C':'evangelion-animated-1D99C','1E152':'breaking-bad-1E152',
 '1B9E3':'windows-xp-1B9E3','1E6FA':'xbox-360-theme-2-1E6FA'
};
const editorial = {
 '1BBAC':{author:'Harbinger2020',description:'Six abstract wallpapers with crystal-style icons and custom XMB graphics.',notes:['Themezer credits Harbinger2020; the embedded author field reads scei.']},
 '1BD7F':{author:'ricemonkey',description:'The Buuf 2.0 static PS3 theme, with custom icons, cursor and notification artwork.',notes:['ricemonkey credits mattahan’s desktop icon artwork. The embedded author field reads scei.']},
 '1C8EB':{version:'unversioned snapshot 2026-11-02',description:'Somatic artwork and custom icons for a static PS3 home screen.',notes:['The embedded version field contains the literal text undefined; no usable release version is supplied.']},
 '1BA2D':{description:'An outline-style static XMB theme with custom icons, cursor and notifications.'},
 '1D06E':{author:'Devilush',description:'A Fallout: New Vegas-inspired dynamic background with themed XMB artwork.'},
 '1D090':{author:'MAXTHUNDER',description:'Uncharted 3-inspired animation with spinning paw motifs, blowing sand and a matching custom icon set.'},
 '1D765':{description:'An alternative LittleBigPlanet dynamic PS3 theme with an animated Sackboy model.',notes:['Kevinoss credits Corwin75 for help with the animation. The source warns that its preview uses different icons; the still preview is illustrative.']},
 '1DB82':{author:'uLtRaMa6nEt1c',description:'Bayonetta-inspired animation with logo-style icons and custom menu sounds.',notes:['The creator credits the Japanese Bayonetta website for much of the artwork and two sounds.']},
  '1E5C8': {author:'xemnas-1',description:'A second PS2-inspired animated PS3 theme, with custom icons, sounds and notification artwork.',notes:['Themezer credits xemnas-1; the embedded author field reads Playstation Network. This metadata is not evidence of an official Sony release. No version is supplied in the P3T.']},
  '1DEFC': {description:'A static PS2-inspired look with BIOS-style sounds and a modified notification bar.'},
  '1DA36': {description:'Scarface artwork with an animated background and custom XMB icons.',notes:['The creator recommends background brightness −1, −2 or −3 and credits Seclairty31 as the background inspiration.']},
  '1D7B2': {description:'An iOS 5-inspired static PS3 theme using app-style icons and selected Mac-style artwork.'},
  '1D99C': {description:'Animated Evangelion artwork with custom icons and original sounds.',notes:['Faxtron credits the custom icons to HollowBattousai and recommends normal background brightness.']},
  '1E152': {description:'Breaking Bad artwork with around 15 HD backgrounds and custom XMB graphics.',notes:['The source specifies HD-only backgrounds, with no SD backgrounds included.']},
  '1B9E3': {author:'Andy Smith',description:'A Windows XP-inspired static appearance for the PS3 XMB, with custom icons.',notes:['Themezer credits Andy Smith; the embedded author field reads bogart27. Both attributions are retained.']},
  '1E6FA': {description:'An Xbox 360-inspired static design for PS3, with custom icons and sounds.',notes:['Aguile1990 credits Kyro’s Xbox 360 theme as inspiration. This file changes PS3 theme artwork; it is not an Xbox download.']},
  '1E4B0': {description:'A PS4-inspired look for the PS3 XMB, with two backgrounds and revised menu sounds. Themezer classifies this P3T as static.', notes:['This changes PS3 artwork; it does not install PS4 system software.']},
  '1E74D': {description:'A restrained red theme with custom icons and pointers, credited to scei in both the archive listing and P3T metadata.'},
  '1E702': {description:'A moving PS2-inspired background with matching icons and BIOS-style menu sounds.', notes:['Listing version: 1.0.1 Final. Embedded version: 1.0.1 Theme Final Ver.1.']},
  '1D87B': {description:'Animated Kamurocho entrance artwork, custom sounds and icons, with day and night background variants.', notes:['Listed author: YakFan; the embedded author field says YakuzaFan.com.']},
  '1D2DE': {description:'Dark Souls artwork with an animated logo, published by Sentiel as a PS3 dynamic theme.'},
  '1D083': {description:'A LittleBigPlanet animation with revised icons, browser pointer and XMB sound effects.', notes:['Kevinoss credits the original LittleBigPlanet icons to Mik2121 and notes further icon edits. Embedded author: Kevinos; embedded version: 2.0.']},
  '1D560': {description:'An animated background by Faxtron with recoloured and supplemented icons originally created by hobix.', notes:['The author recommends background brightness −2 or −3. Adjust under Theme Settings → Background → Brightness.']},
  '1C8BC': {description:'A Windows 7-inspired static XMB appearance using desktop-style icons.', notes:['Listed author: FHT Designs; embedded author: FHT DESIGN. This is a PS3 theme, not a Windows installer.']},
  '1E4EB': {description:'Minecraft artwork and themed icons for a static PS3 home screen, created by The-Marker.'},
  '1D451': {description:'A PlayStation-themed collection with 24 HD/SD backgrounds and three custom menu sounds.', notes:['xdarkgeox credits icons to uLtRaMa6nEt1c’s PlayStation 15th Anniversary White theme. Embedded author spelling: xadarkgeox.']},
  '1E45F': {description:'Animated Matrix-style code by Faxtron, with a green-on-black background.', notes:['Published by the author in response to a request from jdogggyea.']},
  '1CB5E': {description:'John Marston artwork with custom icons and three HD backgrounds, created by Bastart.', notes:['Source specifies HD-only backgrounds; SD background coverage is not supplied.']}
};
function decorate(row) {
  return {...row,originalSourceLinkScope:'Themezer supplies the original site, not an original item permalink',...editorial[row.id],format:{...row.format,metadata:row.format.metadata.map(({name,author,version})=>({name,author,version}))}};
}
function hydrate(html) {
  const match = html.match(/<script[^>]+id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw Error('Themezer server data unavailable');
  const table = JSON.parse(match[1]), cache = new Map();
  function at(i) {
    if (i < 0) return undefined;
    if (cache.has(i)) return cache.get(i);
    const value = table[i];
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value) && ['ShallowReactive','Reactive','Ref','ShallowRef'].includes(value[0])) return at(value[1]);
    const out = Array.isArray(value) ? [] : {}; cache.set(i,out);
    for (const [k,v] of Object.entries(value)) out[k] = at(v);
    return out;
  }
  return at(0);
}
function p3tHeader(bytes) {
  if (bytes.length < 64 || bytes.subarray(0,4).toString() !== 'P3TF') throw Error('Not a P3T container');
  const version=bytes.readUInt32BE(4), ranges=[];
  for (let pos=8;pos<56;pos+=8) {
    const offset=bytes.readUInt32BE(pos), size=bytes.readUInt32BE(pos+4);
    if (offset>bytes.length || size>bytes.length-offset) throw Error('P3T section exceeds container: '+pos);
    ranges.push({headerOffset:pos,offset,size});
  }
  if (ranges[0].offset!==64 || !ranges[0].size || !ranges[1].size || !ranges[5].size) throw Error('Missing P3T element, string or file table');
  const strings=bytes.subarray(ranges[2].offset,ranges[2].offset+ranges[2].size);
  const stringAt=offset=>{
    if (offset<0 || offset>=strings.length) throw Error('P3T string pointer outside table');
    const end=strings.indexOf(0,offset); if(end<0) throw Error('Unterminated P3T string');
    return strings.subarray(offset,end).toString();
  };
  const tree=bytes.subarray(ranges[0].offset,ranges[0].offset+ranges[0].size), visited=new Set(), metadata=[];
  let embeddedFiles=0;
  function walk(offset) {
    if(offset===-1) return;
    if(offset<0 || offset+28>tree.length || visited.has(offset)) throw Error('Invalid or cyclic P3T element pointer');
    visited.add(offset); const name=stringAt(tree.readUInt32BE(offset)), count=tree.readUInt32BE(offset+4), attributes={};
    if(count>256 || offset+28+count*16>tree.length) throw Error('P3T attributes exceed element table');
    for(let i=0;i<count;i++) {
      const pos=offset+28+i*16, key=stringAt(tree.readUInt32BE(pos)), type=tree.readUInt32BE(pos+4), value=tree.readUInt32BE(pos+8), length=tree.readUInt32BE(pos+12);
      if(type===3) attributes[key]=stringAt(value);
      if(type===6) {if(value>ranges[5].size || length>ranges[5].size-value) throw Error('P3T embedded file outside table'); embeddedFiles++;}
    }
    if(name==='info') metadata.push(attributes);
    walk(tree.readInt32BE(offset+20)); walk(tree.readInt32BE(offset+16));
  }
  if(stringAt(tree.readUInt32BE(0))!=='theme') throw Error('P3T theme root missing');
  walk(0);
  return {magic:'P3TF',version,sections:ranges,themeRoot:true,nodeCount:visited.size,embeddedFiles,metadata,structurallyChecked:true};
}
async function get(url,maxBytes=40*1024*1024) {
  const r=await fetch(url,{signal:AbortSignal.timeout(60000)});
  if (!r.ok) throw Error(`${r.status} ${url}`);
  if (Number(r.headers.get('content-length'))>maxBytes) throw Error('Remote artifact too large');
  const bytes=Buffer.from(await r.arrayBuffer());
  if (bytes.length>maxBytes) throw Error('Artifact exceeds bounded download');
  return {bytes,url:r.url,type:r.headers.get('content-type'),disposition:r.headers.get('content-disposition')};
}
function put(url,bytes) {
  const file=path.join(root,url.replace(/^\//,'')); fs.mkdirSync(path.dirname(file),{recursive:true});
  if (fs.existsSync(file)) {
    if (!fs.readFileSync(file).equals(bytes)) throw Error('Refusing to replace different site artifact: '+file);
  } else fs.writeFileSync(file,bytes,{flag:'wx'});
}
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  if (process.argv.includes('--metadata')) {
    const target=path.join(root,'docs/themezer-ps3-catalog.json'), report=JSON.parse(fs.readFileSync(target));
    for (let i=0;i<report.themes.length;i++) {
      const row=report.themes[i], source=await get(row.sourceUrl,2*1024*1024);
      const original=source.bytes.toString().match(/Originally published on <a href="(https?:\/\/(?:www\.)?ps3-themes\.com[^"<>]*)"/)?.[1];
      if(!original) throw Error('Original source attribution missing: '+row.id);
      report.themes[i]=decorate({...row,originalSourceUrl:original.replaceAll('&amp;','&'),originalSourceLinkScope:'Themezer supplies the original site, not an original item permalink'});
    }
    fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n'); console.log('Refreshed 12 editorial descriptions and truthful original-site attribution'); return;
  }
  if (!process.argv.includes('--download')) throw Error('Use --download to fetch and archive the explicitly curated PS3 themes.');
  const addOnly=process.argv.includes('--add-reviewed');
  const previous=JSON.parse(fs.readFileSync(path.join(root,'docs/themezer-ps3-catalog.json')));
  const archive=createArchive(), rows=[...previous.themes], failures=[];
  const listing=await get('https://themezer.net/ps3/themes',2*1024*1024);
  const apollo=hydrate(listing.bytes.toString()).data._apollo;
  const choices=addOnly?[]:Object.values(apollo).filter(t=>t?.__typename==='Ps3Theme' && selected.has(t.hexId));
  if(addOnly) for(const [id,slug] of Object.entries(additions)) {
    if(rows.some(t=>t.id===id)) continue;
    const source=await get('https://themezer.net/ps3/themes/'+slug,2*1024*1024);
    const theme=Object.values(hydrate(source.bytes.toString()).data._apollo).find(t=>t?.__typename==='Ps3Theme'&&t.hexId===id);
    if(!theme) throw Error('Reviewed addition missing: '+id);
    choices.push(theme);
  }
  // Trending entries move. Existing reviewed per-theme source URLs retain the
  // explicit selection; this does not broaden the catalogue automatically.
  const existingPath=path.join(root,'docs/themezer-ps3-catalog.json');
  const existing=fs.existsSync(existingPath)?JSON.parse(fs.readFileSync(existingPath)).themes:[];
  for(const id of addOnly?[]:selected) if(!choices.some(t=>t.hexId===id)) {
    const seed=existing.find(t=>t.id===id);
    if(!seed) throw Error('Reviewed source URL unavailable for '+id);
    const source=await get(seed.sourceUrl,2*1024*1024);
    const theme=Object.values(hydrate(source.bytes.toString()).data._apollo).find(t=>t?.__typename==='Ps3Theme'&&t.hexId===id);
    if(!theme) throw Error('Reviewed theme missing from its source: '+id);
    choices.push(theme);
  }
  for (const t of choices) {
    try {
      if(t.isNSFW || t.isPrivate) throw Error('Selected theme is no longer a public non-adult listing; requires review');
      const source=await get(t.pageUrl,2*1024*1024), html=source.bytes.toString();
      const downloadUrl=html.match(/href="(https:\/\/api\.themezer\.net\/ps3\/themes\/[^"<>]+\/download[^"<>]*)"/)?.[1]?.replaceAll('&amp;','&');
      if (!downloadUrl) throw Error('Publisher P3T download link missing');
      const result=await get(downloadUrl), structure=p3tHeader(result.bytes);
      const digest=hash(result.bytes), embeddedVersion=structure.metadata.find(m=>m.version&&!/^(?:undefined|null)$/i.test(m.version))?.version;
      const version=t.hexId==='1E702'?'1.0.1 Final':t.hexId==='1D083'?'V2+Sounds':t.hexId==='1E4B0'?'2.0':embeddedVersion||`unversioned snapshot ${snapshot}`;
      const author=(addOnly?structure.metadata.find(m=>m.author)?.author:null)||t.description.match(/^Theme by ([^\n]+)/)?.[1]?.trim();
      if (!author) throw Error('Missing original author credit');
      const fileName=`${t.slug}-${t.hexId}.p3t`, localDownload=`/downloads/ps3/themes/${t.hexId}/${digest.slice(0,16)}/${fileName}`;
      put(localDownload,result.bytes);
      const preview=await get(t.preview.sdUrl,8*1024*1024);
      if (!(preview.bytes.subarray(0,4).toString()==='RIFF' && preview.bytes.subarray(8,12).toString()==='WEBP')) throw Error('Preview is not WebP');
      const image=`/assets/images/ps3-themes/${t.hexId}-${hash(preview.bytes).slice(0,12)}.webp`; put(image,preview.bytes);
      const originalSourceUrl=html.match(/Originally published on <a href="(https?:\/\/(?:www\.)?ps3-themes\.com[^"<>]*)"/)?.[1]?.replaceAll('&amp;','&');
      if(!originalSourceUrl) throw Error('Original theme source attribution missing');
      const requirements=['PS3 with Theme Settings and a compatible P3T theme','USB installation: /PS3/THEME/; no HEN, DEX or CFW required','Publisher does not specify a minimum firmware, model or region restriction'];
      const features=[t.isDynamic?'Animated backgrounds':'Static backgrounds',...['Icons','Cursor','Sfx','Notification'].filter(k=>t['hasCustom'+k]).map(k=>'Custom '+({Sfx:'sounds',Notification:'notifications'}[k]||k.toLowerCase()))];
      const archived=await archive.archiveFile({scope,item:{id:`${scope}-${t.hexId.toLowerCase()}`,title:t.name,url:t.pageUrl,platform:'PS3',category:['Themes'],pages:['console/ps3/themes.html']},file:{name:fileName,version,sourceUrl:downloadUrl,local:localDownload,format:'P3T',archiveRole:['Builds'],expectedBytes:result.bytes.length,expectedSha256:digest,compatibility:requirements,container:structure},sourceFile:path.join(root,localDownload.slice(1))});
      const row={id:t.hexId,title:t.name,author,sourceUrl:t.pageUrl,originalSourceUrl,image,imageSource:t.preview.sdUrl,imageSha256:hash(preview.bytes),version,platform:'PS3',requirements,type:t.isDynamic?'dynamic':'static',description:t.description.replace(/^Theme by [^\n]+\n?/,'').replace(/Originally published on ps3-themes.com[\s\S]*/,'').replace(/(?:Theme )?Preview:[\s\S]*/i,'').trim(),features,localDownload,downloadUrl,consoleUrl:`http://ps3.themezer.net/T${t.hexId}`,bytes:result.bytes.length,sha256:digest,createdAt:t.createdAt,checkedAt:new Date().toISOString(),format:structure,container:'Original publisher download is a ready-to-use P3T; no ZIP supplied',archiveStatus:'verified',archiveInventory:'docs/ps3-themes-private-inventory.json'};
      const priorIndex=rows.findIndex(value=>value.id===row.id);
      if(priorIndex<0) rows.push(decorate(row)); else rows[priorIndex]=decorate(row);
      console.log(JSON.stringify({id:t.hexId,title:t.name,bytes:row.bytes,sha256:digest,archived:!!archived.file.backupPath}));
    } catch(error) {failures.push({id:t.hexId,sourceUrl:t.pageUrl,error:error.message});console.error(t.hexId+': '+error.message);}
  }
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),platform:'PS3',sources:{themezer:'https://themezer.net/',catalogue:'https://themezer.net/ps3/themes',sony:'https://manuals.playstation.net/document/en/ps3/current/settings/themesettings.html',usb:'https://themezer.net/ps3/faq/how-do-i-install-a-ps3-theme-from-a-usb-drive',browser:'https://themezer.net/ps3/faq/can-i-install-a-theme-using-the-ps3-browser-or-ftp',compatibility:'https://themezer.net/ps3/faq/do-i-need-a-modded-ps3-to-use-custom-themes'},themes:rows,failures,verificationLimits:['Container magic and section bounds checked; no theme or embedded animation executed','No physical PS3 installation, browser download or display test performed']};
  fs.writeFileSync(path.join(root,'docs/themezer-ps3-catalog.json'),JSON.stringify(report,null,2)+'\n');
  if (rows.length<10 || failures.length) process.exitCode=1;
}
module.exports={hydrate,p3tHeader,decorate};
if (require.main===module) main().catch(e=>{console.error(e);process.exitCode=1;});
