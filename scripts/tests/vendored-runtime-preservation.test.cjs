const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
test('vendored console runtimes retain pinned upstream bytes and stay out of page styling and browser QA',()=>{
    const manifest=path.join(root,'docs/qa/host-runtime-upstream-files.json');
    if(!fs.existsSync(manifest))return;
    const mobile=require('../apply-mobile-layout.cjs');
    const background=require('../apply-site-background.cjs');
    assert.ok(!mobile.pages().some(file=>file.replaceAll('\\','/').includes('/hosts/runtime/')));
    assert.ok(!background.pages().some(file=>file.replaceAll('\\','/').includes('/hosts/runtime/')));
    for(const entry of JSON.parse(fs.readFileSync(manifest,'utf8')).filter(x=>/\.html$/i.test(x.path))){
        const file=path.join(root,'hosts/runtime',entry.id,'upstream',entry.path);
        const bytes=fs.readFileSync(file);
        assert.equal(bytes.length,entry.bytes,entry.path);
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.path);
        assert.equal(background.improve(bytes.toString('utf8'),file),bytes.toString('utf8'));
    }
});
