// Rebuild only the Wii U library and themes; preserve all other console pages.
const {buildWiiUHomebrew} = require('./build-wiiu-homebrew.cjs');
function buildWiiUMore() {
  const {buildWiiUThemes} = require('./build-wiiu-themes.cjs');
  const apps = buildWiiUHomebrew();
  const themes = buildWiiUThemes();
  const guides=require('./build-wiiu-online-mods.cjs').buildWiiUOnlineMods();
  const hubs=require('./build-console-topic-hubs.cjs');
  const generated=hubs.buildPlatform(hubs.platforms().find(p=>p.id==='wiiu'));
  for(const file of generated){const target=require('node:path').join(__dirname,'..',file); const fs=require('node:fs');fs.writeFileSync(target,require('./apply-site-background.cjs').improve(fs.readFileSync(target,'utf8'),file));}
  const batch=require('./build-wiiu-games-batch2.cjs').buildWiiUGamesBatch2();
  return {apps, themes, guides,batch};
}
if (require.main === module) console.log(JSON.stringify(buildWiiUMore()));
module.exports = {buildWiiUMore};
