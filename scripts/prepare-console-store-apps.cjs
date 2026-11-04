// Capture a selected native PS5 catalogue, verify exact publisher release assets,
// and stage the selected publisher builds for archive jobs. Never runs them.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {applyStoreAppOverrides}=require('./console-store-app-overrides.cjs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const selections={
  'Prospero Explorer':'Browse console files, manage archives and packages, and use the project’s network tools.',
  'Prospero Multi Tools':'Manage supported homebrew and backup layouts. The project requires its unjail payload.',
  'DriftCheck':'Inspect DualSense sticks, drift, buttons, triggers, touchpad and motion input.',
  'ScreenTester5':'Display test patterns to inspect screen geometry, colour uniformity and pixels.',
  'Chiral-FTP':'Manage console files and connect through the project’s FTP, SFTP and web tools.',
  'ProsperoRadio':'Browse internet radio stations, save favourites and control playback with DualSense.',
  'CD Player':'Play audio discs using supported USB CD hardware and the project’s music interface.',
  'Surround Sound Studio':'Test HDMI audio formats and speaker channels using the project’s passthrough tools.',
  'Home5':'Control your configured Home Assistant rooms and devices from the console.',
  'ProsperoWeb':'Browse websites with controller navigation, tabs and bookmarks in a native PS5 app.'
};
async function request(url){const r=await fetch(url,{headers:{'User-Agent':'whatsite-selected-homebrew/1.0'},signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('HTTP '+r.status+' '+url);return r;}
async function run(){
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/tmp/prospero-catalog-2026-11-02.json'),'utf8'));
  const resources=[],jobs=[],imageSources=[];
  const overrides=JSON.parse(fs.readFileSync(path.join(root,'docs/console-store-app-overrides.json'),'utf8')).resources;
  const cache=path.join(root,'docs/tmp/console-app-sources');fs.mkdirSync(cache,{recursive:true});
  const imageRoot=path.join(root,'assets/images/console-software/store');fs.mkdirSync(imageRoot,{recursive:true});
  for(const [name,description] of Object.entries(selections)){
    const app=catalog.apps.find(row=>row.name===name);if(!app)throw Error('Missing selected app '+name);
    const match=new URL(app.artifact_url).pathname.match(/^\/([^/]+\/[^/]+)\/releases\/download\/([^/]+)\/(.+)$/);if(!match)throw Error('Not a publisher release asset');
    const [_,repo,tag,encodedFilename]=match,filename=decodeURIComponent(encodedFilename);
    const id='ps5-store-'+app.titleid.toLowerCase();
    const releaseCache=path.join(cache,id+'-release.json');
    let release;
    if(fs.existsSync(releaseCache))release=JSON.parse(fs.readFileSync(releaseCache,'utf8'));
    else try {release=await(await request('https://api.github.com/repos/'+repo+'/releases/tags/'+tag)).json();}
    catch(error){release={html_url:'https://github.com/'+repo+'/releases/tag/'+tag,assets:[],metadataUnavailable:error.message};}
    const staged=path.join(root,'downloads/console-store',id,filename);
    const binary=fs.existsSync(staged)?fs.readFileSync(staged):Buffer.from(await(await request(app.artifact_url)).arrayBuffer());
    if(binary.subarray(0,2).toString()!=='PK'||digest(binary)!==app.sha256)throw Error('Publisher asset bytes differ from pinned store checksum '+name);
    fs.mkdirSync(path.dirname(staged),{recursive:true});
    if(!fs.existsSync(staged))fs.writeFileSync(staged,binary,{flag:'wx'});
    const asset=release.assets.find(asset=>asset.name===filename&&asset.browser_download_url===app.artifact_url)||{name:filename,size:binary.length};
    if(asset.digest?.startsWith('sha256:')&&asset.digest.slice(7)!==app.sha256)throw Error('Publisher/catalogue hash conflict '+name);
    let readme='';
    try {readme=await(await request('https://raw.githubusercontent.com/'+repo+'/'+tag+'/README.md')).text();} catch(error){readme='README unavailable at pinned release: '+error.message;}
    fs.writeFileSync(path.join(cache,id+'-README.txt'),readme);
    fs.writeFileSync(path.join(cache,id+'-release.json'),JSON.stringify(release,null,2));
    const icon=Buffer.from(await(await request(app.icon)).arrayBuffer());
    if(icon.subarray(0,4).toString()!=='RIFF'||icon.subarray(8,12).toString()!=='WEBP')throw Error('Invalid catalogue artwork '+name);
    const image='/assets/images/console-software/store/'+app.titleid.toLowerCase()+'.webp';fs.writeFileSync(path.join(root,'.'+image),icon);
    imageSources.push({file:image,source:app.icon,publisherSource:app.icon_url,sha256:digest(icon),bytes:icon.length});
    const compatibility=`Native PS5 app bundle · ${app.titleid} · release ${app.version}. Requires an already working, compatible PS5 homebrew app environment; follow the pinned publisher setup. No stock-console installation or universal firmware support is claimed.`;
    resources.push(applyStoreAppOverrides({id,title:name,platforms:['ps5'],category:'apps',version:app.version,filename,source:app.source_repo,storePage:app.page,url:app.artifact_url,bytes:asset.size,sha256:app.sha256,image,page:'/console/ps5/apps.html#store-'+app.titleid.toLowerCase(),description,compatibility,preparation:'Complete app bundle: extract into a new folder and follow the publisher’s app installation layout. Keep every included dependency; an app eboot.bin is not automatically a standalone payload.',license:app.license,readme:'docs/tmp/console-app-sources/'+id+'-README.txt'},overrides[id]));
    jobs.push({id,title:name+' · PS5 '+app.version,platform:'PS5',category:'Apps',project:name,version:app.version,filename,url:app.artifact_url,importPath:path.relative(root,staged).replaceAll('\\','/'),expectedBytes:asset.size,expectedSha256:app.sha256,mirror:asset.size<=64*1024*1024,pages:['console/ps5/apps.html','console/ps5/downloads.html'],maxBytes:512*1024*1024,provenance:{store:'https://prosperostore.net/catalog/v1.json',storePage:app.page,publisherRelease:release.html_url,license:app.license}});
    console.log(name+' '+app.version+' · '+asset.size+' bytes · '+filename);
  }
  fs.writeFileSync(path.join(root,'docs/console-ready-software.json'),JSON.stringify({reviewed:'2026-11-02',sources:['https://prosperostore.net/','https://prosperostore.net/catalog/v1.json'],resources,imageSources},null,2)+'\n');
  fs.writeFileSync(path.join(root,'docs/console-ready-software-jobs.json'),JSON.stringify({reviewed:'2026-11-02',jobs},null,2)+'\n');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
