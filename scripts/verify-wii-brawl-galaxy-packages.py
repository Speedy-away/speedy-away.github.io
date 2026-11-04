"""Inspect native binaries, ZIP CRCs and Riivolution XML without running downloads."""
import hashlib
import json
import struct
import subprocess
import re
import zipfile
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET
import importlib.util

spec = importlib.util.spec_from_file_location('wii_binary_inspection', Path(__file__).with_name('verify-wii-packages.py'))
binary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(binary)
inspect_dol, inspect_elf = binary.inspect_dol, binary.inspect_elf

ROOT = Path(__file__).resolve().parent.parent
STAGE = ROOT / 'docs/tmp/wii-brawl-galaxy'


def main():
    records = []
    jobs = json.loads((ROOT / 'docs/wii-brawl-galaxy-jobs.json').read_text(encoding='utf-8'))['jobs']
    for job in jobs:
        file = STAGE / job['filename']
        if not file.exists():
            continue
        digest = hashlib.file_digest(file.open('rb'), 'sha256').hexdigest()
        if job.get('expectedSha256') and digest != job['expectedSha256']:
            raise ValueError('Publisher SHA-256 does not match: ' + job['id'])
        if job.get('expectedMd5') and hashlib.file_digest(file.open('rb'), 'md5').hexdigest() != job['expectedMd5']:
            raise ValueError('Publisher MD5 does not match: ' + job['id'])
        row = {'id':job['id'], 'filename':file.name, 'bytes':file.stat().st_size, 'sha256':digest}
        if job.get('expectedSha256'):
            row.update(publisherSha256=job['expectedSha256'], publisherSha256Matched=True)
        if job.get('expectedMd5'):
            row['publisherMd5'] = job['expectedMd5']
            row['publisherMd5Matched'] = True
        if file.suffix.lower() == '.7z':
            seven = 'C:/Program Files/7-Zip/7z.exe'
            test = subprocess.run([seven, 't', str(file)], capture_output=True, text=True, check=True)
            listing = subprocess.run([seven, 'l', '-slt', str(file)], capture_output=True, text=True, check=True).stdout
            members = []
            for block in listing.split('----------\n', 1)[-1].strip().split('\n\n'):
                attrs = dict(line.split(' = ', 1) for line in block.splitlines() if ' = ' in line)
                if 'Path' in attrs:
                    name = attrs['Path'].replace('\\', '/')
                    if PurePosixPath(name).is_absolute() or '..' in PurePosixPath(name).parts or ':' in name:
                        raise ValueError('Unsafe 7z member')
                    members.append((name, int(attrs.get('Size', 0))))
            row.update(format='7z · Riivolution mod data', crcPassed=True, entryCount=len(members), uncompressedBytes=sum(n for _, n in members), roots=sorted({n.split('/')[0] for n,_ in members}), nativeFiles=[], patchXml=[], readmes={})
            for name, size in members:
                if size and size < 100000 and (name.lower().endswith('.xml') or 'readme' in name.lower()):
                    data = subprocess.run([seven, 'e', '-so', str(file), name], capture_output=True, check=True).stdout
                    if name.lower().endswith('.xml') and 'riivolution/' in name.lower():
                        tree = ET.fromstring(data)
                        row['patchXml'].append({'path':name, 'discs':[x.attrib for x in tree.iter('id')], 'regions':[x.attrib for x in tree.iter('region')], 'folders':[x.attrib for x in tree.iter('folder')], 'xml':data.decode('utf-8-sig', errors='replace')})
                    elif 'readme' in name.lower():
                        row['readmes'][name] = data.decode('utf-8-sig', errors='replace')
        elif file.suffix.lower() == '.exe':
            with file.open('rb') as f:
                header = f.read(64)
                if header[:2] != b'MZ':
                    raise ValueError('Not a PE executable')
                pe_offset = struct.unpack('<I', header[60:64])[0]
                f.seek(pe_offset)
                pe = f.read(26)
                if pe[:4] != b'PE\0\0' or struct.unpack('<H', pe[4:6])[0] != 0x8664:
                    raise ValueError('Expected Windows AMD64 PE')
            row['format'] = 'PE x64 · Windows helper'
        else:
            with zipfile.ZipFile(file) as z:
                for entry in z.infolist():
                    if PurePosixPath(entry.filename).is_absolute() or '..' in PurePosixPath(entry.filename).parts:
                        raise ValueError('Unsafe ZIP path')
                if z.testzip() is not None:
                    raise ValueError('CRC failed: ' + job['id'])
                names = z.namelist()
                row.update(crcPassed=True, entryCount=len(names), uncompressedBytes=sum(x.file_size for x in z.infolist()), roots=sorted({x.split('/')[0] for x in names}), nativeFiles=[], patchXml=[], readmes={})
                for name in names:
                    if name.lower().endswith(('/boot.dol', '/boot.elf')):
                        data = z.read(name)
                        try:
                            inspection = inspect_elf(data) if name.endswith('.elf') else inspect_dol(data)
                            row['nativeFiles'].append({'path':name, 'format':'ELF' if name.endswith('.elf') else 'DOL', 'headerPassed':True, **inspection})
                        except ValueError as e:
                            row['nativeFiles'].append({'path':name, 'headerPassed':False, 'note':str(e), 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest()})
                    if name.lower().endswith('.xml') and ('riivolution/' in name.lower() or job['id'] == 'mkw-sp'):
                        data = z.read(name)
                        try:
                            tree = ET.fromstring(data)
                            row['patchXml'].append({'path':name,'root':tree.tag,'discs':[x.attrib for x in tree.iter('id')], 'regions':[x.attrib for x in tree.iter('region')], 'folders':[x.attrib for x in tree.iter('folder')], 'xml':data.decode('utf-8-sig',errors='replace')[:20000]})
                        except ET.ParseError as e:
                            row['patchXml'].append({'path':name,'error':str(e)})
                    if ('readme' in name.lower() or name.lower().endswith('/version.txt')) and z.getinfo(name).file_size < 20000:
                        row['readmes'][name] = z.read(name).decode('utf-8-sig',errors='replace')
                icons = [x for x in names if x.lower().endswith('/icon.png') and '/apps/' in '/' + x.lower()]
                if icons:
                    icon = z.read(icons[0])
                    target = ROOT / 'assets/images/wii-brawl-galaxy' / (job['id']+'-hbc.png')
                    target.parent.mkdir(parents=True,exist_ok=True)
                    target.write_bytes(icon)
                    row['image'] = {'path':'/'+target.relative_to(ROOT).as_posix(),'credit':job['title']+' project · supplied Homebrew Channel banner','sourceUrl':job['url'],'sha256':hashlib.sha256(icon).hexdigest()}
                row['format'] = 'ZIP · standalone Wii DOL' if job['id']=='mkw-sp' else 'ZIP · mod data + Wii launcher' if job['kind']=='mod' and row['nativeFiles'] else 'ZIP · Riivolution mod data' if job['kind']=='mod' else 'ZIP · Wii homebrew'
        records.append(row)
        print(job['id'], row['format'], row['bytes'], 'CRC/header inspected')
    (ROOT / 'docs/wii-brawl-galaxy-package-verification.json').write_text(json.dumps({'records':records,'downloadsExecuted':False},indent=2)+'\n',encoding='utf-8')


if __name__ == '__main__':
    main()
