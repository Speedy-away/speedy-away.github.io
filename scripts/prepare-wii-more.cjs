/* Scoped Wii intake. Downloads official distribution packages; never runs them. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const staging = path.join(root, 'docs/tmp/wii-more');
const ids = ['fceugx', 'snes9xgx', 'vbagx', 'not64', 'wiimc', 'wiixplorer', 'supertux', 'cavestory', 'helium', 'scummvm', 'mgba', 'wiisxrx'];
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
async function get(url) {
  const response = await fetch(url, {signal: AbortSignal.timeout(120000), headers: {'User-Agent': 'whatsite-Wii-catalogue/1.0'}});
  if (!response.ok) throw Error(`HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 120 * 1024 * 1024) throw Error('Package exceeds intake bound');
  return bytes;
}
async function main() {
  fs.mkdirSync(staging, {recursive: true});
  if (process.argv.includes('--metadata')) {
    const all = JSON.parse((await get('https://hbb1.oscwii.org/api/v3/contents')).toString());
    const selected = all.filter(x => ids.includes(x.slug.toLowerCase()));
    for (const app of selected) {
      const source = `https://raw.githubusercontent.com/OpenShopChannel/Apps/master/contents/${app.slug}.oscmeta`;
      try {app.manifest = JSON.parse((await get(source)).toString());} catch (e) {app.manifestError = e.message;}
      app.manifestUrl = source;
    }
    fs.writeFileSync(path.join(staging, 'metadata.json'), JSON.stringify(selected, null, 2) + '\n');
    console.log(JSON.stringify(selected.map(x => ({slug:x.slug, version:x.version, bytes:x.file_size.zip_compressed, paths:x.subdirectories, platforms:x.supported_platforms, url:x.url, manifest:x.manifest})), null, 2));
  }
  if (process.argv.includes('--download')) {
    const apps = JSON.parse(fs.readFileSync(path.join(staging, 'metadata.json')));
    for (const app of apps) {
      const file = path.join(staging, app.slug + '-' + app.version.replace(/[^a-z0-9_.-]/gi, '_') + '.zip');
      if (!fs.existsSync(file)) fs.writeFileSync(file, await get(app.url.zip), {flag:'wx'});
      const bytes = fs.readFileSync(file);
      if (bytes.length !== app.file_size.zip_compressed || bytes.readUInt32LE(0) !== 0x04034b50) throw Error('ZIP length/signature differs: ' + app.slug);
      app.stagedFile = file; app.sha256 = sha256(bytes);
      console.log(`${app.slug} ${app.version} ${bytes.length} ${app.sha256}`);
    }
    fs.writeFileSync(path.join(staging, 'downloads.json'), JSON.stringify(apps, null, 2) + '\n');
    const bundledPython = path.join(require('node:os').homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
    const inspect = spawnSync(process.env.WII_PYTHON || (fs.existsSync(bundledPython) ? bundledPython : 'python'), [path.join(__dirname, 'verify-wii-packages.py')], {cwd:root,encoding:'utf8'});
    process.stdout.write(inspect.stdout || ''); process.stderr.write(inspect.stderr || '');
    if (inspect.status !== 0) throw Error('Package inspection failed');
  }
  if (process.argv.includes('--archive') || process.argv.includes('--catalog')) {
    const {createArchive} = require('./console-expansion-archive.cjs');
    const archive = createArchive();
    const apps = JSON.parse(fs.readFileSync(path.join(staging, 'downloads.json')));
    const checked = JSON.parse(fs.readFileSync(path.join(root, 'docs/wii-more-package-verification.json')));
    const publicFiles = process.argv.includes('--archive') ? [] : JSON.parse(fs.readFileSync(path.join(root,'docs/wii-more-files.json'))).files;
    if (process.argv.includes('--archive')) for (const app of apps) {
      const verified = checked.apps.find(x => x.slug === app.slug && x.sha256 === app.sha256);
      if (!verified || !verified.nativeFiles.length || !verified.crcPassed) throw Error('Unverified package ' + app.slug);
      const name = path.basename(app.stagedFile);
      const local = '/downloads/wii-more/' + name;
      const format = verified.bootPath.endsWith('.elf') ? 'ELF' : 'DOL';
      const result = await archive.archiveFile({scope:'wii-more', item:{id:'wii-more-' + app.slug, title:app.name, url:'https://oscwii.org/library/app/' + app.slug, platform:'Wii', category:[app.category === 'emulators' ? 'Emulators' : app.category === 'games' ? 'Homebrew Games' : 'Tools'], pages:['console/retro/wii.html']}, file:{name, sourceUrl:app.url.zip, version:app.version, expectedBytes:app.file_size.zip_compressed, expectedSha256:app.sha256, format:'ZIP with native Wii ' + format, archiveRole:['Builds'], local}, sourceFile:app.stagedFile});
      const publicPath = path.join(root, local);
      fs.mkdirSync(path.dirname(publicPath),{recursive:true});
      if (fs.existsSync(publicPath)) {
        if (sha256(fs.readFileSync(publicPath)) !== app.sha256) throw Error('Public file conflict: '+publicPath);
      } else fs.copyFileSync(app.stagedFile, publicPath, fs.constants.COPYFILE_EXCL);
      publicFiles.push({slug:app.slug, ...result.publicFile});
      console.log('Archived and mirrored ' + name);
    }
    fs.writeFileSync(path.join(root,'docs/wii-more-files.json'),JSON.stringify({checkedAt:new Date().toISOString(),files:publicFiles},null,2)+'\n');
    const descriptions = require('./wii-more-descriptions.cjs');
    const catalogue = apps.map(app => {
      const verified = checked.apps.find(x=>x.slug === app.slug);
      const published = publicFiles.find(x=>x.slug === app.slug);
      for(const record of [verified,published]) if(!record || record.version !== app.version || record.bytes !== app.file_size.zip_compressed || record.sha256 !== app.sha256) throw Error('Archive/catalogue version mismatch for ' + app.slug + '; archive this inspected version first');
      if(sha256(fs.readFileSync(path.join(root,published.local))) !== app.sha256) throw Error('Published ZIP differs from inspected build: ' + app.slug);
      return {id:app.slug, title:app.name, version:app.version, author:app.author, ...descriptions[app.slug], advertisedPlatforms:app.supported_platforms, supportedPlatforms:app.supported_platforms.filter(x=>!descriptions[app.slug].excludedModels?.includes(x)), peripherals:[...new Set(app.peripherals)], systemMenu:'OSC specifies no System Menu version for this app; a working Homebrew Channel for your console model is required.', bootPath:'/' + verified.bootPath, image:verified.icon, format:'ZIP · native Wii ' + (verified.bootPath.endsWith('.elf') ? 'ELF' : 'DOL'), package:published, sources:{distribution:'https://oscwii.org/library/app/' + app.slug, manifest:app.manifestUrl, upstream:app.manifest.source}, checkedAt:new Date().toISOString()};
    });
    fs.writeFileSync(path.join(root,'docs/wii-more-catalog.json'),JSON.stringify({schemaVersion:1,scope:'wii-more',apps:catalogue},null,2)+'\n');
  }
}
if(require.main === module) main().catch(e=>{console.error(e);process.exitCode=1;});
