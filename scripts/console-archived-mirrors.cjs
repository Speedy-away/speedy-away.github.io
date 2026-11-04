// Reuse explicit public downloads already saved by the older archive workflow.
// A release landing page is ambiguous when it contains more than one asset.
function sourceKey(value) {
  try {
    const url = new URL(value);
    const mediafire = /(?:^|\.)mediafire\.com$/i.test(url.hostname) && url.pathname.match(/^\/(?:file|file_premium)\/([^/]+)/);
    if (mediafire) return 'mediafire:' + mediafire[1];
    if (url.hostname === 'cdn.discordapp.com') { url.search = ''; url.hash = ''; }
    return url.href;
  } catch { return ''; }
}
function archivedMirrors(resources, inventory) {
  const mirrors = [];
  for (const resource of resources.filter(item => item.publication === 'include')) {
    for (const download of (resource.downloads || []).filter(file => file.distribution === 'include')) {
      const key = sourceKey(download.url);
      if (!key) continue;
      const candidates = [];
      for (const item of inventory) {
        if (item.status !== 'downloaded' || /private|review|excluded/i.test(item.publication || '')) continue;
        for (const file of item.files || []) {
          if (!file.local?.startsWith('/downloads/') || !/^[a-f0-9]{64}$/i.test(file.sha256 || '')) continue;
          const exactFile = [file.resolvedUrl, file.source].some(url => url && sourceKey(url) === key);
          const singleAsset = item.files.length === 1 && [item.url, ...(item.sourceUrls || [])].some(url => sourceKey(url) === key);
          if (exactFile || singleAsset) candidates.push({...file, source: download.url, status: 'downloaded', downloadId: download.id});
        }
      }
      // Conflicting revisions at the same URL remain external until identified.
      if (new Set(candidates.map(file => file.sha256)).size === 1) mirrors.push(candidates[0]);
    }
  }
  return mirrors;
}
module.exports = {sourceKey, archivedMirrors};
