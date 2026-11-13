'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),api=require('../../assets/host-home-detect.js');
test('home detects only console and firmware explicitly reported by this browser',()=>{
 assert.deepEqual(api.detect('Mozilla/5.0 (PlayStation 4 9.00) AppleWebKit/605.1.15'),{console:'PS4',firmware:'9.00'});assert.deepEqual(api.detect('Mozilla/5.0 (PlayStation; PlayStation 5/13.60) AppleWebKit/605.1.15'),{console:'PS5',firmware:'13.60'});assert.deepEqual(api.detect('Mozilla/5.0 (PlayStation 4) AppleWebKit/605.1.15'),{console:'PS4',firmware:null});for(const ua of ['Mozilla/5.0 Windows NT 10.0','Mozilla/5.0 (PlayStation 3; 4.93)','Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'])assert.deepEqual(api.detect(ua),{console:null,firmware:null});
});
test('home browser detection makes no network request, storage read, redirect, timer or native action',()=>{
 const attrs={},events={},nodes={};for(const id of ['home-detected-console','home-detected-firmware'])nodes[id]={textContent:'',setAttribute:(k,v)=>attrs[id+':'+k]=v};const cards=['ps4','ps5'].map(platform=>({values:{'data-home-console':platform},getAttribute(k){return this.values[k];},setAttribute(k,v){this.values[k]=v;},removeAttribute(k){delete this.values[k];}}));const calls=[];const window={navigator:{userAgent:'PlayStation 5/7.61'},location:{set href(v){calls.push('redirect');}},get localStorage(){calls.push('storage');throw Error('Unexpected storage read');},fetch:()=>calls.push('fetch'),setTimeout:()=>calls.push('timer'),XMLHttpRequest:class{constructor(){calls.push('xhr');}},addEventListener:(type,fn)=>events[type]=fn,document:{getElementById:id=>nodes[id],querySelectorAll:()=>cards}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'assets/host-home-detect.js'),'utf8'),{window});assert.equal(nodes['home-detected-console'].textContent,'PS5');assert.equal(nodes['home-detected-firmware'].textContent,'7.61');assert.equal(cards[0].values['data-browser-console'],undefined);assert.equal(cards[1].values['data-browser-console'],'true');events['scooby:langchange']();assert.deepEqual(calls,[]);
});
test('homepage retains console/tool routes with one full trainer cover and no KARO feature links',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/id="home-detected-console"/);assert.match(html,/id="home-detected-firmware"/);assert.match(html,/ps4-offline-trainer-cover-v1\.jpg/);assert.doesNotMatch(html,/trainer-mosaic|karo-feature|href="\.\/hosts\/karo\//i);for(const destination of ['./hosts/ps4/','./hosts/ps5/','./hosts/tools/ps4-trainer/','./hosts/ps4/payload-manager/','./hosts/ps5/files/'])assert.ok(html.includes('href="'+destination+'"'));
 for(const m of html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[?#][^"]*)?"/g)){const file=path.join(root,m[1]);assert.ok(fs.existsSync(file)||fs.existsSync(path.join(file,'index.html'))||require('../host-public-routes.cjs').routes().some(r=>r.target===m[1].replace(/^\.\//,'')+'index.html'&&fs.existsSync(path.join(root,r.source))),'Missing home asset/route '+m[1]);}
});
test('blue theme uses uncropped images and removes only the outer catalogue box, with readable desktop columns',()=>{
 const home=fs.readFileSync(path.join(root,'assets/host-home.css'),'utf8'),theme=fs.readFileSync(path.join(root,'assets/host-blue-theme.css'),'utf8');assert.match(home,/--bg:#11161f/);assert.match(home,/--accent:#99bdff/);assert.doesNotMatch(home,/object-fit:cover|overflow:hidden/);assert.match(home,/\.tool-art img\{[^}]*object-fit:contain/);assert.match(theme,/\.host-dashboard\.host-reset/);assert.doesNotMatch(theme,/body\.wwb-host-page \.host-dashboard,/);assert.match(theme,/object-fit:contain!important/);for(const count of [4,5,6])assert.match(theme,new RegExp('grid-template-columns:repeat\\('+count+',minmax\\(0,1fr\\)\\)'));assert.match(theme,/html\.host-console-browser/);assert.doesNotMatch(theme,/repeat\(7,/);assert.doesNotMatch(theme,/hosts\/runtime|<script|fetch\(/);
});

test('payload outlines and hidden media apply only to the payload view',()=>{
 const theme=fs.readFileSync(path.join(root,'assets/host-blue-theme.css'),'utf8'),scope='body.wwb-host-page .host-catalog-grid[data-host-view="payloads"] ',rules=[...theme.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].includes('[data-host-view="payloads"]'));
 assert.equal(rules.length,4);for(const rule of rules)assert.ok(rule[1].trim().startsWith(scope));
 const card=rules.find(m=>m[1].trim().endsWith('.host-catalog-tile'))[2];assert.match(card,/padding:16px!important/);assert.match(card,/border:1px solid #344258!important/);assert.match(card,/min-height:76px/);
 assert.ok(rules.some(m=>m[1].trim().endsWith('.host-catalog-tile__media')&&m[2].includes('display:none!important')));
 assert.ok(rules.some(m=>m[1].includes(':hover')&&m[2].includes('border-color:#779cd8')));
 assert.ok(rules.some(m=>m[1].includes(':focus-visible')&&m[2].includes('outline:3px solid #99bdff')));
});
