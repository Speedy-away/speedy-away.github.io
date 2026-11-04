"""Read-only ZIP/CRC/native DOL inspection, plus public icon extraction. Never executes builds."""
import hashlib
import json
import struct
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
STAGING = ROOT / 'docs/tmp/wii-more'


def inspect_dol(data):
    if len(data) < 256:
        raise ValueError('Short DOL header')
    words = struct.unpack('>64I', data[:256])
    sections = []
    for index in range(18):
        offset, address, size = words[index], words[18 + index], words[36 + index]
        if not size:
            continue
        if offset < 256 or offset + size > len(data):
            raise ValueError('DOL section exceeds file')
        if not (0x80000000 <= address < 0x94000000):
            raise ValueError('DOL section outside Wii memory')
        sections.append({'kind': 'text' if index < 7 else 'data', 'offset': offset, 'address': hex(address), 'bytes': size})
    entry = words[56]
    if not any(s['kind'] == 'text' and int(s['address'], 16) <= entry < int(s['address'], 16) + s['bytes'] for s in sections):
        raise ValueError('DOL entry not in a text section')
    return {'entryPoint': hex(entry), 'sections': sections, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def inspect_elf(data):
    if len(data) < 52 or data[:6] != b'\x7fELF\x01\x02':
        raise ValueError('Expected ELF32 big-endian')
    header = struct.unpack('>HHIIIIIHHHHHH', data[16:52])
    kind, machine, version, entry, phoff, shoff, flags, ehsize, phsize, phnum, shsize, shnum, shstr = header
    if kind != 2 or machine != 20 or version != 1 or ehsize != 52 or phsize != 32:
        raise ValueError('Expected executable PowerPC ELF')
    if phoff + phsize * phnum > len(data):
        raise ValueError('ELF program table outside file')
    sections = []
    for index in range(phnum):
        segment = struct.unpack('>8I', data[phoff + index * phsize:phoff + (index + 1) * phsize])
        ptype, offset, address, physical, size, memsize, permissions, alignment = segment
        if ptype != 1:
            continue
        if offset + size > len(data) or memsize < size or not 0x80000000 <= address < 0x94000000:
            raise ValueError('Invalid ELF load segment')
        sections.append({'kind':'text' if permissions & 1 else 'data', 'offset':offset, 'address':hex(address), 'bytes':size, 'memoryBytes':memsize})
    if not any(s['kind'] == 'text' and int(s['address'], 16) <= entry < int(s['address'], 16) + s['memoryBytes'] for s in sections):
        raise ValueError('ELF entry not in executable load segment')
    return {'entryPoint':hex(entry), 'sections':sections, 'bytes':len(data), 'sha256':hashlib.sha256(data).hexdigest(), 'format':'ELF32 big-endian PowerPC'}


def main():
    reports = []
    for app in json.loads((STAGING / 'downloads.json').read_text(encoding='utf-8')):
        file = Path(app['stagedFile'])
        with zipfile.ZipFile(file) as package:
            for info in package.infolist():
                p = PurePosixPath(info.filename)
                if p.is_absolute() or '..' in p.parts or '\\' in info.filename:
                    raise ValueError('Unsafe archive path')
            if sum(x.file_size for x in package.infolist()) > 600 * 1024 * 1024:
                raise ValueError('Uncompressed bound exceeded')
            if package.testzip() is not None:
                raise ValueError('CRC failed')
            dols = []
            for name in package.namelist():
                if name.lower().endswith(('.dol', '.elf')):
                    dols.append({'path': name, **(inspect_dol(package.read(name)) if name.lower().endswith('.dol') else inspect_elf(package.read(name)))})
            if not dols:
                raise ValueError('No native executable: ' + app['slug'])
            boot = [x for x in dols if x['path'].lower().endswith(('/boot.dol', '/boot.elf'))]
            if len(boot) != 1:
                raise ValueError('Expected one HBC boot.dol/elf: ' + app['slug'])
            folder = str(PurePosixPath(boot[0]['path']).parent)
            meta = package.read(folder + '/meta.xml')
            xml = ET.fromstring(meta)
            icon = package.read(folder + '/icon.png')
            if not icon.startswith(b'\x89PNG\r\n\x1a\n'):
                raise ValueError('Icon is not PNG')
            icon_path = ROOT / 'assets/images/wii-more' / (app['slug'].lower() + '.png')
            icon_path.parent.mkdir(parents=True, exist_ok=True)
            icon_path.write_bytes(icon)
            artwork_credit = 'Courtesy of ' + app['name'] + ' project / distributed by Open Shop Channel'
            if app['slug'] == 'wiixplorer':
                artwork_credit = 'NeoRame / WiiXplorer / distributed by Open Shop Channel'
            report = {'slug':app['slug'], 'version':app['version'], 'bytes':file.stat().st_size, 'sha256':hashlib.sha256(file.read_bytes()).hexdigest(), 'crcPassed':True, 'entryCount':len(package.infolist()), 'uncompressedBytes':sum(x.file_size for x in package.infolist()), 'nativeFiles':dols, 'bootPath':boot[0]['path'], 'metaVersion':xml.findtext('version'), 'ahbAccess':xml.find('ahb_access') is not None, 'noIosReload':xml.find('no_ios_reload') is not None, 'icon':{'path':'/' + icon_path.relative_to(ROOT).as_posix(), 'sourceUrl':app['url']['icon'], 'credit':artwork_credit, 'sha256':hashlib.sha256(icon).hexdigest()}, 'files':package.namelist()}
            reports.append(report)
            print(app['slug'], 'CRC OK', boot[0]['path'], 'meta', report['metaVersion'])
    output = {'checkedAt':datetime.now(timezone.utc).isoformat(), 'payloadsExecuted':False, 'apps':reports}
    (ROOT / 'docs/wii-more-package-verification.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
