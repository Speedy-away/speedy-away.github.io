const gameAliases = {
  'gta5': ['GTA V', 'GTA 5', 'Grand Theft Auto V'],
  'rdr2': ['RDR2', 'RDR 2', 'Red Dead Redemption 2'],
  'dying-light': ['Dying Light', 'Dying Light The Following', 'Dying Light Enhanced Edition'],
  'dying-light-2': ['Dying Light 2', 'Dying Light 2 Stay Human', 'DL2'],
  'dead-island': ['Dead Island', 'Dead Island Definitive Edition', 'Dead Island Riptide'],
  'black-ops-1': ['BO1', 'Black Ops 1', 'Black Ops I', 'BO 1'],
  'black-ops-2': ['BO2', 'Black Ops 2', 'Black Ops II', 'BO 2'],
  'black-ops-3': ['BO3', 'Black Ops 3', 'Black Ops III', 'BO 3'],
  'black-ops-4': ['BO4', 'Black Ops 4', 'Black Ops IV', 'BO 4'],
  'ghosts': ['Ghosts', 'COD Ghosts', 'Call of Duty Ghosts'],
  'advanced-warfare': ['AW', 'Advanced Warfare', 'COD AW'],
  'infinite-warfare': ['IW', 'Infinite Warfare', 'COD IW'],
  'modern-warfare-remastered': ['MWR', 'MW4R', 'Modern Warfare Remastered', 'COD4 Remastered'],
  'modern-warfare-2-remastered': ['MW2R', 'MW2 Remastered', 'Modern Warfare 2 Campaign Remastered'],
  'cold-war': ['Cold War', 'BOCW', 'Black Ops Cold War'],
  'wwii': ['WWII', 'WW2', 'World War II', 'Call of Duty WWII']
};
const categoryLabels = {
  menu: 'Mod menu', client: 'Server client', injector: 'Injector', pack: 'Menu pack', cfg: 'CFG',
  rtm: 'RTM tool', script: 'Script', cheat: 'Cheat file', reference: 'DLC reference', source: 'Source code'
};
const unique = values => [...new Map(values.filter(Boolean).map(value => [String(value).toLowerCase(), String(value)])).values()];
function resourceTags(item) {
  const tags = [categoryLabels[item.category] || 'Resource', ...(item.gameIds || []).map(id => gameAliases[id]?.[0])];
  const subject = [item.name, item.group, item.description].filter(Boolean).join(' ');
  if (/\bzombies\b|\bZM\b/i.test(subject)) tags.push('Zombies');
  if (/\bmultiplayer\b|\bMP\b/i.test(subject)) tags.push('Multiplayer');
  if (/\bextinction\b/i.test(subject)) tags.push('Extinction');
  if (/\bGSC\b/i.test(subject)) tags.push('GSC');
  if (/\bWindows\b/i.test(subject)) tags.push('Windows');
  for (const download of item.downloads || []) {
    let filename = download.filename || '';
    try { filename += ' ' + decodeURIComponent(new URL(download.url).pathname); } catch {}
    for (const extension of ['sprx', 'prx', 'gscc', 'gsc', 'csc', 'cfg']) {
      if (new RegExp('\\.' + extension + '(?:[ /]|$)', 'i').test(filename)) tags.push(extension.toUpperCase());
    }
  }
  for (const version of item.gameVersions || []) tags.push('Game ' + version);
  if ((item.guideBlocks || []).length || (item.controls || []).length) tags.push('Guide');
  return unique([...tags, ...(item.tags || [])]);
}
function resourceTerms(item, gameTitle = '') {
  const aliases = (item.gameIds || []).flatMap(id => gameAliases[id] || []);
  const modes = resourceTags(item);
  return unique([item.name, gameTitle, ...aliases, ...modes, item.version, item.compatibilityText,
    ...((modes.includes('Zombies')) ? ['ZM'] : []), ...((modes.includes('Multiplayer')) ? ['MP'] : []),
    ...(item.keywords || [])]);
}
module.exports = {gameAliases, categoryLabels, resourceTags, resourceTerms, unique};
