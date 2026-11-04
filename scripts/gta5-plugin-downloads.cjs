const fs=require('node:fs'),path=require('node:path');
const {esc}=require('./build-console-guides.cjs');
const root=path.resolve(__dirname,'..');
function createPluginDownloads(){
 const file=path.join(root,'downloads/ps4/GTA5/plugin-configs/manifest.json');
 const catalog=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{downloads:[]};
 function choices(item,downloads,legacy){
  if(!item?.gameIds?.includes('gta5'))return [];
  const ids=new Set((downloads||item.downloads||[]).map(f=>f.id));
  return catalog.downloads.filter(f=>f.resourceId===item.id&&(legacy?(f.sha256===legacy.sha256||f.url===legacy.local||f.aliases.includes(legacy.local)):ids.has(f.downloadId))).flatMap(f=>f.variants.map(v=>({
   ...v,key:f.downloadId+'-'+v.key,label:(f.variants.length>1?f.label.replace(/ · GTA V 1\.\d{2}(?: \/ 1\.\d{2})*/g,''):f.label)+(v.gameVersion&&(f.variants.length>1||!f.label.includes(v.gameVersion))?' · GTA V '+v.gameVersion:''),source:{url:f.url,name:f.name,bytes:f.bytes,sha256:f.sha256,kind:f.kind}
  })));
 }
 function render(item,downloads,legacy){
  const rows=choices(item,downloads,legacy);if(!rows.length)return '';
  // Keep the default aligned with a compatibility-specific legacy section.
  if(/^\d{3}$/.test(legacy?.group||'')){const update='1.'+legacy.group.slice(1);rows.sort((a,b)=>Number(b.gameVersion===update)-Number(a.gameVersion===update));}
  const row=rows[0],config=row.configs.CUSA00419;
  return `<fieldset class="gta-plugin-download" data-gta-plugin-download data-plugin-choices="${esc(JSON.stringify(rows))}"><legend>Menu + plugins.ini</legend>${rows.length>1?`<label>Game update / package<select data-plugin-build>${rows.map((r,i)=>`<option value="${i}">${esc(r.label)}</option>`).join('')}</select></label>`:`<p class="gta-plugin-build-label">${esc(row.label)}</p>`}<label>Game region<select data-plugin-region><option value="CUSA00411">Europe / EU · CUSA00411</option><option value="CUSA00419" selected>USA · CUSA00419</option></select></label><p class="gta-plugin-region-note" data-plugin-region-note>${config.sourceExample?'Source includes this title-ID example.':'Configuration template: regional menu compatibility is unconfirmed.'}</p><code data-plugin-module>${esc((config.modules||[config.module]).join(' + '))}</code><button type="button" class="btn btn-primary" data-plugin-bundle disabled><i class="fas fa-download" aria-hidden="true"></i> Download menu + plugins.ini</button><div class="gta-plugin-separate"><a href="${esc(config.url)}" download="plugins.ini" data-plugin-ini data-no-file-options>plugins.ini only</a><a href="${esc(row.source.url)}" download data-plugin-original data-no-file-options>Original menu file</a></div><p data-plugin-status role="status" aria-live="polite"></p><noscript><p>JavaScript is required for the combined ZIP. These original files and regional configurations can be saved separately:</p><ul>${rows.map(r=>`<li>${esc(r.label)}: <a href="${esc(r.source.url)}" download data-no-file-options>Original menu</a> · <a href="${esc(r.configs.CUSA00411.url)}" download="plugins.ini" data-no-file-options>EU plugins.ini</a> · <a href="${esc(r.configs.CUSA00419.url)}" download="plugins.ini" data-no-file-options>USA plugins.ini</a></li>`).join('')}</ul></noscript></fieldset>`;
 }
 return {render,choices,has:id=>catalog.downloads.some(x=>x.downloadId===id)};
}
module.exports={createPluginDownloads};
