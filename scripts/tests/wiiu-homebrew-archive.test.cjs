const test=require('node:test');
const assert=require('node:assert/strict');
const {isBuild,validate}=require('../archive-wiiu-homebrew.cjs');
function elf(machine=20,endian=2){const b=Buffer.alloc(80);b.set([0x7f,69,76,70,1,endian]);b.writeUInt16BE(machine,18);return b;}
test('accepts Wii U PowerPC executables and modules, rejects other-platform ELF and NRO data',()=>{
 for(const extension of ['rpx','wps','wms','elf'])assert.equal(isBuild(elf(),'app.'+extension),true);
 assert.equal(isBuild(elf(62),'desktop.rpx'),false);
 assert.equal(isBuild(elf(20,1),'little-endian.wps'),false);
 const nro=Buffer.alloc(160);nro.write('NRO0',16);assert.equal(isBuild(nro,'wrong-platform.wuhb'),false);
 assert.equal(isBuild(elf().subarray(0,10),'truncated.wps'),false);
});
test('recognizes WUHB containers separately from raw executables',()=>{
 const b=Buffer.alloc(64);b.write('WUHB');assert.equal(isBuild(b,'homebrew.wuhb'),true);
 assert.equal(isBuild(b,'renamed.rpx'),false);
 assert.equal(isBuild(elf(),'renamed.wuhb'),false);
});
test('limits source jobs to captured Wii U store packages or pinned official release assets',()=>{
 const app={id:'test',title:'Test',version:'1.0',packageUrl:'https://wiiu.cdn.fortheusers.org/zips/test.zip',storeMD5:'1234'};
 assert.doesNotThrow(()=>validate(app));
 assert.throws(()=>validate({...app,packageUrl:'https://switch.cdn.fortheusers.org/zips/test.zip'}));
 assert.throws(()=>validate({...app,packageUrl:'https://github.com/example/app/archive/refs/heads/main.zip'}));
 assert.throws(()=>validate({...app,id:'../outside'}));
 assert.throws(()=>validate({...app,packageUrl:'http://wiiu.cdn.fortheusers.org/zips/test.zip'}));
 assert.throws(()=>validate({...app,storeMD5:undefined}));
});
