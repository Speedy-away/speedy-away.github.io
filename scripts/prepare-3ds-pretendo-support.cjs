const fs=require('node:fs');
const sources={
 community:'https://wiki.pretendo.zip/game-support-status',
 april:'https://forum.pretendo.network/t/announcement-2026-04-02-games-released-to-public/27434',
 december:'https://forum.pretendo.network/t/service-update-2025-12-08-acnl-game-servers-more/25381',
 may:'https://forum.pretendo.network/t/animal-crossing-new-leaf-available-to-everyone-more/16460',
 pokemon:'https://forum.pretendo.network/t/pokemon-y-online-servers/29077',
 maintenance:'https://forum.pretendo.network/t/update-on-july-maintenance/29218',
 official:'https://pretendo.network/'
};
const rows=[
 ['Mario Kart 7','public','Races; rankings/ghosts incomplete.','community',true],
 ['Animal Crossing: New Leaf','public','Current Nimbus required; Dream Suite unavailable.','december',true],
 ['Kid Icarus: Uprising','public','Listed for public play.','community',false],
 ['Luigi’s Mansion 2 / Dark Moon','public','Public access announced December 2025.','december',false],
 ['Super Street Fighter IV: 3D Edition','public','Public access announced December 2025.','december',false],
 ['Monster Hunter 4 / 4G / 4 Ultimate','public','Multiplayer; DLC is a separate service.','april',true],
 ['Monster Hunter Generations / X','public','Multiplayer; DLC support differs.','april',true],
 ['Monster Hunter Stories','public','Public access announced April 2026.','april',false],
 ['Super Smash Bros. for Nintendo 3DS','public','Battles; Spectate/Share incomplete.','community',true],
 ['The Legend of Zelda: Tri Force Heroes','public','Online play; friend-room limits remain.','may',true],
 ['Steel Diver: Sub Wars','public','Listed for public play.','community',false],
 ['IRONFALL: Invasion','public','Listed for public play.','community',false],
 ['Yo-kai Watch 2','public','Online play; rankings incomplete.','may',true],
 ['Yo-kai Watch Blasters','public','Regional matchmaking restrictions apply.','community',true],
 ['Dr. Mario: Miracle Cure','public','Public online play announced May 2025.','may',false],
 ['Super Mario Maker for Nintendo 3DS','public','100 Mario Challenge; browsing unreliable.','community',true],
 ['Team Kirby Clash Deluxe','public','Listed public; SpotPass unavailable.','community',true],
 ['Pokémon Rumble World','public','Listed public; SpotPass unavailable.','community',true],
 ['Pokémon X / Y','tester','PSS trading/battles require tester access.','pokemon',true],
 ['Pokémon Omega Ruby / Alpha Sapphire','tester','PSS trading/battles require tester access.','pokemon',true],
 ['Monster Hunter XX','tester','Tester access; patch compatibility matters.','community',true],
 ['F1 2011','tester','Tester channel announced December 2025.','december',true],
 ['Metroid Prime: Federation Force / Blast Ball','tester','Tester channel; Blast Ball scope.','december',true],
 ['Ice Station Z','tester','Lobbies/chat; limitations remain.','community',true],
 ['Resident Evil: The Mercenaries 3D','tester','Listed tester-only.','community',true],
 ['Puyo Puyo Tetris','tester','Listed tester-only; further testing needed.','community',true],
 ['Resident Evil: Revelations','development','Not a confirmed public release.','community',true],
 ['RPG Maker Fes','development','Listed in development.','community',true],
 ['Pokémon Sun / Moon / Ultra Sun / Ultra Moon','unconfirmed','No public support confirmed here.','community',true]
];
const raw=fs.readFileSync('tmp/3ds-more/batch4/wiki.txt','utf8');
if(!raw.includes('==== Nintendo 3DS ====')||!raw.includes('Monster Hunter 4 Ultimate'))throw Error('Current community-source capture missing');
const aliases={'Mario Kart 7':'mk7','Animal Crossing: New Leaf':'acnl welcome amiibo','Monster Hunter 4 / 4G / 4 Ultimate':'mh4 mh4g mh4u','Monster Hunter Generations / X':'mhgen mhx','Monster Hunter XX':'mhxx double cross','Pokémon X / Y':'pokemon xy pss trading battles','Pokémon Omega Ruby / Alpha Sapphire':'pokemon oras pss trading battles','The Legend of Zelda: Tri Force Heroes':'triforce zelda','Super Smash Bros. for Nintendo 3DS':'smash3ds ssb4'};
const document={schemaVersion:1,checkedAt:new Date().toISOString(),checkedDate:'2026-11-02',title:'3DS Pretendo game-support snapshot',sources,method:'Current maintainer/community status export checked against original Pretendo release announcements and support posts where available. Public describes announced/listed access, not a physical-console test or live uptime guarantee. Source-specific limitations remain visible.',maintenanceNotice:raw.includes('Some games are unavailable after the maintenance period'),games:rows.map(([game,access,notes,source,partial])=>({game,access,notes,aliases:aliases[game]||'',sourceUrl:sources[source],evidence:source==='community'?'Community status listing':'Official Pretendo announcement/support',featureSource:partial?sources.community:undefined,partial,checkedDate:'2026-11-02'}))};
fs.writeFileSync('docs/3ds-pretendo-game-support.json',JSON.stringify(document,null,2)+'\n');console.log({games:document.games.length,public:document.games.filter(g=>g.access==='public').length,tester:document.games.filter(g=>g.access==='tester').length});
