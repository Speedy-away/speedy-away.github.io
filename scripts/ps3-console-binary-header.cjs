// Read container/ELF headers only. This never loads or executes console code.
const fs=require('node:fs');
const path=require('node:path');
const reference='https://github.com/RPCS3/rpcs3/blob/master/rpcs3/Crypto/unself.h';
const requested=name=>/\.(?:sprx|prx|self|elf)$/i.test(name)||/\.sprx\s+Load In [^\\/]+$/i.test(name)||/^EBOOT\.BIN$/i.test(path.basename(name));
function consoleBinaryHeader(file,name=path.basename(file)){
 if(!requested(name))return;
 const actualBytes=fs.statSync(file).size,result={status:'invalid-console-header',actualBytes,reference,limitation:'Static container/PPU ELF recognition only; not a signature authenticity, menu identity, firmware compatibility or hardware execution test.'};
 const fd=fs.openSync(file,'r');
 const fail=reason=>{result.reason=reason;const error=Error('Invalid PS3 console binary header: '+reason);error.consoleBinaryHeader=result;throw error;};
 const read=(offset,bytes)=>{const b=Buffer.alloc(bytes);if(offset<0||offset+bytes>actualBytes||fs.readSync(fd,b,0,bytes,offset)!==bytes)fail('truncated header');return b;};
 try{
  if(actualBytes<64)fail('nonempty file is too small for a PPU ELF header');
  const start=read(0,Math.min(128,actualBytes));result.magicHex=start.subarray(0,4).toString('hex');
  let elfOffset=0,programTableLimit=BigInt(actualBytes),programTableOffset;
  if(result.magicHex==='53434500'){
   if(actualBytes<112)fail('truncated SCE/SELF extended header');
   const category=start.readUInt16BE(10),metadataOffset=start.readUInt32BE(12),headerBytes=start.readBigUInt64BE(16),extVersion=start.readBigUInt64BE(32),elfPosition=start.readBigUInt64BE(48);
   Object.assign(result,{container:'SCE/SELF',sceVersion:start.readUInt32BE(4),category,metadataOffset,headerBytes:headerBytes.toString(),extendedHeaderVersion:extVersion.toString(),elfOffset:elfPosition.toString()});
   if(category!==1||extVersion!==3n)fail('SCE container is not a PS3 SELF wrapper');
   if(headerBytes<112n||headerBytes>BigInt(actualBytes)||BigInt(metadataOffset)+32n>headerBytes)fail('SCE header bounds are inconsistent');
   if(elfPosition<112n||elfPosition+64n>headerBytes)fail('embedded ELF header is outside the SCE header');
   elfOffset=Number(elfPosition);programTableLimit=headerBytes;programTableOffset=start.readBigUInt64BE(56);
  }else if(result.magicHex==='7f454c46')result.container='ELF';
  else fail('file does not have SCE/SELF or ELF magic');
  const elf=read(elfOffset,64),magic=elf.subarray(0,4).toString('hex'),elfClass=elf[4],byteOrder=elf[5],identVersion=elf[6];
  if(magic!=='7f454c46'||elfClass!==2||byteOrder!==2||identVersion!==1)fail('ELF is not 64-bit big-endian format');
  const machine=elf.readUInt16BE(18),headerBytes=elf.readUInt16BE(52),programEntryBytes=elf.readUInt16BE(54),programCount=elf.readUInt16BE(56);
  Object.assign(result,{elfClass,byteOrder:'big-endian',machine,elfType:'0x'+elf.readUInt16BE(16).toString(16),elfOsAbi:elf[7],elfHeaderBytes:headerBytes,programEntryBytes,programCount});
  if(machine!==21||headerBytes<64||elf.readUInt32BE(20)!==1)fail('ELF does not identify a PowerPC64 PPU image');
  if(programTableOffset===undefined)programTableOffset=elf.readBigUInt64BE(32);
  if(!programCount||programEntryBytes<56||programTableOffset<64n||programTableOffset+BigInt(programEntryBytes)*BigInt(programCount)>programTableLimit)fail('ELF program-header table is absent or outside the container');
  result.status='valid-static-PS3-PPU-header';result.programTableOffset=programTableOffset.toString();return result;
 }finally{fs.closeSync(fd);}
}
module.exports={consoleBinaryHeader,requested};
