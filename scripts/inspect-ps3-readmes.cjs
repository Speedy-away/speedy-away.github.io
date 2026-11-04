// Static archive inspection only: list members and read documentation, never run builds.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'downloads/ps3/manifest.json'),'utf8'));
const requested=process.argv.find(arg=>arg.startsWith('--ids='))?.slice(6).split(',');
const output=path.join(root,'docs/discord-ps4-ps5-raw/platforms/archive-readmes.json');
const records=fs.existsSync(output)?JSON.parse(fs.readFileSync(output,'utf8')):[];
const tar=path.join(process.env.SystemRoot || 'C:/Windows','System32/tar.exe');
for(const file of manifest.files.filter(file=>file.status==='downloaded' && file.local?.startsWith('/downloads/ps3/') && /\.(?:rar|zip|7z)$/i.test(file.name) && (!requested || requested.includes(file.downloadId)))){
 if(records.some(record=>record.id===file.downloadId && record.sha256===file.sha256))continue;
 const target=path.resolve(root,'.'+file.local);
 if(!target.startsWith(path.join(root,'downloads/ps3')+path.sep))throw Error('Archive escaped collection');
 const listing=spawnSync(tar,['-tf',target],{encoding:'utf8',maxBuffer:1000000,timeout:15000});
 const members=(listing.stdout || '').split(/\r?\n/).filter(Boolean);
 const documentation=members.filter(member=>/(?:^|\/)(?:read.?me[^/]*|controls[^/]*|how to install[^/]*|install(?:ation)?[^/]*)\.txt$/i.test(member));
 const record={id:file.downloadId,sha256:file.sha256,members,documentation:[],...(listing.status?{error:listing.stderr.trim()}: {})};
 for(const member of documentation){
  const result=spawnSync(tar,['-xOf',target,member],{encoding:'utf8',maxBuffer:250000,timeout:10000});
  record.documentation.push({member,...(result.status?{error:result.stderr?.trim() || String(result.error)}:{text:result.stdout})});
 }
 records.push(record);
 console.log(file.downloadId+': '+members.length+' members, '+documentation.length+' documentation files');
}
fs.writeFileSync(output,JSON.stringify(records,null,2)+'\n');
