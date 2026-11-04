'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {eligible, LIMIT} = require('./build-pages.cjs');
const {eligible: publicPage} = require('./site-public-pages.cjs');
const root = path.resolve(process.argv[2] || 'tmp/pages-build');
const report = JSON.parse(fs.readFileSync(path.join(root, 'pages-build.json')));
const mapping = JSON.parse(fs.readFileSync(path.join(root, 'pages-download-map.json')));
let bytes = 0, pages = 0, links = 0;
const failures = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name), relative = path.relative(root, file).replaceAll('\\', '/');
    if (entry.isDirectory()) { walk(file); continue; }
    bytes += fs.statSync(file).size;
    if (!publicPage(relative) || !eligible(relative)) continue;
    pages++;
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/\b(?:href|src)=(["'])(.*?)\1/g)) {
      const value = match[2].replaceAll('&amp;', '&');
      if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
      const url = new URL(value, 'https://whatwhatboy.com/' + relative);
      const name = decodeURIComponent(url.pathname);
      links++;
      const target = path.join(root, name);
      if (!fs.existsSync(target)) failures.push(relative + ': ' + value + (mapping[name] ? ' (offloaded link was not rewritten)' : ''));
    }
  }
}
walk(root);
if (bytes >= 1_000_000_000 || report.bytes > LIMIT) failures.push('Pages artifact exceeds size budget');
for (const url of Object.values(mapping)) if (!/^https:\/\/raw\.githubusercontent\.com\/Speedy-away\/whatsite\/(?:main|[a-f0-9]{40})\//.test(url)) failures.push('Unexpected download origin');
for (const failure of failures.slice(0, 30)) console.error(failure);
console.log(JSON.stringify({bytes, pages, links, offloadedFiles:Object.keys(mapping).length, issues:failures.length}));
if (failures.length) process.exitCode = 1;
