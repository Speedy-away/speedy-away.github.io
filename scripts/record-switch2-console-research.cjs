// Records why this scope has no ready-use software intake. No F: writes,
// source archive downloads or global inventory merge occur here.
const { createArchive } = require('./console-expansion-archive.cjs');
const catalogue = require('../docs/switch2-console-catalogue.json');
async function main() {
  const archive = createArchive();
  const inventory = await archive.appendInventory({
    scope: 'switch2-console',
    items: [{
      id: 'switch2-console-ns2jb-research',
      title: 'ns2jb · native Switch 2 FS research demo',
      platform: 'Nintendo Switch 2',
      category: ['Research'],
      pages: ['console/nintendo-switch-2.html'],
      url: catalogue.sources.ns2jbProject.url,
      status: 'source-only-no-published-release-asset',
      checkedOn: catalogue.checkedOn,
      commit: catalogue.researchCommit,
      compatibility: 'README specifies Switch 2, SmileBASIC 4.4.9 and system software 23.0.1; no revision matrix. Host Node.js 22+ on macOS/Linux.',
      files: [],
      attempts: [
        { url: catalogue.sources.ns2jbReleases.url, status: 'HTTP 200; empty releases array', checkedOn: catalogue.checkedOn },
        { url: catalogue.sources.ns2jbTags.url, status: 'HTTP 200; empty tags array', checkedOn: catalogue.checkedOn },
        { url: catalogue.sources.ns2jbReadme.url, status: 'HTTP 200; pinned original prerequisites verified', checkedOn: catalogue.checkedOn }
      ],
      note: 'Repository contains source plus a bundled helper, but no explicit release asset; whole source snapshot was not requested and was not downloaded. No ready console build is advertised.'
    }, {
      id: 'switch2-console-official-system-update',
      title: 'Nintendo Switch 2 system software',
      platform: 'Nintendo Switch 2',
      category: ['Firmware'],
      pages: ['console/nintendo-switch-2.html'],
      url: catalogue.sources.updates.url,
      status: 'official-on-console-delivery',
      version: catalogue.firmware.version,
      checkedOn: catalogue.checkedOn,
      files: [],
      note: 'Nintendo instructs users to update through System Settings. No standalone official PC firmware asset was identified or mirrored.'
    }],
    publicFiles: []
  });
  console.log(inventory);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
