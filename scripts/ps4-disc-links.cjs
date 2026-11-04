const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const external = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} <i class="fas fa-external-link-alt" aria-hidden="true"></i></a>`;

function linksFor(title) {
  if (title === 'Get the supplied HEN ISO') {
    const iso = require('../docs/ps4-goldhen14.json');
    return `<a href="${esc(iso.file.local)}" data-original-href="${esc(iso.jobs[0].url)}" download>Download GOLDHEN14.iso <i class="fas fa-download" aria-hidden="true"></i></a>` +
      external('https://gofile.io/d/kg4BSziZ', 'Supplied HEN ISO');
  }
  if (title === 'Burn the image to Blu-ray') {
    return '<a href="/downloads/archive/27a6ea954663/SetupImgBurn_2.5.8.0.exe" data-original-href="https://www.imgburn.com/index.php?act=download" download>ImgBurn downloads <i class="fas fa-download" aria-hidden="true"></i></a>';
  }
  if (title === 'Start the disc on PS4') return external('https://github.com/OptiTronOffical/PS4-14.00-BD-JB', '14.00 disc workflow reference');
  return '';
}

function inlineTitle(title, linkHTML = linksFor(title)) {
  return linkHTML ? `<div class="guide-step-heading"><strong>${esc(title)}</strong><span class="guide-step-links">${linkHTML}</span></div>` : `<strong>${esc(title)}</strong>`;
}

function discSteps(items) {
  return `<ol class="guide-steps">${items.map(([title, text]) => `<li>${inlineTitle(title)}${text}</li>`).join('')}</ol>`;
}

function applyDiscLinks(html) {
  return html.replace(/<section\b(?=[^>]*\bid="disc")[^>]*>[\s\S]*?<\/section>/, section => {
    if (section.includes('class="guide-step-heading"')) return section;
    return section.replace(/<strong>(Get the supplied HEN ISO|Burn the image to Blu-ray|Start the disc on PS4)<\/strong>/g, (_, title) => inlineTitle(title))
      .replace('Download the archive below and extract it if needed.', 'Download the ISO using the links here. If the supplied file is an archive, extract it first.');
  });
}

module.exports = {applyDiscLinks, inlineTitle, discSteps};
