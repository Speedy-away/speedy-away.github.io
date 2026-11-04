const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const d=require('../../docs/ps4-ps5-game-patches.json'),jobs=require('../../docs/ps4-ps5-game-patch-jobs.json').jobs;
const {unzip,relevant,appendRecords}=require('../prepare-console-game-patches.cjs');
const {gameCard}=require('../build-console-game-patches.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
test('ready title-specific XMLs preserve exact bytes from the pinned author release',()=>{
  const archive=fs.readFileSync(path.join(root,d.archive.local.slice(1)));
  assert.equal(hash(archive),d.archive.sha256);
  const entries=new Map(unzip(archive).map(e=>[e.name,e.bytes]));
  assert.ok(d.games.length>=20);
  for(const game of d.games)for(const file of game.files){
    assert.equal(file.filename,file.titleId+'.xml');
    assert.ok(entries.has(file.archiveEntry));
    assert.equal(hash(entries.get(file.archiveEntry)),file.sha256);
    const local=fs.readFileSync(path.join(root,file.local.slice(1)));
    assert.equal(hash(local),file.sha256);
    assert.match(local.toString(),new RegExp('<ID>'+file.titleId+'</ID>'));
    const job=jobs.find(j=>j.id===file.downloadId);assert.ok(job);assert.equal(job.expectedSha256,file.sha256);
  }
});
test('Bloodborne and RDR2 retain exact update pins and source performance caveats',()=>{
  const blood=d.games.find(g=>g.title==='Bloodborne'),rdr=d.games.find(g=>g.title==='Red Dead Redemption 2');
  assert.ok(blood.options.some(o=>o.Name==='60 FPS (With Deltatime)'&&o.AppVer==='01.09'&&/Laurence/.test(o.Note)));
  assert.deepEqual([...new Set(rdr.options.map(o=>o.AppVer))].sort(),['01.29','01.32']);
  assert.ok(rdr.options.some(o=>/120fps/.test(o.Name)&&/VideoOut/.test(o.Note)));
  assert.equal(d.resources.find(r=>r.filename==='CUSA00900.xml').category,'patches');
});
test('native PS5 and PS5-targeted backward-compatibility files keep their scope and paths',()=>{
  for(const game of d.games.filter(g=>g.arch==='prospero')){
    assert.deepEqual(game.platforms,['ps5']);
    for(const f of game.files){assert.match(f.titleId,/^PPSA/);assert.match(d.resources.find(r=>r.id===f.downloadId).preparation,/xml_prospero/);}
  }
  const guardian=d.games.find(g=>g.title==='The Last Guardian');assert.deepEqual(guardian.platforms,['ps5']);
  assert.ok(guardian.options.every(o=>/PS5/.test(o.Note)));
  assert.equal(d.engine.confirmedFirmware.ps5,'3.00–12.70');
  assert.equal(d.engine.confirmedFirmware.ps4,'9.00–12.52');
});
test('each catalogue requires explicit title selection and provides platform-specific storage routing',()=>{
  const blood=d.games.find(g=>g.title==='Bloodborne'),html=gameCard(blood,'ps5',d);
  assert.match(html,/<option value="">Choose title ID/);
  assert.match(html,/data-download-page="\/console\/ps5\/downloads.html"/);
  assert.match(html,/data-patch-download aria-disabled="true"/);
  assert.match(html,/data-patch-storage aria-disabled="true"/);
  assert.match(html,/CUSA00900\.xml/);
  assert.doesNotMatch(html,/<(?:video|iframe)\b/);
});
test('all staged patch-engine assets match captured size and SHA-256',()=>{
  for(const j of jobs){const bytes=fs.readFileSync(path.join(root,j.importPath));assert.equal(bytes.length,j.expectedBytes,j.id);assert.equal(hash(bytes),j.expectedSha256,j.id);}
});

const addedSources=['HorizonZeroDawn-Orbis.xml','HorizonForbiddenWest-Orbis.xml','EldenRing-Orbis.xml','GhostOfTsushimaDC-Orbis.xml','DaysGone-Orbis.xml','MarvelsSpider-Man-Orbis.xml','MarvelsSpider-ManMilesMorales-Orbis.xml','FinalFantasyVIIRemake-Orbis.xml','FinalFantasyXV-orbis.xml','AlienIsolation-Orbis.xml','SleepingDogs-Orbis.xml','Persona5Royal-Orbis.xml','Stray-Orbis.xml','ArmoredCoreVI-Orbis.xml','DetroitBecomeHuman.xml'];
test('fifteen additional title families contain genuine performance options and retain exact regional XML identities',()=>{
  const additions=d.games.filter(game=>addedSources.includes(game.sourceFile));
  assert.equal(additions.length,15);assert.equal(additions.reduce((count,game)=>count+game.files.length,0),59);
  for(const game of additions){
    assert.ok(game.options.length>0&&game.options.every(relevant),game.title);
    assert.deepEqual(game.platforms,['ps4','ps5']);
    for(const file of game.files){
      assert.match(file.titleId,/^CUSA\d+$/);assert.equal(file.downloadId,'fps-'+file.titleId.toLowerCase()+'-'+d.release);
      const resource=d.resources.find(item=>item.id===file.downloadId);assert.ok(resource);assert.match(resource.compatibility,/PS5 use is backward compatibility only/);
      assert.equal(resource.pages.ps4,'/console/ps4/game-patches.html#'+game.id);assert.equal(resource.pages.ps5,'/console/ps5/game-patches.html#'+game.id);
    }
  }
});

test('new pacing, pattern-scan and source warning details remain distinguishable from blanket 60 FPS support',()=>{
  const find=file=>d.games.find(game=>game.sourceFile===file);
  const ff=find('FinalFantasyXV-orbis.xml');assert.equal(ff.options.length,1);assert.match(ff.options[0].Name,/Frame Pacing Fix For 30FPS Modes/);assert.equal(ff.options[0].AppVer,'01.30');assert.match(ff.options[0].Note,/Only 30FPS Modes are affected/);
  assert.ok(find('Persona5Royal-Orbis.xml').options.some(option=>/softlock/.test(option.Note)&&/30FPS/.test(option.Note)));
  assert.ok(find('AlienIsolation-Orbis.xml').options.some(option=>/120/.test(option.Name)&&/VideoOut.*120Hz/.test(option.Note)));
  assert.ok(find('GhostOfTsushimaDC-Orbis.xml').options.every(option=>/Better Framerate Mode/.test(option.Note)));
  const forbidden=find('HorizonForbiddenWest-Orbis.xml');assert.ok(forbidden.options.some(option=>option.AppVer==='mask'));assert.ok(d.resources.filter(item=>item.game===forbidden.id).every(item=>/mask = upstream pattern scan/.test(item.compatibility)));
  const elden=find('EldenRing-Orbis.xml');const update119=elden.options.filter(option=>option.AppVer==='01.19');assert.ok(update119.length>0);assert.ok(update119.every(option=>!/60 FPS/.test(option.Name)));
});

test('new game artwork uses documented publisher assets, reuses matching existing covers and matches recorded hashes',()=>{
  const manifest=require('../../docs/ps4-ps5-game-patch-images.json').images;
  for(const game of d.games.filter(game=>addedSources.includes(game.sourceFile))){
    const image=manifest[game.id];assert.ok(image,game.title);assert.equal(game.image,image.image);assert.match(image.sourcePage,/^https:\/\/(?:store\.steampowered\.com\/app\/\d+|www\.playstation\.com\/en-gb\/games\/[a-z0-9-]+)\/$/);
    const bytes=fs.readFileSync(path.join(root,image.image.slice(1)));assert.equal(bytes.length,image.bytes);assert.equal(hash(bytes),image.sha256);
    assert.ok(d.resources.filter(item=>item.game===game.id).every(item=>item.image===image.image));
  }
  assert.equal(findImage('horizon-zero-dawn'),'/assets/images/ps4-ps5/horizon-zero-dawn.jpg');assert.equal(findImage('elden-ring'),'/assets/images/ps4-ps5/elden-ring.jpg');
  assert.match(manifest['marvel-s-spider-man'].source,/marvel-spiderman-pdp-hero-desktop-01-ps4-en/);
  assert.match(manifest['marvel-s-spider-man'].kind,/Original PS4 hero/);
  function findImage(id){return d.games.find(game=>game.id===id).image;}
});

test('append mode retains previous record identity and refuses duplicate IDs before changing existing arrays',()=>{
  const original={id:'old',bytes:123,compatibility:'Pinned 01.00'},previous=[original],added={id:'new',bytes:456};
  const combined=appendRecords(previous,[added]);assert.equal(combined[0],original);assert.equal(combined[1],added);assert.deepEqual(previous,[original]);
  assert.throws(()=>appendRecords(previous,[{id:'fresh'},{id:'old'}]),/Refusing a duplicate/);assert.deepEqual(previous,[original]);
  assert.throws(()=>appendRecords(previous,[{}]),/missing id/);
});

const nextTitleFamilies={
  'AssassinsCreedIVBlackFlag.xml':[['CUSA00009'],['01.04']],
  'AssassinsCreedRougeRemastered-Orbis.xml':[['CUSA10123'],['01.01']],
  'KenaBridgeofSpirits-Orbis.xml':[['CUSA24853'],['02.03','02.08']],
  'Skyrim-Orbis.xml':[['CUSA05333'],['01.17']],
  'RiseoftheTombRaider-Orbis.xml':[['CUSA05794'],['01.06']],
  'DeusExMankindDivided-Orbis.xml':[['CUSA01836'],['01.14']],
  'DragonAgeInquisition-Orbis.xml':[['CUSA00503','CUSA00220','CUSA01425','CUSA00728'],['01.12']],
  'Wreckfest-Orbis.xml':[['CUSA08548','CUSA08652','CUSA17033'],['01.31','02.17','02.22']],
  'LiesOfP-Orbis.xml':[['CUSA36849','CUSA36848','CUSA36847','CUSA36850'],['mask']],
  'SonicFrontiers-Orbis.xml':[['CUSA28194','CUSA32054','CUSA28193'],['mask']]
};
test('next ten performance families keep all twenty exact CUSA files, update pins and backward-compatibility scope',()=>{
  let files=0;
  for(const [source,[ids,updates]]of Object.entries(nextTitleFamilies)){
    const game=d.games.find(g=>g.sourceFile===source);assert.ok(game,source);
    assert.deepEqual(game.titleIds,ids);assert.deepEqual([...new Set(game.options.map(o=>o.AppVer))],updates);
    assert.deepEqual(game.platforms,['ps4','ps5']);assert.equal(game.arch,'orbis');
    assert.ok(game.options.every(relevant));files+=game.files.length;
    for(const file of game.files){const resource=d.resources.find(r=>r.id===file.downloadId);assert.match(resource.compatibility,/PS5 use is backward compatibility only/);assert.equal(resource.sha256,file.sha256);}
  }
  assert.equal(files,20);
  const find=source=>d.games.find(game=>game.sourceFile===source);
  assert.ok(find('KenaBridgeofSpirits-Orbis.xml').options.filter(o=>/Resolution/.test(o.Name)).every(o=>o.AppVer==='02.03'));
  assert.ok(find('RiseoftheTombRaider-Orbis.xml').options.some(o=>/CPU Limited/.test(o.Note)));
  assert.ok(find('DeusExMankindDivided-Orbis.xml').options.some(o=>/120/.test(o.Name)&&/VideoOut for 120Hz/.test(o.Note)));
  assert.ok(find('Skyrim-Orbis.xml').options.some(o=>/720p for Base/.test(o.Name)));
  for(const source of ['LiesOfP-Orbis.xml','SonicFrontiers-Orbis.xml']){
    const game=find(source);assert.ok(d.resources.filter(r=>r.game===game.id).every(r=>/mask = upstream pattern scan, not a guarantee/.test(r.compatibility)));
  }
});
