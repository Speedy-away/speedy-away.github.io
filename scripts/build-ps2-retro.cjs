const fs = require('node:fs');
const path = require('node:path');
const { page, section, grid, resource, note, steps, ext, link, sourceList, esc } = require('./build-console-guides.cjs');
const root = path.resolve(__dirname, '..');
const nav = [
  ['/console/retro/', 'Retro Consoles'],
  ['/console/retro/ps2.html', 'PS2'],
  ['/console/retro/wii.html', 'Wii'],
  ['/console/retro/gamecube.html', 'GameCube'],
  ['/console/retro/ds.html', 'DS & DSi'],
  ['/console/retro/3ds.html', '2DS & 3DS']
];

function buildPs2Retro() {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/expansion-ps2.json'), 'utf8'));
  const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/expansion-ps2-jobs.json'), 'utf8')).jobs;
  const byJob = Object.fromEntries(jobs.map(job => [job.id, job]));
  const card = tool => resource(tool.title, esc(tool.description),
    ext(byJob[tool.job].url, `Download · ${tool.version}`) + ext(tool.project, 'Project & releases') + ext(tool.guide, tool.guideLabel), tool.image
  ).replace('<article ', `<article id="${tool.id}" `)
    .replace('data-search="', `data-search="${esc(tool.tags.join(' ').toLowerCase())} `)
    .replace(`alt="${esc(tool.title)} artwork"`, `alt="${esc(tool.imageAlt)}"`)
    .replace('</h3>', `</h3><div class="game-features" aria-label="Tool tags">${tool.tags.map(tag => `<span class="feature">${esc(tag)}</span>`).join('')}</div>`);
  const cards = group => grid(...catalog.tools.filter(tool => tool.group === group).map(card));
  page('console/retro/ps2.html', 'PlayStation 2 Homebrew & Softmod',
    'PS2 homebrew setup, FreeMcBoot and OpenTuna, Open PS2 Loader, wLaunchELF, Apollo saves and PS2Ident with artwork and build downloads.',
    '/assets/images/expansion-ps2/fmcb.png', nav,
    section('start', 'Start with your PS2 model',
      note('<p>PS2 homebrew usually starts through a memory-card softmod or another ELF boot method. Choose a route for the console’s model and boot ROM before installing applications.</p>') +
      steps([
        ['Check the model and boot method', 'Read the SCPH model on the console. On a system that already launches homebrew, use wLaunchELF or PS2Ident to check the boot ROM. Late SCPH-900xx systems with ROM 2.30 or newer and PS2 TV cannot autoboot FreeMcBoot.'],
        ['Prepare a homebrew entry point', 'Use an already prepared, compatible memory card or an existing ELF launcher to start the installer. Copying an installer file onto an ordinary USB drive does not itself make an unmodified PS2 boot homebrew.'],
        ['Back up the memory card', 'Keep a separate copy of your saves and existing setup before installing. OpenTuna’s installer removes APPS, FORTUNA and OPENTUNA folders from the selected card.'],
        ['Choose FMCB or OpenTuna', 'Use FreeMcBoot for a compatible automatic memory-card boot menu. For a supported later Slim or another OpenTuna-compatible model, follow the OpenTuna installer documentation and its browser trigger.'],
        ['Add your apps', 'Extract downloaded archives on your computer and transfer their ELF files and required data folders. Launch apps through your prepared menu or wLaunchELF; keep each app’s accompanying files together.']
      ]) + `<div class="guide-links">${ext('https://israpps.github.io/FreeMcBoot-Installer/test/6_FAQ.html', 'FMCB compatibility FAQ')}${ext('https://github.com/ps2homebrew/opentuna-installer#readme', 'OpenTuna installer instructions')}${link('#apps', 'Browse PS2 apps')}</div>`,
      'Memory-card boot tools, file managers, loaders and save utilities for real PlayStation 2 hardware.') +
    section('setup', 'Memory-card softmods & boot tools', cards('setup')) +
    section('apps', 'PS2 apps & homebrew tools', cards('apps'),
      'Choose the console build and read its requirements before copying files to your storage.') +
    section('storage', 'Choose storage for your setup', grid(
      resource('USB & app folders', 'Use storage supported by the app you are launching. Extract archives first; an ELF launcher starts the executable, while some apps also need their data folders in the documented location.', ext('https://github.com/ps2homebrew/Open-PS2-Loader#readme', 'OPL app & storage notes'), '/assets/images/expansion-ps2/opl.png'),
      resource('Saves & virtual memory cards', 'Back up original physical-card saves before importing or applying patches. Apollo supports physical memory cards and supported VMC images; follow its documented save-format rules.', link('#apollo', 'Get Apollo for PS2') + ext('https://github.com/bucanero/apollo-ps2#save-management', 'Apollo save documentation'), '/assets/images/expansion-ps2/apollo.png')
    )) +
    section('sources', 'Project documentation', sourceList(catalog.sources.map(source => [source.url, source.supports])) +
      '<p class="guide-firmware-note">Images use project logos, official app artwork and example interface screenshots. PS2Ident background artwork credits: pikiuperstar / Freepik, as included by the project.</p>'),
    '#start', 'Choose a boot method');
  return { pages: ['console/retro/ps2.html'], tools: catalog.tools.length, downloads: jobs.length };
}

if (require.main === module) console.log(JSON.stringify(buildPs2Retro()));
module.exports = { buildPs2Retro };
