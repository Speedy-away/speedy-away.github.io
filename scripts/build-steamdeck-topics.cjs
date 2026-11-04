// Refresh only Steam Deck topic pages, preserving other platforms' in-progress work.
const {platforms, buildPlatform} = require('./build-console-topic-hubs.cjs');
const {spawnSync} = require('node:child_process');
const path = require('node:path');
const platform = platforms().find(item => item.id === 'steamdeck');
if (!platform) throw Error('Steam Deck topic manifest missing');
const files = buildPlatform(platform);
const result = spawnSync(process.execPath, ['scripts/update-page-metadata.cjs', ...files.flatMap(file => ['--page', file])], {cwd: path.resolve(__dirname, '..'), encoding: 'utf8'});
if (result.status !== 0) throw Error(result.stderr || result.stdout || 'Steam Deck topic metadata failed');
console.log(result.stdout.trim());
console.log(`Refreshed ${files.length} Steam Deck topic pages.`);
