const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'downloads/ps4-ps5/manifest.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs/download-audit.json'), 'utf8'));
const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-ps5-download-imports.json'), 'utf8'));
const ownIds = new Set(jobs.jobs.map(job => job.id));
const ownItemIds = new Set(jobs.jobs.map(job => 'ps4-ps5-' + job.id));
const ownItems = audit.items.filter(item => ownItemIds.has(item.id));
const ownFiles = manifest.files.filter(file => ownIds.has(file.downloadId));
const successful = ownFiles.filter(file => file.status === 'downloaded');
const unique = [...new Map(successful.map(file => [file.downloadId + '|' + file.sha256, file])).values()];
const sourceIds = new Set(ownItems.filter(item => item.kind === 'source-code' || item.kind === 'github-source' || item.archiveRole?.includes('Source Code')).map(item => item.id.slice('ps4-ps5-'.length)));
const privateSourceItems = ownItems.filter(item => item.publication === 'private-review' && sourceIds.has(item.id.slice('ps4-ps5-'.length)));
const privateSourceFiles = privateSourceItems.flatMap(item => item.files.map(file => ({ ...file, downloadId: item.id.slice('ps4-ps5-'.length) })));
const sourceArchives = [...unique.filter(file => sourceIds.has(file.downloadId)), ...privateSourceFiles];
const auxiliaryIds = new Set(ownItems.filter(item => item.kind === 'guide').map(item => item.id.slice('ps4-ps5-'.length)));
const auxiliaryFiles = unique.filter(file => auxiliaryIds.has(file.downloadId));
const ready = unique.filter(file => !file.local?.startsWith('/assets/') && !sourceIds.has(file.downloadId) && !auxiliaryIds.has(file.downloadId));
const images = unique.filter(file => file.local?.startsWith('/assets/images/'));
const videos = unique.filter(file => file.local?.startsWith('/assets/videos/'));
const reviews = (audit.reviews || []).filter(item => item.id === 'ps4-ps5-bo2-relay-ps5-review');
const reviewFiles = reviews.flatMap(item => item.files.map(file => ({ ...file, downloadId: item.id })));
const privateReviewMedia = (audit.reviewMedia || []).filter(file => /^cod-dlc-.+-review-image$/.test(file.id));
const derivatives = ownItems.flatMap(item => (item.mediaDerivatives || []).map(file => ({ ...file, sourceFiles: item.files, downloadId: item.id + '/' + file.id })));
function verifyFile(filename, record, label) {
  const bytes = fs.readFileSync(filename);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  if (bytes.length !== record.bytes || digest !== record.sha256) throw Error(label + ' hash/size mismatch: ' + record.downloadId);
}
function verifyPublicValues(value) {
  if (typeof value === 'string' && /^(?:[a-z]:[\\/]|\\\\)/i.test(value)) throw Error('Machine path in public manifest');
  if (Array.isArray(value)) value.forEach(verifyPublicValues);
  else if (value && typeof value === 'object') Object.values(value).forEach(verifyPublicValues);
}
for (const file of unique) {
  const item = audit.items.find(entry => entry.id === 'ps4-ps5-' + file.downloadId);
  const record = item?.files.find(entry => entry.sha256 === file.sha256);
  if (!record) throw Error('Missing private inventory record: ' + file.downloadId);
  const savedPath = file.local ? path.join(root, file.local.slice(1)) : record.backupPath;
  if (!savedPath) throw Error('Missing locally saved file: ' + file.downloadId);
  verifyFile(savedPath, file, 'Local');
  if (!file.local?.startsWith('/assets/')) {
    if (!record.backupPath) throw Error('Missing F: backup: ' + file.downloadId);
    verifyFile(record.backupPath, file, 'Backup');
  }
}
for (const file of ownFiles) {
  const source = new URL(file.source);
  if (source.hostname.endsWith('discordapp.com') && source.search) throw Error('Signed URL in public manifest: ' + file.downloadId);
}
for (const item of ownItems) {
  const source = new URL(item.url);
  if (source.hostname.endsWith('discordapp.com') && source.search) throw Error('Signed library source URL: ' + item.id);
}
for (const file of reviewFiles) {
  if (file.local) throw Error('Review-only attachment has a public mirror: ' + file.downloadId);
  verifyFile(file.reviewPath, file, 'Private review');
  verifyFile(file.backupPath, file, 'Review backup');
}
for (const file of privateSourceFiles) {
  if (file.local || ownFiles.some(row => row.downloadId === file.downloadId)) throw Error('Private mixed source archive appeared in the public manifest: ' + file.downloadId);
  verifyFile(file.backupPath, file, 'Private mixed source backup');
}
for (const file of privateReviewMedia) {
  if (file.local || !path.resolve(file.reviewPath).startsWith(path.join(root, 'docs/discord-ps4-ps5-raw/review-images') + path.sep)) throw Error('Review image escaped its private evidence folder: ' + file.id);
  verifyFile(file.reviewPath, { ...file, downloadId: file.id }, 'Private review image');
}
for (const file of derivatives) {
  if (!file.sourceFiles.some(source => source.sha256 === file.derivedFromSha256)) throw Error('Derivative lacks its original source hash: ' + file.downloadId);
  verifyFile(path.join(root, file.local.slice(1)), file, 'Reviewed derivative');
}
verifyPublicValues(ownFiles);
console.log(JSON.stringify({
  scope: 'Explicit Discord import job IDs; other chats\' records are preserved and excluded from these counts.',
  uniqueReadyFiles: ready.length,
  mirroredReadyFiles: ready.filter(file => file.local?.startsWith('/downloads/')).length,
  backupOnlyReadyFiles: ready.filter(file => !file.local).length,
  uniqueOriginalImages: images.length,
  uniqueOriginalVideos: videos.length,
  sourceArchives: sourceArchives.length,
  privateMixedSourceArchives: privateSourceFiles.length,
  auxiliaryMetadataFiles: auxiliaryFiles.length,
  reviewedMediaDerivatives: derivatives.length,
  privateReviewArchives: reviewFiles.length,
  privateReviewImages: privateReviewMedia.length,
  readyBytes: ready.reduce((sum, file) => sum + file.bytes, 0),
  sourceArchiveBytes: sourceArchives.reduce((sum, file) => sum + file.bytes, 0),
  imageBytes: images.reduce((sum, file) => sum + file.bytes, 0),
  allLocalHashesVerified: true,
  allReadyBackupsVerified: true,
  publicManifestNoMachinePathsOrDiscordSigningQueries: true,
  currentUnavailableIds: [...new Set(ownFiles.filter(file => file.status !== 'downloaded' && !successful.some(entry => entry.downloadId === file.downloadId)).map(file => file.downloadId))],
  completedDownloadIds: ready.map(file => file.downloadId)
}, null, 2));
