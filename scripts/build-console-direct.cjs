'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function build(archive=false){
 let core=fs.readFileSync(path.join(root,'assets/host-native-workspace.js'),'utf8');
 const replace=(a,b)=>{if(!core.includes(a))throw Error('Native client contract changed: '+a.slice(0,60));core=core.replace(a,b);};
 replace("installPath:'/data/whatsite-workspace-ps4.html',config:'/data/GoldHEN/payloads.ini',roots:['/data/payloads','/data/whatwhatboy']","installPath:'/data/wwb-console-files.html',config:'/data/GoldHEN/plugins.ini',roots:['/data/GoldHEN','/data/payloads','/data/whatwhatboy']");
 replace("String(location.port) === s.port","(platform === 'ps4' ? /^(?:[1-9][0-9]{0,4})$/.test(String(location.port || '80')) && Number(location.port || 80) <= 65535 : String(location.port) === s.port)");
 replace("if(!/\\.(?:bin|elf)$/i.test(filename))throw error('payload-format','Choose a ready BIN or ELF file. This page saves files and never executes them.');",'');
 replace("if(/\\.elf$/i.test(filename)&&(data.length<64||data[0]!==127||data[1]!==69||data[2]!==76||data[3]!==70))throw error('payload-format','The selected ELF does not have its executable header.');",'');
 replace("file=writePath(platform,file);newName=namePart(newName);","file=writePath(platform,file);newName=writePath(platform,newName);");
 replace("var destination=parentPath(file)+'/'+newName,original,started=false;","var destination=newName,original,started=false;");
 replace("if(find(items,baseName(file))||!find(items,newName))", "if(find(items,baseName(file)))");
 replace('function readConfig() {','function readExistingConfig() {');
 const missing=`function readConfig() { return list(parentPath(s.config)).then(function(items){if(find(items,baseName(s.config)))return readExistingConfig();return {path:s.config,text:'',data:encode(''),sha256:sha256(encode('')),missing:true};}); }
    function saveConfig(snapshot,edited) {
      if(snapshot&&snapshot.missing){var content=String(edited),data=encode(content);if(data.length>MAX_TEXT||content.indexOf('\\0')>=0)return Promise.reject(error('text-limit','Config must be valid text under 64 KiB.'));return absent(s.config).then(function(){return uploadBytes(s.config,data,true);}).then(function(out){out.status='saved';return out;});}
`;
 replace('function saveConfig(snapshot,edited) {',missing);
 fs.writeFileSync(path.join(root,'assets/console-direct-client.js'),core);
 let ui=fs.readFileSync(path.join(root,'assets/console-files-ui.js'),'utf8');
 ui=ui.replace("var helper=location.pathname==='/'&&location.protocol==='http:'&&/^(localhost|127\\.0\\.0\\.1|192\\.168\\.|10\\.|172\\.)/.test(location.hostname);","var helper=true;");
 ui=ui.replace('function api(route,data,blob){','function api(route,data,blob){return window.WWBDirect.api(route,data,blob);/*').replace("return blob?r.blob():r.json();});}","return blob?r.blob():r.json();});*/}");
 const stageStart=ui.indexOf('function stage(file){'),stageEnd=ui.indexOf('  function stagedList()',stageStart);if(stageStart<0||stageEnd<0)throw Error('UI stage contract changed');ui=ui.slice(0,stageStart)+'function stage(file){return window.WWBDirect.stage(file);}\n'+ui.slice(stageEnd);
 ui=ui.replace('var paired=false','var paired=true');
 ui=ui.replace('el(\'public\').hidden=helper;el(\'local\').hidden=!helper;',"el('public').hidden=true;el('local').hidden=true;el('connect-form').hidden=true;el('connection-panel').classList.remove('cf-collapsed');el('connection-panel').innerHTML='<h3>Direct to your PS4</h3><p>No computer helper. Requests go only to this console.</p><p id=direct-address></p><a class=cf-primary href=/ target=_blank rel=noopener>Open native file manager</a><p class=cf-muted>Use the native manager for archives, USB storage, folders and files larger than 8 MiB.</p>';document.getElementById('direct-address').textContent=location.host;");
 // The connection form is removed, so config is presentation-only in direct mode.
 ui=ui.replace(/function config\(\)\{[^\n]+?\}\n/,"function config(){return {host:location.hostname,port:Number(location.port||80),user:'',password:''};}\n");
 ui=ui.replace("el('connect-form').onsubmit=", "var unusedConnectForm={};unusedConnectForm.onsubmit=");
 ui=ui.replace("try{var saved=JSON.parse(localStorage.getItem('wwb-files-address')||'null');if(saved){el('host').value=saved.host;el('port').value=saved.port;}}catch(_){}",'');
 ui=ui.replace("el('connection-toggle').onclick=", "var unusedToggle={};unusedToggle.onclick=");
 ui=ui.replace("el('pair-button').addEventListener", "el('pair-button').addEventListener");
 // Bindings for removed setup-only controls must not dereference absent nodes.
 ui=ui.replace("function addAction(id,fn){el(id).addEventListener", "function addAction(id,fn){if(!el(id))return;el(id).addEventListener");
 ui=ui.replace("el('open').onclick=", "var unusedOpen={};unusedOpen.onclick=");
 ui=ui.replace("el('connection-panel').classList.add('cf-collapsed');el('connection-toggle').setAttribute('aria-expanded','false');",'');
 ui=ui.replace('Up to 256 MiB per file.','Verified uploads up to 8 MiB per file.');
 ui=ui.replace('<button data-path="/mnt/usb0">USB 0</button>','');
 ui=ui.replace('Read the current console file before saving.','Read the current console file before saving.');
 // Use ezRemote's native archive interface; never send its extraction API unreviewed paths.
 const start=ui.indexOf("  el('archive-input').onchange="),end=ui.indexOf("  var plugins=",start);if(start<0||end<0)throw Error('Archive UI contract changed');ui=ui.slice(0,start)+"  var archivePanel=mount.querySelector('[data-panel=archives]');archivePanel.innerHTML='<h3>Extract directly on PS4</h3><p>Open the native file manager, upload your RAR, ZIP or 7z to a new folder, select the archive and choose Extract. Keep the original archive and use a new destination folder.</p><a class=cf-primary href=/ target=_blank rel=noopener>Open native file manager</a><p class=cf-muted>The console handles extraction. No computer or 7-Zip installation is needed. Format and password support depend on your installed ezRemote version.</p>';\n"+ui.slice(end);
 ui=ui.replace("Choose a tool to begin. The config editor also works without a connection.","Direct console workspace. Press Refresh to read files. No computer helper is used.");
 let html=fs.readFileSync(path.join(root,'assets/console-files.html'),'utf8').replace('<title>Console files · WWB HOST</title>','<title>Phone to PS4 · WWB HOST</title>');
 html=html.replace(/<link[^>]+console-files\.css[^>]*>/,'<style>'+fs.readFileSync(path.join(root,'assets/console-files.css'),'utf8')+'</style>');
 html=html.replace(/<script defer[^>]+console-plugins\.js[^>]*><\/script>/,'').replace(/<script defer[^>]+console-files-ui\.js[^>]*><\/script>/,'');
 html=html.replace('</body>',()=>['assets/console-plugins.js','assets/console-direct-client.js','assets/console-direct-transport.js'].map(f=>'<script>'+fs.readFileSync(path.join(root,f),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>').join('')+'<script>'+ui.replace(/<\/script/gi,'<\\/script')+'</script></body>');
 const bytes=Buffer.from(html),hash=sha(bytes),url='/downloads/helpers/console-direct/'+hash.slice(0,12)+'/wwb-console-files.html';fs.mkdirSync(path.dirname(path.join(root,url)),{recursive:true});fs.writeFileSync(path.join(root,url),bytes);
 const manifest={version:'1.0.0',url,sha256:hash,bytes:bytes.length,installPath:'/data/wwb-console-files.html',defaultWebPort:8080,source:'https://github.com/cy33hc/ps4-ezremote-client/blob/266d9b8fa7af1cd106688999f95960841c3e894d/source/server/http_server.cpp',hardwareVerified:false};fs.writeFileSync(path.join(root,'docs/console-direct.json'),JSON.stringify(manifest,null,2)+'\n');
 if(archive){const intake=require('./console-expansion-archive.cjs').createArchive(),scope='console-direct';await intake.writeBytes({scope,item:{id:scope+'-'+hash.slice(0,12),title:'Phone to PS4 workspace',platform:'PS4',category:['Tools','File management'],project:'WWB HOST',pages:['hosts/ps4/downloads/index.html']},file:{name:'wwb-console-files.html',version:'1.0.0',releaseTag:'1.0.0',sourceUrl:'https://speedy-away.github.io'+url,archiveRole:['Helpers'],expectedBytes:bytes.length,expectedSha256:hash},bytes});require('./import-host-game-actions.cjs').mergeAudit(JSON.parse(fs.readFileSync(intake.inventoryPath(scope))));}
 console.log(JSON.stringify(manifest));return manifest;
}
if(require.main===module)build(process.argv.includes('--archive')).catch(e=>{console.error(e);process.exitCode=1;});module.exports={build};
