// Reapply after generating site pages. --check reports missing integration.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const excluded = new Set([
    '.git', '.agents', '.codex', '.claude', '.playwright', '.playwright-cli',
    'node_modules', 'assets', 'docs', 'design-references', 'languages',
    'i18n-tools', 'scripts', 'tmp', 'api'
]);
const version = '2';

function routeFor(file) {
    return (path.isAbsolute(file) ? path.relative(root, file) : file).replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase();
}

function eligible(html, file) {
    const route = routeFor(file);
    if (route.split('/').some(part => part.startsWith('.'))) return false;
    if (/^hosts\/runtime(?:\/|$)/.test(route)) return false;
    if (!/<head\b/i.test(html) || !/<body\b/i.test(html)) return false;
    if (/<meta\b[^>]*http-equiv\s*=\s*["']refresh["']/i.test(html)) return false;
    if (route === 'free-keys/sponsor-frame.html') return false;
    // These are self-contained ready-to-use receiver builds, not site UI pages.
    // Keep packaged tool bytes and their download inventory hashes intact.
    if (/^console\/ps([45])\/whatsite-ps\1\.html$/.test(route)) return false;
    return true;
}

function pages(directory = root) {
    if (/^hosts\/runtime(?:\/|$)/.test(routeFor(directory))) return [];
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name.startsWith('.') || excluded.has(entry.name)) return [];
            // Only the browser-facing download library belongs to the site shell.
            if (entry.name === 'downloads') {
                const index = path.join(file, 'index.html');
                return fs.existsSync(index) && eligible(fs.readFileSync(index, 'utf8'), index) ? [index] : [];
            }
            return pages(file);
        }
        return entry.isFile() && /\.html$/i.test(entry.name) && eligible(fs.readFileSync(file, 'utf8'), file) ? [file] : [];
    });
}

function themeFor(file = 'index.html') {
    const route = routeFor(file);
    if (/^(?:downloads|games-downloads|tools|source-codes)(?:\/|$)/.test(route)) return 'amber';
    if (/^(?:pc(?:\/|$)|console\/steamdeck(?:\/|\.html|$))/.test(route)) return 'ice';
    if (/(?:^|\/)(?:nintendo[^/]*|switch[^/]*)(?:\/|\.html|$)/.test(route)) return 'rose';
    if (/(?:^|\/)(?:xbox[^/]*)(?:\/|\.html|$)/.test(route)) return 'emerald';
    if (/(?:^|\/)(?:ps[2345][^/]*|psvita|playstation[^/]*)(?:\/|\.html|$)/.test(route)) return 'cobalt';
    if (/^(?:games|mods|free-keys)(?:\/|$)/.test(route) || /^(?:scooby|nenyoo)/.test(route)) return 'violet';
    return 'emerald';
}

function improve(html, file = 'index.html') {
    if (!eligible(html, file)) return html;
    const eol = html.includes('\r\n') ? '\r\n' : '\n';
    // Refresh shared heading fixes along with the backdrop on generated pages.
    html = html.replace(/(\bhref\s*=\s*["'](?:[^"']*\/)?(?:style|console-guides)\.css)(?:\?[^"']*)?(["'])/gi, '$1?v=3.3.2$2');

    html = html.replace(/<body\b[^>]*>/i, tag => {
        tag = tag.replace(/\s+data-background-theme\s*=\s*["'][^"']*["']/gi, '');
        if (/\bclass\s*=\s*["']/i.test(tag)) {
            tag = tag.replace(/\bclass\s*=\s*(["'])([^"']*)\1/i, (_, quote, names) => {
                const classes = names.split(/\s+/).filter(Boolean).filter((name,index,all) => name !== 'site-atmosphere' || all.indexOf(name) === index);
                if (!classes.includes('site-atmosphere')) classes.push('site-atmosphere');
                return 'class=' + quote + classes.join(' ') + quote;
            });
        } else tag = tag.replace(/>$/, ' class="site-atmosphere">');
        return tag.replace(/>$/, ' data-background-theme="' + themeFor(file) + '">');
    });

    // Migrate the first homepage-only version; the shared runtime creates one
    // decorative canvas and one motion control on every integrated page.
    html = html.replace(/(?:\r?\n)?[ \t]*<div\b(?=[^>]*\bid=["']home-flow-background["'])[^>]*>\s*<canvas\b[^>]*>\s*<\/canvas>\s*<\/div>/gi, '');
    html = html.replace(/(?:\r?\n)?[ \t]*<button\b(?=[^>]*\bid=["']home-motion-toggle["'])[^>]*>[\s\S]*?<\/button>/gi, '');
    html = html.replace(/(?:\r?\n)?[ \t]*<script\b(?=[^>]*\bsrc=["'][^"']*home-background\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi, '');
    const stylePattern = /(?:\r?\n)?[ \t]*<link\b(?=[^>]*\bhref=["'][^"']*(?:\/|^)site-background\.css(?:\?[^"']*)?["'])[^>]*>/gi;
    const scriptPattern = /(?:\r?\n)?[ \t]*<script\b(?=[^>]*\bsrc=["'][^"']*site-background\.js(?:\?[^"']*)?["'])[^>]*>\s*<\/script>/gi;
    const styles = [...html.matchAll(stylePattern)];
    const scripts = [...html.matchAll(scriptPattern)];
    const current = styles.length === 1 && scripts.length === 1
        && styles[0][0].includes('/assets/site-background.css?v=' + version + '"')
        && scripts[0][0].includes('/assets/site-background.js?v=' + version + '"');
    // Other site generators may add assets later in the head. Retain a current,
    // single integration in place instead of repeatedly reordering their output.
    if (!current) {
        html = html.replace(stylePattern, '').replace(scriptPattern, '');
        const integration = '    <link rel="stylesheet" href="/assets/site-background.css?v=' + version + '">' + eol
            + '    <script defer src="/assets/site-background.js?v=' + version + '"></script>' + eol;
        html = html.replace(/\s*<\/head>/i, eol + integration + '</head>');
    }
    return html;
}

module.exports = { pages, improve, themeFor, eligible };

if (require.main === module) {
    const check = process.argv.includes('--check');
    const files = pages();
    let changed = 0;
    for (const file of files) {
        const before = fs.readFileSync(file, 'utf8');
        const after = improve(before, file);
        if (before === after) continue;
        changed++;
        if (check) console.error(path.relative(root, file) + ': animated background integration needs refresh');
        else fs.writeFileSync(file, after);
    }
    console.log(files.length + ' site pages checked; ' + changed + (check ? ' need updates.' : ' updated.'));
    if (check && changed) process.exitCode = 1;
}
