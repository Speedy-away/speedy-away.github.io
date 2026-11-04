const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {publicMirror}=require('./download-mirror-policy.cjs');
const esc=value=>String(value||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function resources(platform){
  return ['docs/console-ready-software.json','docs/ps4-store-apps.json','docs/console-batch4-apps.json'].flatMap(file=>fs.existsSync(path.join(root,file))?(JSON.parse(fs.readFileSync(path.join(root,file),'utf8')).resources||[]):[]).filter(item=>(item.platforms||[item.platform]).includes(platform));
}
function storeIntro(platform){
  const ps4=platform==='ps4';
  return `<section class="section" id="homebrew-stores"><div class="container"><aside class="guide-note"><h2>${ps4?'PKG-Zone · PS4 homebrew':'ProsperoStore · PS5 homebrew'}</h2><p>${ps4?'Browse the PS4 catalogue and the supplied Scratch Everywhere! entry. Each console app keeps its own installation and firmware requirements.':'Browse the native PS5 catalogue, then use the selected publisher builds below. Existing pinned store and app versions remain available.'}</p><div class="guide-links"><a href="${ps4?'https://pkg-zone.com/?console=PS4':'https://prosperostore.net/'}" target="_blank" rel="noopener noreferrer">${ps4?'Open PKG-Zone for PS4':'Open ProsperoStore website'}</a>${ps4?'<a href="https://pkg-zone.com/details/NTXS10053" target="_blank" rel="noopener noreferrer">Scratch Everywhere! · supplied entry</a>':''}</div></aside></div></section>`;
}
function storeCards(platform){
  const items=resources(platform);if(!items.length)return '';
  const audit=JSON.parse(fs.readFileSync(path.join(root,'docs/download-audit.json'),'utf8')).items;
  return `<section class="section" id="selected-apps"><div class="container"><div class="section-header"><h2 class="section-title">More ${platform.toUpperCase()} apps & utilities</h2><p class="section-subtitle">Publisher builds with their actual package or complete app-bundle format. Downloading, extracting and installing remain separate actions.</p></div><div class="games-grid">${items.map(item=>{
    const owner=audit.find(row=>row.id==='ps4-ps5-'+(item.importJobId||item.id)&&row.status==='downloaded');
    const file=owner?.files.find(file=>file.name===item.filename&&file.sha256===item.sha256);
    const url=publicMirror(file?.local,root)?.local||item.url;
    const extension=path.extname(item.filename).slice(1).toUpperCase();
    const id=(item.page?.includes('#')?item.page.split('#')[1]:null)||'store'+ '-' +(item.titleId||item.titleid||item.id.replace(/^ps[45]-store-/,'' )).toLowerCase();
    return `<article class="guide-resource" id="${esc(id)}"><img src="${esc(item.image)}" alt="${esc(item.title||item.name)} app artwork" loading="lazy"><h3>${esc(item.title||item.name)}</h3><p><strong>${esc(item.version)} · ${extension}${extension==='ZIP'?' app bundle':''}</strong></p><p>${esc(item.description)}</p><p>${esc(item.compatibility)}</p>${item.preparation?`<details><summary>Installation & requirements</summary><p>${esc(item.preparation)}</p>${item.requirements?.length?`<ul>${item.requirements.map(requirement=>`<li>${esc(requirement)}</li>`).join('')}</ul>`:''}${item.networkIntegration?`<p>${esc(item.networkIntegration)}</p>`:''}</details>`:''}<div class="guide-links"><a class="btn btn-primary" href="${esc(url)}" download="${esc(item.filename)}">Download ${extension}</a><a href="/console/${platform}/downloads.html?file=${encodeURIComponent(item.id)}#files">Save on ${platform.toUpperCase()}</a><a href="${esc(item.source)}" target="_blank" rel="noopener noreferrer">Publisher setup</a>${item.storePage?`<a href="${esc(item.storePage)}" target="_blank" rel="noopener noreferrer">Store entry</a>`:''}</div></article>`;
  }).join('')}</div></div></section>`;
}
module.exports={storeIntro,storeCards,resources};
