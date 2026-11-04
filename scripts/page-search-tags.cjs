// Search aliases for actual resource names and visible tags, never page-wide
// platform guesses or hidden compatibility prose.
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const decode = value => String(value)
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(?:amp|quot|apos|lt|gt|nbsp|rsquo|lsquo|ndash|mdash);/g, entity => ({'&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&rsquo;': '’', '&lsquo;': '‘', '&ndash;': '–', '&mdash;': '—'}[entity]));
const plain = value => decode(String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const fold = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const unique = values => [...new Map(values.filter(Boolean).map(value => [fold(value), String(value).trim()])).values()];
const groups = [
  [/\b(?:gta\s*(?:v|5)|grand theft auto\s*(?:v|5))\b/i, ['GTA V', 'GTA 5', 'GTA5', 'Grand Theft Auto V', 'Grand Theft Auto 5']],
  [/\b(?:gta\s*(?:iv|4)|grand theft auto\s*(?:iv|4))\b/i, ['GTA IV', 'GTA 4', 'GTA4', 'Grand Theft Auto IV', 'Grand Theft Auto 4']],
  [/\b(?:rdr\s*2|red dead redemption\s*(?:2|ii))\b/i, ['RDR2', 'RDR 2', 'Red Dead Redemption 2', 'Red Dead Redemption II']],
  [/\b(?:gta\s*(?:sa|san andreas)|grand theft auto san andreas)\b/i, ['GTA San Andreas', 'GTA SA', 'GTASA', 'Grand Theft Auto San Andreas']],
  [/\b(?:gta\s*(?:vc|vice city)|grand theft auto vice city)\b/i, ['GTA Vice City', 'GTA VC', 'GTAVC', 'Grand Theft Auto Vice City']],
  [/\b(?:gta\s*(?:iii|3)|grand theft auto\s*(?:iii|3))\b/i, ['GTA III', 'GTA 3', 'GTA3', 'Grand Theft Auto III']],
  [/\b(?:red dead redemption|rdr\s*1)\b(?!\s*(?:2|ii)\b)/i, ['Red Dead Redemption', 'RDR1', 'RDR 1']],
  [/\b(?:modern warfare\s*(?:2|ii)|mw\s*2)\b/i, ['Modern Warfare 2', 'Modern Warfare II', 'MW2', 'MW 2']],
  [/\b(?:modern warfare\s*(?:3|iii)|mw\s*3)\b/i, ['Modern Warfare 3', 'Modern Warfare III', 'MW3', 'MW 3']],
  [/\bborderlands\s*(?:2|ii)\b/i, ['Borderlands 2', 'BL2', 'BL 2']],
  [/\bborderlands\s*(?:3|iii)\b/i, ['Borderlands 3', 'BL3', 'BL 3']],
  [/\bleft\s*4\s*dead\s*2\b|\bl4d\s*2\b/i, ['Left 4 Dead 2', 'L4D2', 'L4D 2']],
  [/\bleft\s*4\s*dead\b(?!\s*2\b)|\bl4d\s*1\b/i, ['Left 4 Dead', 'L4D1', 'L4D 1']],
  [/\b(?:black ops\s*(?:1|i)|bo\s*1)\b/i, ['Black Ops 1', 'Black Ops I', 'BO1', 'BO 1', 'Call of Duty Black Ops 1']],
  [/\b(?:black ops\s*(?:2|ii)|bo\s*2)\b/i, ['Black Ops 2', 'Black Ops II', 'BO2', 'BO 2', 'Call of Duty Black Ops 2']],
  [/\b(?:black ops\s*(?:3|iii)|bo\s*3)\b/i, ['Black Ops 3', 'Black Ops III', 'BO3', 'BO 3', 'Call of Duty Black Ops 3']],
  [/\b(?:black ops\s*(?:4|iv)|bo\s*4)\b/i, ['Black Ops 4', 'Black Ops IV', 'BO4', 'BO 4', 'Call of Duty Black Ops 4']],
  [/\b(?:black ops cold war|bocw)\b/i, ['Black Ops Cold War', 'BOCW', 'Call of Duty Black Ops Cold War']],
  [/\b(?:modern warfare remastered|cod\s*4 remastered|mwr)\b/i, ['Modern Warfare Remastered', 'MWR', 'COD4 Remastered', 'Call of Duty Modern Warfare Remastered']],
  [/\b(?:call of duty\s*4|cod\s*4)(?!\s*remastered)\b/i, ['Call of Duty 4', 'COD4', 'COD 4']],
  [/\b(?:call of duty world at war|world at war|cod\s*waw)\b/i, ['Call of Duty World at War', 'COD WaW', 'World at War']],
  [/\b(?:advanced warfare|cod\s*aw)\b/i, ['Advanced Warfare', 'COD AW', 'Call of Duty Advanced Warfare']],
  [/\b(?:infinite warfare|cod\s*iw)\b/i, ['Infinite Warfare', 'COD IW', 'Call of Duty Infinite Warfare']],
  [/\b(?:call of duty\s*(?:wwii|ww2|world war ii)|cod\s*(?:wwii|ww2))\b/i, ['Call of Duty WWII', 'Call of Duty WW2', 'COD WWII', 'COD WW2']],
  [/\b(?:counter[- ]strike\s*2|cs\s*2)\b/i, ['Counter-Strike 2', 'Counter Strike 2', 'CS2', 'CS 2']],
  [/\bcounter[- ]strike source\b/i, ['Counter-Strike Source', 'Counter Strike Source', 'CS Source', 'CS:S']],
  [/\bcounter[- ]strike\s*1\.6\b|\bcs\s*1\.6\b/i, ['Counter-Strike 1.6', 'Counter Strike 1.6', 'CS 1.6', 'CS16']],
  [/\b(?:counter[- ]strike global offensive|cs[: ]?go)\b/i, ['Counter-Strike Global Offensive', 'CSGO', 'CS GO', 'CS:GO']],
  [/\b(?:team fortress\s*2|tf\s*2)\b/i, ['Team Fortress 2', 'TF2', 'TF 2']],
  [/\b(?:garry['’]?s mod|gmod)\b/i, ["Garry's Mod", 'Garrys Mod', 'GMod']],
  [/\b(?:playstation\s*1|ps\s*1)\b/i, ['PlayStation 1', 'PS1', 'PS 1']],
  [/\b(?:playstation\s*2|ps\s*2)\b/i, ['PlayStation 2', 'PS2', 'PS 2']],
  [/\b(?:playstation\s*3|ps\s*3)\b/i, ['PlayStation 3', 'PS3', 'PS 3']],
  [/\b(?:playstation\s*4|ps\s*4)\b/i, ['PlayStation 4', 'PS4', 'PS 4']],
  [/\b(?:playstation\s*5|ps\s*5)\b/i, ['PlayStation 5', 'PS5', 'PS 5']],
  [/\b(?:playstation vita|ps\s*vita|native vita)\b/i, ['PlayStation Vita', 'PS Vita', 'PSVita']],
  [/\b(?:playstation portable|psp)\b/i, ['PlayStation Portable', 'PSP']],
  [/\b(?:xbox\s*360|x360)\b/i, ['Xbox 360', 'Xbox360', 'X360']],
  [/\b(?:original xbox|xbox classic)\b/i, ['Original Xbox', 'Xbox Classic']],
  [/\b(?:xbox one)\b/i, ['Xbox One', 'XboxOne']],
  [/\b(?:xbox series x|xsx)\b/i, ['Xbox Series X', 'XSX']],
  [/\b(?:xbox series s|xss)\b/i, ['Xbox Series S', 'XSS']],
  [/\b(?:nintendo switch\s*2|switch\s*2)\b/i, ['Nintendo Switch 2', 'Switch 2']],
  [/(?:\bnintendo switch(?!\s*2)\b|^switch$|\bswitch(?=\s+(?:homebrew|firmware|games|mods|themes|apps|emulators|tools|setup|cfw|bootloader)\b))/i, ['Nintendo Switch', 'Switch']],
  [/\b(?:nintendo gamecube|gamecube)\b/i, ['Nintendo GameCube', 'GameCube', 'Game Cube']],
  [/\b(?:nintendo wii\s*u|wii\s*u)\b/i, ['Nintendo Wii U', 'Wii U', 'WiiU']],
  [/\b(?:nintendo wii|wii)(?!\s*u)\b/i, ['Nintendo Wii', 'Wii']],
  [/\b(?:nintendo\s*3ds|3ds)\b/i, ['Nintendo 3DS', '3DS']],
  [/\b(?:nintendo\s*2ds|2ds)\b/i, ['Nintendo 2DS', '2DS']],
  [/\b(?:nintendo dsi|dsi)\b/i, ['Nintendo DSi', 'DSi']],
  [/\b(?:nintendo ds|nds)(?!i)\b/i, ['Nintendo DS', 'NDS']],
  [/\b(?:game boy advance|gba)\b/i, ['Game Boy Advance', 'GBA']],
  [/\b(?:game boy color|gbc)\b/i, ['Game Boy Color', 'GBC']],
  [/\b(?:steam deck|steamdeck)\b/i, ['Steam Deck', 'SteamDeck']],
  [/\bsingle[- ]?player\b/i, ['single player', 'single-player', 'singleplayer']],
  [/\bmulti[- ]?player\b/i, ['multiplayer', 'multi-player', 'multi player']],
  [/\bco[- ]?op\b/i, ['co-op', 'co op', 'coop']],
  [/\bopen[- ]source\b/i, ['open source', 'open-source']],
  [/\b(?:frame[- ]?rate|\d+\s*fps)\b/i, ['frame rate', 'framerate']],
  [/\b(?:vpk)\b/i, ['VPK', 'VPK package']],
  [/\bpkg\b/i, ['PKG', 'package file']],
  [/\bwuhb\b/i, ['WUHB', 'homebrew bundle']],
  [/\b(?:nxtheme|nx themes?)\b/i, ['NXTheme', 'NX theme', 'theme file']],
  [/\bp3t\b/i, ['P3T', 'theme file']],
  [/\bpbp\b/i, ['PBP', 'EBOOT.PBP']],
  [/\bxbe\b/i, ['XBE', 'Xbox executable']],
  [/\bsha[- ]?256\b/i, ['SHA-256', 'SHA256', 'file checksum']]
];

function aliasesFor(value) {
  const text = plain(value);
  return unique(groups.flatMap(([pattern, aliases]) => pattern.test(text) ? aliases : []));
}
function resourceTerms(card) {
  const heading = card.match(/<h[234]\b[^>]*>([\s\S]*?)<\/h[234]>/i)?.[1]
    || card.match(/<(?:span|strong)\b[^>]*class=["'][^"']*\b(?:game-title|resource-title|source-title)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|strong)>/i)?.[1] || '';
  const labels = [...card.matchAll(/<(?:span|li)\b[^>]*class=["'][^"']*\b(?:feature|feature-tag|tag|badge)\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|li)>/gi)].map(match => plain(match[1]));
  for (const match of card.matchAll(/<ul\b[^>]*class=["'][^"']*\b[\w-]*tags\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi)) labels.push(plain(match[1]));
  const title = plain(heading);
  // Negative compatibility tags remain visible/searchable, but must not add
  // positive platform aliases. A file format alone never assigns a platform.
  const positiveLabels=labels.filter(label=>!/\b(?:not (?:compatible|supported|tested|verified|available)|unsupported|unconfirmed|unverified|untested|no (?:native |verified |confirmed )?(?:support|ps[1-5]|xbox))\b/i.test(label));
  return unique([title, ...labels, ...[title, ...positiveLabels].flatMap(aliasesFor)]);
}
function protectedFile(file, html = '') {
  const relative = (path.isAbsolute(file) && !/^\/(?:console|downloads)\//.test(file) ? path.relative(root, file) : file).replaceAll('\\', '/').replace(/^\/+/, '').split(/[?#]/)[0];
  return relative.startsWith('hosts/runtime/')
    || relative.startsWith('downloads/') && relative !== 'downloads/index.html'
    || /(?:^|\/)whatsite-ps[45]\.html$/i.test(relative)
    || /\bid=["']receiver-catalog["']/.test(html);
}
const tokenPattern = /<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<\/?[a-z][\w:-]*\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const searchAttribute = /(?:^|\s)(data-search|data-library-search)\s*=\s*(["'])([\s\S]*?)\2/i;
function apply(file, html) {
  if (protectedFile(file, html)) return html;
  const tokens = [...html.matchAll(tokenPattern)];
  const edits = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], start = token[0];
    const tag = start.match(/^<(article|div|a|li)\b/i)?.[1]?.toLowerCase();
    if (!tag) continue;
    const found = start.match(searchAttribute);
    const native = /\sdata-(?:ps2-item|vita-item|ds-card|three-ds-card|wii-card|wiiu-app|xbox-app|library-card)(?=\s|=|>)/.test(start);
    if (!found && !native) continue;
    let depth = 1, end = -1;
    for (let j = i + 1; j < tokens.length; j++) {
      const next = tokens[j];
      if (new RegExp(`^<${tag}\\b`, 'i').test(next[0])) depth++;
      else if (new RegExp(`^<\\/${tag}\\s*>$`, 'i').test(next[0])) depth--;
      if (!depth) { end = next.index + next[0].length; break; }
    }
    if (end === -1) continue;
    const terms = resourceTerms(html.slice(token.index, end));
    if (!terms.length) continue;
    const existing = found ? decode(found[3]).toLowerCase() : '';
    const additions = [];
    for (const term of terms) {
      const variants = [...new Set([term.toLowerCase(), fold(term)])];
      for (const value of variants) if (value && !(existing + ' ' + additions.join(' ')).includes(value)) additions.push(value);
    }
    const value = [existing, ...additions].filter(Boolean).join(' ').trim();
    const attr = found?.[1] || (/\sdata-library-card(?:\s|=|>)/.test(start) ? 'data-library-search' : 'data-search');
    const quote = found?.[2] || '"';
    const escaped = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll(quote, quote === '"' ? '&quot;' : '&#39;');
    const prefix = found ? found[0].slice(0, found[0].indexOf(found[1])) : ' ';
    const updated = found ? start.replace(searchAttribute, `${prefix}${attr}=${quote}${escaped}${quote}`) : start.replace(/>$/, ` ${attr}=${quote}${escaped}${quote}>`);
    if (updated !== start) edits.push({start: token.index, end: token.index + start.length, value: updated});
  }
  for (const edit of edits.reverse()) html = html.slice(0, edit.start) + edit.value + html.slice(edit.end);
  return html;
}
module.exports = {apply, aliasesFor, resourceTerms, protectedFile, decode, plain, fold};
