// Read-only file/network QA. Downloads are hashed as data and never executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const backup = 'F:/whatsite-backup-downloads-etc';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const unescape = value => value.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
const identity = file => JSON.stringify([file.name || file.filename || '', file.sha256 || '', file.version || file.releaseTag || '', file.sourceUrl || file.resolvedUrl || '']);
async function httpFile(url, expected) {
  const response = await fetch(url, {signal:AbortSignal.timeout(45000)});
  assert.equal(response.status, 200, url);
  const digest = crypto.createHash('sha256'); let bytes = 0;
  for await (const chunk of response.body) { bytes += chunk.length; assert(bytes <= expected.bytes, 'Unexpected larger file: '+url); digest.update(chunk); }
  assert.equal(bytes, expected.bytes, url);
  assert.equal(digest.digest('hex'), expected.sha256, url);
  return {url, status:200, bytes, sha256:expected.sha256};
}
async function main() {
  const catalog = read(path.join(root, 'docs/psp-more-catalogue.json'));
  const sidecar = read(path.join(root, 'docs/psp-more-private-inventory.json'));
  const inventories = [read(path.join(root,'docs/download-audit.json')),read(path.join(backup,'download-inventory.json'))];
  const index = fs.readFileSync(path.join(backup,'index.html'),'utf8');
  const checksums = fs.readFileSync(path.join(backup,'CHECKSUMS.sha256'),'utf8');
  const report = {checkedAt:new Date().toISOString(), pageLinks:0, entries:catalog.items.length, files:0, bytes:0, http:[], upstream:[], archiveLinks:0, baselineRecords:0};
  for (const route of ['console/retro/psp.html','console/retro/index.html','console/themes.html']) {
    const html = fs.readFileSync(path.join(root,route),'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
    assert.equal(ids.length,new Set(ids).size,'Duplicate IDs: '+route);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      const href = unescape(match[1]);
      if (!href || href === '#' || /^(?:https?:|mailto:|tel:|data:|javascript:)/.test(href)) continue;
      const url = new URL(href,'https://whatwhatboy.com/'+route);
      let target = path.join(root, decodeURIComponent(url.pathname));
      if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target,'index.html');
      assert(fs.existsSync(target),'Missing link: '+route+' '+href);
      if (url.hash && target.endsWith('.html')) assert(fs.readFileSync(target,'utf8').includes('id="'+decodeURIComponent(url.hash.slice(1))+'"'),'Missing anchor: '+href);
      report.pageLinks++;
    }
    for (const integration of [/languages\/i18n\.js\?v=3/, /mobile\.css/, /site-background/]) assert.match(html,integration,route);
  }
  const pspHtml = fs.readFileSync(path.join(root,'console/retro/psp.html'),'utf8');
  const themeHtml = fs.readFileSync(path.join(root,'console/themes.html'),'utf8');
  for (const item of catalog.items) for (const file of item.files) {
    const local = fs.readFileSync(path.join(root,file.local));
    assert.equal(local.length,file.bytes); assert.equal(hash(local),file.sha256);
    assert(pspHtml.includes('href="'+(item.directSourceOnly ? file.sourceUrl : file.local)+'"'),'Missing download action');
    let archived;
    for (const inventory of inventories) {
      const row = inventory.items.find(row=>row.id==='psp-more-'+item.id);
      assert(row,'Missing PSP inventory entry');
      archived = row.files.find(candidate=>identity(candidate)===identity(file));
      assert(archived,'Missing PSP version/source');
    }
    const bytes = fs.readFileSync(archived.backupPath);
    assert.equal(bytes.length,file.bytes); assert.equal(hash(bytes),file.sha256);
    const relative = path.relative(backup,archived.backupPath).replaceAll('\\','/');
    assert(checksums.includes(file.sha256+'  '+relative),'Missing checksum row');
    assert(index.includes(relative.split('/').map(encodeURIComponent).join('/').replaceAll('&','&amp;')),'Missing archive index link');
    report.archiveLinks++; report.files++; report.bytes+=file.bytes;
    if (item.category==='Themes') {
      assert(themeHtml.includes('id="theme-psp-'+item.id+'"'),'Missing theme preview');
      assert(themeHtml.includes('href="'+file.local+'"'),'Missing theme download');
    }
    if (process.argv.includes('--http')) report.http.push(await httpFile(new URL(file.local,'http://127.0.0.1:8776').href,file));
    if (item.directSourceOnly && process.argv.includes('--upstream')) report.upstream.push(await httpFile(file.sourceUrl,file));
  }
  assert.match(themeHtml,/href="\/console\/retro\/psp.html#theme-setup"/);
  const hub = fs.readFileSync(path.join(root,'console/retro/index.html'),'utf8');
  // Shared route maintenance may use the PSP hub alias; preserve that routing.
  assert.match(hub,/href="\/console\/(?:retro\/psp.html|psp\/)">Explore PSP/);
  if (hub.includes('href="/console/psp/">Explore PSP')) assert.match(fs.readFileSync(path.join(root,'console/psp/index.html'),'utf8'),/\/console\/retro\/psp.html/);
  assert.equal((fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').match(/<loc>https:\/\/whatwhatboy.com\/console\/retro\/psp.html<\/loc>/g)||[]).length,1);
  const beforeDir=path.join(root,'docs/tmp/psp-archive-merge');
  if(fs.existsSync(beforeDir)) for(const name of fs.readdirSync(beforeDir).filter(name=>/^[0-9].*-(?:workspace|archive)\.json$/.test(name))) {
    for(const item of read(path.join(beforeDir,name)).items) for(const inventory of inventories) {
      const latest=inventory.items.find(row=>row.id===item.id); assert(latest,'Lost prior item '+item.id);
      for(const file of item.files||[]) {
        assert(latest.files.some(candidate=>identity(candidate)===identity(file) || candidate.sha256===file.sha256 && candidate.recoveryOriginalFileRecord && identity(candidate.recoveryOriginalFileRecord)===identity(file)),'Lost prior version/source '+item.id);
        report.baselineRecords++;
      }
    }
  }
  report.archive={items:inventories[1].items.length,fileRecords:inventories[1].items.reduce((sum,item)=>sum+(item.files||[]).length,0),indexRefresh:inventories[1].indexRefresh?.updated};
  report.priorRecordsPreserved=true; report.payloadsExecuted=false;
  fs.writeFileSync(path.join(root,'docs/qa/psp-final-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,http:report.http.length,upstream:report.upstream.length},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
