// Read-only inspection of downloaded containers and generated Switch theme content.
// Writes only docs/qa/switch-themes-verification.json; never executes a console file.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {inspectZip, safeMember} = require('./archive-switch-homebrew.cjs');
const root = path.resolve(__dirname, '..');
const reportPath = path.join(root, 'docs/qa/switch-themes-verification.json');
const maxThemeBytes = 32 * 1024 * 1024;
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const targets = {home:'ResidentMenu', lock:'Entrance', apps:'Flaunch', set:'Set', news:'Notification', user:'MyPage', psl:'Psl'};
const menuLabels = {ResidentMenu:'Home Menu', Entrance:'Lockscreen', Flaunch:'All Apps', Set:'Settings', Notification:'News', MyPage:'User Page', Psl:'Player Selection'};
const publisherHashes = {client:'c83741eafe3a999e717b056055d42df91369555d94285077ce6c117b16c0fe62', installer:'36ac0fac5477e08a176b2f155b8b3c170c1291004d943541348599bae8cf97a1'};
function inside(base, file) {
  const relative = path.relative(path.resolve(base), path.resolve(file));
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
function localPath(url) {
  if (typeof url !== 'string' || !/^\/(?!\/)/.test(url) || url.includes('\\') || /[?#]/.test(url)) throw Error('Expected a plain site-relative file path');
  const file = path.resolve(root, decodeURIComponent(url).slice(1));
  if (!inside(root, file) || !inside(fs.realpathSync(root), fs.realpathSync(file))) throw Error('File resolves outside the workspace');
  return file;
}
function verifyBytes(file, expectedBytes, expectedSha256) {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes <= 0 || !/^[a-f0-9]{64}$/.test(expectedSha256 || '')) throw Error('Missing pinned file size/SHA-256');
  const bytes = fs.readFileSync(file);
  if (bytes.length !== expectedBytes || hash(bytes) !== expectedSha256) throw Error('File size or SHA-256 differs from catalogue: ' + path.basename(file));
  return bytes;
}
function readPublic(file) { return verifyBytes(localPath(file.local), file.bytes, file.sha256); }
function imageType(bytes) {
  if (bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'WebP';
  if (bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a') return 'PNG';
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'JPEG';
  if (bytes.length >= 12 && bytes.toString('ascii',4,8) === 'ftyp' && /avif|avis/.test(bytes.toString('ascii',8,32))) return 'AVIF';
  throw Error('Unrecognized image container');
}
function inspectNro(bytes) {
  if (bytes.length < 0x80 || bytes.toString('ascii',16,20) !== 'NRO0') throw Error('NRO0 signature is missing');
  const size = bytes.readUInt32LE(24);
  if (size < 0x80 || size > bytes.length) throw Error('NRO image size is out of bounds');
  const segments = ['text','readOnly','data'].map((name,index) => {
    const offset = bytes.readUInt32LE(32+index*8), length = bytes.readUInt32LE(36+index*8);
    if (offset + length > size) throw Error('NRO segment exceeds image bounds');
    return {name,offset,bytes:length};
  });
  return {format:'NRO0',imageBytes:size,fileBytes:bytes.length,segments};
}
function decodeYaz0(bytes) {
  if (bytes.length < 16 || bytes.toString('ascii',0,4) !== 'Yaz0') throw Error('Yaz0 header is missing');
  const length = bytes.readUInt32BE(4);
  if (!length || length > maxThemeBytes) throw Error('Yaz0 expanded-size limit exceeded');
  const out = Buffer.alloc(length); let cursor = 16, written = 0;
  const next = () => { if (cursor >= bytes.length) throw Error('Truncated Yaz0 stream'); return bytes[cursor++]; };
  while (written < length) {
    const code = next();
    for (let mask = 128; mask && written < length; mask >>= 1) {
      if (code & mask) out[written++] = next();
      else {
        const a = next(), b = next(), distance = ((a & 15) << 8 | b) + 1;
        const count = a >> 4 ? (a >> 4) + 2 : next() + 0x12;
        if (distance > written || written + count > length) throw Error('Yaz0 copy is outside output bounds');
        for (let i=0; i<count; i++) { out[written] = out[written-distance]; written++; }
      }
    }
  }
  return out;
}
function inspectSarc(bytes) {
  if (bytes.length < 0x28 || bytes.length > maxThemeBytes || bytes.toString('ascii',0,4) !== 'SARC') throw Error('SARC header is missing or oversized');
  const bom = bytes.readUInt16BE(6);
  if (![0xfeff,0xfffe].includes(bom)) throw Error('Invalid SARC byte order');
  const u16 = offset => bom === 0xfeff ? bytes.readUInt16BE(offset) : bytes.readUInt16LE(offset);
  const u32 = offset => bom === 0xfeff ? bytes.readUInt32BE(offset) : bytes.readUInt32LE(offset);
  const header = u16(4), length = u32(8), dataOffset = u32(12);
  if (header < 0x14 || length !== bytes.length || header+12 > dataOffset || dataOffset > length || bytes.toString('ascii',header,header+4) !== 'SFAT') throw Error('Invalid SARC bounds/SFAT');
  const tableHeader = u16(header+4), count = u16(header+6), table = header+tableHeader;
  const sfnt = table+count*16;
  if (tableHeader < 12 || !count || count > 4096 || sfnt+8 > dataOffset || bytes.toString('ascii',sfnt,sfnt+4) !== 'SFNT') throw Error('Invalid SARC name table');
  const namesBase = sfnt+u16(sfnt+4), seen = new Set(), entries = [];
  if (namesBase < sfnt+8 || namesBase > dataOffset) throw Error('Invalid SARC name offset');
  for (let i=0; i<count; i++) {
    const node = table+i*16, attributes = u32(node+4), begin = dataOffset+u32(node+8), end = dataOffset+u32(node+12);
    if (!(attributes >>> 24) || begin > end || begin < dataOffset || end > length) throw Error('Unnamed or out-of-bounds SARC member');
    const nameOffset = namesBase+(attributes & 0xffffff)*4, terminator = bytes.indexOf(0,nameOffset);
    if (nameOffset >= dataOffset || terminator < nameOffset || terminator >= dataOffset) throw Error('Unterminated SARC member name');
    const name = bytes.toString('utf8',nameOffset,terminator);
    if (!safeMember(name) || seen.has(name.toLowerCase())) throw Error('Unsafe or duplicate SARC member');
    seen.add(name.toLowerCase()); const data = bytes.subarray(begin,end);
    entries.push({path:name,bytes:data.length,sha256:hash(data),directory:false,data});
  }
  return entries;
}
function jsonMember(entries, name, required=false) {
  const found = entries.filter(entry => entry.path.toLowerCase() === name.toLowerCase());
  if (found.length !== 1) { if (required) throw Error('Expected one ' + name); return null; }
  if (found[0].bytes > 2*1024*1024) throw Error('JSON member exceeds limit');
  const data = JSON.parse(found[0].data.toString('utf8').replace(/^\uFEFF/,''));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Expected a JSON object in ' + name);
  return data;
}
function inspectTheme(bytes) {
  let format, entries;
  if (bytes.length > maxThemeBytes) throw Error('Theme container exceeds inspection limit');
  if (bytes.toString('ascii',0,4) === 'Yaz0') { format='Yaz0/SARC'; entries=inspectSarc(decodeYaz0(bytes)); }
  else if (bytes.toString('ascii',0,4) === 'SARC') { format='SARC'; entries=inspectSarc(bytes); }
  else if (bytes.length >= 4 && bytes.readUInt32LE(0) === 0x04034b50) { format='ZIP-based NXTheme'; entries=inspectZip(bytes,maxThemeBytes); }
  else throw Error('Unsupported NXTheme container');
  const manifest=jsonMember(entries,'info.json',true), layout=jsonMember(entries,'layout.json'), common=jsonMember(entries,'common.json');
  if (!targets[manifest.Target] || !manifest.ThemeName || !manifest.Author || !Number.isInteger(manifest.Version)) throw Error('Invalid NXTheme manifest');
  if (layout?.TargetName && layout.TargetName !== targets[manifest.Target]+'.szs') throw Error('Layout target differs from NXTheme manifest');
  if (!entries.some(entry => !entry.directory && !/\.json$/i.test(entry.path))) throw Error('NXTheme has no image or theme data');
  const evidence = value => value ? {name:value.PatchName || null,author:value.AuthorName || null,targetName:value.TargetName || null,targetFirmware:value.TargetFirmware ?? null,id:value.ID || null} : null;
  return {format,bytes:bytes.length,sha256:hash(bytes),target:targets[manifest.Target],menu:menuLabels[targets[manifest.Target]],manifest,layout:evidence(layout),commonLayout:evidence(common),members:entries.map(({data,...entry})=>entry)};
}
function decodeHTML(text) {
  return text.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ');
}
const textContent = html => decodeHTML(html.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
function attributes(tag) {
  const result={};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) result[match[1].toLowerCase()]=decodeHTML(match[2] ?? match[3] ?? match[4]);
  return result;
}
function checkPage(html, themes) {
  const issues=[], links=[], articleChecks=[];
  if (!/<script\b[^>]*\bsrc=["']\/languages\/i18n\.js\?v=3["']/i.test(html)) issues.push('Missing i18n.js?v=3');
  // Preserve the shared sidebar's channel social link; reject players and video destinations.
  if (/<video\b|<iframe\b|youtube(?:-nocookie)?\.com\/(?:watch[?/]|embed\/|shorts\/|v\/|playlist[?/])|youtu\.be\/|vimeo\.com\/(?:video\/)?\d/i.test(html)) issues.push('Page contains video content');
  if (/F:(?:[\\/]|&#(?:0*47|0*92);)|whatsite-backup-downloads-etc|backupPath/i.test(html)) issues.push('Private archive path/field leaked into page');
  const anchors=new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match=>decodeHTML(match[1])));
  for (const match of html.matchAll(/<(?:a|img|script|link|source)\b[^>]*>/gi)) {
    const attrs=attributes(match[0]);
    for (const attr of ['href','src']) {
      const value=attrs[attr]; if (!value || /^(?:https?:|mailto:|tel:|data:|javascript:|\/\/)/i.test(value)) continue;
      const record={attribute:attr,url:value,passed:false};
      try {
        const parsed=new URL(value,'https://whatwhatboy.com/console/nintendo-switch/themes.html');
        let target=path.resolve(root,decodeURIComponent(parsed.pathname).slice(1));
        if (!inside(root,target) || !fs.existsSync(target)) throw Error('Missing local target');
        if (fs.statSync(target).isDirectory()) target=path.join(target,'index.html');
        if (!fs.existsSync(target) || !inside(fs.realpathSync(root),fs.realpathSync(target))) throw Error('Missing or escaped local target');
        if (parsed.hash && /\.html?$/i.test(target)) {
          const wanted=decodeURIComponent(parsed.hash.slice(1));
          const targetHTML=target===path.join(root,'console/nintendo-switch/themes.html')?html:fs.readFileSync(target,'utf8');
          const ids=targetHTML===html?anchors:new Set([...targetHTML.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)].map(m=>decodeHTML(m[1])));
          if (!ids.has(wanted)) throw Error('Missing local anchor: '+wanted);
        }
        record.passed=true;
      } catch(error) {record.reason=error.message;issues.push(value+': '+error.message);}
      links.push(record);
    }
  }
  const articles=[...html.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)].map(match=>({html:match[0],attrs:attributes(match[0].slice(0,match[0].indexOf('>')+1))}));
  for (const theme of themes) {
    const errors=[],matches=articles.filter(article=>article.attrs.id===theme.id || article.attrs['data-theme-id']===theme.id),article=matches[0];
    if (matches.length!==1) errors.push('Expected one article with catalogue ID');
    if (article) {
      const text=textContent(article.html),tags=[...article.html.matchAll(/<(?:a|img)\b[^>]*>/gi)].map(m=>attributes(m[0]));
      if (!text.includes(theme.author)) errors.push('Missing author attribution');
      if (!text.includes(theme.title)) errors.push('Missing theme title');
      if (article.attrs['data-kind']!==theme.kind) errors.push('Pack/individual data-kind differs from catalogue');
      if (!tags.some(tag=>tag.href===theme.sourceUrl)) errors.push('Missing original theme page');
      if (!tags.some(tag=>tag.src===theme.image)) errors.push('Missing local preview');
      if (!tags.some(tag=>tag.href===theme.file.local)) errors.push('Missing local Download link');
      if (!/\bdownload\b/i.test(text)) errors.push('Missing visible Download label');
      for (const target of new Set(theme.components.map(component=>component.target))) if (!text.includes(menuLabels[target])) errors.push('Missing menu label: '+menuLabels[target]);
    }
    articleChecks.push({id:theme.id,passed:!errors.length,issues:errors});
    issues.push(...errors.map(error=>theme.id+': '+error));
  }
  for (const url of ['https://themezer.net/','https://themezer.net/switch/packs','https://themezer.net/switch/themes','/console/nintendo-switch/apps.html#NXthemes_Installer','/console/nintendo-switch/mods.html']) {
    if (![...html.matchAll(/<a\b[^>]*>/gi)].some(m=>attributes(m[0]).href===url)) issues.push('Missing required link: '+url);
  }
  return {passed:!issues.length,issues,linksChecked:links.length,links,articles:articleChecks};
}
function verify({filesOnly=false}={}) {
  const inputs=[];
  const read=relative=>{const bytes=fs.readFileSync(path.join(root,relative));inputs.push({file:relative,bytes:bytes.length,sha256:hash(bytes)});return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));};
  const catalogue=read('docs/switch-themes-catalog.json'),issues=[],warnings=[];
  if (!Array.isArray(catalogue.themes) || catalogue.themes.length<8) issues.push('Expected at least eight curated themes');
  const themes=catalogue.themes || [];
  if (new Set(themes.map(theme=>theme.id)).size!==themes.length) issues.push('Duplicate theme ID');
  if (!themes.some(theme=>theme.kind==='pack') || !themes.some(theme=>theme.kind==='individual')) issues.push('Both packs and individual themes are required');
  const inventoryPath=catalogue.archiveInventory || 'docs/switch-themes-private-inventory.json';
  const inventory=fs.existsSync(path.join(root,inventoryPath))?read(inventoryPath):{items:[]};
  function archiveCheck(entry) {
    const item=inventory.items.find(item=>item.id===entry.id),file=item?.files?.find(file=>file.sha256===entry.file.sha256 && file.name===entry.file.name);
    if (!file) { if (filesOnly) {warnings.push(entry.id+': archive pending');return {pending:true};} throw Error('Matching scoped archive record is missing'); }
    if (file.sourceUrl!==entry.file.sourceUrl || file.version!==entry.file.version || file.bytes!==entry.file.bytes) throw Error('Archive source/version/size metadata differs from catalogue');
    const archiveRoot=path.resolve('F:/whatsite-backup-downloads-etc');
    if (!file.backupPath || !inside(archiveRoot,file.backupPath) || !inside(fs.realpathSync(archiveRoot),fs.realpathSync(file.backupPath))) throw Error('Archive path escapes required root');
    verifyBytes(file.backupPath,entry.file.bytes,entry.file.sha256);
    return {passed:true,bytes:file.bytes,sha256:file.sha256,version:file.version,sourceUrl:file.sourceUrl};
  }
  const results=themes.map(theme=>{
    const row={id:theme.id,title:theme.title,author:theme.author,kind:theme.kind,components:[],issues:[]};
    try {
      if (!['pack','individual'].includes(theme.kind) || !theme.author || !theme.version || theme.platform!=='Switch' || !Array.isArray(theme.requirements) || !theme.requirements.length) throw Error('Incomplete theme metadata');
      const bytes=readPublic(theme.file),image=verifyBytes(localPath(theme.image),theme.imageProvenance.bytes,theme.imageProvenance.sha256);
      row.file={local:theme.file.local,bytes:bytes.length,sha256:hash(bytes),sourceUrl:theme.file.sourceUrl,version:theme.file.version};
      row.image={local:theme.image,bytes:image.length,sha256:hash(image),format:imageType(image)};
      if (theme.imageProvenance.credit!==theme.author || theme.imageProvenance.page!==theme.sourceUrl) throw Error('Image attribution does not match author/source');
      const members=theme.kind==='pack'?inspectZip(bytes,64*1024*1024):[{path:theme.file.name,data:bytes,directory:false}];
      row.packMembers=members.map(({data,...entry})=>entry);
      const components=members.filter(member=>!member.directory && /\.nxtheme$/i.test(member.path));
      if (components.length!==theme.components.length || theme.kind==='individual' && components.length!==1) throw Error('Container component count differs from metadata');
      const seen=new Set();
      for (const member of components) {
        const parsed=inspectTheme(member.data),id=parsed.manifest.Id?.match(/^Themezer:([^:]+):/)?.[1];
        const expected=theme.components.find(component=>component.id.toUpperCase()===id?.toUpperCase()) || (!id && theme.components.length===1?theme.components[0]:null);
        if (!expected || seen.has(expected.id)) throw Error('Unknown/duplicate component ID in container: '+id);
        seen.add(expected.id);
        if (expected.target!==parsed.target || expected.title!==parsed.manifest.ThemeName || theme.author!==parsed.manifest.Author) throw Error('Component menu/title/author differs from catalogue: '+expected.id);
        row.components.push({id:expected.id,path:member.path,...parsed});
      }
      row.archive=archiveCheck(theme);
    } catch(error) {row.issues.push(error.message);}
    row.passed=!row.issues.length; if (!row.passed) issues.push(...row.issues.map(error=>theme.id+': '+error)); return row;
  });
  let client,installer;
  try {
    const bytes=readPublic(catalogue.client.file);
    if (hash(bytes)!==publisherHashes.client) throw Error('Themezer-NX differs from publisher SHA-256');
    client={passed:true,id:catalogue.client.id,local:catalogue.client.file.local,version:catalogue.client.version,bytes:bytes.length,sha256:hash(bytes),...inspectNro(bytes),archive:archiveCheck(catalogue.client)};
  } catch(error) {client={passed:false,reason:error.message};issues.push('Themezer-NX: '+error.message);}
  try {
    const homebrew=read('docs/switch-homebrew-downloads.json').apps.find(app=>app.id==='NXthemes_Installer');
    if (!homebrew || homebrew.version!=='nxt-3.0.2') throw Error('Expected reused Installer3.0.2 manifest entry');
    const file=homebrew.officialNro || homebrew.nro,bytes=readPublic(file);
    if (hash(bytes)!==publisherHashes.installer) throw Error('Reused installer differs from publisher SHA-256');
    installer={passed:true,local:file.local,version:homebrew.version,bytes:bytes.length,sha256:hash(bytes),...inspectNro(bytes)};
  } catch(error) {installer={passed:false,reason:error.message};issues.push('NXThemes Installer: '+error.message);}
  let page={deferred:true};
  if (!filesOnly) {
    try { const html=fs.readFileSync(path.join(root,'console/nintendo-switch/themes.html'),'utf8');page=checkPage(html,themes);issues.push(...page.issues); }
    catch(error) {page={passed:false,issues:[error.message]};issues.push('Page: '+error.message);}
  }
  const report={schemaVersion:1,checkedAt:new Date().toISOString(),complete:!filesOnly,passed:!issues.length,inputs,themes:results,client,installer,page,summary:{themes:themes.length,packs:themes.filter(theme=>theme.kind==='pack').length,individuals:themes.filter(theme=>theme.kind==='individual').length,components:results.reduce((count,row)=>count+row.components.length,0),verifiedArchives:results.filter(row=>row.archive?.passed).length+(client?.archive?.passed?1:0)},issues,warnings,limitations:['Downloaded files were read and decompressed in memory; none was executed.','Container checks do not establish physical-console installation, visual appearance or firmware compatibility.','Embedded TargetFirmware is a layout compatibility level, not a tested minimum/maximum firmware range.','External source availability and physical-console operation are outside this local verifier.']};
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
  return report;
}
if (require.main===module) {
  try {const result=verify({filesOnly:process.argv.includes('--files-only')});console.log(JSON.stringify({passed:result.passed,complete:result.complete,...result.summary,issues:result.issues,warnings:result.warnings,report:path.relative(root,reportPath)},null,2));if(!result.passed)process.exitCode=1;}
  catch(error) {console.error(error.stack);process.exitCode=1;}
}
module.exports={verify,inspectTheme,inspectSarc,decodeYaz0,inspectNro,checkPage};
