const fs=require('node:fs'),path=require('node:path');
const {preserve,fetchBytes}=require('./download-wiiu-theme-catalog.cjs');
const root=path.resolve(__dirname,'..'),staging=path.join(root,'docs/wiiu-homebrew-theme-staging');
async function main(){const records=[];for(const [id,name,version,url] of [
 ['stylemiiu','stylemiiu.wps','0.5.3','https://github.com/ThemeCafe/StyleMiiU-Plugin/releases/download/0.5.3/stylemiiu.wps'],
 ['themiify','themiify.wuhb','1.2.1','https://github.com/ThemeCafe/Themiify/releases/download/v1.2.1/themiify.wuhb']
]){const result=await fetchBytes(url,33554432),sourceFile=preserve(path.join(root,'downloads/wiiu-themes/tools',version,name),result.bytes);records.push({id,sourceFile,version,sourceUrl:url});console.log(id,version,result.bytes.length);}preserve(path.join(staging,'downloaded-tools.json'),Buffer.from(JSON.stringify(records,null,2)+'\n'));}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
