const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname,'..');
const read = file => JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
function install() {
  const plan = read('docs/image-prompts/merged-category-plan.json');
  const generated = read('docs/image-prompts/merged-category-generation-results.json').results;
  const retries = fs.existsSync(path.join(root,'docs/image-prompts/merged-category-retries.json')) ? read('docs/image-prompts/merged-category-retries.json').results : [];
  const finish = fs.existsSync(path.join(root,'docs/image-prompts/merged-category-theme-finish.json')) ? read('docs/image-prompts/merged-category-theme-finish.json').results : [];
  const byId = new Map(generated.concat(retries,finish).filter(item=>item.status==='fulfilled').map(item=>[item.id,item]));
  const missing = plan.covers.filter(item=>!byId.has(item.id));
  assert.equal(missing.length,0,'Missing finished merged covers: '+missing.map(item=>item.id).join(', '));
  const covers = {};
  for (const spec of plan.covers) {
    const output = byId.get(spec.id), source = output.output_hint.match(/as (C:[^\r\n]+\.png) by default\./)?.[1];
    assert(source, spec.id+': no saved image path');
    const bytes = fs.readFileSync(source), destination = path.join(root,spec.path.slice(1));
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a',spec.id);
    fs.mkdirSync(path.dirname(destination),{recursive:true});
    if (fs.existsSync(destination)) assert(fs.readFileSync(destination).equals(bytes),spec.id+': refusing to replace a different original');
    else fs.copyFileSync(source,destination,fs.constants.COPYFILE_EXCL);
    covers[spec.id]={id:spec.id,path:spec.path,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),type:'image/png',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),title:spec.id.replaceAll('-',' '),alt:'Original merged '+spec.id.replaceAll('-',' ')+' illustration',source:'built-in image_gen.imagegen',prompt:'docs/image-prompts/merged-category-plan.json#'+spec.id};
  }
  const data={version:'merged-category-v1',policy:'One continuous generated cover per composition; no tiled DOM thumbnails. Unmodified generated PNGs and original source images retained.',covers,routes:plan.routes};
  fs.writeFileSync(path.join(root,'docs/merged-category-covers.json'),JSON.stringify(data,null,2)+'\n');
  return {covers:Object.keys(covers).length,routes:Object.keys(plan.routes).length};
}
module.exports={install};
if(require.main===module)console.log(install());
