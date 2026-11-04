'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),ui=require('../../assets/host-dashboard.js');
const {fixture}=require('./host-continuation-dom.cjs');
const action={id:'file-facts-fixture',label:'Fixture',platform:'ps4',category:'mods',game:'Fixture',gameVersion:'1.00',format:'BIN',firmwares:['9.00'],bytes:4,sha256:'ab'.repeat(32),downloadURL:'https://example.test/Original%20Payload.bin',run:{type:'goldhen-http',port:9090,input:'user-file'},requirements:[]};
test('selected-file requirements expose the exact file identity without translating technical values',()=>{
  assert.deepEqual(ui.payloadFileFacts(action),{filename:'Original Payload.bin',bytes:4,sha256:'ab'.repeat(32)});
  const app=fixture({actions:[action]});app.openMenu();const html=app.ids['host-version-detail'].innerHTML;
  assert.match(html,/<summary>Details<\/summary><dl class="host-file-facts">/);assert.ok(html.includes('>Original Payload.bin</code>'));assert.ok(html.includes('>4 B</code>'));assert.ok(html.includes('>'+action.sha256+'</code>'));
  assert.equal((html.match(/<code translate="no" data-i18n-skip>/g)||[]).length,3);
});
test('missing or malformed source identity does not fabricate file facts or expose a local path',()=>{
  for(const change of [{run:null},{format:'ELF'},{bytes:0},{bytes:Infinity},{bytes:'4'},{bytes:0x300001},{sha256:'unknown'},{downloadURL:'file:///C:/private.bin'},{downloadURL:'https://user:secret@example.test/a.bin'},{downloadURL:'https://example.test/bad%2Fname.bin'},{downloadURL:'https://example.test/archive.zip'},{downloadURL:'https://example.test/%ZZ.bin'}])assert.equal(ui.payloadFileFacts({...action,...change}),null);
  const malicious=fixture({actions:[{...action,downloadURL:'https://example.test/%3Cimg%20src=x%3E.bin'}]});malicious.openMenu();
  assert.ok(malicious.ids['host-version-detail'].innerHTML.includes('&lt;img src=x&gt;.bin'));assert.ok(!malicious.ids['host-version-detail'].innerHTML.includes('<img src=x>'));
});
