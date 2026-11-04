'use strict';
// Markup for authored public host pages only. Native/runtime documents stay isolated.
const DEFAULTS={
 projectName:'WWB HOST',
 sourceURL:'https://github.com/Speedy-away/speedy-away.github.io',
 sourceZipURL:'https://github.com/Speedy-away/speedy-away.github.io/archive/refs/heads/main.zip',
 forkURL:'https://github.com/Speedy-away/speedy-away.github.io/fork',
 workflowURL:'https://github.com/Speedy-away/speedy-away.github.io/blob/main/.github/workflows/pages.yml'
};
const DOCS={
 fork:'https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo',
 pages:'https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site',
 actions:'https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow',
 limits:'https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits'
};
function escape(value){return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');}
function https(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw Error('Self-host links require HTTPS without credentials');return escape(url.href);}
function external(href,label,extra=''){return '<a href="'+https(href)+'" target="_blank" rel="noopener noreferrer"'+extra+'>'+escape(label)+'</a>';}
function eligible(file,html){
 file=String(file||'').replaceAll('\\','/');
 return /^(?:index\.html|hosts\/(?!runtime\/).+\.html)$/.test(file)&&!/<meta\b[^>]*http-equiv=["']refresh/i.test(html);
}
function markup(options={}){
 const c={...DEFAULTS,...options};
 const extras=(Array.isArray(c.technicalNotes)?c.technicalNotes:[]).map(note=>'<p>'+escape(note)+'</p>').join('');
 const license=c.licenseURL?external(c.licenseURL,'Project licenses'):'';
 const projectLinks=(c.projectLinks||[]).map(link=>external(link.url,link.label)).join('');
 return `<button type="button" class="host-self-host-trigger" id="host-self-host-trigger" aria-haspopup="dialog" aria-controls="host-self-host-overlay" aria-expanded="false">Make your own host</button>
<div id="host-self-host-overlay" class="host-self-host-overlay" hidden role="dialog" aria-modal="true" aria-labelledby="host-self-host-title" aria-describedby="host-self-host-intro"><section class="host-self-host-dialog"><header><h2 id="host-self-host-title">Make your own host</h2><button type="button" id="host-self-host-close" class="host-self-host-close" aria-label="Close">×</button></header>
<p id="host-self-host-intro">Create your own copy of ${escape(c.projectName)} using its source repository and the existing GitHub Pages workflow.</p>
<div class="host-self-host-actions">${external(c.forkURL,'Fork on GitHub')}${external(c.sourceZipURL,'Download source ZIP')}</div>
<p>The source ZIP contains repository files. GitHub release assets and externally linked downloads remain separate. For an editable host, start with a fork.</p>
<ol><li><strong>Fork the repository</strong>Open the project on GitHub and create a fork under your account. Use <code translate="no">YOUR-USERNAME.github.io</code> for a root-domain Pages site.</li>
<li><strong>Review your host settings</strong>The publisher currently uses an empty base path for the root domain. In <code translate="no">scripts/host-project-pages.cjs</code>, review the Pages origin, repository owner, raw-file and release links, branding and main-site links for your fork. A different repository name or custom domain needs matching path and routing changes.</li>
<li><strong>Enable GitHub Pages</strong>In your fork, open <strong>Settings → Pages → Build and deployment</strong> and choose <strong>GitHub Actions</strong> as the source. If GitHub asks you to enable workflows in the fork, review and enable the existing workflow.</li>
<li><strong>Run the publishing workflow</strong>Open <strong>Actions → Deploy WWB HOST → Run workflow</strong>, select your default branch and run it. The existing <code translate="no">.github/workflows/pages.yml</code> builds and checks the static output before deployment.</li>
<li><strong>Open your published address</strong>After a successful deployment, use the address shown by GitHub Pages. With the original repository name, the usual address is <code translate="no">https://YOUR-USERNAME.github.io/</code>. Check navigation and exact download links before sharing it.</li></ol>
<p class="host-self-host-note">The source archive can be large. Use the project’s publisher to build its selected Pages output and retain download mappings; do not upload the entire download archive as a Pages site. Follow GitHub’s published size limits and preserve each bundled project’s license and attribution.</p>
<div class="host-self-host-docs">${external(c.sourceURL,'Project source')}${external(c.workflowURL,'Publishing workflow')}${license}${projectLinks}${external(DOCS.fork,'GitHub: fork a repository')}${external(DOCS.pages,'GitHub: Pages settings')}${external(DOCS.actions,'GitHub: run a workflow')}${external(DOCS.limits,'GitHub: Pages limits')}</div>${extras?'<div class="host-self-host-extra">'+extras+'</div>':''}
</section></div>`;
}
function apply(file,html,options={}){
 if(!eligible(file,html)||html.includes('id="host-self-host-trigger"'))return html;
 const base=String(options.base||'').replace(/\/$/,'');
 if(base&&!/^\/[A-Za-z0-9_-]+$/.test(base))throw Error('Invalid host project base');
 html=html.replace(/<body\b([^>]*)>/i,(_,attrs)=>'<body'+(/\bclass="/.test(attrs)?attrs.replace(/class="([^"]*)"/,'class="$1 host-has-self-host"'):attrs+' class="host-has-self-host"')+'>');
 html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="'+base+'/assets/host-self-host.css?v=1"></head>');
 return html.replace(/<\/body>/i,markup(options)+'<script defer src="'+base+'/assets/host-self-host.js?v=1"></script></body>');
}
module.exports={DEFAULTS,DOCS,eligible,markup,apply};
