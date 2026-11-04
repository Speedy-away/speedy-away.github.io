const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {execFileSync} = require('node:child_process');

test('real PSP, themes and Retro builders preserve fixes across repeated regeneration', () => {
  // Run the real generators/helpers with page writes held in memory. Reject
  // other writes so this regression cannot alter catalogues or shared archives.
  const code = String.raw`
    const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
    const pages=['console/retro/psp.html','console/themes.html','console/retro/index.html'];
    const allowed=new Set(pages.map(p=>path.resolve(p))),outputs=new Map();
    const read=fs.readFileSync.bind(fs),mkdir=fs.mkdirSync.bind(fs);
    fs.readFileSync=(file,options)=>{
      const captured=outputs.get(path.resolve(file));
      if(captured===undefined)return read(file,options);
      return (typeof options==='string'||options?.encoding)?captured:Buffer.from(captured);
    };
    fs.writeFileSync=(file,bytes)=>{assert(allowed.has(path.resolve(file)),'Unexpected write '+file);outputs.set(path.resolve(file),String(bytes));};
    fs.mkdirSync=(file,options)=>{assert(fs.existsSync(file),'Unexpected new directory '+file);};
    for(const method of ['renameSync','unlinkSync','rmSync','copyFileSync','appendFileSync'])fs[method]=()=>{throw Error('Unexpected '+method);};
    console.log=()=>{};
    const builders=[require('./scripts/build-psp-more.cjs').buildPspMore,require('./scripts/build-console-themes.cjs').buildConsoleThemes,require('./scripts/build-retro-page.cjs').buildRetroPage];
    const metadata=require('./scripts/page-search-metadata.cjs');
    const finish=require('./scripts/search-page-output.cjs').finish;
    const catalog=JSON.parse(read('docs/psp-more-catalogue.json','utf8'));
    const themeRecords=require('./scripts/build-console-themes.cjs').loadThemes().records;
    for(const build of builders)build();
    const first=new Map(outputs);
    for(const build of builders)build();
    for(const page of pages){
      const html=outputs.get(path.resolve(page));
      assert.equal(html,first.get(path.resolve(page)),page+' unstable across regeneration');
      assert.equal(metadata.transform(page,html).html,html,page+' needs manual metadata update');
      assert.equal(finish(page,html),html,page+' finalizer is not stable');
      for(const asset of ['site-background.css','site-background.js','mobile.css','mobile-downloads.js'])assert.equal((html.match(new RegExp('/assets/'+asset.replace('.','\\.')+'\\?','g'))||[]).length,1,page+' '+asset);
      assert.match(html,/languages\/i18n.js\?v=3/);
      assert.equal((html.match(/id="site-page-schema"/g)||[]).length,1,page+' schema');
    }
    const psp=outputs.get(path.resolve(pages[0])),themes=outputs.get(path.resolve(pages[1])),retro=outputs.get(path.resolve(pages[2]));
    assert.match(psp,/Native package: <code>ARK_Loader\/EBOOT.PBP<\/code>/);
    assert.match(psp,/ARK-4 is archived/);
    assert.match(psp,/style="display:none">No matching downloads/);
    assert.ok(!psp.includes('Do not claim full speed')&&!psp.includes('record exact retrieval timestamp'));
    for(const item of catalog.items){
      assert(psp.includes('id="'+item.id+'"'),'Lost PSP title '+item.id);
      for(const file of item.files){
        assert(psp.includes('href="'+(item.directSourceOnly?file.sourceUrl:file.local)+'"'),'Lost pinned download');
        assert(psp.includes(file.sha256),'Lost checksum');
      }
    }
    for(const theme of themeRecords)assert(themes.includes('id="theme-'+theme.id+'"'),'Lost shared theme '+theme.id);
    assert.equal(themeRecords.filter(t=>t.platform.id==='psp').length,4);
    assert.match(themes,/href="\/console\/retro\/psp.html#theme-setup"/);
    assert.match(retro,/href="\/console\/psp\/">Explore PSP/);
    process.stdout.write(JSON.stringify({pages:pages.length,rebuilds:2,pspTitles:catalog.items.length,sharedThemes:themeRecords.length,unrelatedWrites:0}));
  `;
  const result = JSON.parse(execFileSync(process.execPath, ['-e',code], {cwd:path.resolve(__dirname,'../..'),encoding:'utf8'}));
  assert.equal(result.pages,3);
  assert.equal(result.rebuilds,2);
  assert.equal(result.unrelatedWrites,0);
});
