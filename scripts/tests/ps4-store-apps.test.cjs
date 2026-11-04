const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),apps=require('../../docs/ps4-store-apps.json').resources,jobs=require('../../docs/ps4-store-apps-jobs.json').jobs;
const {sfo}=require('../prepare-ps4-store-apps.cjs');
const expected={'ps4-store-scratch-everywhere-1-3':['NTXS10053','01.30'],'ps4-store-mtp-explorer-2-0-0':['NUEX00001','02.00'],'ps4-store-switchfin-0-9-4':['SFIN00000','00.94'],'ps4-store-wiliwili-1-6-0':['WILI00000','01.60'],'ps4-store-sponsorblock-installer-1-0-0':['YTSB42069','1.00'],'ps4-store-itemzflow-1-08':['ITEM00001','01.08'],'ps4-store-xplorer-2-07':['LAPY20009','02.07']};
test('selected ready packages match the captured size, hash, title ID and application version',()=>{
  assert.equal(apps.length,9);
  const identities={...expected,'ps4-store-orbisshelf-0-2-0':['ORBS00001','0.20'],'ps4-store-pplay-3-8':['PPLA00001','3.8']};
  for(const app of apps){
    const job=jobs.find(j=>j.id===app.id);assert.ok(job);
    const bytes=fs.readFileSync(path.join(root,job.importPath));
    assert.equal(bytes.length,app.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),app.sha256);
    let pkg=bytes;
    if(app.id==='ps4-store-pplay-3-8'){
      const {inspectArchive}=require('../audit-console-ready-files.cjs');
      const archive=inspectArchive(path.join(root,job.importPath));
      const builds=archive.consoleFiles.filter(file=>file.path.endsWith('.pkg'));
      assert.equal(builds.length,1);assert.ok(archive.entries.some(file=>file.path==='pplay/data/pplay/mpv/subfont.ttf'&&file.bytes>0));
      pkg=require('node:child_process').execFileSync('C:/Program Files/7-Zip/7z.exe',['e','-so','-spd',path.join(root,job.importPath),builds[0].path],{maxBuffer:64*1024*1024});
      assert.equal(pkg.length,builds[0].bytes);assert.match(app.filename,/\.zip$/i);
    }else assert.match(app.filename,/\.pkg$/i);
    const info=sfo(pkg);assert.equal(info.TITLE_ID,identities[app.id][0]);assert.equal(info.APP_VER,identities[app.id][1]);
    assert.deepEqual(app.platforms,['ps4']);assert.ok(fs.existsSync(path.join(root,app.image.slice(1))));
  }
});
test('publisher-only packages are kept outside site downloads and retain official URLs',()=>{
  for(const id of ['ps4-store-mtp-explorer-2-0-0','ps4-store-xplorer-2-07']){const app=apps.find(a=>a.id===id),job=jobs.find(j=>j.id===id);assert.equal(job.mirror,false);assert.equal(app.local,undefined);assert.match(job.importPath,/^docs\/tmp\//);assert.match(app.url,/^https:\/\/(?:github\.com|pkg-zone\.com)\//);}
  assert.match(apps.find(a=>a.id==='ps4-store-mtp-explorer-2-0-0').distribution,/not cleared for redistribution/);
});
