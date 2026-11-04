const {test}=require('node:test'),assert=require('node:assert/strict');
const {context,select}=require('../ps3-download-context.cjs');
const catalog=require('../build-ps3-catalog.cjs');
const resources=catalog.data().resources;
test('WeAreGhosts keeps the six archive-labelled pairs under one download chooser',()=>{
 const item=resources.find(x=>x.id==='gta-v-weareghosts-v2'),files=catalog.archivedFor(item);
 for(const type of ['HEN','DEX','CEX'])for(const region of ['BLES','BLUS']){
  const pair=files.filter(f=>new RegExp('\\['+region+'-'+type+'\\]').test(f.memberPath||'')&&/EBOOT\.BIN$|WeAreGhosts\.sprx$/i.test(f.name));
  assert.equal(pair.length,2);
  for(const file of pair){assert.deepEqual(context(item,file).types,[type]);assert.deepEqual(context(item,file).regions,[region]);}
 }
 const html=catalog.card(item);
 assert.equal((html.match(/>Choose console type &amp; download<\/a>/g)||[]).length,1);
 for(const file of files)assert.ok(html.includes('href="'+file.local+'"'),file.memberPath||file.name);
 for(const type of ['HEN','DEX','CEX'])assert.ok(html.includes('<span class="menu-file-tag">'+type+'</span>'));
});
test('closest edition directory wins over a parent folder mentioning another region',()=>{
 const item=resources.find(x=>x.id==='gta-v-cloud-v15');
 const file=catalog.archivedFor(item).find(f=>/BLES-07.*EBOOT\.BIN$/.test(f.memberPath||''));
 assert.deepEqual(context(item,file).types,['HEN']);assert.deepEqual(context(item,file).regions,['BLES-07']);
 assert.deepEqual(context(item,{name:'EBOOT.BIN'}).types,[],'resource-wide HEN/DEX claims do not label an unidentified file');
});
test('newest recorded version and duplicates move aside without dropping variants or compatibility pins',()=>{
 const item={id:'test-file-selection',gameUpdate:'1.27'};
 const make=(sha,version,type,gameUpdate='1.27')=>({name:'Menu.sprx',sha256:sha,bytes:5,version,memberPath:type+'/Menu.sprx',gameUpdate});
 const old=make('old','1.0','HEN'),latest=make('latest','2.0','HEN'),copy={...latest,local:'/duplicate'},dex=make('dex','1.0','DEX'),pin=make('pin','1.0','HEN','1.28');
 const result=select(item,[old,latest,copy,dex,pin]);
 assert.deepEqual(result.current,[latest,dex,pin]);assert.deepEqual(result.preserved,[old,copy]);
 assert.equal(result.current.length+result.preserved.length,5);
});
