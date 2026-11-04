function buildPs5LegacyGuides() {
  const {page, section, note, steps, ext, link, sourceList, ps5nav} = require('./build-console-guides.cjs');
  const source = 'https://github.com/idlesauce/umtx2';
  const implementation = source + '/blob/main/document/en/ps5/main.js';
  const host = 'https://umtx2.pages.dev/';
  const supported = [
    ['1.xx', '1.00, 1.01, 1.02, 1.05, 1.10, 1.11, 1.12, 1.13, 1.14'],
    ['2.xx', '2.00, 2.20, 2.25, 2.26, 2.30, 2.50, 2.70'],
    ['3.xx', '3.00, 3.10, 3.20, 3.21'],
    ['4.xx', '4.00, 4.02, 4.03, 4.50, 4.51'],
    ['5.xx', '5.00, 5.02, 5.10, 5.50']
  ];
  const versions = `<dl class="guide-firmware-list">${supported.map(([family, list]) => `<div><dt><strong>${family}</strong></dt><dd>${list}</dd></div>`).join('')}</dl>`;

  page('console/ps5/umtx2.html', 'PS5 UMTX2 Jailbreak · 1.00–5.50',
    'Use idlesauce’s UMTX2 browser route on its listed PS5 firmware versions, then check the payload menu and ELF loader.',
    '/assets/images/consoles/ps5-umtx2.jpg', ps5nav,
    section('compatibility', 'Check your exact firmware',
      note('<p><strong>UMTX2 browser support: listed versions from 1.00 to 5.50.</strong> Find your firmware under Settings → System → System Software → Console Information. Keep that version while checking the list below.</p><p>This page follows idlesauce’s UMTX2 build. The underlying UMTX vulnerability’s wider firmware range does not make this browser chain compatible with 6.00–7.61.</p>') +
      versions + sourceList([[implementation, 'Exact firmware allowlist in UMTX2']]) +
      `<div class="guide-links">${link('/console/ps5/jailbreaks.html', 'Choose a different firmware')}</div>`) +
    section('browser', 'Open the host in the PS5 browser',
      `<p>Open this address on the console:</p><p>${ext(host, host)}</p>` +
      `<p>Use your existing compatible browser entry or User’s Guide redirect. A browser shortcut package requires package-installation access first. The UMTX2 project also includes a self-host option; its inherited setup redirects <code>manuals.playstation.net</code> to the computer hosting the page, with that computer’s LAN address as DNS.</p>` +
      sourceList([
        [source, 'UMTX2 hosts and browser entry options'],
        ['https://github.com/PS5Dev/PS5-UMTX-Jailbreak#how-to-use', 'Project’s self-hosted User’s Guide setup']
      ]) +
      note('<p>There is no fixed public DNS address supplied by this UMTX2 guide. A User’s Guide DNS redirect alone does not establish Sony server blocking. An update-blocking host may also restrict PSN services; follow that host’s own instructions.</p><p>For normal online play, restore DNS Settings → Automatic or your usual DNS. This can allow update connections again. Using a jailbroken console on PSN risks a console ban, account ban, or both; changing DNS does not make it safe.</p>' + ext('https://www.playstation.com/en-gb/support/account/suspensions/', 'PlayStation account &amp; console suspensions'))) +
    section('walkthrough', 'Run UMTX2 · step by step', steps([
      ['Check the host’s firmware display', 'The page checks the console firmware against its allowlist. Stop if it reports an unsupported version.'],
      ['Choose Jailbreak', 'Use the normal Jailbreak button for initial kernel access. The Webkit-only (sender) option expects a loader that is already running; it does not start the kernel chain.'],
      ['Follow the on-screen progress', 'The host can reload and retry after an error. Wait for its payload screen and listening address before sending anything. An error or console restart does not confirm success.'],
      ['Check the loader result', 'The build attempts to start John Tornblom’s ELF loader on TCP port 9021 and also exposes its older port 9020 loader. Read the displayed IP address, ports and any loader errors.'],
      ['Choose one compatible payload', 'Use the payload menu or your matching sender. Check that the payload supports your exact firmware and the loader being used, then confirm its result before adding another.']
    ]) + sourceList([
      [implementation, 'Loader ports, sender mode and completion screen'],
      [source + '/blob/main/document/en/ps5/custom_host_stuff.js', 'Run button and retry behavior']
    ])) +
    section('after', 'After the loader is working',
      `<p>A successful browser exploit does not establish compatibility for every PS5 app or payload. Use each project’s firmware requirements when choosing homebrew. Y2JB installation is a later setup step that needs its own supported firmware and working homebrew access.</p>` +
      `<div class="guide-links">${link('/console/ps5/payloads.html', 'PS5 payloads')}${link('/console/ps5/apps.html', 'PS5 apps')}${link('/console/ps5/downloads.html', 'Console downloads')}${link('/console/ps5/y2jb.html', 'Y2JB setup')}</div>`) +
    section('sources', 'Project documentation & image', sourceList([
      [source, 'idlesauce UMTX2 · firmware range and included features'],
      [implementation, 'UMTX2 implementation · exact versions and loaders'],
      ['https://github.com/PS5Dev/PS5-UMTX-Jailbreak', 'Original UMTX chain · WebKit limit at firmware 6.00'],
      [host, 'Host preview image captured from the UMTX2 landing page']
    ])), '#compatibility', 'Check your firmware');
}

if (require.main === module) buildPs5LegacyGuides();
module.exports = {buildPs5LegacyGuides};
