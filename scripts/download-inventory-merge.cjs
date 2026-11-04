// Merge one completed import into the latest on-disk state. Other writers' IDs
// and top-level inventory sections are preserved as read immediately before save.
function mergeRows(existing = [], incoming = [], key) {
  const rows = existing.map(value => ({ ...value }));
  for (const value of incoming) {
    const index = rows.findIndex(row => key(row) === key(value));
    if (index < 0) rows.push({ ...value });
    else rows[index] = { ...rows[index], ...value };
  }
  return rows;
}
function mergeImport(latestManifest, latestAudit, pendingManifest, pendingAudit, downloadId, collection = 'ps4-ps5') {
  if (!['ps4-ps5', 'ps3', 'xbox360', 'pc'].includes(collection)) throw Error('Unknown download collection');
  const itemId = collection + '-' + downloadId;
  const incoming = pendingAudit.items.find(item => item.id === itemId);
  if (!incoming) throw Error('Missing pending import inventory record: ' + downloadId);
  const privateReview = incoming.publication === 'private-review';
  const manifest = { ...latestManifest, files: privateReview
    ? latestManifest.files.filter(file => file.downloadId !== downloadId)
    : mergeRows(latestManifest.files,
      pendingManifest.files.filter(file => file.downloadId === downloadId),
      file => [file.downloadId, file.status, file.sha256 || '', file.error || ''].join('|')) };
  const items = [...latestAudit.items];
  const index = items.findIndex(item => item.id === itemId);
  const existing = index < 0 ? {} : items[index];
  const item = { ...existing, ...incoming,
    sourceUrls: [...new Set([...(existing.sourceUrls || []), ...(incoming.sourceUrls || [])])],
    files: mergeRows(existing.files, incoming.files, file => [file.sha256 || '', file.name || file.filename || ''].join('|')),
    attempts: mergeRows(existing.attempts, incoming.attempts, attempt => [attempt.at, attempt.status, attempt.sha256 || '', attempt.error || ''].join('|')) };
  if (index < 0) items.push(item); else items[index] = item;
  return { manifest, audit: { ...latestAudit, items } };
}
module.exports = { mergeImport };
