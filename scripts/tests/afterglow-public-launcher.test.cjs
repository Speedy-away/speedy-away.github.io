'use strict';
// Only the newly authored route glue is evaluated. No native script is imported.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../../assets/afterglow-public-launcher.js'),builder=require('../build-afterglow-public-launcher.cjs');
const entry='/hosts/runtime/ps4-afterglow-acf25a831725/web/index.html';
const report={entry,firmwares:['13.52','14.00'],commit:'acf25a831725f0d44fcb64725d4ce35acbba8f9d'};
function location(prefix='',hostname='example.test'){return new URL('https://'+hostname+prefix+'/hosts/ps4/afterglow/');}
test('public route resolves only the exact local isolated landing, with the project prefix preserved',()=>{
  assert.equal(api.destination(entry,location()),'https://example.test'+entry);
  assert.equal(api.destination('/WWB-HOST'+entry,location('/WWB-HOST')),'https://example.test/WWB-HOST'+entry);
  for(const bad of [entry.replace('index.html','jb.html'),entry+'?afterglow=run',entry+'#start',entry.replace('/web/','/upstream/'),'https://evil.test'+entry,'//evil.test'+entry,entry.replace('/web/','/web/../web/'),entry.replace('/web/','/%77eb/'),'/hosts/runtime/other/web/index.html',entry.replace('acf25a831725','main')])assert.throws(()=>api.destination(bad,location()),undefined,bad);
  assert.throws(()=>api.destination(entry,{href:'file:///tmp/index.html',origin:'null'}));
});
test('rendered public page contains no runtime/source downloads, iframe, executable native module or duplicate picker',()=>{
  const html=builder.render(report);assert.match(html,/afterglow-public-launcher\.js\?v=1/);assert.match(html,/id="afterglow-public-data"/);assert.match(html,/href="\/hosts\/runtime\/ps4-afterglow-acf25a831725\/web\/index\.html"/);
  assert.doesNotMatch(html,/<iframe|Download runtime|Download source|\.zip|afterglow-run-guard|jb\.html|jb\.js|name="payload"|autostart:\s*true|type="module"/i);
  for(const altered of [{...report,entry:entry.replace('index.html','jb.html')},{...report,firmwares:['13.52','14.00','14.01']},{...report,commit:'main'}])assert.throws(()=>builder.render(altered));
});
test('browser glue navigates only to the inert picker and cannot arm, import, run or change autostart preferences',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../../assets/afterglow-public-launcher.js'),'utf8');
  for(const userAgent of ['PC desktop','PlayStation 5/14.00','PlayStation 4/13.50','PlayStation 4/13.52','PlayStation 4/14.00']){
    const calls=[],nodes={'afterglow-public-data':{textContent:JSON.stringify({entry})},'afterglow-public-status':{textContent:''},'afterglow-public-continue':{hidden:false}};
    const window={document:{getElementById:id=>nodes[id]},location:{href:'https://example.test/hosts/ps4/afterglow/',origin:'https://example.test',replace:url=>calls.push(url)},navigator:{userAgent}};
    Object.defineProperty(window,'localStorage',{get(){throw Error('Preferences must stay with the original landing.');}});Object.defineProperty(window,'sessionStorage',{get(){throw Error('Only the original landing may arm a run.');}});
    vm.runInNewContext(source,{window,URL});assert.deepEqual(calls,['https://example.test'+entry]);assert.equal(nodes['afterglow-public-continue'].href,calls[0]);assert.equal(nodes['afterglow-public-continue'].hidden,false);
  }
  assert.doesNotMatch(source,/\bfetch\s*\(|\bimport\s*\(|XMLHttpRequest|localStorage|sessionStorage|setInterval|createElement/);
});
test('bad route metadata stays on the public page and disables its fallback without network or native imports',()=>{
  for(const text of ['{bad',JSON.stringify({entry:'https://evil.test/run'}),JSON.stringify({entry:entry.replace('index.html','jb.html')})]){
    const calls=[],nodes={'afterglow-public-data':{textContent:text},'afterglow-public-status':{},'afterglow-public-continue':{hidden:false}},window={location:{href:'https://example.test/hosts/ps4/afterglow/',origin:'https://example.test',replace:url=>calls.push(url)}};
    api.install({getElementById:id=>nodes[id]},window);assert.equal(calls.length,0);assert.equal(nodes['afterglow-public-continue'].hidden,true);assert.ok(nodes['afterglow-public-status'].textContent);
  }
});
