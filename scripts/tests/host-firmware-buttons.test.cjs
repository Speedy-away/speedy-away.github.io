'use strict';
// Exercise the real authored dashboard handlers using an inert DOM and transports.
const test=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./host-continuation-dom.cjs');

function pressed(app){return app.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware]').filter(button=>button.getAttribute('aria-pressed')==='true').map(button=>button.getAttribute('data-host-firmware'));}
function saved(app){return JSON.parse(app.storage.get(app.storageKey));}
function noDispatch(app){assert.equal(app.checks.length,0);assert.equal(app.sends.length,0);assert.equal(app.pairs.length,0);assert.equal(app.opened.length,0);assert.equal(app.anchorClicks.length,0);}

test('PS4 console firmware is selected automatically over a stale saved choice without sending anything',()=>{
 const app=fixture({userAgent:'Mozilla/5.0 (PlayStation 4/14.00)'});
 assert.equal(app.ids['host-firmware'].value,'14.00');
 assert.deepEqual(pressed(app),['14.00']);
 assert.equal(saved(app).firmware,'14.00');
 assert.equal(app.ids['host-firmware-status'].textContent,'Browser firmware: 14.00');
 assert.equal(app.ids['host-firmware-source'].textContent,'Firmware selection: console browser');
 noDispatch(app);
});

test('PS5 browser firmware is normalized and selected automatically on its matching host',()=>{
 const app=fixture({platform:'ps5',userAgent:'Mozilla/5.0 (PlayStation; PlayStation 5/013.60.00.00)'});
 assert.equal(app.ids['host-firmware'].value,'13.60');
 assert.deepEqual(pressed(app),['13.60']);
 assert.equal(saved(app).firmware,'13.60');
 assert.equal(app.ids['host-firmware-status'].textContent,'Browser firmware: 13.60');
 noDispatch(app);
});

test('a PS5 browser on the PS4 host does not substitute PS5 firmware or dispatch a payload',()=>{
 const app=fixture({userAgent:'Mozilla/5.0 (PlayStation; PlayStation 5/13.60)'});
 assert.equal(app.ids['host-firmware'].value,'9.00');
 assert.deepEqual(pressed(app),['9.00']);
 assert.equal(app.ids['host-other-console'].hidden,false);
 assert.equal(app.ids['host-other-console'].href,'/hosts/ps5/');
 assert.equal(app.ids['host-loopback'].disabled,true);
 assert.doesNotMatch(app.ids['host-firmware-status'].textContent,/Browser firmware: 13\.60/);
 noDispatch(app);
});

test('PC firmware buttons update a single pressed state, preserve the choice and restore it on the next visit',()=>{
 const storage=new Map(),app=fixture({storage});
 app.selectFirmware('14.00');
 assert.equal(app.ids['host-firmware'].value,'14.00');
 assert.deepEqual(pressed(app),['14.00']);
 assert.equal(saved(app).firmware,'14.00');
 assert.match(app.ids['host-firmware-status'].textContent,/Firmware selection: manual.*14\.00/);
 app.selectFirmware('5.05');
 assert.deepEqual(pressed(app),['5.05']);
 const next=fixture({storage});
 assert.equal(next.ids['host-firmware'].value,'5.05');
 assert.deepEqual(pressed(next),['5.05']);
 assert.match(next.ids['host-firmware-status'].textContent,/saved choice.*5\.05/);
 noDispatch(app);noDispatch(next);
});

test('an unlisted detected firmware gets one selectable button without inventing payload compatibility',()=>{
 const app=fixture({userAgent:'Mozilla/5.0 (PlayStation 4/15.00)',firmwareButtons:['9.00','14.00']});
 assert.equal(app.ids['host-firmware'].value,'15.00');
 assert.deepEqual(pressed(app),['15.00']);
 assert.equal(app.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware="15.00"]').length,1);
 assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-launch]').length,0,'A newly detected firmware does not make a pinned 9.00 payload compatible');
 app.ids['host-detect'].click();
 assert.equal(app.ids['host-firmware-buttons'].querySelectorAll('[data-host-firmware="15.00"]').length,1);
 noDispatch(app);
});

test('Detect console restores actual browser firmware after a manual button selection',()=>{
 const app=fixture({userAgent:'Mozilla/5.0 (PlayStation 4/9.00)'});
 app.selectFirmware('14.00');
 assert.deepEqual(pressed(app),['14.00']);
 app.ids['host-detect'].click();
 assert.deepEqual(pressed(app),['9.00']);
 assert.equal(saved(app).firmware,'9.00');
 assert.equal(app.ids['host-firmware-status'].textContent,'Browser firmware: 9.00');
 noDispatch(app);
});

test('changing firmware with buttons keeps files browseable but refuses a mismatched Load',()=>{
 const app=fixture({fileListView:true});
 app.selectFirmware('14.00');
 const grid=app.ids['host-action-grid'];
 assert.ok(grid.querySelector('[data-download-action]'),'Changing firmware must not lose an exact downloadable file');
 const load=grid.querySelector('[data-launch]');assert.ok(load);
 grid.fire('click',{target:load});
 assert.equal(app.ids['host-support-overlay'].hidden,false);
 assert.match(app.ids['host-support-text'].textContent,/9\.00/);
 noDispatch(app);
});

test('PS4 retains historical firmware choices without advertising the 14.00 launcher for them',()=>{
 const {hostActions}=require('../build-host-selector.cjs');
 const {publicPS4Actions}=require('../host-compact-pages.cjs');
 const actions=publicPS4Actions(hostActions('ps4'));
 const storage=new Map([['whatwhatboy.host.ps4',JSON.stringify({firmware:''})]]);
 const create=()=>fixture({platform:'ps4',actions,storage,initialCategory:'loaders',catalogGrid:true,
  firmwareChoicesOnly:true,firmwareButtons:['5.05','9.00','13.52','14.00']});
 const app=create(),grid=app.ids['host-action-grid'];
 assert.ok(grid.querySelector('.wwb-primary-loader').getAttribute('href').endsWith('/ps4/14.00/'));
 const older=app.ids['host-firmware-buttons'].querySelector('[data-host-firmware="13.52"]');
 assert.equal(older.hidden,false);
 assert.equal(older.disabled,false);
 assert.equal(older.getAttribute('data-host-loader-status'),'unavailable');
 app.selectFirmware('13.52');
 assert.deepEqual(pressed(app),['13.52']);
 assert.match(app.ids['host-empty'].textContent,/No WebKit loader is listed here for PS4 13\.52/);
 assert.equal(grid.querySelector('.wwb-primary-loader,[data-launch]'),null);
 const restored=create();
 assert.deepEqual(pressed(restored),['13.52']);
 assert.equal(restored.ids['host-action-grid'].querySelector('.wwb-primary-loader,[data-launch]'),null);
 app.selectFirmware('14.00');
 assert.ok(grid.querySelector('.wwb-primary-loader').getAttribute('href').endsWith('/ps4/14.00/'));
 noDispatch(app);noDispatch(restored);
});

test('PS5 shows listed unsupported firmware and retains the exact supported shortcut',()=>{
 const actions=require('../build-host-selector.cjs').hostActions('ps5');
 const relapse=actions.find(action=>action.nativeRoute?.kind==='ps5-native');
 const app=fixture({platform:'ps5',actions:[{...relapse,entryURL:'/ps5/relapse/'}],
  initialCategory:'loaders',catalogGrid:true,firmwareChoicesOnly:true,firmwareButtons:['4.00','7.61','13.60']});
 const older=app.ids['host-firmware-buttons'].querySelector('[data-host-firmware="4.00"]'),grid=app.ids['host-action-grid'];
 assert.equal(older.hidden,false);
 assert.equal(older.disabled,false);
 assert.equal(older.getAttribute('data-host-loader-status'),'unavailable');
 app.selectFirmware('4.00');
 assert.deepEqual(pressed(app),['4.00']);
 assert.equal(saved(app).firmware,'4.00');
 assert.match(app.ids['host-firmware-status'].textContent,/4\.00.*No WebKit loader listed/);
 assert.equal(grid.querySelector('.wwb-primary-loader,[data-launch]'),null);
 app.selectFirmware('7.61');
 assert.ok(grid.querySelector('.wwb-primary-loader').getAttribute('href').endsWith('/ps5/7.61/'));
 noDispatch(app);
});
