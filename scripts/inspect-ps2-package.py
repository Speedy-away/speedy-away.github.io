"""Inspect native PS2 ELF headers and package paths; never execute binaries."""
import json, sys, struct, zipfile, tarfile
from pathlib import PurePosixPath

target=sys.argv[1]
if len(sys.argv)==4:
    import os
    with zipfile.ZipFile(target) as z:
        info=z.getinfo(sys.argv[2])
        if info.file_size>16*1024*1024: raise ValueError('ELF too large')
        data=z.read(info)
        if not data.startswith(b'\x7fELF'): raise ValueError('Member is not ELF')
    os.makedirs(os.path.dirname(sys.argv[3]),exist_ok=True)
    with open(sys.argv[3],'xb') as out: out.write(data)
    sys.exit(0)
builds=[]
elfs=[]
def inspect(name,data):
    if name.lower().endswith('.elf'):
        if len(data)<52 or data[:4]!=b'\x7fELF' or data[4]!=1 or data[5]!=1:
            raise ValueError('Expected ELF32 little-endian: '+name)
        kind,machine=struct.unpack_from('<HH',data,16)
        if machine!=8 or kind!=2: raise ValueError('Expected MIPS executable: '+name)
        elfs.append({'path':name,'class':'ELF32','endian':'little','machine':'MIPS','type':'executable','bytes':len(data)})
    if name.lower().endswith(('.elf','.irx','.dat','.cfg','.lng','.pak','.adpcm','.png')):
        builds.append(name)
def valid(name):
    p=PurePosixPath(name.replace('\\','/'))
    if p.is_absolute() or '..' in p.parts or ':' in name: raise ValueError('Unsafe package member: '+name)
    return name
if target.lower().endswith('.elf'):
    with open(target,'rb') as f: inspect(PurePosixPath(target.replace('\\','/')).name,f.read())
    fmt='PS2 ELF'
elif target.lower().endswith('.zip'):
    with zipfile.ZipFile(target) as z:
        if sum(i.file_size for i in z.infolist())>256*1024*1024: raise ValueError('Excessive expanded package')
        for i in z.infolist():
            valid(i.filename)
            if (i.external_attr>>16)&0o170000==0o120000: raise ValueError('Symlink in package')
            if not i.is_dir(): inspect(i.filename,z.read(i))
        if z.testzip(): raise ValueError('ZIP CRC failure')
    fmt='ZIP'
elif target.lower().endswith(('.tar.gz','.tgz')):
    with tarfile.open(target) as t:
        if sum(i.size for i in t.getmembers())>256*1024*1024: raise ValueError('Excessive expanded package')
        for i in t.getmembers():
            valid(i.name)
            if i.issym() or i.islnk(): raise ValueError('Link in package')
            if i.isfile(): inspect(i.name,t.extractfile(i).read())
    fmt='TAR.GZ'
else: raise ValueError('Unsupported inspection format: '+target)
if not elfs and not any(n.lower().endswith('conf_theme.cfg') for n in builds):
    raise ValueError('No PS2 ELF or OPL theme configuration in package')
print(json.dumps({'format':fmt,'buildPaths':builds,'elfs':elfs}))
