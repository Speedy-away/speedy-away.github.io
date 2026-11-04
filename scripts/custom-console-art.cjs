const catalog = require('../docs/custom-console-art.json');
const byId = new Map(catalog.images.map(item => [item.id, item]));
const esc = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
function image(id) {
  const item = byId.get(id);
  if (!item) throw Error('Missing custom console artwork: ' + id);
  return item.image;
}
const xboxCards = new Map([
  ['Peer Pressure 1.0.477', ['xbox360-peer-pressure', 'Original illustration of an Xbox 360 with its hard drive and a USB drive']],
  ['17559 System Update', ['xbox360-system-update', 'Original illustration of an Xbox 360 controller, USB drive and update progress ring']],
  ['Rock Band Blitz Trial', ['xbox360-rock-band-blitz', 'Original rhythm-game illustration with a guitar, drumsticks and colored music lanes']],
  ['Xbox backwards compatibility', ['xbox360-backwards-compatibility', 'Original illustration of original Xbox and Xbox 360 consoles and controllers']],
  ['Vimm’s Lair · Xbox 360', ['xbox360-game-library', 'Original illustration of an Xbox 360 game library with discs and cases']],
  ['JTAG Installation', ['xbox360-jtag', 'Conceptual illustration of motherboard soldering and a NAND programmer']],
  ['RGH 1.2/2.0/3.0', ['xbox360-rgh', 'Conceptual illustration of an Xbox 360, motherboard and timing signal']],
  ['CoolRunner & Matrix', ['xbox360-glitch-chips', 'Conceptual illustration of two different Xbox 360 glitch-chip boards']]
]);
function applyXboxArtwork(html) {
  return html.replace(/<(?:article|div)\b[^>]*class="[^"]*\b(?:guide-resource|game-card)\b[^"]*"[^>]*>[\s\S]*?<h3\b[^>]*>([\s\S]*?)<\/h3>/g, (card, heading) => {
    const title = heading.replace(/<[^>]+>/g, '').replaceAll('&amp;', '&').trim();
    const art = xboxCards.get(title);
    if (!art) return card;
    return card.replace(/<img\b[^>]*>/, tag => {
      tag = tag.replace(/\bsrc="[^"]*"/, `src="${image(art[0])}"`).replace(/\balt="[^"]*"/, `alt="${esc(art[1])}"`);
      if (!/\bloading=/.test(tag)) tag = tag.replace(/>$/, ' loading="lazy">');
      if (!/\bdecoding=/.test(tag)) tag = tag.replace(/>$/, ' decoding="async">');
      return tag;
    });
  });
}
module.exports = {image, applyXboxArtwork};
