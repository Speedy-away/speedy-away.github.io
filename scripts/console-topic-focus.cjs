// Refine copied catalogue controls to describe the cards retained on a topic page.
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const decode = value => String(value).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'");
const attr = (tag, name) => {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'));
  return match ? decode(match[2]) : null;
};
const has = (tag, name) => new RegExp(`(?:^|\\s)${name}(?=\\s|=|/?>)`, 'i').test(tag);
const families = {
  psvita: {card:'data-vita-item', category:'data-category', select:'vita-category', count:'data-vita-count', noun:'project'},
  wiiu: {card:'data-wiiu-app', category:'data-category', selectAttr:'data-wiiu-category', count:'data-wiiu-count', noun:'app'},
  ps2: {card:'data-ps2-item', category:'data-category', selectAttr:'data-ps2-category', count:'data-ps2-count', noun:'resource'},
  ds: {card:'data-ds-card', category:'data-ds-group', split:true, select:'dsCategory', count:'data-ds-count', noun:'resource', shown:true},
  '3ds': {card:'data-three-ds-card', category:'data-three-ds-category', split:true, select:'threeDsCategory', countClass:'three-ds-count', noun:'resource', shown:true},
  wii: {card:'data-wii-card', category:'data-category', button:'data-wii-filter', countId:'wii-more-status', noun:'resource', shown:true},
  psp: {cardClass:'game-card', category:'data-category', split:true, button:'data-filter', countId:'gameSearchStatus', noun:'download', shown:true}
};

function focusContent(content, group, platform) {
  const family = families[platform.id];
  if (!family) return content;
  const cards = [...content.matchAll(/<article\b[^>]*>/gi)].map(match => match[0]).filter(tag =>
    family.card ? has(tag, family.card) : (attr(tag, 'class') || '').split(/\s+/).includes(family.cardClass));
  // A setup page with no catalogue controls should remain exactly as captured.
  const hasControl = family.select ? content.includes(`id="${family.select}"`) || content.includes(`id='${family.select}'`)
    : family.selectAttr ? new RegExp(`\\b${family.selectAttr}(?:\\s|=|>)`).test(content)
    : new RegExp(`\\b${family.button}\\s*=`).test(content);
  if (!hasControl) return content;
  const values = new Set(cards.flatMap(tag => {
    const value = attr(tag, family.category);
    return value === null ? [] : family.split ? value.split(/\s+/).filter(Boolean) : [value];
  }));
  const keep = value => value === '' || value === 'all' || values.has(value);
  content = content.replace(/<select\b[^>]*>[\s\S]*?<\/select>/gi, select => {
    const opening = select.match(/^<select\b[^>]*>/i)[0];
    if (!(family.select && attr(opening, 'id') === family.select || family.selectAttr && has(opening, family.selectAttr))) return select;
    return select.replace(/<option\b[^>]*>[\s\S]*?<\/option>/gi, option => {
      const opening = option.match(/^<option\b[^>]*>/i)[0];
      const value = attr(opening, 'value') ?? decode(option.replace(/<[^>]*>/g, '').trim());
      return keep(value) ? option : '';
    });
  });
  if (family.button) content = content.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, button => {
    const value = attr(button.match(/^<button\b[^>]*>/i)[0], family.button);
    return value === null || keep(value) ? button : '';
  });
  const label = `${cards.length} ${family.noun}${cards.length === 1 ? '' : 's'}${family.shown ? ' shown' : ''}`;
  content = content.replace(/<(p|span|output)\b[^>]*>[\s\S]*?<\/\1>/gi, element => {
    let opening = element.match(/^<[a-z]+\b[^>]*>/i)[0];
    const match = family.count && has(opening, family.count) || family.countId && attr(opening, 'id') === family.countId
      || family.countClass && (attr(opening, 'class') || '').split(/\s+/).includes(family.countClass);
    if (!match) return element;
    if (platform.id === 'ds') {
      for (const name of ['data-visible-count', 'data-total-count']) {
        const pattern = new RegExp(`\\s${name}\\s*=\\s*(["']).*?\\1`, 'i');
        opening = pattern.test(opening) ? opening.replace(pattern, ` ${name}="${cards.length}"`) : opening.replace(/>$/, ` ${name}="${cards.length}">`);
      }
    }
    return opening + label + element.match(/<\/[a-z]+>$/i)[0];
  });
  // Only retitle the generic catalogue toolbar, never setup or compatibility sections.
  const toolbarIds = platform.id === 'wiiu' ? 'library|browse|wii-library|category|apps' : 'library|browse|wii-library|category';
  const heading = new RegExp(`(<section\\b[^>]*\\bid=(["'])(?:${toolbarIds})\\2[^>]*>[\\s\\S]*?<h2\\b[^>]*>)([\\s\\S]*?)(<\\/h2>)`, 'i');
  const found = heading.exec(content);
  if (found) {
    const start = found.index;
    const changed = found[1] + esc(group.title) + found[4];
    content = content.slice(0, start) + changed + content.slice(start + found[0].length);
    const afterHeading = start + changed.length;
    const remainder = content.slice(afterHeading);
    const boundary = remainder.search(/<(?:article|section)\b/i);
    const prefix = boundary < 0 ? remainder : remainder.slice(0, boundary);
    const focused = prefix.replace(/(<p\b[^>]*\bclass=(["'])[^"']*\bsection-subtitle\b[^"']*\2[^>]*>)[\s\S]*?(<\/p>)/i,
      (_, opening, quote, close) => opening + esc(group.description) + close);
    content = content.slice(0, afterHeading) + focused + remainder.slice(prefix.length);
  }
  return content;
}

module.exports = {focusContent};
