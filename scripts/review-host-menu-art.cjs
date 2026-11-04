'use strict';
// Correct menu artwork/labels only. Never opens or executes a downloaded menu.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function cover(name, subtitle, accent, symbol) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="${name} menu cover"><defs><radialGradient id="light" cx="85%" cy="16%" r="95%"><stop stop-color="${accent}" stop-opacity=".24"/><stop offset="1" stop-color="#0c1118" stop-opacity="0"/></radialGradient><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#fff" stroke-opacity=".035"/></pattern></defs><rect width="1280" height="720" fill="#0c1118"/><rect width="1280" height="720" fill="url(#light)"/><rect width="1280" height="720" fill="url(#grid)"/><path d="M64 74H1216M64 646H1216" stroke="#fff" stroke-opacity=".12"/><text x="68" y="119" fill="#b6c2cc" font-family="Arial,sans-serif" font-size="23" letter-spacing="5">PS4 / GTA V</text><text x="68" y="366" fill="#f2f5f6" font-family="Arial,sans-serif" font-size="100" font-weight="700" letter-spacing="-3">${name}</text><rect x="70" y="410" width="78" height="5" rx="2" fill="${accent}"/><text x="68" y="474" fill="#b6c2cc" font-family="Arial,sans-serif" font-size="31">${subtitle}</text><text x="68" y="603" fill="#93a6b6" font-family="Arial,sans-serif" font-size="22">MENU COVER · CHOOSE THE EXACT GAME AND MENU BUILD</text><g transform="translate(1000 280)" fill="none" stroke="${accent}" stroke-width="5" opacity=".75">${symbol}</g></svg>`;
}

function update() {
  const folder = path.join(root,'assets/images/host-menus'); fs.mkdirSync(folder,{recursive:true});
  const covers = {
    'expulsion.svg': cover('Expulsion','Lush Modz · plugin menu family','#75c6e4','<path d="M0 0L75 -55L150 0L75 55Z M0 35L75 90L150 35 M0 70L75 125L150 70"/>'),
    'explosive.svg': cover('Explosive','SPRX menu family','#d994fb','<circle cx="75" cy="30" r="58"/><path d="M75 -66V-46 M75 106V126 M-21 30H-1 M151 30H171 M7 -38L22 -23 M128 83L143 98 M7 98L22 83 M128 -23L143 -38"/>')
  };
  for (const [name,svg] of Object.entries(covers)) {
    const file = path.join(folder,name);
    if (!fs.existsSync(file) || fs.readFileSync(file,'utf8') !== svg) fs.writeFileSync(file,svg);
  }
  const files = ['docs/host-modern-plugin-actions.json','docs/host-game-actions.json'];
  const before = files.map(file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8')));
  const unchanged = action => Object.fromEntries(Object.entries(action).filter(([key])=>!['image','imageRole','imageDescription','previewImage','menuFamily'].includes(key)));
  const baseline = JSON.stringify(before.map(data=>data.actions.map(unchanged)));
  const records=[];
  for (let index=0;index<files.length;index++) {
    const data = before[index];
    for (const action of data.actions) {
      const original = {image:action.image,menuVersion:action.menuVersion};
      if (/^Expulsion\b/i.test(action.label)) {
        action.menuFamily='Expulsion';
        if (action.menuVersion === '7.0') {
          action.image='/assets/images/host-menus/expulsion.svg';action.imageRole='Menu cover';
          action.imageDescription='Original family cover. The previous image visibly shows v5.0 and must not represent v7.0.';
        } else {
          action.image='/assets/images/ps4-ps5/edited/gta5-expulsion-v5-1-57-image.png';action.imageRole='Menu preview';
          action.imageDescription='Supplied screenshot visibly shows Expulsion v5.0 and GTA V update 1.57.';
        }
      } else if (/^Cyprus\b/i.test(action.label)) {
        action.menuFamily='Cyprus';action.imageRole='Menu preview';
        action.imageDescription='Supplied Cyprus menu promotional screenshot; no numeric menu build was established for this exact PRX.';
      } else if (action.label === 'Explosive') {
        action.menuFamily='Explosive';if(!action.previewImage)action.previewImage=action.image;action.image='/assets/images/host-menus/explosive.svg';action.imageRole='Menu cover';
        action.imageDescription='Original menu cover replaces a source screenshot containing an unrelated browser overlay. That screenshot displays 3.7.0, but the exact supplied 1.57 binary has no confirmed menu version.';
      } else if (action.label === 'Oysters') {
        action.menuFamily='Oysters';action.image='/assets/images/ps4-ps5/originals/rdr2-oyster-image.webp';action.imageRole='Menu preview';
        action.imageDescription='Source-published Oysters Free menu showcase. Its exact historical BIN revision is not established; do not apply the current official SPRX version 1.3.9 to these BINs.';
      } else if (action.label === 'North Beta') {
        action.menuFamily='North Beta';action.image='/assets/images/ps4-ps5/originals/rdr2-north-beta-image.webp';action.imageRole='Menu preview';
        action.imageDescription='Source-published North Beta menu showcase. The historical BIN revision is not inferred from the image or filename.';
      }
      if (original.image !== action.image || action.menuFamily) {
        const local = path.join(root,action.image);
        if (!fs.existsSync(local)) throw Error('Missing menu image: '+action.image);
        if (action.menuVersion !== original.menuVersion) throw Error('Menu version changed without evidence: '+action.id);
        records.push({id:action.id,family:action.menuFamily,game:action.game,gameUpdate:action.gameVersion,menuVersion:action.menuVersion??null,image:action.image,imageRole:action.imageRole,sha256:sha(fs.readFileSync(local)),description:action.imageDescription});
      }
    }
  }
  if (JSON.stringify(before.map(data=>data.actions.map(unchanged))) !== baseline) throw Error('An action, version, requirement, download or compatibility property changed.');
  for (let index=0;index<files.length;index++) fs.writeFileSync(path.join(root,files[index]),JSON.stringify(before[index],null,2)+'\n');
  const report={checkedAt:new Date().toISOString(),scope:'Existing host menu metadata and artwork only; no action added or removed, payload executed, or compatibility/download/hash changed.',records,sourceEvidence:[{source:'docs/discord-ps4-ps5-coverage.json',scope:'Exact original screenshot URLs and local asset mappings for Explosive1.57, Expulsion5.0, Cyprus, North Beta and Oysters.'},{url:'https://rdroysters.com/products',result:'Primary product page reviewed: current1.3.9 is SPRX, supporting game updates1.00/1.13/1.19/1.24/1.29. Does not establish the version of the older host BINs.'},{url:'https://ko-fi.com/s/793712a8ad',result:'Original Explosive PS4 product page reviewed; game-update compatibility and plugin instructions do not establish the version of the supplied explosive_temp.sprx.'},{url:'https://www.youtube.com/watch?v=sX8gF4V5klA',result:'V7 release candidate discovered; primary YouTube/X endpoints inaccessible in web extraction. No unverified thumbnail substituted.'}],grouping:[{family:'Expulsion',game:'GTA V',variants:'Menu5.0 and7.0, both gameupdate1.57'},{family:'Cyprus',game:'GTA V',variants:'Gameupdate1.56 and1.57; menuversionnotprovided'},{family:'Oysters',game:'RDR2',variants:'Gameupdates1.00/1.13/1.19/1.24/1.29; historicalBIN menuversionnotprovided'}],notes:['Original images remain preserved. The two new SVGs are labelled covers, not screenshots.','Expulsion5.0 preview is not reused for7.0.','No new numeric menu version is inferred from a screenshot, filename, or a newer upstream build.']};
  fs.writeFileSync(path.join(root,'docs/host-menu-art-review.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({updatedRecords:records.length,customCovers:Object.keys(covers),preservedActions:before.reduce((n,data)=>n+data.actions.length,0)},null,2));
}
if (require.main===module) update();
module.exports={update};
