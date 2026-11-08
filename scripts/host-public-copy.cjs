'use strict';

const upstream = /^https:\/\/(?:(?:kar0218|gamerhack)\.github\.io(?:\/|$)|karo218\.ir(?:\/|$)|(?:raw\.githubusercontent\.com|github\.com)\/(?:kar0218|gamerhack)(?:\/|$))/i;
const brand = /\b(?:Karo|GamerHack)\b/i;

function label(value) {
  return value
    .replace(/\b(?:Karo|GamerHack)\s+(?:host\s+)?build\b/gi, 'Archived host build')
    .replace(/\b(?:Karo|GamerHack)\s*·\s*/gi, '')
    .replace(/\b(?:Karo|GamerHack)\s+builds\b/gi, 'Console builds')
    .replace(/\b(?:Karo|GamerHack)\s+(?=\S)/gi, '')
    .replace(/\b(?:Karo|GamerHack)\b/gi, 'Archived host');
}

function catalogue(rows, delivery) {
  return rows.map(row => {
    const item = {...row};
    for (const key of ['url', 'downloadURL', 'nativeDownloadURL']) {
      if (delivery[item[key]]) item[key] = delivery[item[key]].url;
    }
    for (const key of ['source', 'sourceURL', 'hostURL']) {
      if (upstream.test(item[key] || '')) delete item[key];
    }
    for (const key of ['title', 'label', 'firmwareLabel', 'version', 'versionLabel', 'variantLabel', 'hostVariant', 'firmwareEvidence', 'license', 'imageAlt']) {
      if (typeof item[key] === 'string' && brand.test(item[key])) item[key] = label(item[key]);
    }
    for (const key of ['requirements', 'tags', 'credits']) {
      if (Array.isArray(item[key])) item[key] = item[key].map(value => typeof value === 'string' ? label(value) : value);
    }
    return item;
  });
}

function html(text, name, delivery) {
  if (!/^(?:hosts\/(?!runtime\/|credits\/)|ps[45]\/)/.test(name)) return text;
  text = text.replace(/<footer><details><summary>Source &amp; credits<\/summary>[\s\S]*?<\/details><\/footer>/gi,
    footer => brand.test(footer) ? '<footer><a href="/hosts/credits/">Credits and source notices</a></footer>' : footer);
  text = text.replace(/<a\b([^>]*\bhref=)(["'])(https:\/\/[^"']+)\2([^>]*)>([\s\S]*?)<\/a>/gi,
    (anchor, start, quote, url, end, body) => {
      if (!upstream.test(url)) return anchor;
      const copy = delivery[url];
      if (copy) return '<a'+start+quote+copy.url+quote+end+'>'+body+'</a>';
      return /\b(?:Original file|Pinned source|Pinned original repository)\b/i.test(body) ? '' : anchor;
    });
  text = text.replace(/(<script\b[^>]*id="host-actions-data"[^>]*>)([\s\S]*?)(<\/script>)/i,
    (whole, open, json, close) => {
      const data = JSON.parse(json);
      if (!Array.isArray(data.actions)) return whole;
      data.actions = catalogue(data.actions, delivery);
      return open+JSON.stringify(data).replaceAll('<', '\\u003c')+close;
    });
  return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>|<[^>]+>|[^<]+/gi,
    token => token.startsWith('<') || !brand.test(token) ? token : label(token));
}

module.exports = {catalogue, html};
