'use strict';

// Authored console navigation only; never change native runtimes or saved tools.
function apply(file, html) {
  const platform = file.match(/^hosts\/(ps[45])\/.+\.html$/)?.[1];
  if (!platform || /http-equiv=["']refresh/i.test(html)) return html;
  const destination = '/hosts/' + platform + '/downloads/';
  function section(href) {
    let url;
    try { url = new URL(href, 'https://speedy-away.github.io/'); } catch { return ''; }
    if (url.origin !== 'https://speedy-away.github.io') return '';
    const pathname = url.pathname.replace(/^\/(?:WWB-HOST|wwb-host)(?=\/)/, '');
    const route = pathname.match(/^\/(?:hosts\/)?(ps[45])\/(downloads|packages)\/(?:index\.html)?$/) ||
      pathname.match(/^\/console\/(ps[45])\/(downloads|packages)\.html$/);
    return route?.[1] === platform ? route[2] : '';
  }
  return html.replace(/(<nav\b[^>]*class=["'][^"']*\b(?:host-taskbar|host-workbench-nav|wwb-console-links)\b[^"']*["'][^>]*>)([\s\S]*?)(<\/nav>)/gi,
    (whole, open, links, close) => {
      let found = false;
      links = links.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, anchor => {
        const href = anchor.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
        const target = section(href);
        if (target === 'packages') return '';
        if (target !== 'downloads') return anchor;
        if (found) return '';
        found = true;
        return anchor.replace(/\bhref\s*=\s*(["'])(.*?)\1/i, 'href="' + destination + '"')
          .replace(/>[\s\S]*?<\/a>$/i, '>Download centre</a>');
      });
      if (!found) links += '<a class="host-download-link" href="' + destination + '">Download centre</a>';
      return open + links + close;
    });
}

module.exports = {apply};
