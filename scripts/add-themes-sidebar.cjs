const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function integrateThemes(fragment, file = '') {
    // Remove the complete old group, including nested platform links.
    const opening = /<li\b(?=[^>]*\bdata-nav-section=["']themes["'])[^>]*>/i.exec(fragment);
    if (opening) {
        const tags = /<(\/?)li\b[^>]*>/gi;
        tags.lastIndex = opening.index + opening[0].length;
        let depth = 1, tag;
        while (depth && (tag = tags.exec(fragment))) depth += tag[1] ? -1 : 1;
        if (depth) throw new Error('Unclosed Themes navigation: ' + file);
        fragment = fragment.slice(0, opening.index) + fragment.slice(tags.lastIndex);
    }
    const entries = [
        ['/console/themes.html', 'All themes'],
        ['/console/ps3/themes.html', 'PS3 Themes'],
        ['/console/nintendo-switch/themes.html', 'Switch Themes'],
        ['/console/ps4/themes.html', 'PS4 Themes'],
        ['/console/ps5/themes.html', 'PS5 Themes'],
        ['/console/psvita/themes.html', 'PS Vita Themes'],
        ['/console/psp/themes.html', 'PSP Themes'],
        ['/console/ps2/themes.html', 'PS2 Themes'],
        ['/console/ds/themes.html', 'DS Themes'],
        ['/console/retro/3ds-themes.html', '3DS Themes'],
        ['/console/retro/wiiu-themes.html', 'Wii U Themes']
    ];
    const current = '/' + (path.isAbsolute(file) ? path.relative(root, file) : file).replaceAll('\\', '/').replace(/^\/+/, '');
    const active = entries.some(([url]) => url === current);
    const group = `<li data-nav-section="themes"><a href="/console/themes.html" class="nav-link nav-sublink${active ? ' active' : ''}" data-theme-navigation data-tooltip="Themes" aria-label="Themes"${active ? ` aria-current="${current === '/console/themes.html' ? 'page' : 'location'}"` : ''}><i class="fas fa-palette" aria-hidden="true"></i><span>Themes</span></a></li>`;
    return fragment.replace(/<li\b[^>]*>\s*<a\b(?=[^>]*\bdata-tooltip=["']Retro["'])[^>]*>[\s\S]*?<\/a>\s*<\/li>/i, match => match + group);
}

function applyThemes(html, file) {
    html = html.replace(/<nav\b[^>]*class="sidebar-nav"[^>]*>[\s\S]*?<\/nav>/, fragment => integrateThemes(fragment, file));
    const relative = String(file).replaceAll('\\','/').replace(/^\//,'');
    if (relative === 'console/themes.html') {
        const choices = [
            ['ps3','PS3'], ['nintendo-switch','Switch'], ['ps4','PS4'], ['ps5','PS5'],
            ['psvita','PS Vita'], ['psp','PSP'], ['ps2','PS2'], ['ds','DS'],
            ['retro/3ds-themes.html','3DS'], ['retro/wiiu-themes.html','Wii U']
        ];
        const directory = `<div class="themes-console-grid" data-theme-platform-directory>${choices.map(([route,label]) => {
            const platform = route.replace('retro/', '').replace('-themes.html', '');
            const url = '/console/' + (route.endsWith('.html') ? route : route + '/themes.html');
            return `<article class="themes-console themes-platform-card"><a href="${url}" aria-label="${label} Themes"><img src="/assets/images/merged-categories/library-${platform}-v1.png" alt="${label} console" width="1672" height="941" loading="lazy" decoding="async"><h3>${label} Themes</h3></a></article>`;
        }).join('')}</div>`;
        html = html.replace(/<div class="themes-console-grid" data-theme-platform-directory>[\s\S]*?<\/article><\/div>/, '');
        html = html.replace(/(<section\b[^>]*id="collections"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<\/h2>)/, '$1' + directory);
    }
    const themes = {'console/ps3/index.html':['/console/ps3/themes.html','PS3 themes'], 'console/psvita/home.html':['/console/psvita/themes.html','Vita themes'], 'console/ps2/index.html':['/console/ps2/themes.html','OPL themes'], 'console/psp/index.html':['/console/psp/themes.html','PSP themes'], 'console/ds/index.html':['/console/ds/themes.html','TWiLight Menu++ skins'], 'console/3ds/index.html':['/console/retro/3ds-themes.html','3DS themes'], 'console/wiiu/index.html':['/console/retro/wiiu-themes.html','Wii U themes'], 'console/nintendo-switch/index.html':['/console/nintendo-switch/themes.html','Switch themes']};
    for(const platform of ['ps4','ps5']) themes[`console/${platform}/index.html`]=[`/console/${platform}/themes.html`,platform.toUpperCase()+' themes'];
    const owner = Object.keys(themes).find(hub => relative.startsWith(hub.slice(0,hub.lastIndexOf('/')+1)));
    const entry = themes[relative] || themes[owner];
    if (!entry || !fs.existsSync(path.join(root,entry[0].slice(1)))) return html;
    const [url,label] = entry;
    html = html.replace(/<nav\b(?=[^>]*class="[^"]*\bguide-nav\b)[^>]*>[\s\S]*?<\/nav>/g, nav => nav.includes(`href="${url}"`) ? nav : nav.replace('</nav>',`<a href="${url}">${label}</a></nav>`));
    const art = require('./category-card-art.cjs');
    html = html.replace(/<article\b(?=[^>]*\bdata-console-theme-card)[^>]*>[\s\S]*?<\/article>/g, card => {
      const old=/<div\b(?=[^>]*\bdata-category-art=)[^>]*>/.exec(card);
      if(!old)return card;
      const area=art.range(card,old.index,old[0]);
      return card.slice(0,area.start)+require('./merged-category-covers.cjs').render(url,{title:label,kind:'themes'})+card.slice(area.end);
    });
    const start = /<section\b(?=[^>]*id="start")[^>]*>/.exec(html);
    if (start && themes[relative]) {
      const section = art.range(html,start.index,start[0]);
      const body = section && html.slice(section.start,section.end);
      if (body && !body.includes(`href="${url}"`)) {
        const grid = /<div\b(?=[^>]*class="[^"]*\bgames-grid\b)[^>]*>/.exec(body);
        if (grid) {
          const area = art.range(body,grid.index,grid[0]), image = require('./merged-category-covers.cjs').render(url,{title:label,kind:'themes'});
          const card = `<article class="guide-resource" data-console-theme-card><a href="${url}" aria-label="${label}">${image}</a><h3>${label}</h3><p>Browse themes, previews and installation instructions for this console.</p><div class="guide-links"><a href="${url}">Browse themes <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div></article>`;
          const position = section.start + area.close;
          html = html.slice(0,position) + card + html.slice(position);
        }
      }
    }
    return html;
}

if (require.main === module) {
    let changed = 0;
    for (const file of require('./site-public-pages.cjs').pages()) {
        const before = fs.readFileSync(file, 'utf8');
        const after = applyThemes(before, path.relative(root, file));
        if (before !== after) { fs.writeFileSync(file, after); changed++; }
    }
    console.log(`Added Themes below Retro; ${changed} pages updated.`);
}

module.exports = { integrateThemes, applyThemes };
