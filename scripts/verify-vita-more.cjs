const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {inspect}=require('./prepare-vita-more.cjs');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function main(){
 const files=require('../docs/vita-more-files.json'),catalogue=require('../docs/vita-more-catalogue.json'),inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/vita-more-private-inventory.json'),'utf8'));
 const html=fs.readFileSync(path.join(root,'console/psvita/library.html'),'utf8');
 const report={scope:'vita-more',checkedAt:new Date().toISOString(),projects:catalogue.items.length,files:[],localLinks:0,filterChecks:[],integrations:{},limits:['No physical Vita installation or gameplay tested.','Downloaded builds were inspected, never executed.']};
 assert.ok(catalogue.items.length>=12);
 for(const item of files.items){
  const inv=inventory.items.find(x=>x.id==='vita-more-'+item.id);assert.ok(inv,'Sidecar item '+item.id);
  for(const f of item.files){
   const mirror=path.join(root,f.local);assert.equal(fs.statSync(mirror).size,f.bytes);assert.equal(sha(mirror),f.sha256);const format=inspect(mirror);assert.equal(format.format,f.verification.format);
   const backup=inv.files.find(x=>x.sha256===f.sha256&&x.name===f.name);assert.ok(backup,'Backup record '+f.name);assert.equal(fs.statSync(backup.backupPath).size,f.bytes);assert.equal(sha(backup.backupPath),f.sha256);
   assert.ok(html.includes(f.local));assert.ok(html.includes(f.sha256));
   report.files.push({id:item.id,name:f.name,bytes:f.bytes,sha256:f.sha256,format:format.format,mirrorVerified:true,backupVerified:true,...(format.crc?{crc:format.crc}:{})});
  }
  for(const image of [item.image,item.screenshot].filter(Boolean)){assert.equal(sha(path.join(root,image.local)),image.sha256);assert.ok(image.credit);}
 }
 const urls=[...new Set([...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(x=>x[1]).filter(x=>!/^https?:|^mailto:|^data:/.test(x)))];
 for(const u of urls){const parsed=new URL(u,'http://127.0.0.1:8765/console/psvita/library.html');let target=path.join(root,decodeURIComponent(parsed.pathname));if(fs.existsSync(target)&&fs.statSync(target).isDirectory())target=path.join(target,'index.html');assert.ok(fs.existsSync(target),'Missing local '+u);report.localLinks++;if(parsed.hash&&parsed.pathname==='/console/psvita/library.html')assert.ok(html.includes('id="'+parsed.hash.slice(1)+'"'),'Missing anchor '+u);}
 for(const [key,regex] of Object.entries({languages:/languages\/i18n\.js\?v=3/,mobile:/assets\/mobile\.css/,background:/assets\/site-background\.js/})){report.integrations[key]=regex.test(html);assert.ok(report.integrations[key],key);}
 assert.ok(!/<video|<iframe[^>]+(?:youtube|vimeo)/i.test(html));
 // Run the delivered filter script against its rendered card data, checking
 // combined filters, an empty search, reset focus and hidden deep-link reveal.
 const cards=[...html.matchAll(/<article class="vita-item" id="([^"]+)" data-vita-item data-category="([^"]+)" data-formats="([^"]+)" data-search="([^"]+)"/g)].map(m=>({id:m[1],dataset:{category:m[2],formats:m[3],search:m[4]},hidden:false,matches:()=>true,scrollIntoView(){this.scrolled=true;}}));
 assert.equal(cards.length,catalogue.items.length);
 const fields={};for(const key of ['#vita-query','#vita-category','#vita-format'])fields[key]={value:'',events:{},addEventListener(n,f){this.events[n]=f;},focus(){this.focused=true;}};
 const status={textContent:''},empty={hidden:true},reset={addEventListener(n,f){this.click=f;}};
 const scope={querySelector:s=>fields[s]||({'[data-vita-count]':status,'[data-vita-empty]':empty,'[data-vita-reset]':reset})[s],querySelectorAll:()=>cards};
 const window={addEventListener(n,f){this[n]=f;}},location={hash:''};const document={querySelector:()=>scope,getElementById:id=>cards.find(x=>x.id===id)};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/vita-more.js'),'utf8'),{document,window,location});
 const run=(query,category,format,expected)=>{fields['#vita-query'].value=query;fields['#vita-category'].value=category;fields['#vita-format'].value=format;fields['#vita-query'].events.input();assert.equal(cards.filter(x=>!x.hidden).length,expected);report.filterChecks.push({query,category,format,shown:expected});};
 run('','','',14);run('','Plugins','SKPRX',3);run('3.65','Plugins','SKPRX',2);run('','Emulators','VPK',2);run('minimal','Themes','ZIP',1);run('impossible-search-3r7','','',0);assert.equal(empty.hidden,false);
 location.hash='#mgba';window.hashchange();assert.equal(cards.filter(x=>!x.hidden).length,14);assert.ok(cards.find(x=>x.id==='mgba').scrolled);reset.click();assert.ok(fields['#vita-query'].focused);assert.equal(empty.hidden,true);
 report.totalFiles=report.files.length;report.totalBytes=report.files.reduce((n,f)=>n+f.bytes,0);report.passed=true;
 fs.mkdirSync(path.join(root,'docs/qa'),{recursive:true});fs.writeFileSync(path.join(root,'docs/qa/vita-more-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:true,projects:report.projects,files:report.totalFiles,totalBytes:report.totalBytes,localLinks:report.localLinks,filterChecks:report.filterChecks.length,integrations:report.integrations},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
