// Upload large histories without rewriting commits or changing the working tree.
// Default: read-only plan. Use --push to upload and fast-forward origin/main.
const {execFileSync, spawnSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--push' && !/^--batch-mib=\d+$/.test(arg) && !/^--target-ref=refs\/heads\/(?:main|codex\/[a-z0-9-]+)$/.test(arg))) throw new Error('Usage: node scripts/push-in-batches.cjs [--push] [--batch-mib=768] [--target-ref=refs/heads/codex/review-name]');
const targetRef=args.find(arg=>arg.startsWith('--target-ref='))?.slice('--target-ref='.length)||'refs/heads/main';
const upload = args.includes('--push');
const batchMiB = Number(args.find(arg => arg.startsWith('--batch-mib='))?.split('=')[1] || 768);
if (batchMiB < 1 || batchMiB > 768) throw new Error('Batch size must be between 1 and 768 MiB.');
const limit = batchMiB * 1024 * 1024;
function git(args, options = {}) {
  return execFileSync('git', ['-c','credential.username=Speedy-away',...args], {cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}, ...options}).trim();
}
function push(refspec, lease, negotiate = false) {
  const result = spawnSync('git', ['-c', 'http.version=HTTP/1.1','-c','credential.username=Speedy-away',
    ...(negotiate ? ['-c', 'push.negotiate=true'] : []), 'push', '--progress',
    ...(lease ? [`--force-with-lease=${lease}`] : []), 'origin', refspec], {cwd: root, stdio: 'inherit',env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Upload stopped. Rerun the same command to resume; files and commits are unchanged.');
}
const head = git(['rev-parse', 'HEAD']);
if (git(['branch', '--show-current']) !== 'main') throw new Error('Run this from main.');
const remoteURL = git(['remote', 'get-url', '--push', 'origin']);
const stateDir = git(['rev-parse', '--git-path', 'batch-upload']);
const stateFile = path.resolve(root, stateDir, `${head}-${targetRef.replaceAll('/','-')}.json`);
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
if (state && (state.head !== head || state.remoteURL !== remoteURL || state.batchMiB !== batchMiB)) throw new Error('Saved upload does not match this repository or batch size.');
const remoteMain = upload ? git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s/)[0] : git(['rev-parse', 'origin/main']);
if (!remoteMain) throw new Error('Cannot find origin/main.');
if (remoteMain === head) {
  console.log('origin/main already matches HEAD. No upload needed.');
  process.exit(0);
}
git(['merge-base', '--is-ancestor', remoteMain, head]);
const base = state ? state.base : remoteMain;
const objects = git(['rev-list', '--objects', head, `^${base}`]).split('\n').map(line => line.split(' ')[0]);
const rows = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {input: objects.join('\n') + '\n'}).split('\n');
const batches = [];
let batch = [], bytes = 0, total = 0;
for (const row of rows) {
  const [oid, type, rawSize] = row.split(' ');
  if (type !== 'blob') continue;
  const size = Number(rawSize);
  if (size > 100 * 1024 * 1024) throw new Error(`Blob ${oid} exceeds GitHub's 100 MiB file limit. Resolve this before uploading.`);
  if (batch.length && bytes + size > limit) { batches.push({objects: batch, bytes}); batch = []; bytes = 0; }
  batch.push(oid); bytes += size; total += size;
}
if (batch.length) batches.push({objects: batch, bytes});
console.log(`${objects.length} new objects; ${(total / 1024 ** 3).toFixed(2)} GiB of blobs; ${batches.length} batches (maximum ${batchMiB} MiB, or one file, each).`);
console.log('Original commits, working files, index and local main are preserved.');
if (!upload) { console.log('To upload: node scripts/push-in-batches.cjs --push'); process.exit(0); }
const ref = `refs/heads/codex/upload-objects-${head.slice(0, 12)}`;
const date = git(['show', '-s', '--format=%cI', head]);
const env = {...process.env, GIT_AUTHOR_NAME: 'whatsite batch uploader', GIT_AUTHOR_EMAIL: 'batch-upload@localhost',
  GIT_COMMITTER_NAME: 'whatsite batch uploader', GIT_COMMITTER_EMAIL: 'batch-upload@localhost', GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date};
let parent = base;
// Similar retained ZIPs need the same Git pathname hint to become delta
// candidates. Hash-only names scatter them among unrelated objects. Preserve
// the old tree format when resuming an upload created by an earlier version.
const groupedPaths = !state || state.treePathFormat === 'grouped';
const commits = batches.map((part, i) => {
  const tree = git(['mktree'], {input: part.objects.map(oid => `100644 blob ${oid}\t${oid}${groupedPaths ? '.whatsite-preserved-download-object' : ''}\n`).sort().join('')});
  const commit = git(['-c', 'commit.gpgsign=false', 'commit-tree', tree, '-p', parent],
    {input: `Upload objects ${i + 1}/${batches.length} for ${head}\n`, env});
  parent = commit;
  return commit;
});
if (state && JSON.stringify(state.commits) !== JSON.stringify(commits)) throw new Error('Saved batch plan changed; refusing to overwrite the staging branch.');
// Anchor the original history to the already-uploaded objects on the staging
// branch. Some servers advertise only the destination ref during a push;
// without this step, a push to main can resend every blob despite staging.
const bridge = git(['-c', 'commit.gpgsign=false', 'commit-tree', git(['rev-parse', `${head}^{tree}`]),
  ...commits.slice().reverse().flatMap(commit => ['-p', commit]), '-p', head],
  {input: `Anchor original history for ${head}\n`, env});
// Every batch is a direct boundary parent: Git can then exclude its tree,
// including blobs no longer present in the last batch's tree.
if (commits.length) {
  const remaining = git(['rev-list', '--objects', bridge, `^${commits.at(-1)}`]).split('\n').map(row => row.split(' ')[0]);
  const types = git(['cat-file', '--batch-check=%(objecttype)'], {input: remaining.join('\n') + '\n'}).split('\n');
  if (types.includes('blob')) throw new Error('Final handoff would resend blobs. Stopping before uploading.');
  console.log(`Final handoff verified locally: ${remaining.length} metadata objects, zero file blobs.`);
}
if (!state) {
  state = {head, base, remoteURL, ref, commits, bytes: total, batchMiB, treePathFormat:'grouped', createdAt: new Date().toISOString()};
  fs.mkdirSync(path.dirname(stateFile), {recursive: true});
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
}
let remoteStage = git(['ls-remote', 'origin', ref]).split(/\s/)[0];
const completed = remoteStage === bridge ? commits.length : remoteStage ? commits.indexOf(remoteStage) + 1 : 0;
if (remoteStage && completed === 0) throw new Error('Staging branch has unexpected changes; refusing to replace it.');
for (let i = completed; i < commits.length; i++) {
  console.log(`\nUploading batch ${i + 1}/${commits.length}: ${(batches[i].bytes / 1024 ** 2).toFixed(1)} MiB before compression.`);
  push(`${commits[i]}:${ref}`, `${ref}:${remoteStage}`);
  remoteStage = commits[i];
}
if (git(['rev-parse', 'HEAD']) !== head) throw new Error('HEAD changed during upload. Rerun from the intended main commit.');
if (remoteStage !== bridge) {
  console.log('\nAll large objects uploaded. Anchoring original history on the temporary branch.');
  push(`${bridge}:${ref}`, `${ref}:${remoteStage}`);
  remoteStage = bridge;
}
console.log('\nPushing the original commits to '+targetRef+' with object negotiation.');
push(`${head}:${targetRef}`, undefined, true);
if (git(['ls-remote', 'origin', targetRef]).split(/\s/)[0] !== head) throw new Error('Remote verification failed. Staging branch retained.');
git(['update-ref', targetRef.replace('refs/heads/','refs/remotes/origin/'), head]);
console.log('Verified '+targetRef+' matches the original local HEAD. Removing the temporary upload branch.');
push(`:${ref}`, `${ref}:${remoteStage}`);
state.completedAt = new Date().toISOString();
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
console.log('Push complete. Verified '+targetRef+' at '+head+'.');
