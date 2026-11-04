"""Verify archives as data only; never extract or execute members."""
import hashlib
import io
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parent.parent
build = json.loads((root / 'docs/afterglow-build.json').read_text())
inventory = json.loads((root / 'docs/afterglow-download-inventory.json').read_text())
records = []
for job in build['jobs']:
    data = (root / job['importPath']).read_bytes()
    assert len(data) == job['bytes']
    assert hashlib.sha256(data).hexdigest() == job['sha256']
    item = next(i for i in inventory['items'] if i['id'] == job['id'])
    saved = Path(item['files'][0]['backupPath']).read_bytes()
    assert saved == data
    members = None
    if job['filename'].endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            assert archive.testzip() is None
            names = archive.namelist()
            assert len(names) == len(set(names))
            assert all(n.startswith('afterglow/') and '..' not in n.split('/') for n in names)
            members = len(names)
            for entry in archive.infolist():
                relative = entry.filename[len('afterglow/'):]
                assert archive.read(entry) == (root / build['base'] / relative).read_bytes()
    records.append({'name':job['filename'], 'bytes':len(data), 'sha256':job['sha256'],
                    'backupVerified':True, 'zipMembersVerified':members})
sender = json.loads((root / 'docs/qa/afterglow-sender-build.json').read_text())
data = Path(sender['file']).read_bytes()
assert len(data) == sender['bytes']
assert hashlib.sha256(data).hexdigest() == sender['sha256']
assert Path(sender['backupPath']).read_bytes() == data
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    assert archive.testzip() is None
    prefix = 'whatwhatboy-console-payload-sender/'
    manifest = json.loads(archive.read(prefix+'bundle-manifest.json'))
    for entry in manifest['files']:
        member = archive.read(prefix+entry['name'])
        assert len(member) == entry['bytes']
        assert hashlib.sha256(member).hexdigest() == entry['sha256']
    sender_verification = {'version':sender['version'], 'bytes':len(data),
                           'sha256':sender['sha256'], 'zipMembers':len(archive.namelist()),
                           'manifestRecords':len(manifest['files']), 'backupVerified':True}
report = {'payloadsExecuted':False, 'method':'Independent Python ZIP/CRC/SHA reader; no extraction or execution',
          'artifacts':records, 'sender':sender_verification}
(root / 'docs/qa/afterglow-artifact-integrity.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'verifiedArtifacts':len(records), 'sender':sender_verification},indent=2))
