const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
function build() {
 const ui=require('./build-console-guides.cjs');
 const { page, section, grid, note, steps, ext, link, sourceList, esc } = ui;
 const resource=(title,description,actions,image)=>ui.resource(title,description,actions,image).replace(/(<article\b[^>]*>)/,'$1'+(!image?require('./console-rest-card-images.cjs').markup('console/retro/xbox-online.html',title):''));
 const data = JSON.parse(fs.readFileSync(path.join(root, 'docs/original-xbox-online.json'), 'utf8'));
 const s = data.sources;
 const cards = data.games.map(game => resource(esc(game.title),
  `System Link · Versus ${game.versus} · Co-op ${game.coop || '—'}`,
  `<p>Up to ${game.perConsole} per console · PAL/NTSC together: ${game.crossRegion ? 'yes' : 'no'}</p>` +
  ext(s.kaiGames, 'System Link reference') + (game.insignia ? ext(game.insignia, 'Insignia game page') : '')
 ).replace('<article ', `<article id="game-${game.id}" data-xbox-game="${esc(JSON.stringify(game))}" `));
 const content = section('routes', 'Choose how to play', grid(
  resource('Xbox Live → Insignia', 'Use the Xbox Live menu in supported original Xbox games through this free community service.', link('#insignia', 'Connect with Insignia')),
  resource('System Link → XLink Kai', 'Play LAN modes across the internet through a computer running Kai. Original Xbox console modification is not required.', link('#kai', 'Use System Link online')),
  resource('Local System Link', 'Connect Xbox consoles on your local network and choose the game’s System Link menu.', link('#local', 'Plan a LAN game')),
  resource('Same-console multiplayer', 'Use one console and multiple controllers. Split-screen, shared-screen and local campaign support depend on the game.', link('#modes', 'Understand game modes'))
 ), 'Original Xbox only. Xbox 360 and Xbox One/Series have separate service and game compatibility requirements.') +
 section('insignia', 'Connect to Insignia', steps([
  ['Prepare the console', 'The official guide requires retail dashboard D:1.00.5960.01. Choose its stock or modded setup route; stock setup uses a compatible USB device and adapter.'],
  ['Register your Xbox', 'Follow the official Setup Assistant instructions for your configuration, then run the dashboard connection test. A zeroed HDD key and some older Xbox Live-blocking modifications need attention first.'],
  ['Create your account', 'Request the free subscription code from Insignia and follow its dashboard signup guide. Use the guide’s dummy billing details, not real payment information.'],
  ['Choose a supported game', 'Check Insignia’s current game page for features, updates and limitations before opening Xbox Live in the game. Service support does not imply every original game mode is available.']
 ]) + `<div class="guide-links">${ext(s.insignia, 'Official written connection guide')}${ext(s.insigniaGames, 'Supported games & features')}</div>`) +
 section('kai', 'Take System Link online', steps([
  ['Prepare Kai', 'Create an XTag account and follow Team XLink’s computer and console setup instructions. Prefer wired Ethernet.'],
  ['Join the same game arena', 'Use the original Xbox arena for your exact title. Start the game’s System Link session and have the other players search there.'],
  ['Check the game requirements', 'Match compatible game regions and updates. Use the supported-game reference for player limits and game-specific restrictions.']
 ]) + `<div class="guide-links">${ext(s.kai, 'Team XLink setup & account')}${ext(s.kaiGames, 'Original Xbox game reference')}${ext(s.kaiSetup, 'Console setup wiki')}</div>` +
 note('<p>The detailed Kai setup wiki returned a temporary maintenance notice during this review. The main site and game reference were available; retry the official guide if it remains unavailable.</p>')) +
 section('local', 'Plan a local multiplayer session', note('<p>For a LAN session, give each console a compatible copy of the game, connect the consoles to the same local network, and use System Link to host and join. For one-console play, check the game’s local multiplayer menu and controller limit. A network player limit is not a promise that that many players can share one Xbox.</p>')) +
 section('modes', 'Game modes explained', grid(
  resource('Versus / PvP', 'Players compete against each other. A team mode still counts as versus; working together against other people is different from campaign co-op.', link('#games', 'Browse versus games')),
  resource('Co-op / PvE', 'Players work together against the game. Network co-op and local campaign co-op are separate capabilities.', link('#games', 'Find System Link co-op')),
  resource('Split-screen / shared console', 'Several controllers use one Xbox. The cards below show the source’s per-console System Link maximum, not a separate local campaign rating.', link('#games', 'Find shared-console LAN games')),
  resource('Matchmaking / private games', 'Matchmaking finds opponents; private sessions let you arrange a group. Playlist and lobby availability depend on the service and game.', ext(s.halo2, 'Halo 2 live playlists'))
 )) + section('halo-playlists', 'Halo 2: pick a playlist', grid(
  resource('Rumble Pit', 'Free-for-all, unranked · 4–8 players.', ext(s.halo2, 'Current playlists')),
  resource('Double Team', 'Ranked 2v2 · 4 players.', ext(s.halo2, 'Current playlists')),
  resource('Team Slayer', 'Ranked team combat · 6–8 players.', ext(s.halo2, 'Current playlists')),
  resource('Big Team Battle', 'Unranked · 12–16 players · guests allowed.', ext(s.halo2, 'Current playlists'))
 ), 'Playlist details were checked on '+data.reviewedAt+'. Follow the live page for current rotations and restrictions.') +
 section('games', 'Find a game & mode', `<div class="xbox-online-filters"><label for="xbox-game-search">Game name<input type="search" id="xbox-game-search" placeholder="Halo, Forza, Doom…"></label><label for="xbox-game-mode">System Link mode<select id="xbox-game-mode"><option value="all">All modes</option><option value="versus">Versus</option><option value="coop">Co-op</option><option value="shared">Multiple players per console</option></select></label><button type="button" id="xbox-game-reset">Reset</button></div><p id="xbox-game-count" role="status" aria-live="polite">${cards.length} games</p><p id="xbox-game-empty" hidden>No games match. Try another name or reset the filters.</p>` + grid(...cards) +
 note('<p>All player counts above describe System Link, using Team XLink’s reference. “—” means no System Link co-op is listed; it does not rule out local co-op. Insignia links are included for three individually checked titles; their absence is not an unsupported-game verdict. Check the full service catalogue.</p>')) +
 section('help', 'Connection checklist', grid(
  resource('Xbox Live login fails', 'Use Insignia’s connection test and Assistant troubleshooting. Recheck its current DNS instructions and whether your existing mod blocks Xbox Live.', ext(s.insignia, 'Insignia troubleshooting')),
  resource('No System Link lobby', 'Confirm everyone selected the same title, compatible region/update and Kai arena. Check the computer/console network setup before changing game files.', ext(s.kai, 'Team XLink help')),
  resource('Co-op option missing', 'Check whether the intended mode is local, System Link or Xbox Live. A versus lobby does not add network campaign support.', link('#games', 'Check game mode limits')),
  resource('Different Xbox generation', 'Use the guide for your actual console and game version.', link('/console/xbox360/', 'Xbox 360 hub') + link('/console/retro/xbox.html', 'Original Xbox homebrew'))
 )) + section('sources', 'Official references', sourceList([[s.insignia,'Insignia connection requirements'],[s.insigniaGames,'Insignia service catalogue'],[s.kai,'Team XLink service'],[s.kaiGames,'Team XLink original Xbox mode matrix'],[s.halo2,'Halo 2 current playlists']]) + note('<p>Reviewed '+data.reviewedAt+'. This is a service and game-mode guide; it adds no downloadable builds. Existing homebrew downloads and archived versions remain on the original Xbox hub. Physical console connections have not been tested here.</p>'));
 const route = 'console/retro/xbox-online.html';
 page(route,'Original Xbox Live & Online','Insignia, XLink Kai, System Link and local multiplayer, with searchable original Xbox versus/co-op player limits and Halo 2 playlists.','/assets/images/consoles/xbox.jpg',[[ '/console/retro/xbox.html','Xbox homebrew'],['#routes','Online routes'],['#modes','Game modes'],['#games','Find a game'],['#help','Connection help']],content,'#routes','Choose how to play');
 const target = path.join(root,route);
 let html = fs.readFileSync(target,'utf8');
 html = html.replace('</head>','<style>.xbox-online-filters{display:flex;flex-wrap:wrap;gap:1rem;align-items:end;margin-bottom:1rem}.xbox-online-filters label{display:grid;gap:.5rem;flex:1 1 220px;min-width:0}.xbox-online-filters input,.xbox-online-filters select,.xbox-online-filters button{font:inherit;padding:.8rem;background:#151a22;color:#fff;border:1px solid #697480;border-radius:6px;max-width:100%;min-width:0}.xbox-online-filters button{cursor:pointer}.guide-resource[hidden],#xbox-game-empty[hidden]{display:none!important}</style></head>').replace('</body>','<script src="/assets/original-xbox-online.js" defer></script></body>');
 fs.writeFileSync(target,require('./apply-site-background.cjs').improve(html,route));
 require('./add-sitemap-pages.cjs').addSitemapPages([route]);
 console.log('Built original Xbox online guide with '+cards.length+' game-mode cards.');
}
module.exports={build};if(require.main===module)build();
