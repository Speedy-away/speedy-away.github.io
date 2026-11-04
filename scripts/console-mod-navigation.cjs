// Presentation groups never infer supported games from a menu-family name.
const gameImages={
 'gta-v':'/assets/images/gta52.png', 'gta-iv':'/assets/images/gta4.png',
 'world-at-war':'/assets/images/game-card-covers/cod-world-at-war-official-v1.jpg',
 'gta-san-andreas':'/assets/images/game-card-covers/gta-san-andreas-official-v1.jpg',
 'quantum-of-solace':'/assets/images/game-card-covers/quantum-of-solace-official-v1.jpg',
 'left-4-dead-2':'/assets/images/game-card-covers/left-4-dead-2-official-v1.jpg',
 'red-dead-redemption':'/assets/images/game-patches/red-dead-redemption-official.jpg',
 'red-dead-redemption-undead-nightmare':'/assets/images/game-patches/red-dead-redemption-official.jpg',
 'dead-island':'/assets/images/game-card-covers/dead-island-official-v1.jpg',
 'dead-island-riptide':'/assets/images/game-card-covers/dead-island-riptide-official-v1.jpg',
 'dead-rising-2':'/assets/images/game-card-covers/dead-rising-2-official-v1.jpg',
 'skate-3':'/assets/images/game-card-covers/skate-3-official-v1.jpg',
 'uncharted':'/assets/images/game-card-covers/uncharted-1-official-v1.jpg',
 'uncharted-1':'/assets/images/game-card-covers/uncharted-1-official-v1.jpg',
 'uncharted-2':'/assets/images/game-card-covers/uncharted-2-official-v1.jpg',
 'uncharted-3':'/assets/images/game-card-covers/uncharted-3-official-v1.jpg'
};
function applyGameImages(games){return games.map(game=>({...game,image:game.id==='world-at-war'&&game.image?.includes('ps3-mods/waw-official-cover')?game.image:gameImages[game.id]||game.image}));}
function xbox(data){
 const base='/console/xbox360/mods/';
 const games=applyGameImages(data.games).map(g=>g.id==='tools'?{...g,title:'Mod tools',image:'/assets/images/merged-categories/category-apps-v1.png'}:g.id==='multicod'?{...g,image:'/assets/images/covers/cod-black-ops-2.jpg'}:g);
 const stealth={id:'stealth-servers',title:'Stealth servers',page:base+'stealth-servers/index.html',image:'/assets/images/merged-categories/category-network-v1.png',kind:'tools'};
 if(!games.some(g=>g.id===stealth.id))games.push(stealth);
 const resources=data.resources.map(item=>/^discord-xbox360-stealth-/.test(item.id)?{...item,gameId:stealth.id}:item);
 const cod={id:'call-of-duty',title:'Call of Duty',page:base+'call-of-duty/index.html',image:'/assets/images/covers/cod-black-ops-2.jpg',kind:'collection',summary:'Choose a Call of Duty game for its mod menus and supported builds.'};
 const multi={id:'multi-game-tools',title:'Multi-game tools & mod menus',page:base+'multi-game-tools/index.html',image:'/assets/images/merged-categories/category-mods-v1.png',kind:'collection',summary:'Myten and multi-game collections, with a separate page for each family.'};
 const myten={id:'myten',title:'Myten',page:base+'multi-game-tools/myten/index.html',image:'/assets/images/menu-previews/xbox360/mw2-campaign-myten-v12-source.jpg',kind:'collection',summary:'Myten versions, downloads and their documented supported games.'};
 const codGames=games.filter(g=>g.page.includes('/call-of-duty/'));
 const overview=[games.find(g=>g.id==='gta-v'),cod,games.find(g=>g.id==='gta-iv'),...games.filter(g=>g.kind==='game'&&!g.page.includes('/call-of-duty/')&&!['gta-v','gta-iv'].includes(g.id)),stealth,multi,games.find(g=>g.id==='tools')].filter(Boolean);
 return {games,resources,cod,codGames,multi,myten,overview};
}
module.exports={applyGameImages,xbox};
