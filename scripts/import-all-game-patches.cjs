'use strict';
// Read XML as data. Preserve upstream source and official release bytes; run nothing.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {unzip}=require('./prepare-console-game-patches.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
const slug=s=>String(s).toLowerCase().replace(/\([^)]*\)/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const unique=a=>[...new Set(a)];
function decode(value){
 return value.replace(/[\t\r\n]/g,' ').replace(/&([^;\s<&]+);|&/g,(all,key)=>{
  if(!key)throw Error('Unescaped XML ampersand');
  const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.hasOwn(known,key))return known[key];
  if(!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(key))throw Error('Unsupported XML entity '+all);
  const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));
  if(!Number.isInteger(n)||n<=0||n>0x10ffff||n>=0xd800&&n<=0xdfff)throw Error('Invalid XML character');return String.fromCodePoint(n);
 });
}
function parseXML(xml){
 if(typeof xml!=='string'||/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('XML declarations are not supported');
 const roots=[],stack=[];let at=xml.charCodeAt(0)===0xfeff?1:0;
 while(at<xml.length){
  if(xml[at]!=='<'){const end=xml.indexOf('<',at),next=end<0?xml.length:end,text=xml.slice(at,next);if(stack.length)stack.at(-1).text+=decode(text);else if(text.trim())throw Error('Text outside Patch');at=next;continue;}
  if(xml.startsWith('<!--',at)){const end=xml.indexOf('-->',at+4);if(end<0)throw Error('Unclosed XML comment');at=end+3;continue;}
  if(xml.startsWith('<?',at)){const end=xml.indexOf('?>',at+2);if(end<0)throw Error('Unclosed XML instruction');at=end+2;continue;}
  if(xml.startsWith('<![CDATA[',at)){const end=xml.indexOf(']]>',at+9);if(end<0||!stack.length)throw Error('Invalid CDATA');stack.at(-1).text+=xml.slice(at+9,end);at=end+3;continue;}
  let end=at+1,quote='';for(;end<xml.length;end++){const c=xml[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
  if(end===xml.length)throw Error('Unclosed XML tag');const token=xml.slice(at+1,end);
  if(token[0]==='/'){const name=token.slice(1).trim(),node=stack.pop();if(!node||node.name!==name)throw Error('Mismatched XML closing tag '+name);node.end=end+1;at=end+1;continue;}
  const selfClosing=/\/\s*$/.test(token),body=selfClosing?token.replace(/\/\s*$/,''):token,match=/^([A-Za-z_][\w:.-]*)/.exec(body);if(!match)throw Error('Invalid XML tag');
  const node={name:match[1],attrs:{},children:[],text:'',start:at,end:end+1};let cursor=match[0].length;
  while(cursor<body.length){const rest=body.slice(cursor);if(!rest.trim())break;const attribute=/^\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(rest);if(!attribute||Object.hasOwn(node.attrs,attribute[1]))throw Error('Invalid or duplicate XML attribute');node.attrs[attribute[1]]=decode(attribute[2]??attribute[3]);cursor+=attribute[0].length;}
  if(stack.length)stack.at(-1).children.push(node);else roots.push(node);if(!selfClosing)stack.push(node);at=end+1;
 }
 if(stack.length||roots.length!==1)throw Error('Expected one complete XML root');return roots[0];
}
function canonical(node){return JSON.stringify([node.name,Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b)),node.text.trim(),node.children.map(child=>JSON.parse(canonical(child)))]);}
function parsePatch(xml){
 const root=parseXML(xml);if(root.name!=='Patch'||Object.keys(root.attrs).length)throw Error('Expected the upstream Patch root');
 const groups=root.children.filter(n=>n.name==='TitleID'),metadata=root.children.filter(n=>n.name==='Metadata');
 if(groups.length!==1||!metadata.length||root.children.some(n=>!['TitleID','Metadata'].includes(n.name)))throw Error('Unsupported Patch structure');
 const ids=groups[0].children.map(n=>{if(n.name!=='ID'||n.children.length||! /^(?:CUSA|PPSA)\d{5}$/.test(n.text.trim()))throw Error('Invalid title ID');return n.text.trim();});
 if(!ids.length||unique(ids).length!==ids.length||new Set(ids.map(id=>id.slice(0,4))).size!==1)throw Error('Invalid or mixed title-ID group');
 for(const node of metadata)if(!node.attrs.Title||!node.attrs.Name||!node.attrs.AppVer||!node.children.length)throw Error('Incomplete patch Metadata');
 return {titleIds:ids,arch:ids[0].startsWith('PPSA')?'prospero':'orbis',options:metadata.map(n=>({...n.attrs})),signature:canonical(root)};
}
function preserve(root,name,bytes){
 const absolute=path.resolve(root,name),relative=path.relative(root,absolute);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Unsafe import destination');
 if(fs.existsSync(absolute)){if(sha(fs.readFileSync(absolute))!==sha(bytes))throw Error('Refusing to replace a different file: '+name);return;}
 fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,bytes,{flag:'wx'});
}
function plan(root,capture,archiveBytes,legacy){
 if(capture.repository!=='illusionyy/PS-Game-Patch'||! /^[a-f0-9]{40}$/.test(capture.commit)||!Array.isArray(capture.files)||!capture.files.length)throw Error('Invalid source capture');
 if(capture.commit!==legacy.revision||sha(archiveBytes)!==legacy.archive.sha256||archiveBytes.length!==legacy.archive.bytes)throw Error('Source pin and official release must match the preserved catalogue');
 const revision=capture.commit,version=revision.slice(0,12),prefix='downloads/ps4-ps5/all-game-patches-'+version,repository='https://github.com/'+capture.repository;
 const outputs=new Map(),sources=[],bySignature=new Map();
 for(const f of capture.files){
  if(!/^patches\/xml\/[A-Za-z0-9_.-]+\.xml$/.test(f.path)||f.path.includes('..')||!/^[a-f0-9]{64}$/.test(f.sha256)||!/^[a-f0-9]{40}$/.test(f.gitBlobSHA1))throw Error('Invalid captured source identity');
  if(sources.some(s=>s.path===f.path))throw Error('Duplicate captured source');
  const input=path.resolve(root,f.localPath),relative=path.relative(root,input);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Capture must be inside this repository');
  const bytes=fs.readFileSync(input);if(bytes.length!==f.bytes||sha(bytes)!==f.sha256||blob(bytes)!==f.gitBlobSHA1)throw Error('Captured source identity mismatch: '+f.path);
  const parsed=parsePatch(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),local=prefix+'/source/'+path.posix.basename(f.path),record={path:f.path,filename:path.posix.basename(f.path),source:repository+'/blob/'+revision+'/'+f.path,rawURL:f.url,local:'/'+local,bytes:f.bytes,sha256:f.sha256,gitBlobSHA1:f.gitBlobSHA1,titleIds:parsed.titleIds,arch:parsed.arch,optionCount:parsed.options.length};
  outputs.set(local,bytes);const source={...record,parsed};sources.push(source);if(!bySignature.has(parsed.signature))bySignature.set(parsed.signature,[]);bySignature.get(parsed.signature).push(source);
 }
 const releaseEntries=unzip(archiveBytes).filter(e=>/^patches\/xml\/(?:CUSA|PPSA)\d{5}\.xml$/.test(e.name)),files=new Map();
 for(const entry of releaseEntries){
  const parsed=parsePatch(entry.bytes.toString('utf8')),matches=bySignature.get(parsed.signature);if(!matches)continue;
  const titleId=path.posix.basename(entry.name,'.xml');if(!parsed.titleIds.includes(titleId))throw Error('Official ready filename is absent from source whitelist');
  if(files.has(titleId))throw Error('Duplicate official title XML');const filename=titleId+'.xml',local=prefix+'/title/'+filename,downloadId='all-patch-'+titleId.toLowerCase()+'-'+version;
  const options=matches.flatMap(source=>source.parsed.options.map(option=>({...option,titleIds:source.titleIds.slice(),sourcePath:source.path,sourceRevision:revision})));
  const file={titleId,filename,archiveEntry:entry.name,local:'/'+local,downloadLocal:'/'+local,downloadId,bytes:entry.bytes.length,sha256:sha(entry.bytes),sourcePaths:matches.map(s=>s.path),options};
  outputs.set(local,entry.bytes);files.set(titleId,file);
 }
 for(const source of sources)for(const id of source.titleIds)if(!files.get(id)?.sourcePaths.includes(source.path))throw Error('No byte-identical official ready XML for '+source.path+' '+id);
 const groups=new Map(),usedIds=new Set();
 for(const source of sources){
  const old=legacy.games.find(g=>g.sourcePath===source.path),title=old?.title||source.parsed.options[0].Title,key=source.arch+'\0'+title.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
  if(!groups.has(key))groups.set(key,{id:old?.id||slug(title),title,arch:source.arch,sourcePath:source.path,sourcePaths:[],sourceRevision:revision,titleIds:[],options:[],files:[],image:old?.image||'/assets/images/host-catalog/games.svg',platforms:old?.platforms?.slice()||(source.arch==='prospero'?['ps5']:['ps4','ps5'])});
  const game=groups.get(key);if(old){game.image=old.image;game.platforms=old.platforms.slice();game.id=old.id;}
  game.sourcePaths.push(source.path);game.titleIds.push(...source.titleIds);game.options.push(...source.parsed.options.map(option=>({...option,titleIds:source.titleIds.slice(),sourcePath:source.path,sourceRevision:revision})));
 }
 const games=[...groups.values()];for(const game of games){if(usedIds.has(game.id))game.id+='-'+game.arch+'-'+sha(Buffer.from(game.sourcePaths.join('\n'))).slice(0,8);usedIds.add(game.id);game.titleIds=unique(game.titleIds);game.files=game.titleIds.map(id=>files.get(id));}
 games.sort((a,b)=>a.title.localeCompare(b.title)||a.arch.localeCompare(b.arch));
 const resources=[],jobs=[];
 for(const source of sources){const id='all-patch-source-'+slug(source.filename.slice(0,-4))+'-'+version;jobs.push({id,title:source.parsed.options[0].Title+' · original source XML',platform:source.arch==='prospero'?'PS5':'PS4 and PS5',category:['Game Patches'],project:'PS Game Patch',version:revision,filename:source.filename,url:source.rawURL,sourceUrls:[source.source],importPath:source.local.slice(1),expectedBytes:source.bytes,expectedSha256:source.sha256,archiveRole:['Source Code'],pages:['hosts/ps4/patches/index.html','hosts/ps5/patches/index.html']});}
 for(const file of files.values()){
  const game=games.find(g=>g.titleIds.includes(file.titleId)),updates=unique(file.options.map(o=>o.AppVer)),platforms=game.platforms,compatibility=(game.arch==='prospero'?'Native PS5 title':'PS4 title; PS5 use is backward compatibility only')+'. '+file.titleId+'. Exact source option updates: '+updates.join(', ')+(updates.includes('mask')?' (mask = upstream pattern scan, not a guarantee for every update)':'')+'. Source hardware and author notes apply separately to each option.';
  const preparation='Download '+file.filename+' as XML data. The matching installed patch engine uses /data/user/patches/'+(game.arch==='prospero'?'xml_prospero/':'xml_orbis/')+file.filename+'. Select the exact game update and follow its option notes.';
  resources.push({id:file.downloadId,title:game.title+' · '+file.titleId+' patch XML',platforms,category:'patches',version:legacy.release,sourceRevision:revision,source:repository+'/blob/'+revision+'/'+file.sourcePaths[0],sourcePaths:file.sourcePaths,filename:file.filename,format:'XML patch data',game:game.id,keywords:[game.title,file.titleId,...updates,...file.options.map(o=>o.Name)],local:file.downloadLocal,bytes:file.bytes,sha256:file.sha256,image:game.image,compatibility,preparation,page:'/hosts/'+platforms[0]+'/patches/',pages:Object.fromEntries(platforms.map(p=>[p,'/hosts/'+p+'/patches/']))});
  jobs.push({id:file.downloadId,title:game.title+' · '+file.titleId+' patch XML',platform:game.arch==='prospero'?'PS5':'PS4 and PS5',category:['Games',game.title,'Game Patches'],project:'PS Game Patch',version:legacy.release,filename:file.filename,url:legacy.archive.url,sourceUrls:file.sourcePaths.map(p=>repository+'/blob/'+revision+'/'+p),importPath:file.local.slice(1),archiveEntry:file.archiveEntry,expectedBytes:file.bytes,expectedSha256:file.sha256,archiveRole:['Builds'],pages:platforms.map(p=>'hosts/'+p+'/patches/index.html')});
 }
 if(new Set(jobs.map(j=>j.id)).size!==jobs.length)throw Error('Duplicate import job identity');
 const sourceFiles=sources.map(({parsed,...record})=>record),counts={sourceFiles:sourceFiles.length,sourceBytes:sourceFiles.reduce((n,f)=>n+f.bytes,0),games:games.length,titleFiles:files.size,options:sources.reduce((n,s)=>n+s.parsed.options.length,0),ps4Games:games.filter(g=>g.platforms.includes('ps4')).length,ps5Games:games.filter(g=>g.platforms.includes('ps5')).length};
 return {data:{schemaVersion:1,reviewed:'2026-11-04',repository,revision,release:legacy.release,scope:'patches/xml/',sourcePage:capture.sourcePage,xmlTree:capture.xmlTree,archive:legacy.archive,vendorArchive:{url:legacy.archive.url,bytes:legacy.archive.bytes,sha256:legacy.archive.sha256},counts,games,resources,sourceFiles,nativeExecution:false,hardwareTested:false},jobs:{reviewed:'2026-11-04',notes:['All requested raw source XMLs are byte-identical to the pinned Git blobs. Every ready title XML is byte-identical to the matching official release entry. No native code was run.'],jobs},outputs};
}
function main(root=path.resolve(__dirname,'..'),capturePath=path.join(root,'tmp/all-game-patches-20261104/capture.json'),archivePath=process.env.GAME_PATCH_ARCHIVE){
 const legacy=JSON.parse(fs.readFileSync(path.join(root,'docs/ps4-ps5-game-patches.json'))),capture=JSON.parse(fs.readFileSync(capturePath));
 if(!archivePath)archivePath=path.join(root,legacy.archive.local.slice(1));const result=plan(root,capture,fs.readFileSync(archivePath),legacy);
 for(const [name,bytes]of result.outputs)preserve(root,name,bytes);
 fs.writeFileSync(path.join(root,'docs/host-all-game-patches.json'),JSON.stringify(result.data,null,2)+'\n');fs.writeFileSync(path.join(root,'docs/host-all-game-patch-jobs.json'),JSON.stringify(result.jobs,null,2)+'\n');
 return result.data.counts;
}
if(require.main===module){try{console.log(JSON.stringify(main(),null,2));}catch(error){console.error(error);process.exitCode=1;}}
module.exports={decode,parseXML,parsePatch,canonical,preserve,plan,main};
