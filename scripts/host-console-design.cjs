'use strict';

// Apply the shared console shell to authored pages during the Pages build.
function apply(html, name) {
  const platform = name.match(/^(?:hosts|console)\/(ps[45])\//)?.[1];
  const authored = name === 'index.html' || /^hosts\/(?!runtime\/).+\.html$/.test(name) ||
    /^(?:ps[45]\/.+\/index|offline\/ps[45]\/index|console\/ps[45]\/downloads)\.html$/.test(name);
  if (!authored || !html.includes('</head>') || /http-equiv=["']refresh/i.test(html)) return html;
  const dashboards = /id="host-action-grid"/.test(html);
  html = html.replace(/<body\b/i, '<body data-wwb-console-ui');
  html = html.replace('</head>', '<link rel="stylesheet" href="/assets/host-console-design.css?v=20261108">\n' +
    '<script defer src="/assets/host-console-navigation.js?v=20261108"></script>\n</head>');
  if (!platform || !dashboards) return html;

  const destination = '/hosts/' + platform + '/';
  const quickLinks = '<nav class="wwb-console-links" aria-label="Console tools">' +
    '<a href="' + destination + 'downloads/">Downloads</a>' +
    '<a href="' + destination + 'packages/">Packages</a>' +
    '<a href="' + destination + 'files/">Files</a>' +
    '<a href="' + destination + '?view=connection">Diagnostics</a></nav>';
  html = html.replace(/(<div id="host-file-firmware"[^>]*>)/, quickLinks + '$1');
  html = html.replace(/(<h3>Connect to your PS[45]<\/h3>)/, '$1' +
    '<dl class="wwb-diagnostics" aria-label="Browser diagnostics"><div><dt>Network</dt><dd data-wwb-network>Checking browser status</dd></div>' +
    '<div><dt>Offline cache</dt><dd data-wwb-cache>Checking browser support</dd></div></dl>');

  const search = '<label class="wwb-library-search" data-wwb-library-search hidden>' +
    '<span>Search this catalogue</span><input id="host-search" type="search" autocomplete="off" placeholder="Name, game, version or file type"></label>';
  const activity = '<details class="wwb-activity"><summary>Session log</summary>' +
    '<pre id="host-session-log" role="log" aria-live="polite">Console actions and results appear here.</pre></details>';
  if (!html.includes('id="host-search"')) html = html.replace(/(<div[^>]+id="host-action-grid"[^>]*>)/, search + '$1');
  return html.replace(/(<div[^>]+id="host-action-grid"[^>]*><\/div>)/, '$1' + activity);
}

module.exports = {apply};
