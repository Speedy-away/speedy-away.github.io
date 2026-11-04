// Signature/bounds identification only; this does not install, decrypt or run
// packages and does not establish firmware or package-install compatibility.
// FIH fields follow the pinned LibProsperoPkg 2.6.0 reader/layout:
// https://github.com/kvnhrt/ps5-browser-app/tree/d427877157b5ffdf90847a0c3ad54c7025100f55/tools/LibProsperoPKG
function consolePackageFormat(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 4) return null;
  const magic=bytes.subarray(0,4).toString('hex');
  if(magic==='7f504b47')return 'PKG container';
  if(magic==='7f434e54')return 'CNT package';
  if(magic!=='7f464948'||bytes.length<0x10000||bytes.readUInt16LE(6)!==3||![0,128].includes(bytes[5]))return null;
  const image=Number(bytes.readBigUInt64LE(0x10)),size=Number(bytes.readBigUInt64LE(0x18)),cnt=Number(bytes.readBigUInt64LE(0x58));
  if(![image,size,cnt].every(Number.isSafeInteger)||image<0x10000||size<=0||image+size>bytes.length||cnt<image+size||cnt+0x1000>bytes.length)return null;
  if(bytes.subarray(cnt,cnt+4).toString('hex')!=='7f434e54')return null;
  const count=bytes.readUInt32BE(cnt+0x10),table=cnt+bytes.readUInt32BE(cnt+0x18);
  if(count>0x10000||table<cnt||table+count*32>bytes.length)return null;
  for(let i=0;i<count;i++) {
    const row=table+i*32,start=cnt+bytes.readUInt32BE(row+16),entrySize=bytes.readUInt32BE(row+20);
    if(start<cnt||start+entrySize>bytes.length)return null;
  }
  return bytes[5]===0?'PS5 FIH debug':'PS5 FIH retail';
}
module.exports={consolePackageFormat};
