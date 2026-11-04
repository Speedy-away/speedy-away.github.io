const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const data=require('../../docs/original-xbox-online.json');
const {matches}=require('../../assets/original-xbox-online.js');
const find=(query,mode)=>data.games.filter(game=>matches(game,query,mode)).map(game=>game.id);
test('Xbox online filters keep LAN co-op separate from versus and per-console counts',()=>{
 assert.deepEqual(find(' Halo ','all'),['halo-ce','halo-2']);
 assert.deepEqual(find('Halo','coop'),[]);
 assert.deepEqual(find('doom','coop'),['doom-3']);
 assert.deepEqual(find('doom','shared'),[]);
 assert.deepEqual(find('','coop'),['doom-3','brute-force','chaos-theory','rainbow-six-3']);
 assert.equal(find('','all').length,10);
 assert.equal(find('does not exist','all').length,0);
 assert.equal(data.games.find(game=>game.id==='halo-ce').crossRegion,false);
 assert.equal(data.games.find(game=>game.id==='doom-3').coop,2);
});
test('Xbox online guide is linked, indexed and has safe unique game anchors',()=>{
 const root=path.resolve(__dirname,'../..');
 const html=fs.readFileSync(path.join(root,'console/retro/xbox-online.html'),'utf8');
 const hub=fs.readFileSync(path.join(root,'console/retro/xbox.html'),'utf8');
 for(const game of data.games){assert.ok(html.includes('id="game-'+game.id+'"'));if(game.insignia)assert.ok(html.includes(game.insignia));}
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(ids.length,new Set(ids).size);
 for(const id of ['routes','insignia','kai','local','modes','games','help'])assert.ok(ids.includes(id));
 assert.ok(hub.includes('/console/retro/xbox-online.html'));
 assert.ok(fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').includes('https://whatwhatboy.com/console/retro/xbox-online.html'));
 assert.ok(html.includes('/assets/original-xbox-online.js'));
 assert.ok(!/<(?:video|iframe|object|embed)\b/.test(html));
 assert.ok(!/F:[\\/]|private-inventory/.test(html));
});
