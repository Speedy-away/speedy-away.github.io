// Resume into a NEW copy; preserve the original partial and never run its contents.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir='docs/tmp/console-batch5';
const capture=JSON.parse(fs.readFileSync(path.join(root,dir,'cjhouse-direct.json'),'utf8'));
const stamp=Date.now(),target=path.join(root,dir,'zm_cjhouse-'+stamp+'.rar');
fs.copyFileSync(path.join(root,capture.partial),target,fs.constants.COPYFILE_EXCL);
const before=fs.statSync(target).size;
const result=cp.spawnSync('curl.exe',['-L','--fail','--max-time','150','--retry','0','-sS','-C',String(before),'-o',target,capture.url],{encoding:'utf8',timeout:160000});
const bytes=fs.statSync(target).size;
const report={checkedAt:new Date().toISOString(),source:capture.source,priorPartial:capture.partial,retainedPartialBytes:before,stagedPath:path.relative(root,target).replaceAll('\\','/'),expectedBytes:capture.expectedBytes,bytes,complete:false,transferExitCode:result.status,error:result.stderr||result.error?.message||null};
if(result.status===0&&bytes===capture.expectedBytes){
  const tested=cp.spawnSync('C:/Program Files/7-Zip/7z.exe',['t','-bd','-y',target],{encoding:'utf8',timeout:60000});
  const listing=cp.spawnSync('C:/Program Files/7-Zip/7z.exe',['l','-slt',target],{encoding:'utf8',timeout:30000});
  fs.writeFileSync(path.join(root,dir,'cjhouse-layout.txt'),listing.stdout||'');
  report.archiveTestExitCode=tested.status;report.complete=tested.status===0&&listing.status===0;
  if(report.complete)report.sha256=crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
}
fs.writeFileSync(path.join(root,dir,'cjhouse-transfer.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.complete)process.exitCode=1;
