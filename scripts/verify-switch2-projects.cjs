const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const data=require('../docs/switch2-projects.json'),downloads=require('../docs/switch2-project-downloads.json');
const html=fs.readFileSync('console/nintendo-switch-2.html','utf8');
assert.equal(data.projects.length,4);assert.equal((html.match(/data-switch2-card/g)||[]).length,4);
for(const p of data.projects)assert.ok(html.includes(p.url));
for(const old of ['First-time setup','microSD Express','Battery','game compatibility','PC emulation'])assert.ok(!html.includes(old));
for(const f of downloads.files){const bytes=fs.readFileSync('.'+f.local);assert.equal(bytes.length,f.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),f.sha256);assert.ok(html.includes(f.local));}
assert.ok(!/<video|<iframe/.test(html));assert.ok(html.includes('/languages/i18n.js?v=3'));
for(const p of data.projects.filter(p=>p.guideSteps))assert.ok(html.includes('id="'+p.id+'-setup"'));
console.log('Switch 2: four projects, '+downloads.files.length+' verified downloads; setup guides and integrations checked.');
