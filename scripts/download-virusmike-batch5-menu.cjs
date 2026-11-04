// One exact source-linked menu archive; no downloaded program is executed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir='docs/tmp/console-batch5';
async function main(){
  const source='https://www.mediafire.com/file/4hsmuzvkf0gfjm9/SilentShadowV2%252BElf_Injector.rar/file';
  const report={checkedAt:new Date().toISOString(),source,sourcePage:'https://sites.google.com/view/im-virusmike-exe/ps4-all-you-need/cod-ghosts',complete:false};
  try{
    const page=await fetch(source,{signal:AbortSignal.timeout(20000)});if(!page.ok)throw Error('Source HTTP '+page.status);
    const html=await page.text(),tag=[...html.matchAll(/<a\b[^>]*>/gi)].map(x=>x[0]).find(t=>/id=["']downloadButton["']/.test(t));
    const direct=tag?.match(/href=["']([^"']+)["']/)?.[1]?.replaceAll('&amp;','&');
    if(!direct||!new URL(direct).hostname.endsWith('.mediafire.com'))throw Error('Direct source unavailable');
    const response=await fetch(direct,{signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Download HTTP '+response.status);
    const max=16*1024*1024;if(Number(response.headers.get('content-length'))>max)throw Error('Source exceeds selected menu bound');
    let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>max)throw Error('Download exceeds bound');chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);if(bytes.subarray(0,4).toString()!=='Rar!')throw Error('Not an original RAR archive');
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),file=dir+'/SilentShadowV2-Elf-Injector-'+sha256.slice(0,12)+'.rar';
    if(fs.existsSync(path.join(root,file))){if(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')!==sha256)throw Error('Existing file conflict');}
    else fs.writeFileSync(path.join(root,file),bytes,{flag:'wx'});
    Object.assign(report,{complete:true,bytes:bytes.length,sha256,stagedPath:file});
  }catch(error){report.error=error.message;}
  fs.writeFileSync(path.join(root,dir,'silentshadow-transfer.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main();
