// Read only image-cache entries belonging to the site's captured source posts.
// Never reads account/session stores or executes downloaded content.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const targets=new Map();
for(const platform of ['ps3','xbox360']) for(const item of [...read(`docs/discord-${platform}-resources.json`).resources,...(platform==='xbox360'?read('docs/xbox360-mod-resources.json').resources:[])]){
 const thread=item.source?.match(/\/channels\/\d+\/(\d+)/)?.[1];
 if(thread)targets.set(thread,[...(targets.get(thread)||[]),{id:item.id,name:item.name,source:item.source,platform}]);
}
const cache=process.argv.find(x=>x.startsWith('--cache='))?.slice(8);
if(!cache)throw Error('Pass an explicit --cache= path to the image Cache_Data directory.');
const results=[],seen=new Set(),blocks=new Map();
function block(name){if(!blocks.has(name))blocks.set(name,fs.readFileSync(path.join(cache,name)));return blocks.get(name);}
function address(addr,size){
 if(!(addr&0x80000000)||size<1||size>30000000)return null;
 try{const type=(addr>>>28)&7;if(!type)return fs.readFileSync(path.join(cache,'f_'+(addr&0xfffffff).toString(16).padStart(6,'0'))).subarray(0,size);
 const bytes=block('data_'+((addr>>>16)&255)),unit={1:36,2:256,3:1024,4:4096}[type];if(!unit)return null;
 const offset=8192+(addr&65535)*unit;if(offset+size>bytes.length)return null;return bytes.subarray(offset,offset+size);
 }catch{return null;}
}
const entries=[];
for(const name of fs.readdirSync(cache)){
 if(/^data_\d+$/.test(name)){
  const bytes=block(name);if(bytes.readInt32LE(12)!==256)continue;
  for(let offset=8192;offset+256<=bytes.length;offset+=256){
   const keylen=bytes.readInt32LE(offset+32),state=bytes.readInt32LE(offset+20);
   if(keylen<1||keylen>8192||state<0||state>2)continue;
   const long=bytes.readUInt32LE(offset+36),keyBytes=long?address(long,keylen):bytes.subarray(offset+96,offset+96+keylen);
   if(!keyBytes)continue;const key=keyBytes.toString('latin1');
   if(!/https:\/\/(?:media\.discordapp\.net|cdn\.discordapp\.com)\/attachments\//.test(key))continue;
   entries.push({key,body:()=>address(bytes.readUInt32LE(offset+60),bytes.readInt32LE(offset+44))});
  }
 }else if(/^[a-f0-9]+_[01]$/i.test(name)){const b=fs.readFileSync(path.join(cache,name));entries.push({key:b.subarray(0,12000).toString('latin1'),body:()=>b});}
}
for(const entry of entries){
 const key=entry.key;
 const match=key.match(/https:\/\/(?:media\.discordapp\.net|cdn\.discordapp\.com)\/attachments\/(\d+)\/(\d+)\/[^\s\x00-\x1f]+/);
 if(!match||!targets.has(match[1]))continue;
 const b=entry.body();if(!b)continue;
 const url=match[0].replace(/[\x7f-\xff].*$/,'');
 let start=-1,end=-1,ext;
 const png=b.indexOf(Buffer.from('89504e470d0a1a0a','hex'));
 const jpeg=b.indexOf(Buffer.from('ffd8ff','hex'));
 const webp=b.indexOf(Buffer.from('RIFF'));
 // Response bodies start with their format header. Prefer the outer WEBP
 // container over coincidental JPEG marker bytes in its compressed payload.
 if(webp===0&&b.toString('ascii',8,12)==='WEBP'){start=0;end=8+b.readUInt32LE(4);ext='webp';}
 else if(/^GIF8[79]a$/.test(b.toString('ascii',0,6))){start=0;end=b.length;ext='gif';}
 else if(png===0){start=png;const tail=b.indexOf(Buffer.from('0000000049454e44ae426082','hex'),start);if(tail>=0)end=tail+12;ext='png';}
 else if(jpeg===0){start=jpeg;const tail=b.lastIndexOf(Buffer.from('ffd9','hex'));if(tail>start)end=tail+2;ext='jpg';}
 if(start<0||end<=start||end>b.length)continue;
 const bytes=b.subarray(start,end),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 for(const target of targets.get(match[1])){
 if(seen.has(target.id+sha256))continue;seen.add(target.id+sha256);
 const image=`/assets/images/menu-previews/${target.platform}/original-${match[1]}-${match[2]}-${sha256.slice(0,12)}.${ext}`;
 results.push({...target,image,imageSourceUrl:url,attachmentId:match[2],bytes:bytes.length,sha256});
 if(process.argv.includes('--extract')){fs.mkdirSync(path.dirname(path.join(root,image)),{recursive:true});const output=path.join(root,image);if(fs.existsSync(output)&&!fs.readFileSync(output).equals(bytes))throw Error('Refusing overwrite');fs.writeFileSync(output,bytes);}
 }
}
const output={checkedAt:new Date().toISOString(),scope:'Only cached image responses whose attachment channel matches an existing captured mod resource post. No account or session stores accessed.',images:results};
fs.writeFileSync(path.join(root,'docs/qa/cached-menu-image-candidates.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({images:results.length,resources:new Set(results.map(x=>x.id)).size,platforms:Object.fromEntries(['ps3','xbox360'].map(p=>[p,new Set(results.filter(x=>x.platform===p).map(x=>x.id)).size]))}));
