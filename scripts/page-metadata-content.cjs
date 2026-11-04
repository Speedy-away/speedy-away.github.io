// Extract page-specific search subjects without sidebar/footer keyword leakage.
const decode = value => String(value).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&apos;', "'").replaceAll('&nbsp;', ' ').replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const plain = html => decode(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function mainContent(html) {
  let body = (html.split(/<body\b[^>]*>/i)[1] || html).replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const opening = /<(main|div)\b(?=[^>]*(?:\bid=["']main-content["']|\brole=["']main["']|\bclass=["'][^"']*\bmain-content\b))[^>]*>|<main\b[^>]*>/i.exec(body);
  if (opening) {
    const name = opening[0].match(/^<([\w-]+)/)[1];
    const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
    tags.lastIndex = opening.index + opening[0].length;
    let depth = 1, token;
    while (depth && (token = tags.exec(body))) depth += token[1] ? -1 : 1;
    body = body.slice(opening.index + opening[0].length, depth ? undefined : token.index);
  }
  return body.replace(/<(nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--\s*(?:Footer\b|Safety\s+(?:Information|Warning)\b)[\s\S]*/i, '');
}
function matchesPrefix(relative, prefix) {
  if (prefix.endsWith('.html')) return relative === prefix;
  if (prefix.endsWith('/')) return relative.startsWith(prefix);
  return relative === prefix || relative === prefix + '.html' || relative.startsWith(prefix + '/');
}
function trimDescription(value, limit = 165) {
  const text = plain(value);
  if (text.length <= limit) return text;
  const sentence = text.match(new RegExp(`^(.{75,${limit - 1}}[.!?])(?:\\s|$)`))?.[1];
  return sentence || text.slice(0, limit - 1).replace(/\s+\S*$/, '').replace(/[,;:]$/, '') + '…';
}
function fallbackDescription(subject, content) {
  const titles = [...content.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(m => plain(m[1])).filter(t => t.length > 3 && t.length < 65 && !/^(?:More |Sources|Related|Documentation|Before |Installation|Requirements|Overview)/i.test(t)).slice(0, 3);
  return trimDescription(`${subject}. ${titles.length ? 'Browse ' + titles.join(', ') + ' and page-specific details.' : 'Find the resources, source links and page-specific information on whatwhatboy.'}`);
}
module.exports = {decode, plain, mainContent, matchesPrefix, trimDescription, fallbackDescription};
