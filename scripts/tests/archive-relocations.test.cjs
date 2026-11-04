const {test}=require('node:test'),assert=require('node:assert/strict');
const {createRelocationRepair}=require('../archive-relocations.cjs');
const old={name:'Original.rar',bytes:42,sha256:'a'.repeat(64),version:'v1',backupPath:'F:/backup/PS3/Original.rar',local:'/downloads/original.rar'};
const target={...old,backupPath:'F:/backup/Helpers/Original.rar',archiveRole:['Helpers','Windows'],previousBackupPaths:[old.backupPath]};
test('explicit verified relocation repairs resurrected stale paths and retains original metadata',()=>{
 let checks=0;const repair=createRelocationRepair([{items:[{id:'owner',files:[old,target]}]}],{exists:p=>p===target.backupPath,verify:f=>{assert.equal(f,target);checks++;}});
 const result=repair('owner',old);
 assert.equal(result.backupPath,target.backupPath);assert.deepEqual(result.archiveRole,['Helpers','Windows']);assert.equal(result.local,old.local);
 assert.deepEqual(result.relocationOriginalFileRecords,[old]);assert.ok(result.previousBackupPaths.includes(old.backupPath));
 repair('owner',old);assert.equal(checks,1);
});
test('relocation never guesses across owners, versions, digests or existing original paths',()=>{
 const repair=createRelocationRepair([{items:[{id:'owner',files:[target]}]}],{exists:p=>p===target.backupPath,verify(){throw Error('Should not verify');}});
 assert.equal(repair('other',old),old);
 for(const delta of [{version:'v2'},{sha256:'b'.repeat(64)},{bytes:43},{name:'Other.rar'}]){const f={...old,...delta};assert.equal(repair('owner',f),f);}
 const present=createRelocationRepair([{items:[{id:'owner',files:[target]}]}],{exists:()=>true,verify(){throw Error('Should not verify');}});assert.equal(present('owner',old),old);
});
test('failed byte verification prevents a relocation from being accepted',()=>{
 const repair=createRelocationRepair([{items:[{id:'owner',files:[target]}]}],{exists:p=>p===target.backupPath,verify(){throw Error('Hash mismatch');}});
 assert.throws(()=>repair('owner',old),/Hash mismatch/);
});
