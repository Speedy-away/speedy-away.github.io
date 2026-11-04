'use strict';
function integrateWebhostLink(html){
  const links=html.replace(/\s*<li\b[^>]*data-webhost-navigation[^>]*>[\s\S]*?<\/li>/g,'');
  return links.replace(/(<li\b[^>]*>\s*<a\b[^>]*\bdata-tooltip="Language"[\s\S]*?<\/li>)/,'$1\n<li data-webhost-navigation><a href="/hosts/" class="nav-link" data-tooltip="PS4 / PS5 webhost"><i class="fas fa-gamepad" aria-hidden="true"></i><span>PS4 / PS5 webhost</span></a></li>');
}
module.exports={integrateWebhostLink};
