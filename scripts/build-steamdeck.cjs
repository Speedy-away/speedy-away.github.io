// Rebuild only the Steam Deck catalogue and guides; preserve shared page integrations.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const data = {...require('../docs/steamdeck-resources.json'), guides: require('../docs/steamdeck-setup-guides.json')};
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const id = value => /^[a-z0-9-]+$/.test(value);
const knownGroups = new Set(data.groups.map(group => group.id));
const knownGuides = new Set(data.guides.map(guide => guide.id));
const allIds = [...data.groups, ...data.items, ...data.guides].map(item => item.id);
assert(allIds.every(id) && new Set(allIds).size === allIds.length, 'Catalogue IDs must be valid and unique');
const url = value => { assert(value.startsWith('https://') || /^\/[a-zA-Z0-9/_.-]+$/.test(value), 'Expected a public HTTPS URL or local asset'); return escape(value); };
const external = link => `<a href="${url(link.url)}" target="_blank" rel="noopener noreferrer" class="game-link">${escape(link.label)} <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>`;
function card(item) {
  assert(knownGroups.has(item.group), 'Unknown tool group: ' + item.group);
  if (item.guide) assert(knownGuides.has(item.guide), 'Unknown setup guide: ' + item.guide);
  const search = [item.title, item.kind, item.search, item.description, ...item.features].join(' ').toLowerCase();
  const image = `<img src="${url(item.icon)}" alt="" width="${item.preview ? 88 : 64}" height="${item.preview ? 55 : 64}" loading="lazy">`;
  return `<article class="game-card" id="tool-${item.id}" data-category="${escape(item.categories.join(' '))}" data-search="${escape(search)}"><div class="game-info">
    <header class="steamdeck-tool-header">${item.preview ? `<a class="steamdeck-preview" href="${url(item.icon)}" target="_blank" rel="noopener noreferrer" aria-label="View ${escape(item.title)} screenshot">${image}</a>` : image}<div><p class="steamdeck-tool-kind">${escape(item.kind)}</p><h4 class="game-title">${escape(item.title)}</h4></div></header>
    <p class="game-description">${escape(item.description)}</p>
    ${item.requirement ? `<p class="steamdeck-requirement">${escape(item.requirement)}</p>` : ''}
    <div class="game-features">${item.features.map(feature => `<span class="feature">${escape(feature)}</span>`).join('')}</div>
    <div class="steamdeck-links">${item.links.map(external).join('')}${item.guide ? `<a class="game-link" href="#${item.guide}" data-steamdeck-guide>Step-by-step setup <i class="fas fa-arrow-down" aria-hidden="true"></i></a>` : ''}</div>
  </div></article>`.replace(/[ \t]+$/gm, '');
}
const filters = [['all','All tools'], ['launchers','Launchers'], ['compatibility','Proton & fixes'], ['emulation','Emulation'], ['plugins','Decky plugins'], ['streaming','Remote play'], ['desktop','Files & utilities']];
const catalog = `<section class="section steamdeck-catalog" id="plugins" aria-labelledby="tools-title"><div class="container">
  <header class="section-header"><h2 class="section-title" id="tools-title">Tools &amp; plugins by purpose</h2><p class="section-subtitle">${data.items.length} tools and plugins, grouped by what you want to do.</p></header>
  <div class="steamdeck-toolbar"><div class="search-container"><div class="search-box"><i class="fas fa-search search-icon" aria-hidden="true"></i><input type="search" class="search-input" placeholder="Search tools, plugins, or features..." id="gameSearch" aria-label="Search Steam Deck tools" aria-controls="steamdeck-groups"></div></div><p id="gameSearchStatus" data-result-noun="tool" role="status" aria-live="polite" aria-atomic="true">${data.items.length} tools shown</p><button type="button" class="steamdeck-reset" id="resetGameSearch">Clear filters</button></div>
  <div class="filter-buttons" role="group" aria-label="Filter Steam Deck tools by category">${filters.map(([value,label])=>`<button type="button" class="filter-btn${value==='all'?' active':''}" data-filter="${value}" aria-pressed="${value==='all'}">${escape(label)}</button>`).join('')}</div>
  <div class="no-results" id="noResults"><h3>No tools match your search</h3><p>Try a different name or use Clear filters to show every tool.</p></div>
  <div id="steamdeck-groups">${data.groups.map(group => `<section class="steamdeck-group" id="${group.id}" data-search-group aria-labelledby="${group.id}-title"><div class="section-header"><h3 class="steamdeck-group-title" id="${group.id}-title">${escape(group.title)}</h3><p>${escape(group.description)}</p></div><div class="games-grid">${data.items.filter(item=>item.group===group.id).map(card).join('\n')}</div></section>`).join('\n')}</div>
</div></section>`;
const guides = `<section class="section steamdeck-guides" id="guides" aria-labelledby="guides-title"><div class="container">
  <header class="section-header"><h2 class="section-title" id="guides-title">Setup guides</h2><p class="section-subtitle">Choose a walkthrough. Each guide links to the project's own instructions.</p></header>
  <nav class="steamdeck-guide-nav" aria-label="Steam Deck setup guides">${data.guides.map(guide=>`<a href="#${guide.id}" data-steamdeck-guide>${escape(guide.shortTitle || guide.title)}</a>`).join('')}</nav>
  <div class="steamdeck-setup-guides">${data.guides.map(guide=>`<details class="steamdeck-setup-guide" id="${guide.id}"><summary><span>${escape(guide.title)}</span><span class="steamdeck-guide-topic">${guide.steps.length} steps</span></summary><div class="steamdeck-guide-body"><p>${escape(guide.intro)}</p><ol>${guide.steps.map(step=>`<li>${escape(step)}</li>`).join('')}</ol>${guide.note?`<p class="steamdeck-guide-note">${escape(guide.note)}</p>`:''}<div class="steamdeck-links">${guide.sources.map(external).join('')}</div></div></details>`).join('\n')}</div>
  <div class="steamdeck-guide-list">
    <article><h3>Will my game run?</h3><p>Check <a href="https://www.steamdeck.com/en/verified" target="_blank" rel="noopener noreferrer">Valve's Deck Verified ratings</a> and <a href="https://www.protondb.com/" target="_blank" rel="noopener noreferrer">ProtonDB community reports</a>. GE-Proton is optional and does not make every Windows game compatible.</p></article>
    <article><h3>Which emulation setup?</h3><p>EmuDeck and RetroDECK are alternative setups. Steam ROM Manager organizes shortcuts and artwork. Games and required BIOS files are supplied separately.</p><a href="#emulation" data-search-reveal>Compare the emulation tools <i class="fas fa-arrow-up" aria-hidden="true"></i></a></article>
    <article><h3>After a SteamOS update</h3><p>Check Decky and plugin compatibility after SteamOS or Steam client updates. Use stable releases and each project's troubleshooting guide when something changes.</p><a href="#decky-plugins" data-search-reveal>Browse Decky plugins <i class="fas fa-arrow-up" aria-hidden="true"></i></a></article>
  </div>
</div></section>`;
const file = path.join(root, 'console/steamdeck.html');
const before = fs.readFileSync(file, 'utf8');
let after = before.replace(/\r\n/g, '\n');
const catalogPattern = /<section class="section steamdeck-catalog"[\s\S]*?(?=<!-- BEGIN SITE AD -->)/;
const guidePattern = /<section class="section steamdeck-guides"[\s\S]*?(?=    <\/div>\n\n    <footer)/;
assert(catalogPattern.test(after) && guidePattern.test(after), 'Steam Deck content boundaries missing');
after = after.replace(catalogPattern, catalog + '\n\n').replace(guidePattern, guides + '\n');
after = after.replace(/(steamdeck\.css\?v=)[^" ]+/, '$1' + '3.3.2');
if (!after.includes('/assets/steamdeck.js?')) after = after.replace('</body>', '<script defer src="/assets/steamdeck.js?v=1"></script></body>');
after = require('./search-page-output.cjs').finish(file, after);
if (process.argv.includes('--check')) assert.equal(after, before.replace(/\r\n/g, '\n'), 'Steam Deck page needs rebuilding');
else fs.writeFileSync(file, after);
console.log(`Validated ${data.items.length} Steam Deck tools/plugins and ${data.guides.length} setup guides.`);
