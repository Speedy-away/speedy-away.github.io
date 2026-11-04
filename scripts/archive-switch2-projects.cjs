const fs=require('node:fs'),path=require('node:path');
const {createArchive}=require('./console-expansion-archive.cjs');
const jobs=[['pico1','Pico 1 / RP2040','f9ce6aa5ca98271768e508a8dc30a662ced9a5065c34c608d1e7ea8e19f4de93'],['pico2','Pico 2 / RP2350','13e16ae13a30c0e1d8bf5f24ac0871c5855083edab4544c3fb3b6f1a3f8fd95b']];
async function main(){const report=path.join(__dirname,'../docs/switch2-project-downloads.json');const archive=createArchive(),files=fs.existsSync(report)?JSON.parse(fs.readFileSync(report)).files.filter(f=>!(f.project==='civswitch'&&f.version==='1.0')):[];for(const [id,label,sha] of jobs){
 const name='civ7-'+id+'.uf2',sourceUrl='https://github.com/Gezine/CivSwitch/releases/download/1.0/'+name;
 const response=await fetch(sourceUrl);if(!response.ok)throw Error('HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length%512||bytes.readUInt32LE(0)!==0x0a324655||bytes.readUInt32LE(4)!==0x9e5d5157)throw Error('Invalid UF2');
 for(let i=0;i<bytes.length;i+=512)if(bytes.readUInt32LE(i+508)!==0x0ab16f30)throw Error('Invalid UF2 block');
 const result=await archive.writeBytes({scope:'switch2-projects',item:{id:'switch2-projects-civswitch-'+id,title:'CivSwitch '+label,url:'https://github.com/Gezine/CivSwitch',platform:'Nintendo Switch 2',category:['Tools','CivSwitch'],pages:['console/nintendo-switch-2.html']},file:{name,sourceUrl,version:'1.0',archiveRole:['Helpers'],expectedSha256:sha},bytes});
 const local='/downloads/nintendo-switch-2/civswitch/1.0/'+name,target=path.join(__dirname,'..',local);fs.mkdirSync(path.dirname(target),{recursive:true});if(fs.existsSync(target)&&!fs.readFileSync(target).equals(bytes))throw Error('Different mirror exists');if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{flag:'wx'});
 files.push({...result.publicFile,project:'civswitch',label,local});
 }fs.writeFileSync(path.join(__dirname,'../docs/switch2-project-downloads.json'),JSON.stringify({checkedAt:new Date().toISOString(),files},null,2)+'\n');console.log('Archived two verified UF2 files; nothing executed.');}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});

