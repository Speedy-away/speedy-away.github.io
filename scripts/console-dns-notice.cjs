const notice = () => `<aside class="guide-note" id="dns-online-note"><p><strong>Sony / PlayStation server blocking:</strong> These DNS servers are intended to block PlayStation update servers and can also restrict PSN sign-in and other Sony services. DNS blocking is not a guarantee that every Sony server is blocked.</p><p><strong>For normal online play:</strong> Do not use these blocking DNS settings. Set <strong>DNS Settings → Automatic</strong>, or restore your usual DNS. This can also allow update connections again.</p><p><strong>Jailbreak online risk:</strong> Using a jailbroken console on PlayStation Network risks a <strong>console ban, account ban, or both</strong>. Changing DNS does not make online jailbreak use safe or bypass PSN’s software and account requirements.</p><div class="guide-links"><a href="https://www.playstation.com/en-gb/support/account/suspensions/" target="_blank" rel="noopener noreferrer">PlayStation account &amp; console suspensions <i class="fas fa-external-link-alt" aria-hidden="true"></i></a></div></aside>`;

function applyDnsNotice(html) {
  if (html.includes('id="dns-online-note"')) return html;
  const start = html.indexOf('id="dns"');
  const values = html.indexOf('</dl>', start);
  if (start < 0 || values < 0) throw Error('Missing manual DNS section');
  return html.slice(0, values + 5) + notice() + html.slice(values + 5);
}

module.exports = {notice, applyDnsNotice};
