const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function batches(){return fs.readdirSync(path.join(root,'docs')).filter(x=>/^xbox360-more-batch\d+\.json$/.test(x)).map(x=>JSON.parse(fs.readFileSync(path.join(root,'docs',x),'utf8'))).sort((a,b)=>a.batch-b.batch);}
function filesFor(item){return [item.file,...(item.alternateFiles||[]),...(item.companions||[]).map(c=>c.file),...(item.components||[]).map(c=>c.file)].filter(Boolean);}
function assertPreserved(data,assert){
  for(const batch of batches()){
    const baseline=JSON.parse(fs.readFileSync(path.join(root,batch.baseline),'utf8'));
    assert.ok(data.resources.length>=baseline.resources.length+batch.addedIds.length,'Missing batch entries');
    for(const original of baseline.resources){const current=data.resources.find(x=>x.id===original.id);assert.ok(current,'Missing previous resource '+original.id);for(const file of original.files)assert.ok(filesFor(current).some(x=>x.name===file.name&&x.version===file.version&&x.bytes===file.bytes&&x.sha256===file.sha256&&x.sourceUrl===file.sourceUrl),'Previous download changed: '+file.name);}
    for(const id of batch.addedIds)assert.ok(data.resources.some(x=>x.id===id),'Missing added resource '+id);
  }
}
module.exports={batches,filesFor,assertPreserved};
