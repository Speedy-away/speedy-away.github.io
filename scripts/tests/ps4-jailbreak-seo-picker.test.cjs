'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),compact=require('../host-compact-pages.cjs'),seo=require('../host-page-metadata.cjs'),locales=require('../host-locales.cjs');
test('merged PS4 picker exposes exact source-confirmed firmware routes',()=>{
 const html=compact.directory(root,'ps4'),options=[...html.matchAll(/<option value="([\d.]+)" data-entry="([^"]+)">/g)];
 assert.equal((html.match(/id="ps4-firmware-picker"/g)||[]).length,1);assert.doesNotMatch(html,/class="host-firmware-family"/);assert.match(html,/<h1>Jailbreak<\/h1>/);
 const routes=new Map(options.map(m=>[m[1],m[2]])),group=compact.groups(root).find(g=>g.entry==='/hosts/ps4/exploit/multi-firmware/');
 assert.equal(routes.get('14.02'),'/ps4/14.02/');assert.equal(routes.get('14.00'),'/ps4/14.00/');
 for(const version of group.firmwares)if(version!=='14.00')assert.equal(routes.get(version),group.entry);
 assert.equal(routes.size,new Set([...group.firmwares,'14.00','14.02']).size);assert.equal(routes.has('14.01'),false);assert.equal(routes.has('10.50'),false);
 assert.deepEqual([...routes.keys()],[...routes.keys()].sort((a,b)=>Number(b)-Number(a)));
});
test('picker is inert until submission and detects exact firmware without executing code',()=>{
 function run(ua){const handlers={},status={},button={},location={href:''},select={options:[{value:'',getAttribute:()=>null},{value:'14.02',getAttribute:()=>'/ps4/14.02/'},{value:'14.00',getAttribute:()=>'/ps4/14.00/'}],selectedIndex:0,get value(){return this.options[this.selectedIndex].value;},addEventListener:(e,f)=>handlers[e]=f};const form={addEventListener:(e,f)=>handlers[e]=f};
 vm.runInNewContext(fs.readFileSync(root+'/assets/ps4-firmware-picker.js','utf8'),{document:{getElementById:id=>({'ps4-firmware-picker':form,'ps4-firmware-choice':select,'ps4-jailbreak-open':button,'host-family-detected':status}[id])},navigator:{userAgent:ua},location});return{handlers,button,location,select,status};}
 const desktop=run('desktop');assert.equal(desktop.button.disabled,true);desktop.handlers.submit({preventDefault(){}});assert.equal(desktop.location.href,'');desktop.select.selectedIndex=2;desktop.handlers.change();desktop.handlers.submit({preventDefault(){}});assert.equal(desktop.location.href,'/ps4/14.00/');
 const ps4=run('PlayStation 4/14.02');assert.equal(ps4.select.value,'14.02');assert.equal(ps4.location.href,'');ps4.handlers.submit({preventDefault(){}});assert.equal(ps4.location.href,'/ps4/14.02/');assert.equal(run('PlayStation 4/14.03').button.disabled,true);
});
test('guide has canonical/social/schema metadata and all sitemap language entries',()=>{
 const name='hosts/ps4/14.02-guide/index.html',html=fs.readFileSync(root+'/'+name,'utf8'),data=seo.descriptor(name);
 assert.match(html,/<h1>PS4 14.02 jailbreak<\/h1>/);assert.match(html,/name="robots" content="index, follow/);assert.match(html,/property="og:title"/);assert.match(html,/name="twitter:card"/);assert.match(html,/application\/ld\+json/);assert.ok(data.keywords.includes('PS4 14.02 jailbreak'));
 const map=fs.readFileSync(root+'/sitemap.xml','utf8');assert.equal(map,seo.sitemap());for(const code of locales.codes)assert.ok(map.includes('<loc>'+locales.url(name,code)+'</loc>'));assert.doesNotMatch(map,/<loc>[^<]*\/hosts\/runtime\//);
});
test('localized PS4 metadata describes 14.02 features while PS5 keeps its limitations',()=>{
 for(const code of locales.codes.filter(c=>c!=='en')){const table=locales.dictionary(root,code),ps4=locales.localized(seo.descriptor('hosts/ps4/index.html'),code,table),ps5=locales.localized(seo.descriptor('hosts/ps5/index.html'),code,table),empty=locales.translate('{versions}: empty firmware choices; no exploit or payload is provided.',table).split('{versions}')[1];assert.match(ps4.description,/PS4 14\.02.*GoldHEN \/ ps4-hen/);assert.ok(!ps4.description.includes(empty));assert.ok(ps5.description.includes(empty));}
});
test('PS4 tab and primary launch cards use the requested labels',()=>{
 assert.match(fs.readFileSync(root+'/assets/host-folders.js','utf8'),/loaders:platform==='ps4'\?'Jailbreak'/);
 const dashboard=fs.readFileSync(root+'/assets/host-dashboard.js','utf8');assert.match(dashboard,/if\(path&&platform==='ps4'\).*wwb-jailbreak-launch.*<strong>Load jailbreak<\/strong>/);assert.doesNotMatch(dashboard,/label = 'Open PS4 14.00 loader'/);
 assert.match(fs.readFileSync(root+'/assets/host-dashboard.css','utf8'),/wwb-primary-loader\.wwb-jailbreak-launch/);
});
