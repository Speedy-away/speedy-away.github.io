'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {retainJobs}=require('../prepare-host-menu-companions.cjs');
test('different preparations with the same receiver version retain every exact job set',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'receiver-job-retention-'));
  t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(root).startsWith('receiver-job-retention-'));fs.rmSync(root,{recursive:true,force:true});});
  const first=Buffer.from('{"jobs":[{"sha256":"first"}]}\n'),second=Buffer.from('{"jobs":[{"sha256":"second"}]}\n');
  const a=retainJobs('2026.11.02.13',first,root),b=retainJobs('2026.11.02.13',second,root);
  assert.notEqual(a,b);assert.deepEqual(fs.readFileSync(path.join(root,a)),first);assert.deepEqual(fs.readFileSync(path.join(root,b)),second);
  assert.equal(retainJobs('2026.11.02.13',second,root),b);assert.equal(fs.readdirSync(path.join(root,'docs/qa')).length,2);
  assert.throws(()=>retainJobs('../bad',second,root),/version/);
});
