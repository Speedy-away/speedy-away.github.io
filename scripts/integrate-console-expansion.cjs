// Additive coordinator: only ready destination pages are linked; child content is preserved.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const entries = [
  {route:'/console/xbox-one-series.html',title:'Xbox One / Series X|S',description:'Set up Developer Mode, connect Device Portal and install compatible UWP emulators and homebrew.',image:'/assets/images/platform-logos/xbox-one-series.svg',tags:['Dev Mode','UWP Apps','Emulators']},
  {route:'/console/nintendo-switch-2.html',title:'Nintendo Switch 2',description:'Console setup, storage, system software, compatibility and source-confirmed homebrew research.',image:'/assets/images/platform-logos/nintendo-switch-2.svg',tags:['Setup','Compatibility','System Software']},
  {route:'/console/themes.html',title:'Console themes',description:'Credited Switch, Wii U, Nintendo 2DS / 3DS and PS3 themes with previews, downloads and console-specific setup.',image:'/assets/images/expansion-nintendo-retro/luma.png',tags:['Themezer','Previews','Setup Guides']}
];
const destinations = [
  ...entries.map(x=>x.route), '/console/nintendo-switch/themes.html', '/console/retro/wiiu-themes.html', '/console/retro/3ds-themes.html', '/console/ps3/themes.html',
  '/console/retro/xbox.html', '/console/retro/psp.html', '/console/psvita/library.html', '/console/xbox360/library.html'
];
const exists = route => fs.existsSync(path.join(root, route.slice(1)));
function card(item) {
  return `<article class="game-card" data-search="${esc([item.title,...item.tags].join(' ').toLowerCase())}"><div class="game-image"><img src="${item.image}" alt="${esc(item.title)}" loading="lazy"></div><div class="game-info"><h3 class="game-title">${esc(item.title)}</h3><p class="game-description">${esc(item.description)}</p><div class="game-features">${item.tags.map(t=>`<span class="feature">${esc(t)}</span>`).join('')}</div><a class="game-link" href="${item.route}">Explore ${esc(item.title)} <i class="fas fa-arrow-right" aria-hidden="true"></i></a></div></article>`;
}
function integrateIndex(html, ready = entries.filter(x=>exists(x.route))) {
  // The grouped directory owns placement; do not prepend mixed-family cards.
  if(html.includes('<!-- CONSOLE DIRECTORY START -->')) return html;
  const begin='<!-- BEGIN CONSOLE EXPANSION CARDS -->', end='<!-- END CONSOLE EXPANSION CARDS -->';
  const block=begin + ready.map(card).join('\n') + end;
  if(html.includes(begin)) html=html.replace(new RegExp(begin+'[\\s\\S]*?'+end),block);
  else html=html.replace(/(<section\b[^>]*\bid="modern"[^>]*>[\s\S]*?<div class="games-grid">)/, '$1\n'+block);
  html=html.replace(/(?:Wii U, )*Wii, GameCube, DS and DSi, Nintendo 2DS and 3DS, PS2, original Xbox and PSP homebrew\./g,'Wii U, Wii, GameCube, DS and DSi, Nintendo 2DS and 3DS, PS2, original Xbox and PSP homebrew.');
  return html;
}
function addSitemap(xml, routes=destinations.filter(exists)) {
  for(const route of routes) {
    const url='https://whatwhatboy.com'+route;
    if(!xml.includes('<loc>'+url+'</loc>')) xml=xml.replace('</urlset>',`  <url><loc>${url}</loc><lastmod>2026-11-02</lastmod></url>\n</urlset>`);
  }
  return xml;
}
function main() {
  const file=path.join(root,'console/index.html');
  const before=fs.readFileSync(file,'utf8'),after=integrateIndex(before);
  if(before!==after)fs.writeFileSync(file,after);
  require('./build-retro-page.cjs').buildRetroPage();
  const sitemap=path.join(root,'sitemap.xml'),old=fs.readFileSync(sitemap,'utf8'),next=addSitemap(old);
  if(old!==next)fs.writeFileSync(sitemap,next);
  const navigation=require('./integrate-console-platforms.cjs').integrateConsolePlatforms();
  const topicBuilder=path.join(__dirname,'build-console-topic-hubs.cjs');
  const topics=fs.existsSync(topicBuilder)?require(topicBuilder).main({integrate:false}):null;
  const topicNavigation=require('./console-topic-navigation.cjs').main();
  return {ready:destinations.filter(exists),pending:destinations.filter(x=>!exists(x)),navigation,topics,topicNavigation};
}
module.exports={entries,destinations,integrateIndex,addSitemap,main};
if(require.main===module)console.log(JSON.stringify(main(),null,2));
