const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
function build() {
  const gta = JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-gta-source-evidence.json'),'utf8'));
  const cod = JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-cod-uncharted-source-evidence.json'),'utf8'));
  const apps = JSON.parse(fs.readFileSync(path.join(root,'docs/ps3-apps-source-evidence.json'),'utf8'));
  const evidenceFiles=['ps3-third-source-evidence.json','ps3-fourth-cod-source-evidence.json','ps3-fourth-gta-source-evidence.json','ps3-fourth-tools-source-evidence.json','ps3-fifth-source-evidence.json'];
  const additions=evidenceFiles.map(file=>path.join(root,'docs',file)).filter(file=>fs.existsSync(file)).map(file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')));
  const additional=Object.fromEntries(['games','resources','sources','apps'].map(key=>[key,additions.flatMap(evidence=>evidence[key]||[])]));
  const gameIds=new Set();
  for(const game of additional.games||[]){
    if(!/^[a-z0-9-]+$/.test(game.id)||gameIds.has(game.id)||!/^\/console\/ps3\/mods\/(?:call-of-duty\/)?[a-z0-9-]+\/$/.test(game.url)||!game.title||!game.short||!Array.isArray(game.aliases))throw Error('Invalid additional PS3 game definition');
    gameIds.add(game.id);
  }
  const appIds=new Set();
  for(const app of additional.apps||[]){
    if(!/^[a-z0-9-]+$/.test(app.id)||appIds.has(app.id)||!app.name||!app.version||!app.compatibility||!Array.isArray(app.downloads))throw Error('Invalid additional PS3 app definition');
    appIds.add(app.id);
  }
  const resources = [...gta.resources,...cod.resources,...(additional.resources||[]),...cod.dlcResources.map(item=>({...item,id:item.gameId+'-dlc-regions',category:'dlc-reference',version:'Region reference',gameUpdate:'Match the licensed add-on and game release',compatibility:'Listed regions: '+item.regions.join(', '),region:item.regions.join(', '),description:item.description+' Packs listed: '+item.packs.join(', ')+'.',image:item.gameId==='black-ops-1'?'/assets/images/covers/cod-black-ops-1.jpg':'/assets/images/covers/cod-black-ops-2.jpg'}))];
  for(const update of additions.flatMap(evidence=>evidence.resourceUpdates||[])){
    const item=resources.find(resource=>resource.id===update.id);
    if(!item)throw Error('Unknown PS3 resource update: '+update.id);
    const downloads=[...new Map([...(item.downloads||[]),...(update.downloads||[])].map(download=>[download.url,download])).values()];
    Object.assign(item,update,{downloads});
  }
  const ids = new Set();
  for (const item of resources) {
    if (!/^[a-z0-9-]+$/.test(item.id) || ids.has(item.id)) throw Error('Duplicate or invalid PS3 resource ID: '+item.id);
    ids.add(item.id);
    if(item.id==='uncharted-series-dev-installer' && apps.unchartedArchiveEvidence) {
      const evidence = apps.unchartedArchiveEvidence;
      item.region = Object.entries(evidence.supportedTitleIds).map(([title,ids])=>title+': '+ids.join(', ')).join('; ');
      item.note = 'The archived Supported Versions.txt lists these title IDs. Game updates are not stated; keep the separate per-game developer references distinct.';
      item.archiveEvidence = evidence;
    }
    const referenceRegions = {'uncharted-1-debug-reference':'BCES00065','uncharted-2-debug-reference':'BCES00757','uncharted-3-debug-reference':'BCES01175'};
    if(referenceRegions[item.id]) item.region=referenceRegions[item.id];
    if (item.status === 'source-marks-down') item.availability = 'Unavailable · source marks this link down';
    if (!item.region) item.region = [...new Set((item.compatibility || '').match(/\b(?:BLES|BLUS|NPEB|NPUB|BCES\d+)\b/g) || [])].join(' / ') || 'Not specified by source';
    item.tags = [...new Set([...(item.tags||[]),item.category==='rtm'?'Windows helper':null].filter(Boolean))];
  }
  const output = {schemaVersion:1,reviewed:'2026-11-02',scope:'PS3 game mod catalogues; source claims are distinct from archive availability and hardware testing.',games:additional.games||[],apps:additional.apps||[],sources:[...gta.sources,...cod.sources,...(additional.sources||[])],resources};
  fs.writeFileSync(path.join(root,'docs/ps3-mod-resources.json'),JSON.stringify(output,null,2)+'\n');
  console.log(`Prepared ${resources.length} PS3 mod and compatibility records.`);
}
module.exports={build};
if(require.main===module)build();
