const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function buildPs4Goldhen() {
  const {page, section, grid, resource, note, steps, ext, link, sourceList, esc} = require('./build-console-guides.cjs');
  const iso = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps4-goldhen14.json'), 'utf8'));
  const artwork = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-software-images.json'), 'utf8')).goldhen.image;
  const official = 'https://github.com/GoldHEN/GoldHEN';
  const officialRelease = official + '/releases/tag/2.3';
  const currentRelease = 'https://ko-fi.com/s/e694c36022';
  const nav = [
    ['/console/ps4/', 'PS4 Hub'],
    ['/console/ps4/jailbreaks.html', 'Jailbreak'],
    ['/console/ps4/goldhen.html', 'GoldHEN'],
    ['/console/ps4/downloads.html', 'Console Downloads'],
    ['/console/ps4/payloads.html', 'Payloads'],
    ['/console/ps4/apps.html', 'Apps'],
    ['/console/ps4/emulators.html', 'PS4 Emulators'],
    ['/console/mods/ps4/', 'Game Mods']
  ];
  const officialDownload = '<a href="/downloads/archive/f07434d99146/GoldHEN_v2.3.7z" data-original-href="https://github.com/GoldHEN/GoldHEN/releases" download>Download archived GoldHEN 2.3 <i class="fas fa-download" aria-hidden="true"></i></a>';
  const isoDownload = `<a href="${esc(iso.file.local)}" data-original-href="${esc(iso.jobs[0].url)}" download>Download GOLDHEN14.iso · ${(iso.file.bytes / 1048576).toFixed(1)} MiB <i class="fas fa-download" aria-hidden="true"></i></a>`;

  page('console/ps4/goldhen.html', 'GoldHEN & PS4 HEN Downloads',
    'GoldHEN v2.4b18.13 from SiSTRo, adding PS4 14.00 support, plus archived GoldHEN 2.3 and the separately supplied HEN ISO.',
    artwork, nav,
    section('downloads', 'Choose the correct HEN resource',
      note('<p><strong>Match the firmware, exploit and payload separately.</strong> GoldHEN is a PS4 homebrew enabler loaded through a compatible jailbreak. SiSTRo’s v2.4b18.13 beta adds PS4 14.00 support. The separately supplied GOLDHEN14.iso has not been verified as an official GoldHEN release.</p>') + grid(
        resource('GoldHEN v2.4b18.13 · SiSTRo',
          'Official beta release adding PS4 firmware 14.00 support and fixing an FTP SIZE issue. Get the release from SiSTRo’s Ko-fi page and follow its instructions for your firmware and exploit.',
          ext(currentRelease, 'Get GoldHEN v2.4b18.13') + ext(official, 'Official project'), artwork)
          .replace('<article ', '<article id="current-goldhen" '),
        resource('GoldHEN · official project',
          'The existing archived download is GoldHEN 2.3. Extract the archive and use only the payload for firmware supported by that release and your exploit. The official project documents homebrew, debugging, package installation, FTP and other release-specific features.',
          officialDownload + ext(officialRelease, '2.3 release notes') + ext(official, 'Official project'), artwork)
          .replace('<article ', '<article id="official-goldhen" '),
        resource('14.00 HEN ISO · supplied file',
          'The user-supplied GOLDHEN14.iso is kept here for the experimental PS4 14.00 disc workflow. Publisher identity and firmware compatibility have not been independently verified. It is a Blu-ray image, separate from the official GoldHEN archive.',
          isoDownload + link('/console/ps4/jailbreak.html#disc', 'Open 14.00 disc guide'),
          '/assets/images/consoles/ps4-jailbreak.jpg')
          .replace('<article ', '<article id="supplied-14-iso" ')
      ), 'GoldHEN downloads now have a dedicated page. Choose a jailbreak route before selecting a compatible HEN build.') +
    section('use', 'Loading HEN and installing apps', steps([
      ['Choose your jailbreak route', 'Open the Jailbreak page and select the firmware route matching the version already installed on your console. Use that route’s requirements and instructions.'],
      ['Match the enabler build', 'Read the release notes for the exact GoldHEN or HEN file you plan to use. Do not substitute an arbitrary payload into a different firmware route.'],
      ['Load the payload or follow the disc workflow', 'A GoldHEN payload is loaded by the compatible exploit or payload loader. The supplied ISO uses its separate Blu-ray procedure; saving or downloading either file does not itself enable homebrew.'],
      ['Install or manage homebrew afterwards', 'After the enabler reports success, use the console’s supported package installer, homebrew store or file manager. File saving, package installation and payload execution are separate actions.']
    ]) + `<div class="guide-links">${link('/console/ps4/jailbreaks.html', 'Browse jailbreak firmware')}${link('/console/ps4/downloads.html', 'Download on PS4')}${link('/console/ps4/apps.html', 'Browse PS4 apps')}${link('/console/ps4/payloads.html', 'Other PS4 payloads')}</div>`) +
    section('iso-checksum', 'Supplied ISO file details',
      `<p>Filename: <code>${esc(iso.file.name)}</code> · ${(iso.file.bytes / 1048576).toFixed(1)} MiB.</p><p>A matching checksum confirms that a copy matches the archived file. It does not verify its publisher or firmware support.</p><pre class="guide-code"><code>SHA-256: ${esc(iso.file.sha256)}</code></pre>`) +
    section('sources', 'GoldHEN documentation', sourceList([
      [currentRelease, 'SiSTRo’s GoldHEN v2.4b18.13 beta and changelog'],
      [official, 'Official GoldHEN project and documented features'],
      [officialRelease, 'Pinned GoldHEN 2.3 release notes'],
      ['https://github.com/GoldHEN/GoldHEN_Plugins_Repository', 'Official GoldHEN plugin documentation']
    ])), '#downloads', 'Choose a HEN resource');
  return {page: 'console/ps4/goldhen.html', officialVersion: '2.4b18.13', currentRelease, archivedVersion: '2.3', suppliedISO: iso.file.local};
}

if (require.main === module) console.log(JSON.stringify(buildPs4Goldhen()));
module.exports = {buildPs4Goldhen};
