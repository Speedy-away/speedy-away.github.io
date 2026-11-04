const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ui = require('../../assets/host-dashboard.js');
const root = path.resolve(__dirname, '../..');
const ps4 = require('../../docs/host-actions-ps4.json').actions;
const games = require('../../docs/host-game-actions.json').actions;

test('firmware matching preserves exact compatibility and never fills whitelist gaps', () => {
  const loader = {firmwares:['9.00','11.00','13.52']};
  assert.equal(ui.firmwareMatches(loader,'9.00'),true);
  assert.equal(ui.firmwareMatches(loader,'9.03'),false);
  assert.equal(ui.firmwareMatches(loader,'13.50'),false);
  assert.equal(ui.firmwareMatches(loader,'14.00'),false);
  assert.equal(ui.firmwareMatches(loader,'bogus'),false);
  assert.equal(ui.firmwareMatches({firmwares:['5.05–6.72']},'6.72'),true);
  assert.equal(ui.firmwareMatches({firmwares:['5.05–6.72']},'7.00'),false);
  assert.equal(ui.firmwareLabel({firmwares:[]}), 'See requirements');
  assert.match(ui.firmwareLabel({firmwares:['9.00','9.50','11.00','13.52']}), /4 listed versions/);
});

test('console firmware detection uses the matching console browser identifier', () => {
  const ua = 'Mozilla/5.0 (PlayStation 4 9.00) AppleWebKit/605.1';
  assert.equal(ui.browserFirmware(ua,'ps4'),'9.00');
  assert.equal(ui.browserFirmware(ua,'ps5'),'');
  assert.equal(ui.browserFirmware('Mozilla/5.0 Windows NT 10.0','ps4'),'');
  assert.equal(ui.browserFirmware('PlayStation 5/13.60.00','ps5'),'13.60');
  assert.equal(ui.browserFirmware('Mozilla/5.0 (Playstation; Playstation 4/9.00)','ps4'),'9.00');
  assert.equal(ui.browserFirmware('Mozilla/5.0 (PlayStation; PlayStation 5/07.61.00.00)','ps5'),'7.61');
  assert.equal(ui.browserFirmware('PlayStation 4 9.0','ps4'),'9.00');
  assert.deepEqual(ui.detectBrowser('Mozilla/5.0 (PlayStation; PlayStation 5/13.60)'),{platform:'ps5',firmware:'13.60',device:'PS5',source:'Console browser'});
  assert.equal(ui.detectBrowser('Mozilla Android Mobile').platform,'');
  assert.equal(ui.detectBrowser('Mozilla Android Mobile').firmware,'');
  assert.equal(ui.detectBrowser('Mozilla Windows NT 10.0').firmware,'');
});

test('newer GTA plugin builds are the default and old BIN menus remain explicitly accessible', () => {
  const rows = [
    {label:'Older BIN',category:'mods',game:'GTA V',gameVersion:'1.33',legacy:true},
    {label:'Plugin',category:'mods',game:'GTA V',gameVersion:'1.56'},
    {label:'Newer plugin',category:'mods',game:'GTA V',gameVersion:'1.57'}
  ];
  assert.deepEqual(ui.filterActions(rows,'mods','','','GTA V').map(a=>a.gameVersion),['1.57','1.56']);
  assert.deepEqual(ui.filterActions(rows,'mods','','','GTA V',true).map(a=>a.gameVersion),['1.57','1.56','1.33']);
  assert.ok(ui.compareGameVersions({gameVersion:'01.010.002'},{gameVersion:'01.000.000'}) < 0);
});

test('Run requires a selected firmware even when upstream provides no complete matrix', () => {
  assert.equal(ui.requiresFirmware({run:{type:'elf-http'},firmwares:[]}),true);
  assert.equal(ui.requiresFirmware({category:'loaders',launchURL:'https://example.test/'}),true);
  assert.equal(ui.requiresFirmware({category:'tools',launchURL:'http://{address}:8084/'}),false);
  assert.equal(ui.requiresFirmware({downloadURL:'/downloads/file.elf'}),false);
});

test('game filters retain the exact game update and separate PS4 from PS5 data', () => {
  const entries = games.filter(a => a.platform === 'ps4');
  const rdr = ui.filterActions(entries,'mods','9.00','1.29','RDR2');
  assert.ok(rdr.length);
  assert.ok(rdr.every(a => a.game === 'RDR2' && a.gameVersion === '1.29'));
  assert.equal(ui.filterActions(entries,'mods','13.52','','GTA V').length,0);
  assert.equal(ui.filterActions(ps4,'loaders','14.00','').length,0);
});

test('unsafe launch URLs and blank values do not become actionable links', () => {
  for (const value of ['', ' ', 'javascript:alert(1)', 'file:/data/test.elf', 'http://user:password@192.168.1.2']) assert.equal(ui.safeURL(value,'https://whatwhatboy.com/hosts/ps4/'),'');
  assert.equal(ui.safeURL('/downloads/test.elf','https://whatwhatboy.com/hosts/ps4/'),'https://whatwhatboy.com/downloads/test.elf');
});

test('console saving uses each platform native receiver and rejects arbitrary destinations', () => {
  const normalize = require('../../assets/host-console-client.js').normalizeAddress;
  assert.equal(ui.consoleDownloadURL('ps4','192.168.1.2','ps4-file',normalize),'http://192.168.1.2:6701/data/whatsite-ps4.html?file=ps4-file');
  assert.equal(ui.consoleDownloadURL('ps5','ps5.local','gta5-ps5-04264',normalize),'http://ps5.local:6701/whatsite-ps5.html?file=gta5-ps5-04264');
  assert.throws(()=>ui.consoleDownloadURL('ps3','ps5','valid',normalize));
  assert.throws(()=>ui.consoleDownloadURL('ps5','8.8.8.8','valid',normalize));
  assert.throws(()=>ui.consoleDownloadURL('ps5','ps5','../file',normalize));
});

test('a desktop cannot mistake its own loopback service for a console', () => {
  const normalize = require('../../assets/host-console-client.js').normalizeAddress;
  const desktop = ui.detectBrowser('Mozilla Windows NT 10.0');
  for (const platform of ['ps4','ps5']) {
    for (const address of ['127.0.0.1','127.1.2.3','localhost']) assert.throws(()=>ui.targetAddress(address,platform,desktop,normalize),/LAN address/);
    assert.equal(ui.targetAddress('192.168.1.50',platform,desktop,normalize),'192.168.1.50');
  }
  const ps5 = ui.detectBrowser('PlayStation 5/13.60');
  assert.equal(ui.targetAddress('127.0.0.1','ps5',ps5,normalize),'127.0.0.1');
  assert.throws(()=>ui.targetAddress('127.0.0.1','ps4',ps5,normalize),/LAN address/);
});

test('native manager screens use documented PS5 hash routes, never a fabricated web API', () => {
  const normalize = require('../../assets/host-console-client.js').normalizeAddress;
  for (const screen of ['','autoload','storage','sources','processes','settings']) assert.equal(ui.managerURL('ps5.local',screen,normalize),'http://ps5.local:8084/#/'+screen);
  assert.throws(()=>ui.managerURL('ps5.local','manage:delete',normalize));
  assert.throws(()=>ui.managerURL('https://example.test','autoload',normalize));
  assert.equal(ui.actionImage({image:'/assets/images/menu.png'}),'/assets/images/menu.png');
  for (const value of ['https://example.test/image.jpg','/assets/images/../file.png','javascript:x']) assert.equal(ui.actionImage({image:value}),'');
});

test('dedicated manager pages keep console scopes and native autoload controls separate', () => {
  for (const platform of ['ps4','ps5']) {
    const html = fs.readFileSync(path.join(root,'hosts',platform,'payload-manager/index.html'),'utf8');
    assert.ok(html.includes('Connect to your '+platform.toUpperCase()));
    assert.ok(html.includes('data-open-workspace="payloads"'));
    assert.ok(html.includes('data-open-workspace="autoload"'));
    assert.ok(!html.includes('id="host-action-grid"'));
    assert.ok(!html.includes('class="host-tools-grid"'));
    if (platform === 'ps5') { assert.ok(html.includes('data-manager-route="autoload"')); assert.ok(html.includes('id="host-load-manager"')); }
    else { assert.ok(html.includes('PayLoader LaunchPad')); assert.ok(!html.includes('id="host-load-manager"')); }
  }
});

test('generated dashboards have selectors, separate catalogues and immutable ready-file links', () => {
  for (const platform of ['ps4','ps5']) {
    const html = fs.readFileSync(path.join(root,'hosts',platform,'index.html'),'utf8');
    for (const id of ['host-console-address','host-firmware','host-game','host-download-on-run','host-actions-data','host-detect','host-check-services','host-show-legacy']) assert.ok(html.includes('id="'+id+'"'), id);
    const data = JSON.parse(html.match(/<script id="host-actions-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(data.platform,platform);
    assert.ok(data.actions.length);
    assert.ok(data.actions.every(a => a.platform === platform));
    assert.ok(html.includes('data-host-firmware="13.52"') || platform === 'ps5');
    if (platform === 'ps4') { assert.ok(html.includes('data-host-firmware="14.00"')); assert.ok(html.includes('id="host-firmware-note"')); }
    for (const action of data.actions.filter(a => a.run && a.downloadURL)) {
      if (action.run.input === 'user-file') {
        assert.equal(action.platform,'ps4');assert.equal(action.format,'BIN');assert.equal(action.publicMirror,false);
        assert.match(action.sha256,/^[a-f0-9]{64}$/);assert.ok(action.bytes>0&&action.bytes<=0x300000);
        const original=new URL(action.downloadURL);
        assert.equal(original.protocol,'https:');
        assert.ok(original.hostname==='github.com'&&original.pathname.includes('/releases/download/')||original.hostname==='raw.githubusercontent.com'&&/\/[a-f0-9]{40}\//.test(original.pathname));
        const advertised=require('../console-payload-bridge.cjs').availability(action,root);
        assert.equal(advertised.available,true);assert.equal(advertised.requiresFile,true);
        continue;
      }
      assert.match(action.downloadURL,/^\/downloads\//);
      assert.ok(fs.existsSync(path.join(root,action.downloadURL)));
      assert.match(action.sha256,/^[a-f0-9]{64}$/);
    }
  }
});
