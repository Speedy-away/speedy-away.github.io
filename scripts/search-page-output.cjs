// Final browser-page pass shared by generators. Never alters packaged HTML tools.
const {eligible} = require('./site-public-pages.cjs');
const tags = require('./page-search-tags.cjs');
function finish(file, html) {
  const metadata = require('./page-search-metadata.cjs');
  const relative = metadata.normalizedFile(file);
  if (!eligible(relative) || tags.protectedFile(relative, html)) return html;
  const navigable = require('./console-game-directories.cjs').apply(relative, html);
  const themed = require('./add-themes-sidebar.cjs').applyThemes(navigable, relative);
  const illustrated = require('./category-card-art.cjs').apply(relative, themed);
  const searchable = tags.apply(relative, require('./host-page-shell.cjs').apply(relative,illustrated));
  return metadata.transform(relative, searchable).html;
}
module.exports = {finish};
