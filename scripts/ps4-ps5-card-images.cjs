// Image-only repair helpers. Artwork never changes a build's compatibility.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.existsSync(path.join(root,file))?JSON.parse(fs.readFileSync(path.join(root,file),'utf8')):{};
const exists=image=>typeof image==='string'&&image.startsWith('/assets/images/')&&fs.existsSync(path.join(root,'.'+image));
const norm=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const games=[...read('docs/ps4-ps5-game-resources.json').games||[],...read('docs/ps4-ps5-cod-resources.json').games||[]];
const resources=[...read('docs/ps4-ps5-game-resources.json').resources||[],...read('docs/ps4-ps5-cod-resources.json').resources||[],...(read('docs/ps4-bo3-resources.json').resources||[]).map(item=>({...item,id:'bo3-'+item.id,gameIds:['black-ops-3']}))];
const ps5={
 'the-last-of-us-part-ii-remastered':'/assets/images/host-trainers/the-last-of-us-part-ii-remastered-f1c0691e29a5.jpg',
 'dragons-dogma-2':'/assets/images/host-trainers/dragons-dogma-2-4474b5997a4b.jpg',
 'silent-hill-2':'/assets/images/host-trainers/silent-hill-2-7e0743d7eb02.jpg',
 'astro-bot':'/assets/images/host-trainers/astro-bot-19e37c8f055d.jpg',
 'black-myth-wukong':'/assets/images/host-trainers/black-myth-wukong-61095f57d8d6.jpg',
 'ghostrunner-2':'/assets/images/host-trainers/ghostrunner-2-0c6aa18bed2d.jpg',
 'demons-souls':'/assets/images/game-patches/demons-souls-official.jpg',
 'lies-of-p':'/assets/images/game-patches/lies-of-p-official.jpg',
 'gta-v':'/assets/images/gta52.png',
 'marvel-s-spider-man-miles-morales':'/assets/images/game-patches/marvel-s-spider-man-miles-morales-official.jpg',
 'sonic-frontiers':'/assets/images/game-patches/sonic-frontiers-official.jpg',
 ...Object.fromEntries((read('docs/ps5-game-card-artwork.json').records||[]).map(r=>[r.id,r.file]))
};
function gameImage(id,title){if(['gta5','gta-v'].includes(id)||norm(title)==='grandtheftautov')return '/assets/images/gta52.png';if(id==='rdr2')return '/assets/images/rdr2.png';const game=games.find(g=>g.id===id)||games.find(g=>norm(g.title)===norm(title));return exists(game?.cover)?game.cover:Object.entries(ps5).find(([key])=>norm(key)===norm(id)||norm(key)===norm(title))?.[1]||null;}
function resourceImage(item){
 const own=(item.images||[]).find(i=>i.role!=='guide'&&(exists(i.display)||exists(i.original)));
 if(own)return {src:exists(own.display)?own.display:own.original,alt:own.caption||item.name,kind:'source'};
 const known=resources.find(r=>r.id===item.id);
 const image=gameImage(item.gameIds?.[0]||known?.gameIds?.[0]);
 return image?{src:image,alt:(games.find(g=>g.id===(item.gameIds?.[0]||known?.gameIds?.[0]))?.title||item.name)+' artwork',kind:'artwork'}:null;
}
const h=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function markup(image){return image?`<img src="${h(image.src)}" alt="${h(image.alt)}" loading="lazy" decoding="async" data-card-image="${image.kind}">`:'';}
module.exports={games,resources,ps5,gameImage,resourceImage,markup,exists,norm};
