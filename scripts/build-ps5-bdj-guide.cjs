const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function buildPs5BdjGuide() {
  const { page, section, note, ext, link, sourceList, esc, ps5nav } = require('./build-console-guides.cjs');
  const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps5-bdj-download-jobs.json'), 'utf8'));
  const compatibility = JSON.parse(fs.readFileSync(path.join(root, 'docs/ps5-jailbreak-firmware.json'), 'utf8')).routes.find(route => route.id === 'bdj');
  const manifestFile = path.join(root, 'downloads/ps4-ps5/manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : { files: [] };
  const archivedFile = id => manifest.files.findLast(file => file.downloadId === id && file.status === 'downloaded');
  const stagedFile = id => manifest.files.findLast(file => file.downloadId === id && file.status === 'downloaded' && file.local && fs.existsSync(path.join(root, file.local.slice(1))));
  const download = (id, label) => {
    const job = data.jobs.find(item => item.id === id);
    if (!job) throw Error('Unknown BD-J download: ' + id);
    const file = stagedFile(id);
    return file
      ? `<a href="${esc(file.local)}" data-original-href="${esc(job.url)}" download>${esc(label)} <i class="fas fa-download" aria-hidden="true"></i></a>`
      : ext(job.url, esc(label));
  };
  const iso = 'ps5-bdj-jar-loader-4-1-1';
  const umtx = 'ps5-bdj-umtx1-4-1-1';
  const processJailbreak = 'ps5-bdj-process-jailbreak-4-1-1';
  const imgburn = '<a href="/downloads/archive/27a6ea954663/SetupImgBurn_2.5.8.0.exe" data-original-href="https://www.imgburn.com/index.php?act=download" download>ImgBurn 2.5.8.0 <i class="fas fa-download" aria-hidden="true"></i></a>';
  const step = (title, text, links = '') => `<li><div class="guide-step-heading"><strong>${title}</strong>${links ? `<span class="guide-step-links">${links}</span>` : ''}</div>${text}</li>`;
  const files = data.jobs.map(job => {
    const file = archivedFile(job.id);
    const bytes = file?.bytes || job.expectedBytes;
    return `<li><strong>${esc(job.filename)}</strong> · ${esc(job.version)} · ${(bytes / 1048576).toFixed(2)} MiB${file?.sha256 ? `<br>SHA-256: <code>${esc(file.sha256)}</code>` : ''}</li>`;
  }).join('');
  const requirements = `<ul class="guide-source-list">
    <li>A PS5 with an enabled, working Blu-ray drive, on one of the exact versions below.</li>
    <li>A computer, a Blu-ray writer and blank BD-R or BD-RE media. Use a recordable Blu-ray disc for this entry point.</li>
    <li>The pinned v4.1.1 ISO and matching UMTX1 and process-jailbreak JARs.</li>
    <li>A computer with Java 11 available, on the same local network as the PS5, to send the JARs.</li>
  </ul>`;
  const walkthrough = '<ol class="guide-steps">' +
    step('Check your exact firmware and drive', 'On PS5 open Settings &gt; System &gt; System Software &gt; Console Information. Check the list below before preparing a disc. Keep the console on its existing firmware while checking compatibility.') +
    step('Get the matching JAR Loader files', 'Use the v4.1.1 trimmed ISO for the disc, plus the matching updated UMTX1 and process-jailbreak JARs. The release notes specifically require sending the updated UMTX through the Remote Loader; the Full ISO contains an older UMTX copy.', download(iso, 'JAR Loader ISO') + download(umtx, 'UMTX1 JAR') + download(processJailbreak, 'Process-jailbreak JAR')) +
    step('Burn the ISO to Blu-ray', 'In ImgBurn choose <strong>Write image file to disc</strong>, select <code>ps5-jar-loader-4.1.1.iso</code>, choose the Blu-ray writer and burn the image. Complete verification before removing the disc. The upstream instructions specify UDF 2.50 when creating a disc filesystem from source; the supplied ISO is already an image ready to burn.', imgburn) +
    step('Open the JAR Loader on PS5', 'Insert the disc, switch to <strong>Media</strong> and open <strong>Disc Player / PS5 JAR Loader</strong>. Wait for the remote loader to show that it is listening. Its default JAR port is <strong>9025</strong>. Use the PS5\'s local IP address from its connection status.') +
    step('Send the updated UMTX1 JAR', 'From the computer, use the upstream sender built into the matching JAR: <code>java -jar umtx1-1.0-SNAPSHOT.jar &lt;PS5_IP&gt;</code>. Replace <code>&lt;PS5_IP&gt;</code> with the console\'s local address. The sender uses port <strong>9025</strong> by default; append a port number only if your loader uses a different one. Wait for the console\'s completion messages before sending the next payload.', download(umtx, 'UMTX1 JAR')) +
    step('Apply the BD-J process jailbreak', 'After UMTX establishes kernel read/write, send <code>java -jar jailbreak-1.0-SNAPSHOT.jar &lt;PS5_IP&gt;</code>. This upstream payload gives the BD-J process root privileges and escapes its <code>/app0</code> filesystem jail. Keep the loader and JAR payloads from the same release.', download(processJailbreak, 'Process-jailbreak JAR')) +
    step('Check the next payload separately', 'This loader workflow establishes kernel read/write and a privileged BD-J process. Follow the specific ELF loader or homebrew-enabler project\'s supported firmware and entry-point instructions before proceeding. A successful JAR Loader run does not certify etaHEN or every app for all of these firmware versions.', link('/console/ps5/payloads.html', 'PS5 payload resources')) +
    '</ol>';
  page('console/ps5/bdj.html', 'PS5 BD-J & UMTX · 6.00–7.61',
    'Prepare a Blu-ray JAR Loader disc for the listed 6.xx and 7.xx firmware builds, send the matching UMTX payload and check the limits before choosing homebrew.',
    data.image.path, ps5nav,
    section('compatibility', 'Check the firmware and Blu-ray requirements',
      note('<p><strong>This is a disc-based JAR Loader and UMTX workflow.</strong> It covers the listed 6.xx–7.xx builds between the browser guide bands. It requires a working Blu-ray drive; digital-only consoles need a different compatible entry point.</p><p><strong>Supported versions in this guide:</strong> ' + compatibility.supportedVersions.map(version => `<code>${esc(version)}</code>`).join(', ') + '.</p>') + requirements +
      `<div class="guide-links">${link('/console/ps5/jailbreaks.html', 'Choose a different firmware')}${link('/console/ps5/relapse.html', '7.xx Relapse alternative')}</div>`) +
    section('disc', 'Blu-ray preparation & JAR Loader steps', walkthrough) +
    section('limits', 'What this method provides',
      note('<p><strong>Kernel read/write has firmware-specific limits.</strong> The upstream documentation warns that writing protected kernel-data regions on 6.00 and later can panic the console. Its kernel read/write capability is separate from support for a particular ELF loader, HEN or app.</p><p>The v4.1.1 release fixes 5.xx-and-later offsets and says to run its updated UMTX through the Remote Loader. Use those matching release files rather than assuming an older disc menu or another project\'s payload is interchangeable.</p>') +
      `<p>On the listed 7.xx versions, the <a href="/console/ps5/relapse.html">Relapse browser page</a> is also available. For 6.xx, this page documents the Blu-ray path. Y2JB has different app and installation prerequisites.</p>`) +
    section('files', 'Pinned files · JAR Loader v4.1.1',
      `<div class="guide-links">${download(iso, 'Download JAR Loader ISO')}${download(umtx, 'Download UMTX1 JAR')}${download(processJailbreak, 'Download process-jailbreak JAR')}${ext(data.release, 'Official v4.1.1 release')}</div>` +
      `<ul class="guide-source-list">${files}</ul>` +
      `<figure class="guide-video"><img src="${data.image.path}" alt="Official PS5 JAR Loader Blu-ray menu artwork" width="640" height="360" loading="lazy"><figcaption>${ext(data.image.source, 'Official PS5 JAR Loader disc artwork · v4.1.1')}</figcaption></figure>`) +
    section('sources', 'Project instructions & compatibility evidence', sourceList([
      ['https://github.com/hammer-83/ps5-jar-loader/blob/v4.1.1/README.md', 'PS5 JAR Loader instructions · pinned v4.1.1'],
      ['https://github.com/hammer-83/ps5-jar-loader/blob/v4.1.1/sdk/src/main/java/org/ps5jb/sdk/core/kernel/KernelOffsets.java', 'Exact supported firmware offsets'],
      ['https://github.com/hammer-83/ps5-jar-loader/blob/v4.1.1/xploit/jar/src/main/java/org/ps5jb/client/JarMain.java', 'JAR sender command arguments and default port 9025'],
      [data.release, 'v4.1.1 fixes, matching payloads and Remote Loader requirement'],
      ['https://github.com/hammer-83/ps5-jar-loader/releases/tag/v4.1.0', 'UMTX1 and BD-J process-jailbreak payload descriptions']
    ])), '#compatibility', 'Check requirements');
}

if (require.main === module) buildPs5BdjGuide();
module.exports = { buildPs5BdjGuide };
