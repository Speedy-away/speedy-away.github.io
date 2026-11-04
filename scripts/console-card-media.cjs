const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// Compose existing artwork in the page, retaining the original image files.
function cardMedia(config) {
  const images = Array.isArray(config) ? config : config.images;
  const names = (images || []).map(item=>item.src).join(' ');
  const key = /etahen|shadowmount/i.test(names) ? 'ps5-payloads' : /ps5upload|ezremote/i.test(names) ? 'ps5-transfer-tools' : /playden|orbit|prosperostore/i.test(names) ? 'ps5-apps' : /gta52|cod-black|rdr2/i.test(names) ? 'category-mods' : 'category-apps';
  const cover = require('./merged-category-covers.cjs').get(key);
  if (cover) return `<div class="guide-card-media guide-card-media--merged">${require('./merged-category-covers.cjs').image(cover,'Merged '+key.replaceAll('-',' ')+' cover')}</div>`;
  const layout = !Array.isArray(config) && config.layout === 'mosaic' && images?.length === 3 ? 'mosaic' : 'strip';
  if (!Array.isArray(images) || images.length < 2 || images.length > 3) throw Error('Card mixes require two or three images');
  return `<div class="guide-card-media guide-card-media--${layout} guide-card-media--${images.length}">${images.map(item => {
    if (!item.src || !item.alt) throw Error('Card artwork requires a source and description');
    return `<img class="guide-card-media__${item.fit === 'cover' ? 'cover' : 'contain'}" src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy" decoding="async">`;
  }).join('')}</div>`;
}

const ps5Media = {
  payloads: [
    {src: '/assets/images/console-software/etahen.jpg', alt: 'etaHEN'},
    {src: '/assets/images/console-software/shadowmountplus.png', alt: 'ShadowMountPlus'}
  ],
  apps: {layout: 'mosaic', images: [
    {src: '/assets/images/console-software/playden.jpg', alt: 'PlaydenPS5 library', fit: 'cover'},
    {src: '/assets/images/console-software/orbit.jpg', alt: 'Orbit Store', fit: 'cover'},
    {src: '/assets/images/console-software/prosperostore.png', alt: 'ProsperoStore'}
  ]},
  transfers: [
    {src: '/assets/images/expansion-ps4-ps5/ps5-ezremote.jpg', alt: 'ezRemote file browser', fit: 'cover'},
    {src: '/assets/images/console-software/ps5upload.png', alt: 'PS5upload'}
  ],
  mods: {layout: 'mosaic', images: [
    {src: '/assets/images/gta52.png', alt: 'Grand Theft Auto V', fit: 'cover'},
    {src: '/assets/images/covers/cod-black-ops-3.jpg', alt: 'Call of Duty Black Ops III', fit: 'cover'},
    {src: '/assets/images/rdr2.png', alt: 'Red Dead Redemption 2', fit: 'cover'}
  ]}
};

module.exports = {cardMedia, ps5Media};
