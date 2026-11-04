import json,sys,zipfile,hashlib,struct
from pathlib import PurePosixPath
with zipfile.ZipFile(sys.argv[1]) as z:
    bad=z.testzip()
    if bad: raise ValueError('CRC failed: '+bad)
    builds=[]; xml=[]; regions=[]
    for e in z.infolist():
        p=PurePosixPath(e.filename.replace('\\','/'))
        if p.is_absolute() or '..' in p.parts: raise ValueError('Unsafe ZIP path')
        if e.filename.lower().endswith(('.wuhb','.rpx','.elf','.dol','.wps','.wms')):
            b=z.read(e); ext=p.suffix.lower()
            if ext=='.wuhb':
                if b[:4]!=b'WUHB': raise ValueError('Invalid WUHB')
            elif ext=='.dol':
                if len(b)<256: raise ValueError('Short DOL')
                w=struct.unpack('>64I',b[:256]); sections=[(w[i],w[i+18],w[i+36]) for i in range(18) if w[i+36]]
                if not sections or any(o<256 or o+n>len(b) or not 0x80000000<=a<0x94000000 for o,a,n in sections):raise ValueError('Invalid DOL sections')
                if not any(w[i+36] and w[i+18]<=w[56]<w[i+18]+w[i+36] for i in range(7)):raise ValueError('Invalid DOL entry')
            elif not(len(b)>52 and b[:6]==b'\x7fELF\x01\x02' and struct.unpack('>H',b[18:20])[0]==20):raise ValueError('Invalid PowerPC ELF: '+e.filename)
            builds.append({'path':e.filename,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
        if e.filename.lower().endswith('.xml'):
            xml.append(e.filename)
            if e.file_size<200000:
                import re
                regions+=re.findall(r'<id\s+game="([^"]+)"',z.read(e).decode('utf8',errors='replace'))
    print(json.dumps({'crcPassed':True,'entries':len(z.infolist()),'uncompressedBytes':sum(e.file_size for e in z.infolist()),'builds':builds,'xmlFiles':xml[:40],'patchGameIds':sorted(set(regions))}))
