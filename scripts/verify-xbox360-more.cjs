const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {verify}=require('./prepare-xbox360-more.cjs');
const {batches,assertPreserved}=require('./xbox360-library-batches.cjs');
const root=path.resolve(__dirname,'..');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function assertPublicPagePolicy(html){
  // A shared social channel link is navigation, not an embedded player.
  assert.ok(!/<(?:video|iframe|embed|object)\b/i.test(html),'Unexpected video/embed');
  assert.ok(!/F:[\\/]|docs[\\/]tmp|private-inventory/i.test(html),'Private machine path leaked into page');
}
function main(){
  const data=require('../docs/xbox360-more-library.json');
  const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/xbox360-more-private-inventory.json'),'utf8'));
  const html=fs.readFileSync(path.join(root,'console/xbox360/library.html'),'utf8');
  const records=[];
  assertPreserved(data,assert);
  for(const item of data.resources){
    assert.equal(item.status,'ready');assert.ok(item.image?.credit,'Missing artwork credit: '+item.id);
    const images=fs.readFileSync(path.join(root,item.image.local));if(item.image.sha256)assert.equal(digest(images),item.image.sha256);
    const files=[{file:item.file,descriptor:item},...(item.alternateFiles||[]).map(file=>({file,descriptor:{...item,expectedFiles:[]}})),...(item.companions||[]).map(c=>({file:c.file,descriptor:c})),...(item.components||[]).map(c=>({file:c.file,descriptor:c,componentOnly:true}))];
    for(const {file:publicFile,descriptor,componentOnly} of files){
      const privateItem=inventory.items.find(x=>x.id==='xbox360-more-'+item.id);
      const archived=privateItem?.files.find(x=>x.sha256===publicFile.sha256&&x.sourceUrl===publicFile.sourceUrl);
      assert.ok(archived,'Missing scoped archive metadata: '+publicFile.name);
      const buffer=fs.readFileSync(archived.backupPath);
      assert.equal(buffer.length,publicFile.bytes);assert.equal(digest(buffer),publicFile.sha256);
      if(descriptor.gitBlobSha1)assert.equal(crypto.createHash('sha1').update(Buffer.from('blob '+buffer.length+'\0')).update(buffer).digest('hex'),descriptor.gitBlobSha1,'Pinned Git blob differs: '+publicFile.name);
      const formatVerification=verify(buffer,{...descriptor,expectedBytes:publicFile.bytes,expectedSha256:publicFile.sha256},archived.backupPath);
      if(!componentOnly)assert.ok(html.includes(publicFile.sourceUrl.replaceAll('&','&amp;'))||publicFile===item.file&&item.localDownloadUrl&&html.includes(item.localDownloadUrl),'Missing public download link');
      if(publicFile===item.file&&item.localDownloadUrl){const mirrored=fs.readFileSync(path.join(root,item.localDownloadUrl));assert.equal(mirrored.length,publicFile.bytes);assert.equal(digest(mirrored),publicFile.sha256);}
      records.push({id:item.id,name:publicFile.name,bytes:buffer.length,sha256:publicFile.sha256,formatVerification});
    }
  }
  assert.equal(records.length,data.resources.reduce((n,x)=>n+1+(x.alternateFiles||[]).length+(x.companions||[]).length+(x.components||[]).length,0));
  const urls=[...html.matchAll(/(?:href|src)="([^"#]+)"/g)].map(x=>x[1]).filter(x=>x.startsWith('/'));
  for(const url of urls){let file=path.join(root,url.split(/[?#]/)[0]);if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');assert.ok(fs.existsSync(file),'Missing local link/asset '+url);}
  assert.match(html,/languages\/i18n\.js\?v=3/);assert.match(html,/mobile\.css/);assert.match(html,/site-background\.js/);assert.match(html,/data-background-theme="emerald"/);
  assertPublicPagePolicy(html);
  const latestBatch=batches().at(-1).batch;
  const browserFile=path.join(root,'docs/qa/xbox360-more-batch'+latestBatch+'-browser.json');
  const report={checkedAt:new Date().toISOString(),scope:data.scope,passed:true,resources:data.resources.length,archivedFiles:records.length,totalBytes:records.reduce((n,x)=>n+x.bytes,0),localLinksAndAssets:urls.length,publicPrivatePaths:0,files:records,physicalHardwareTested:false,downloadedPayloadsExecuted:false,browser:fs.existsSync(browserFile)?JSON.parse(fs.readFileSync(browserFile,'utf8')):{status:'not-run'}};
  fs.writeFileSync(path.join(root,'docs/qa/xbox360-more-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,resources:report.resources,archivedFiles:report.archivedFiles,totalBytes:report.totalBytes,localLinksAndAssets:report.localLinksAndAssets}));
}
if(require.main===module)main();
module.exports={main,assertPublicPagePolicy};
