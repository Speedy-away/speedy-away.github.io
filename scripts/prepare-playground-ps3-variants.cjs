// Extract two source-labelled PKGs without executing or installing them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),id='discord-ps3-bo1-mp-jo-milk-playground-v2';
const inventory=require('../docs/download-audit.json'),notes=require('../docs/discord-ps3-mw2-guide-research.json')[id],entry=inventory.items.find(x=>x.id==='ps3-'+id);
const file=entry.files.find(x=>x.sha256===notes.evidence.sha256&&x.local);
if(!file)throw Error('Reviewed original archive not found');
const original=path.join(root,file.local.slice(1)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
if(sha(fs.readFileSync(original))!==notes.evidence.sha256)throw Error('Original archive changed');
const tool='C:/Program Files/7-Zip/7z.exe';
execFileSync(tool,['t','-bd','-bb0',original],{timeout:60000,maxBuffer:1024*1024,windowsHide:true});
const jobs=[];
for(const variant of ['DEX','HEN']){
 const member='Jo-Milk Playground V2 - ['+variant+'].pkg';
 if(!notes.evidence.members.includes(member))throw Error('Unreviewed member');
 const bytes=execFileSync(tool,['e','-so','-spd',original,member],{timeout:60000,maxBuffer:80*1024*1024,windowsHide:true});
 if(!require('./console-package-format.cjs').consolePackageFormat(bytes))throw Error('Invalid static package structure: '+member);
 const hash=sha(bytes),relative='docs/discord-ps4-ps5-raw/ps3-variant-staging/'+id+'/'+hash.slice(0,12)+'/'+member,target=path.join(root,relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)){if(sha(fs.readFileSync(target))!==hash)throw Error('Refusing to replace variant');}else fs.writeFileSync(target,bytes,{flag:'wx'});
 jobs.push({id:id+'-'+variant.toLowerCase(),resource:id,title:'Jo-Milk Playground V2 · '+variant+' source-labelled package',platform:'PS3',category:['Games','Call of Duty','Black Ops 1','SPRX Menus'],project:'Jo-Milk Playground V2',version:'V2 (testing distribution)',archiveRole:['Builds'],url:notes.evidence.exactSourceUrl,filename:member,memberPath:member,extractedFromSha256:file.sha256,importPath:relative,expectedBytes:bytes.length,expectedSha256:hash,pages:['console/ps3/mods/call-of-duty/black-ops-1/index.html']});
}
fs.writeFileSync(path.join(root,'docs/discord-ps4-ps5-raw/platforms/playground-variant-jobs.json'),JSON.stringify({jobs},null,2)+'\n');
console.log(jobs.map(x=>({variant:x.filename,bytes:x.expectedBytes,sha256:x.expectedSha256})));
