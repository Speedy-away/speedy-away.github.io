// Curated metadata from the checked official release evidence. No builds run.
const fs=require('node:fs');
const evidence=JSON.parse(fs.readFileSync('docs/switch-game-mods-research.json','utf8'));
const jobs=[];
function asset(id,repo,name,game,extra={}){
 const release=evidence.repositories.find(row=>row.repo===repo&&(!extra.tag||row.tag===extra.tag));
 const file=release?.assets?.find(row=>row.name===name);if(!file)throw Error('Missing verified release '+id);
 const job={id,title:extra.title||id,game,version:release.tag,project:'https://github.com/'+repo,releaseUrl:release.url,url:file.url,name,bytes:file.size,sha256:file.digest?.replace(/^sha256:/,''),format:name.endsWith('.nro')?'nro':'zip',...extra};delete job.tag;jobs.push(job);return id;
}
asset('arcropolis','Raytwo/ARCropolis','release.zip','Super Smash Bros. Ultimate',{title:'ARCropolis',installPath:'sd:/atmosphere/contents/01006A800016E000/romfs/skyline/plugins/libarcropolis.nro'});
asset('skyline','skyline-dev/skyline','skyline.zip','Super Smash Bros. Ultimate',{title:'Skyline runtime',installPath:'sd:/atmosphere/contents/01006A800016E000/exefs/'});
asset('training','jugeeya/UltimateTrainingModpack','TrainingModpack.zip','Super Smash Bros. Ultimate',{title:'Ultimate Training Modpack',installPath:'sd:/atmosphere/contents/01006A800016E000/romfs/skyline/plugins/'});
asset('playable-bosses','NemesisSSBU/Playable_Bosses','Competitive_Playable_Bosses_3.1.6.zip','Super Smash Bros. Ultimate',{title:'Competitive Playable Bosses',gameVersion:'13.0.2 / 13.0.3 / 13.0.4 / 13.0.5',installPath:'sd:/ultimate/mods/Bosses/'});
asset('smashline-168','HDR-Development/smashline','libsmashline_plugin.nro','Super Smash Bros. Ultimate',{tag:'v1.6.8',title:'Smashline 1.6.8 compatibility build',installPath:'sd:/atmosphere/contents/01006A800016E000/romfs/skyline/plugins/libsmashline_plugin.nro'});
asset('smashline-200','HDR-Development/smashline','libsmashline_plugin.nro','Super Smash Bros. Ultimate',{tag:'v2.0.0',title:'Smashline 2.0.0',installPath:'sd:/atmosphere/contents/01006A800016E000/romfs/skyline/plugins/libsmashline_plugin.nro'});
asset('nro-hook','ultimate-research/nro-hook-plugin','libnro_hook.nro','Super Smash Bros. Ultimate',{title:'NRO Hook',installPath:'sd:/atmosphere/contents/01006A800016E000/romfs/skyline/plugins/libnro_hook.nro'});
asset('hdr-launcher','techyCoder81/hdr-launcher-react','hdr-launcher.nro','Super Smash Bros. Ultimate',{title:'HDR Launcher Switch plugin',installPath:'sd:/atmosphere/contents/01006A800016E000/romfs/skyline/plugins/hdr-launcher.nro'});
asset('hdr-package','HDR-Development/HDR-Releases','switch-package.zip','Super Smash Bros. Ultimate',{title:'HewDraw Remix full Switch package',large:true,privateOnly:true,installPath:'SD root; keep atmosphere/ and ultimate/ together'});
asset('smoo-plus','DaDev123/SMOO-Plus','SMOO-Plus-Speedrun-Switch.zip','Super Mario Odyssey',{title:'SMOO+ Speedrun Release',gameVersion:'1.0.0',installPath:'sd:/atmosphere/contents/0100000000010000/'});
for(const [version,segment]of [['3.0.5','Atmosphere'],['4.0.0','Atmosphere-4.0.0']]){
 const entry=evidence.nextendoTree.tree.find(row=>row.type==='blob'&&row.path.startsWith('Consoles/'+segment+'/GB/'));
 const job={id:'mk8-country-gb-'+version.replaceAll('.',''),title:'Nextendo GB country patch '+version,game:'Mario Kart 8 Deluxe',gameVersion:version,version:'snapshot-'+evidence.nextendoTree.sha.slice(0,12),project:'https://github.com/alyeri/nextendo-mk8d-country-flags',url:'https://raw.githubusercontent.com/alyeri/nextendo-mk8d-country-flags/'+evidence.nextendoTree.sha+'/'+entry.path.split('/').map(encodeURIComponent).join('/'),name:entry.path.split('/').pop(),bytes:entry.size,format:'ips',buildId:entry.path.split('/').pop().replace('.ips',''),installPath:'sd:/'+entry.path.slice(entry.path.indexOf('atmosphere/'))};jobs.push(job);
}
jobs.push({id:'ctgp-deluxe',title:'CTGP Deluxe',game:'Mario Kart 8 Deluxe',gameVersion:'3.0.3 only',version:'1.1.1',project:'https://www.ctgpdx.com/',releaseUrl:'https://www.ctgpdx.com/download',url:'https://drive.google.com/file/d/1ZI7vtjWWDpxB83WZhK5gbdr1kciom_ZS/view?usp=sharing',driveId:'1ZI7vtjWWDpxB83WZhK5gbdr1kciom_ZS',name:'CTGPDX-v1.1.1.zip',format:'zip',large:true,privateOnly:true,maxBytes:5*1024**3,installPath:'SD root; preserve supplied atmosphere/ and companion folders'});
fs.writeFileSync('docs/switch-game-mods-jobs.json',JSON.stringify({schemaVersion:1,verifiedAt:new Date().toISOString(),jobs},null,2)+'\n');
console.log('Prepared '+jobs.length+' verified Switch mod jobs');
