"""Read PSP bundles, verify PBP layout and export publisher artwork. Never execute builds."""
import hashlib, io, json, pathlib, struct, tarfile, zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/psp-more-catalogue.json'
ART = ROOT / 'assets/images/psp-more'
ART.mkdir(parents=True, exist_ok=True)

def pbp(data, name):
    if len(data) < 40 or data[:4] != b'\x00PBP':
        raise ValueError('Invalid PBP: ' + name)
    offsets = list(struct.unpack_from('<8I', data, 8)) + [len(data)]
    if offsets != sorted(offsets) or offsets[0] < 40 or offsets[-2] > len(data):
        raise ValueError('Invalid PBP offsets: ' + name)
    return offsets

def main():
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    report = {'scope':'psp-more','files':[], 'executedPayloads':False}
    for item in catalog['items']:
        for file in item['files']:
            source = ROOT / file['local'].lstrip('/')
            if not source.is_file():
                raise ValueError('Download first: ' + str(source))
            raw = source.read_bytes()
            sha = hashlib.sha256(raw).hexdigest()
            if file.get('sha256') and file['sha256'] != sha:
                raise ValueError('Hash changed: ' + str(source))
            row = {'id':item['id'],'file':file['local'],'bytes':len(raw),'sha256':sha,'headerHex':raw[:16].hex(),'pbp':[]}
            contents = []
            if source.name.endswith('.zip'):
                with zipfile.ZipFile(io.BytesIO(raw)) as z:
                    if z.testzip() is not None:
                        raise ValueError('ZIP CRC failure')
                    row['members'] = z.namelist()
                    contents = [(i.filename,z.read(i)) for i in z.infolist() if i.filename.lower().endswith('.pbp') and i.file_size < 32*1024*1024]
                file['verifiedFormat'] = 'ZIP · CRC verified'
            elif source.name.endswith('.tar.gz'):
                with tarfile.open(fileobj=io.BytesIO(raw)) as t:
                    row['members'] = t.getnames()
                    contents = [(i.name,t.extractfile(i).read()) for i in t.getmembers() if i.isfile() and i.name.lower().endswith('.pbp') and i.size < 32*1024*1024]
                file['verifiedFormat'] = 'TAR.GZ · read verified'
            elif source.suffix == '.prx':
                if raw[:4] not in (b'\x7fELF', b'~PSP'):
                    raise ValueError('Not a PRX ELF/PSP module')
                file['verifiedFormat'] = 'PRX · module signature verified'
            elif source.suffix in ('.ptf','.ctf'):
                # PTF files use a PTF header. CTF has a PTF preview + a CTF trailer.
                if raw[:4] != b'\x00PTF':
                    raise ValueError('Missing PTF theme header: ' + source.name)
                file['verifiedFormat'] = source.suffix[1:].upper() + ' · PTF container header verified'
            else:
                raise ValueError('Unhandled format: ' + source.name)
            for name,data in contents:
                offsets = pbp(data,name)
                row['pbp'].append({'path':name,'bytes':len(data),'magic':'00 50 42 50','sha256':hashlib.sha256(data).hexdigest()})
                if not item.get('image'):
                    for index, label in [(4,'PIC1'), (1,'ICON0')]:
                        image = data[offsets[index]:offsets[index+1]]
                        if image.startswith(b'\x89PNG\r\n\x1a\n'):
                            image_path = ART / (item['id']+'.png')
                            image_path.write_bytes(image)
                            item['image'] = '/assets/images/psp-more/'+image_path.name
                            item['imageCredit'] = item['author']+' · '+label+' embedded in official PSP build'
                            item['imageSource'] = file['sourceUrl']
                            break
            if item['format'].startswith('EBOOT') and file.get('containsNativeApp', True) and not row['pbp']:
                raise ValueError('No native PBP in ' + source.name)
            file['nativePbpPaths'] = [r['path'] for r in row['pbp']]
            report['files'].append(row)
            print(item['id'],file['verifiedFormat'],len(row['pbp']),'PBP')
    CATALOG.write_text(json.dumps(catalog,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    (ROOT/'docs/qa/psp-more-format-verification.json').write_text(json.dumps(report,indent=2)+'\n')

if __name__ == '__main__':
    main()
