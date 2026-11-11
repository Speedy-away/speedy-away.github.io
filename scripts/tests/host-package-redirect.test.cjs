'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../../assets/host-package-redirect.js'),'utf8');
function redirect(platform, search='', hash='', prefix='') {
  const link={href:'https://example.org'+prefix+'/hosts/'+platform+'/downloads/?type=packages#downloads'};
  let destination;
  vm.runInNewContext(source,{document:{getElementById:()=>link},window:{location:{search,hash,replace:url=>{destination=url;}}}});
  assert.equal(link.href,destination);
  return new URL(destination);
}
test('legacy package bookmarks open the merged PKG filter and preserve exact file selections',()=>{
  for(const platform of ['ps4','ps5']){
    const url=redirect(platform,'?file=exact%2Bpkg&unused=1','#packages');
    assert.equal(url.pathname,'/hosts/'+platform+'/downloads/');
    assert.equal(url.searchParams.get('type'),'packages');
    assert.equal(url.searchParams.get('file'),'exact+pkg');
    assert.equal(url.searchParams.has('unused'),false);
    assert.equal(url.hash,'#downloads');
  }
});
test('legacy setup links open the retained installer help with the published path unchanged',()=>{
  for(const hash of ['#setup','#workflow']){
    const url=redirect('ps4','?id=package-id',hash,'/WWB-HOST');
    assert.equal(url.pathname,'/WWB-HOST/hosts/ps4/downloads/');
    assert.equal(url.hash,'#package-setup');
    assert.equal(url.searchParams.get('file'),'package-id');
  }
});
test('a broken exact-file bookmark stays unavailable instead of dropping its selection',()=>{
  assert.equal(redirect('ps5','?file=%zz').searchParams.get('file'),'unavailable');
});
