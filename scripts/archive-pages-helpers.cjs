'use strict';
// Archive authored receiver snapshots without executing any downloaded code.
const fs = require('node:fs');
const path = require('node:path');
const {destinationForFile} = require('./download-archive-layout.cjs');
const {storePreserving, mergeAudit, writeJSON, sha} = require('./import-host-game-actions.cjs');
const root = path.resolve(__dirname, '..');
const backup = path.resolve('F:/whatsite-backup-downloads-etc');
const {jobs} = JSON.parse(fs.readFileSync(path.join(root, 'docs/qa/host-menu-companion-jobs.json')));
const items = jobs.map(job => {
  const bytes = fs.readFileSync(path.join(root, job.importPath));
  if (bytes.length !== job.expectedBytes || sha(bytes) !== job.expectedSha256) throw Error('Receiver input mismatch');
  const item = {id:job.id, title:job.title, project:job.project, platform:job.platform, category:job.category, release:job.version, url:job.url, pages:job.pages, status:'downloaded', files:[]};
  const file = {name:job.filename, version:job.version, releaseTag:job.version, bytes:bytes.length, sha256:sha(bytes), sourceUrl:job.url, local:'/'+job.importPath, archiveRole:job.archiveRole};
  file.backupPath = storePreserving(destinationForFile(backup, item, file), bytes, backup);
  if (sha(fs.readFileSync(file.backupPath)) !== file.sha256) throw Error('Receiver archive verification failed');
  item.files.push(file);
  return item;
});
const inventory = {schemaVersion:1, updated:new Date().toISOString(), backupRoot:backup, payloadsExecuted:false, items};
writeJSON(path.join(root, 'docs/pages-helper-download-inventory.json'), inventory);
mergeAudit(inventory);
console.log(JSON.stringify({archived:items.length, verified:true}));
