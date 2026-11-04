const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {zipEntries}=require('./prepare-xbox360-more.cjs');
const root=path.resolve(__dirname,'..'),file=path.join(root,'docs/xbox360-more-library.json');
const data=JSON.parse(fs.readFileSync(file,'utf8'));
const get=id=>{const item=data.resources.find(x=>x.id===id);if(!item||item.status!=='ready')throw Error('Archive before finalizing '+id);return item;};
const fce=get('fce360-enhanced');
fce.requiredEntries=['fceux.xex','media/ui.xzp','media/xarialuni.ttf'];
fce.setup[0]='The release ZIP has fceux.xex and media at its root. Extract its contents directly into the shown FCEUX360 folder, keeping media/ui.xzp and media/xarialuni.ttf beside the executable’s directory.';
delete fce.wrapperVerificationRequired;
const salvia=get('salvia360');
salvia.launch='default.xex';salvia.requiredEntries=['default.xex','salvia.cfg','cover_aurora.jpg'];
salvia.setup[0]='The Xbox 360 ZIP has default.xex, core XEX files, salvia.cfg and supporting directories at its root. Extract all contents directly into a dedicated Salvia folder, such as Usb0:\\Salvia\\ or the shown HDD path. Launch default.xex; individual core XEX files stay alongside it.';
delete salvia.wrapperVerificationRequired;delete salvia.launcherVerificationRequired;
const zip=zipEntries(fs.readFileSync(path.join(root,'docs/tmp/xbox360-more/salvia360-Salvia-360.zip')));
const cover=zip.find(x=>x.name==='cover_aurora.jpg'),bytes=cover.read();
const local='/assets/images/xbox360-more/salvia360.jpg';
if(!fs.existsSync(path.join(root,local)))fs.writeFileSync(path.join(root,local),bytes,{flag:'wx'});
salvia.image={local,sourceUrl:salvia.downloadUrl,archiveEntry:cover.name,credit:'danibiker · official Salvia Aurora cover artwork from the Xbox 360 release',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
const multiplex=get('multiplex360');multiplex.requirementFilter='badupdate';delete multiplex.runtimeFilter;
get('simple360player').requiredEntries=['Simple360Player/default.xex'];multiplex.requiredEntries=['Multiplex360/default.xex'];
const silver=get('silverdash360');silver.downloadLabel='Base 0.1.2';silver.requiredEntries=['Silverdash360/default.xex','Silverdash360/Silverdash360.dll'];
silver.companions[0].installPath='Hdd1:\\Apps\\Silverdash360\\';silver.companions[0].requiredEntries=['Silverdash360.dll'];silver.companions[0].requiredPeEntries=['Silverdash360.dll'];
for(const id of ['auroraflow-en','auroraflow-global']){
  const item=get(id);item.companions[0].required=true;item.companions[0].label='Matching '+(id.endsWith('-en')?'English':'Global')+' layout';
  item.notes='Keep the skin and layout language variants matched and disable Animation. The publisher’s skin metadata contains trailing legacy text; the original release is preserved unchanged. Keep a working skin available; physical-console behavior was not tested.';
}
get('slither360').requiredEntries=['default.xex','assets/atlas.rgba'];
const manifest=require('../docs/xbox360-more-batch2.json');
for(const id of manifest.addedIds){const item=get(id);if(!item.image?.credit)throw Error('Missing artwork credit '+id);if(!item.formatVerification)throw Error('Missing format inspection '+id);}
fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
console.log('Finalized verified launchers, archive wrappers, required companions and source artwork.');
