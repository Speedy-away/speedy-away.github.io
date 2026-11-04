'use strict';
// Full host/console regression collection, with no test-name exclusions.
// Tests use authored/inert adapters and preserved source bytes, never a console.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const files=fs.readdirSync(path.join(root,'scripts/tests')).filter(f=>/\.test\.cjs$/.test(f)&&/^(?:host-|verify-host|afterglow|gamerhack|ps4-browser|ps5-(?:browser|original|webkit|native-extra)|site-hosted|i18n-|language-picker|console-(?:payload-bridge|receiver|game-patches)|receiver-jobs|sender-release)/.test(f)).sort().map(f=>path.join(root,'scripts/tests',f));
const log=path.join(root,'tmp/root-final-complete-tests.tap');fs.mkdirSync(path.dirname(log),{recursive:true});const fd=fs.openSync(log,'w');
const result=cp.spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:root,stdio:['ignore',fd,fd],timeout:300000,windowsHide:true});fs.closeSync(fd);
const text=fs.readFileSync(log,'utf8'),summary=text.split(/\r?\n/).filter(l=>/^# (?:tests|pass|fail|skipped|duration_ms)/.test(l)),failed=text.split(/\r?\n/).filter(l=>/^not ok/.test(l));
console.log(JSON.stringify({files:files.length,status:result.status,summary,failed,log}));if(result.error)console.error(result.error.message);process.exitCode=result.status===0?0:1;
