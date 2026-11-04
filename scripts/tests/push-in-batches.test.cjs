const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {randomBytes} = require('node:crypto');

test('batch upload preserves original history, dirty files and index, and cleans staging', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsite-push-test-'));
  const work = path.join(temp, 'work'), remote = path.join(temp, 'remote.git');
  fs.mkdirSync(work);
  const git = (...args) => execFileSync('git', args, {cwd: work, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
  try {
    git('init', '--bare', remote);
    git('init', '-b', 'main');
    git('config', 'user.name', 'Upload Test');
    git('config', 'user.email', 'upload-test@localhost');
    fs.writeFileSync(path.join(work, 'base.txt'), 'base\n');
    git('add', '.'); git('commit', '-m', 'base');
    git('remote', 'add', 'origin', remote);
    git('push', '-u', 'origin', 'main');
    const base = git('rev-parse', 'HEAD');
    for (let i = 0; i < 3; i++) {
      fs.writeFileSync(path.join(work, `file-${i}.bin`), randomBytes(600 * 1024));
      git('add', '.'); git('commit', '-m', `Original commit ${i}`);
    }
    const head = git('rev-parse', 'HEAD');
    fs.mkdirSync(path.join(work, 'scripts'));
    fs.copyFileSync(path.join(__dirname, '..', 'push-in-batches.cjs'), path.join(work, 'scripts', 'push-in-batches.cjs'));
    fs.writeFileSync(path.join(work, 'base.txt'), 'uncommitted changes\n');
    git('add', 'base.txt');
    fs.writeFileSync(path.join(work, 'untracked.txt'), 'keep this\n');
    const status = git('status', '--porcelain');
    const run = (...args) => execFileSync(process.execPath, ['scripts/push-in-batches.cjs', '--batch-mib=1', ...args],
      {cwd: work, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']});
    assert.match(run(), /3 batches/);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], base);
    // Interrupt after staging, before main advances, then retry the same plan.
    const hook = path.join(remote, 'hooks', 'pre-receive');
    fs.writeFileSync(hook, '#!/bin/sh\nwhile read old new ref; do\n  if [ "$ref" = "refs/heads/main" ]; then exit 1; fi\ndone\n');
    fs.chmodSync(hook, 0o755);
    assert.throws(() => run('--push'));
    assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], base);
    assert.match(git('ls-remote', 'origin', 'refs/heads/codex/*'), /upload-objects-/);
    fs.unlinkSync(hook);
    const resumed = run('--push');
    assert.match(resumed, /Push complete/);
    assert.doesNotMatch(resumed, /Uploading batch/);
    assert.equal(git('rev-parse', 'HEAD'), head);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/main').split(/\s/)[0], head);
    assert.equal(git('status', '--porcelain'), status);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/codex/*'), '');
    assert.match(run('--push'), /already matches HEAD/);
    git('fsck', '--no-dangling');
  } finally {
    fs.rmSync(temp, {recursive: true, force: true});
  }
});
