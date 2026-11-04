'use strict';
// Templates only: no plugins are enabled, downloaded or installed by this module.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),base='/downloads/hosts/ps4/plugin-templates/20261104';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const cod=['Ghosts','Advanced Warfare','Black Ops III','Infinite Warfare','Modern Warfare Remastered','WWII','Black Ops 4','Modern Warfare (2019)','Modern Warfare 2 Campaign Remastered','Black Ops Cold War','Vanguard','Modern Warfare II','Modern Warfare III','Black Ops 6'];
const games=[{id:'gta5',name:'GTA V',ids:['CUSA00411','CUSA00419','CUSA00880']},{id:'rdr2',name:'Red Dead Redemption 2',ids:['CUSA08519','CUSA03041','CUSA08568']},...cod.map(name=>({id:'cod-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,''),name:'Call of Duty: '+name,ids:[]}))];
function template(game){
 if(game.id==='gta5-rdr2')return template(games[0])+'\r\n'+template(games[1]);
 const lines=['; '+game.name+' - GoldHEN plugins.ini TEMPLATE','; Destination: /data/GoldHEN/plugins.ini','; Put the actual PRX/SPRX in /data/GoldHEN/plugins/.','; No plugin is enabled. Match the exact game update, title ID and plugin build.','; Merge completed sections into your existing config; keep unrelated entries.','; Region headings below are editable template slots, not compatibility claims.',''];
 ['EU','USA','JP'].forEach((region,i)=>lines.push('; '+region,'; Replace CUSAXXXXX with your installed title ID before uncommenting.','; [CUSAXXXXX]','; /data/GoldHEN/plugins/YOUR_PLUGIN.prx',''));
 if(game.ids.length)lines.push('; Normalized title IDs from the supplied example (verify your installed edition):',...game.ids.map(id=>'; ['+id+']'));
 if(game.name==='Call of Duty: Black Ops III')lines.push('; Archived BO3 source examples: CUSA02624, CUSA02290, CUSA03004.','; The archived T7 GSC Injector uses T7_GSC_Injector.prx for game update 01.33.');
 return lines.join('\r\n')+'\r\n';
}
function prepare(){
 const originals=[];
 for(const name of ['GTA5 - RDR2 - plugins.ini','RDR2 - plugins.ini']){
  const source=path.join('C:/Users/whatw/Desktop',name);if(!fs.existsSync(source))throw Error('Missing supplied file: '+source);
  const bytes=fs.readFileSync(source),hash=sha(bytes),local=base+'/originals/'+hash.slice(0,12)+'/plugins.ini';preserve(local,bytes);
  originals.push({name:'plugins.ini',originalName:name,local,bytes:bytes.length,sha256:hash,original:true});
 }
 const files=[...games,{id:'gta5-rdr2',name:'GTA V + Red Dead Redemption 2',ids:[]}].map(game=>{const bytes=Buffer.from(template(game)),local=base+'/'+game.id+'/plugins.ini';preserve(local,bytes);return {...game,name:'plugins.ini',game:game.name,local,bytes:bytes.length,sha256:sha(bytes),template:true};});
 const manifest={version:'20261104',installPath:'/data/GoldHEN/plugins.ini',autoInstall:false,note:'User requested templates only. All example sections and module paths are commented. The missing standalone GTA5 file is represented by the supplied combined example; original bytes are preserved.',sources:['https://github.com/GoldHEN/GoldHEN_Plugins_Repository','https://github.com/0x1496FD0/T7-GSC-Injector'],files,originals};
 fs.writeFileSync(path.join(root,base,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
function preserve(local,bytes){const destination=path.join(root,local);if(fs.existsSync(destination)){if(sha(fs.readFileSync(destination))!==sha(bytes))throw Error('Refusing to replace different snapshot: '+local);}else{fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes,{flag:'wx'});}}
function section(){
 const m=JSON.parse(fs.readFileSync(path.join(root,base,'manifest.json')));
 const links=m.files.map(f=>'<a href="'+f.local+'" download="plugins.ini" data-no-file-options>'+f.game+' <span>plugins.ini</span></a>');
 return '<details id="host-plugin-templates" class="host-plugin-templates" hidden><summary>GoldHEN plugins.ini templates</summary><p>Download to this device. EU / USA / JP template sections are included. Add your exact title ID and plugin filename before use.</p><p>Merge into <code>/data/GoldHEN/plugins.ini</code>. Keep your existing entries. These templates do not install or enable plugins.</p><div class="host-plugin-template-links">'+links.join('')+'</div></details>';
}
function apply(html,name){if(name!=='hosts/ps4/index.html'||html.includes('id="host-plugin-templates"'))return html;return html.replace(/(<div\b[^>]*id="host-action-grid"[^>]*>)/,section()+'$1');}
async function archive(){const manifest=JSON.parse(fs.readFileSync(path.join(root,base,'manifest.json'))),intake=require('./console-expansion-archive.cjs').createArchive(),scope='host-plugin-templates-20261104',files=[];for(const file of [...manifest.files,...manifest.originals]){const result=await intake.writeBytes({scope,item:{id:scope+'-'+(file.id||file.sha256.slice(0,12)),title:(file.game||file.originalName)+' plugins.ini',project:'GoldHEN plugin templates',platform:'PS4',category:['Games',file.id||'Examples','Configurations'],pages:['hosts/ps4/index.html'],url:'https://speedy-away.github.io'+file.local},file:{...file,version:'20261104',sourceUrl:'https://speedy-away.github.io'+file.local,archiveRole:['Builds'],expectedSha256:file.sha256,expectedBytes:file.bytes},bytes:fs.readFileSync(path.join(root,file.local))});files.push(result.file);}const auditPath=path.join(root,'docs/download-audit.json'),audit=JSON.parse(fs.readFileSync(auditPath)),incoming=JSON.parse(fs.readFileSync(intake.inventoryPath(scope)));for(const item of incoming.items){if(!item.id.startsWith(scope+'-'))throw Error('Unexpected archive scope');if(!audit.items.some(saved=>saved.id===item.id))audit.items.push(item);}audit.updated=new Date().toISOString();fs.writeFileSync(auditPath,JSON.stringify(audit,null,2)+'\n');fs.writeFileSync(path.join(root,'docs/qa/host-plugin-template-archive.json'),JSON.stringify({scope,files,allFilesVerified:true},null,2)+'\n');console.log(JSON.stringify({archived:files.length}));}
if(require.main===module){if(process.argv.includes('--archive'))archive().catch(e=>{console.error(e);process.exitCode=1;});else console.log(JSON.stringify({templates:prepare().files.length}));}
module.exports={games,template,prepare,apply};
