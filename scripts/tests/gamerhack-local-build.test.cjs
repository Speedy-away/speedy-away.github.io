'use strict';
// Read native files as data only. Execute authored ticket checks with inert
// storage fixtures; never evaluate the preserved original HTML or scripts.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'../..'),prep=require('../prepare-gamerhack-local.cjs'),guard=require('../../assets/host-karo-builds.js'),launcher=require('../../assets/host-local-launcher.js');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),blob=b=>crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+b.length+'\0'),b])).digest('hex');
const report=JSON.parse(fs.readFileSync(path.join(root,'docs/host-gamerhack-local-build.json'),'utf8'));
test('targeted plan includes only the pinned 5.05 and6.72 original cache closures, not all-repository source',()=>{
 const review=JSON.parse(fs.readFileSync(path.join(root,'docs/host-gamerhack-local-route-review.json'),'utf8')),plan=prep.plan(review);assert.equal(plan.length,46);assert.ok(plan.every(f=>/^(?:505|672goldhen)\//.test(f.path)));assert.ok(plan.every(f=>f.url.includes('/'+prep.COMMIT+'/')));assert.ok(!plan.some(f=>/900NM\/payload\.js|900New\/payload\.js/.test(f.path)));assert.throws(()=>prep.plan({...review,commit:'main'}));
});
test('all48 preserved originals match exact source Git blobs andSHA256 and every native deployed file is unchanged',()=>{
 assert.equal(report.sourceFiles.length,48);assert.equal(report.native.length,41);assert.equal(report.sourceCodeExecuted,false);assert.equal(report.consoleContact,false);
 for(const f of report.sourceFiles){const original=fs.readFileSync(path.join(root,report.base,'upstream',f.path));assert.equal(original.length,f.bytes,f.path);assert.equal(sha(original),f.sha256,f.path);assert.equal(blob(original),f.gitBlobSHA1,f.path);if(/\.(?:js|bin)$/.test(f.path))assert.deepEqual(fs.readFileSync(path.join(root,report.base,'web',f.path)),original);}
});
test('static HTML and AppCache dependency closure is present and no external host is used as the native entry',()=>{
 const names=new Set(report.sourceFiles.map(f=>f.path));for(const file of report.sourceFiles.filter(f=>/\.(?:html|manifest|cache)$/.test(f.path))){const bytes=fs.readFileSync(path.join(root,report.base,'upstream',file.path));for(const ref of prep.references(file.path,bytes))assert.ok(names.has(ref),file.path+' missing '+ref);}
 for(const route of report.groups){assert.ok(route.entry.startsWith('/hosts/ps4/exploit/'));assert.ok(route.runtimeEntry.startsWith(report.runtime));assert.deepEqual(route.payloadChoice.map(x=>x.id),['goldhen']);assert.equal(route.payloadChoice[0].file,'goldhen_2.4b18.12.bin');assert.ok(names.has(route.originalEntry.scope+route.payloadChoice[0].file));}
});
test('each original HTML is encoded unchanged inside an authored guard wrapper and never parsed before that guard',()=>{
 for(const f of report.sourceFiles.filter(f=>f.path.endsWith('.html'))){const original=fs.readFileSync(path.join(root,report.base,'upstream',f.path),'utf8'),deployed=fs.readFileSync(path.join(root,report.base,'web',f.path),'utf8'),match=deployed.match(/var config=(\{[^\n]+\});config\.base=/);assert.ok(match);const config=JSON.parse(match[1]);assert.equal(config.original,original);assert.equal(config.path,f.path);assert.ok(deployed.includes('WhatsiteKaro.openOriginal(window,config)'));assert.doesNotMatch(deployed,/<script\b[^>]*src=/i);assert.ok(config.resources.files.includes(f.path));}
});
function storage(){const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
test('existing exact-console trusted ticket contract authorizes these new local entries and blocks desktop/mismatched/untrusted loads',()=>{
 for(const route of report.groups){const win={navigator:{userAgent:'PlayStation 4/'+route.firmwares[0]},document:{visibilityState:'visible'},localStorage:storage(),sessionStorage:storage(),location:new URL('https://example.test'+route.entry)};win.self=win;win.top=win;assert.equal(launcher.config({runtime:report.runtime,entry:route.originalEntry},win.location).runtime,report.runtime);assert.throws(()=>guard.authorize(win,route.originalEntry,report.runtime,true,false));assert.equal(guard.authorize(win,route.originalEntry,report.runtime,true,true),route.runtimeEntry);assert.ok(win.localStorage.getItem(guard.LOCK));guard.runtimeAllowed(win,{entry:route.originalEntry,path:route.originalEntry.path,base:report.runtime});assert.throws(()=>guard.runtimeAllowed(win,{entry:route.originalEntry,path:route.originalEntry.path,base:report.runtime}));
  for(const ua of ['Desktop','PlayStation 5/'+route.firmwares[0],'PlayStation 4/14.00']){const other={...win,navigator:{userAgent:ua},localStorage:storage(),sessionStorage:storage()};assert.throws(()=>guard.authorize(other,route.originalEntry,report.runtime,true,true));}
 }
});
test('ready ZIP hash, every native byte and complete public entry resources are retained together',()=>{
 const bytes=fs.readFileSync(path.join(root,report.bundle.local.slice(1)));assert.equal(bytes.length,report.bundle.bytes);assert.equal(sha(bytes),report.bundle.sha256);const entries=new Map();let at=0;
 while(bytes.readUInt32LE(at)===0x04034b50){const method=bytes.readUInt16LE(at+8),compressed=bytes.readUInt32LE(at+18),nameLength=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),name=bytes.subarray(at+30,at+30+nameLength).toString(),start=at+30+nameLength+extra,content=bytes.subarray(start,start+compressed);assert.ok(!entries.has(name));entries.set(name,method===8?zlib.inflateRawSync(content):content);at=start+compressed;}
 for(const f of report.native)assert.equal(sha(entries.get('gamerhack-local/'+report.base+'/web/'+f.path)),f.sha256);
 for(const file of ['assets/host-local-launcher.js','assets/host-karo-builds.js','assets/host-karo-builds.css','index.html','SOURCE-MANIFEST.json',...report.groups.map(r=>r.entry.slice(1)+'index.html')])assert.ok(entries.has('gamerhack-local/'+file),file);
 assert.equal(report.jobs.length,1);assert.equal(report.jobs[0].expectedSha256,report.bundle.sha256);assert.deepEqual(report.jobs[0].archiveRole,['Builds']);
});
