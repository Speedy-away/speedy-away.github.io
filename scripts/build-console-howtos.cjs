const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = '/guides/console-files/';
const guides = [
  {source: 'docs/guides/ps4-console-downloads.md', file: 'ps4.html', label: 'PS4 files',
    description: 'Save console-ready files, prepare storage folders and extract supported archives on your PS4.',
    image: '/assets/images/host-selector/whatwhatboy-ps4.jpg'},
  {source: 'docs/guides/ps5-console-downloads.md', file: 'ps5.html', label: 'PS5 payloads',
    description: 'Save PS5 apps and payloads, prepare storage and use the matching file manager.',
    image: '/assets/images/host-selector/whatwhatboy-ps5.jpg'},
  {source: 'docs/guides/console-files-and-archives.md', file: 'archives.html', label: 'Archives',
    description: 'Choose ready builds or complete archives and preserve the files each app or mod needs.',
    image: '/assets/images/expansion-ps4-ps5/ps4-ezremote.jpg'}
];
const sourceRoutes = new Map(guides.map(guide => ['/' + guide.source, base + guide.file]));
sourceRoutes.set('/docs/guides/README.md', base);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function target(value, source, image = false) {
  if (/^(?:\/\/|[a-z]:[\\/])/i.test(value) || /\\/.test(value)) throw Error('Unsupported Markdown URL: ' + value);
  const url = new URL(value, 'https://whatwhatboy.com/' + source);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Error('Unsupported Markdown URL: ' + value);
  if (url.origin !== 'https://whatwhatboy.com') return {url: url.href, external: true};
  const route = sourceRoutes.get(url.pathname) || url.pathname;
  if (image && !/^\/assets\/images\//.test(route)) throw Error('Guide image must come from project assets: ' + value);
  return {url: route + url.search + url.hash, external: false};
}

// A deliberately small Markdown renderer for these authored guides. Raw HTML is
// escaped, links accept HTTP(S)/site paths only, and fenced/inline code is literal.
function inline(sourceText, source) {
  const tokens = /(`+)([^`\n]+)\1|!\[([^\]]*)\]\(([^\s)]+)\)|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let html = '', cursor = 0, match;
  while ((match = tokens.exec(sourceText))) {
    html += escape(sourceText.slice(cursor, match.index));
    if (match[1]) html += '<code>' + escape(match[2]) + '</code>';
    else if (match[3] !== undefined) {
      const image = target(match[4], source, true);
      html += `<img src="${escape(image.url)}" alt="${escape(match[3])}" loading="lazy" decoding="async">`;
    } else if (match[5] !== undefined) {
      const link = target(match[6], source);
      html += `<a href="${escape(link.url)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${inline(match[5], source)}</a>`;
    } else html += '<strong>' + inline(match[7], source) + '</strong>';
    cursor = tokens.lastIndex;
  }
  return html + escape(sourceText.slice(cursor));
}

const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replaceAll('\\|', '|'));
const tableDivider = line => /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';

function renderBlocks(lines, source, ids = new Set()) {
  let html = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const fence = /^\s*```([\w-]*)\s*$/.exec(line);
    if (fence) {
      let code = []; i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      if (i === lines.length) throw Error('Unclosed Markdown code block: ' + source);
      html += '<pre><code>' + escape(code.join('\n')) + '</code></pre>'; i++; continue;
    }
    const heading = /^(#{2,6})\s+(.+)$/.exec(line);
    if (heading) {
      let id = slug(heading[2]), suffix = 2;
      while (ids.has(id)) id = slug(heading[2]) + '-' + suffix++;
      ids.add(id);
      html += `<h${heading[1].length} id="${id}">${inline(heading[2], source)}</h${heading[1].length}>`; i++; continue;
    }
    if (i + 1 < lines.length && line.includes('|') && tableDivider(lines[i + 1])) {
      const headers = cells(line), rows = []; i += 2;
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        const row = cells(lines[i++]);
        if (row.length !== headers.length) throw Error('Uneven Markdown table: ' + source);
        rows.push(row);
      }
      html += '<div class="guide-table-scroll"><table><thead><tr>' + headers.map(cell => '<th scope="col">' + inline(cell, source) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + inline(cell, source) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
      continue;
    }
    const item = /^( *)(?:(\d+)[.)]|([-*+]))\s+(.+)$/.exec(line);
    if (item) {
      const ordered = Boolean(item[2]), tag = ordered ? 'ol' : 'ul', depth = item[1].length;
      const pattern = ordered ? /^( *)(\d+)[.)]\s+(.+)$/ : /^( *)([-*+])\s+(.+)$/;
      const rows = [];
      while (i < lines.length) {
        const current = pattern.exec(lines[i]);
        if (!current || current[1].length !== depth) break;
        const content = [current[3]]; i++;
        while (i < lines.length) {
          if (!lines[i].trim()) { i++; if (i < lines.length && pattern.test(lines[i])) break; content.push(''); continue; }
          const indentation = /^ */.exec(lines[i])[0].length;
          if (indentation <= depth) break;
          content.push(lines[i].slice(Math.min(indentation, depth + 2))); i++;
        }
        rows.push('<li>' + renderBlocks(content, source, ids) + '</li>');
      }
      html += '<' + tag + '>' + rows.join('') + '</' + tag + '>'; continue;
    }
    if (/^!\[[^\]]*\]\([^\s)]+\)\s*$/.test(line)) {
      html += '<figure class="guide-illustration">' + inline(line, source) + '</figure>'; i++; continue;
    }
    const paragraph = [line.trim()]; i++;
    while (i < lines.length && lines[i].trim() && !/^#{2,6}\s|^\s*```|^\s*(?:\d+[.)]|[-*+])\s|^!\[/.test(lines[i]) && !(i + 1 < lines.length && tableDivider(lines[i + 1]))) paragraph.push(lines[i++].trim());
    html += '<p>' + inline(paragraph.join(' '), source) + '</p>';
  }
  return html;
}

function readGuide(source) {
  const text = fs.readFileSync(path.join(root, source), 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const title = /^# (.+)$/.exec(lines[0]);
  if (!title) throw Error('Guide needs an opening H1: ' + source);
  if (lines.slice(1).some(line => /^#\s/.test(line))) throw Error('Guide has multiple H1 headings: ' + source);
  return {title: title[1], html: renderBlocks(lines.slice(1), source)};
}

function finalize(file) {
  const filename = path.join(root, file);
  let html = fs.readFileSync(filename, 'utf8');
  html = html.replace('class="container guide-hero-grid"', 'class="container guide-hero-grid guide-hero-text"')
    .replace(/(<header class="guide-hero">[\s\S]*?<\/div>)<img[^>]*>/, '$1')
    .replace('<a class="btn btn-outline" href="/pc/">PC</a>', '')
    .replace(/class="nav-link nav-sublink active" aria-current="page"/g, 'class="nav-link nav-sublink"')
    .replace('</head>', '<link rel="stylesheet" href="/guides/console-files/guides.css?v=1">\n</head>');
  fs.writeFileSync(filename, html);
}

function buildConsoleHowtos() {
  const {page, section, grid, resource, link} = require('./build-console-guides.cjs');
  const nav = [[base, 'All guides'], ...guides.map(guide => [base + guide.file, guide.label])];
  const content = guides.map(guide => ({...guide, ...readGuide(guide.source)}));
  const indexSource = readGuide('docs/guides/README.md');
  page('guides/console-files/index.html', indexSource.title,
    'Choose your console for illustrated storage, download, archive and payload instructions.',
    content[0].image, nav,
    section('guides', 'Choose a guide', grid(...content.map(guide => resource(guide.title, guide.description, link(base + guide.file, 'Read guide'), guide.image)))) +
    section('platforms', 'Other consoles', `<div class="guide-links">${link('/console/ps3/downloads.html', 'PS3 downloads')}${link('/console/nintendo-switch.html', 'Nintendo Switch homebrew')}${link('/hosts/', 'PS4 / PS5 host selector')}</div>`),
    '#guides', 'Choose guide');
  finalize('guides/console-files/index.html');
  for (const guide of content) {
    const file = 'guides/console-files/' + guide.file;
    page(file, guide.title, guide.description, guide.image, nav,
      section('guide', 'Steps and requirements', `<article class="guide-markdown">${guide.html}<div class="guide-markdown-source"><a href="/${guide.source}" download>Download Markdown guide</a></div></article>`), '#guide', 'Read guide');
    finalize(file);
  }
  const sitemapFile = path.join(root, 'sitemap.xml');
  let sitemap = fs.readFileSync(sitemapFile, 'utf8');
  for (const suffix of ['', ...guides.map(guide => guide.file)]) {
    const url = 'https://whatwhatboy.com' + base + suffix;
    if (!sitemap.includes('<loc>' + url + '</loc>')) sitemap = sitemap.replace('</urlset>', '  <url><loc>' + url + '</loc></url>\n</urlset>');
  }
  fs.writeFileSync(sitemapFile, sitemap);
  console.log('Built 4 illustrated console how-to pages from Markdown.');
}

if (require.main === module) buildConsoleHowtos();
module.exports = {buildConsoleHowtos, readGuide, renderBlocks, inline, target, guides};
