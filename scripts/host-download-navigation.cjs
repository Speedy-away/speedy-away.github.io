'use strict';

// Authored console navigation only; never change native runtimes or saved tools.
function apply(file, html) {
  const platform = file.match(/^hosts\/(ps[45])\/.+\.html$/)?.[1];
  if (!platform || /http-equiv=["']refresh/i.test(html)) return html;
  const destination = '/hosts/' + platform + '/downloads/';
  return html.replace(/(<nav\b[^>]*class=["'][^"']*\bhost-taskbar\b[^"']*["'][^>]*>)([\s\S]*?)(<\/nav>)/i,
    (whole, open, links, close) => {
      if (links.includes('href="' + destination + '"') || links.includes("href='" + destination + "'")) return whole;
      return open + links + '<a class="host-download-link" href="' + destination + '">Download centre</a>' + close;
    });
}

module.exports = {apply};
