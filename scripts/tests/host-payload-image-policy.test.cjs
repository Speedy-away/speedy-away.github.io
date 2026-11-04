'use strict';
// Render only authored dashboard controls in the inert DOM fixture. No transport
// or console-native code is executed by these presentation checks.
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./host-continuation-dom.cjs');
const {hostActions}=require('../build-host-selector.cjs');

test('PS4 and PS5 payload tiles and version popups omit image markup',()=>{
  for(const platform of ['ps4','ps5']){
    const actions=hostActions(platform).filter(a=>a.category==='payloads');
    assert.ok(actions.length>0,platform);
    const app=fixture({platform,actions,catalogGrid:true,initialCategory:'payloads'});
    assert.doesNotMatch(app.ids['host-action-grid'].innerHTML,/<img\b|host-catalog-tile__media/);
    app.openMenu();
    assert.doesNotMatch(app.ids['host-version-detail'].innerHTML,/<img\b|<figure\b|host-action-with-art/);
    assert.equal(app.sends.length,0);
    assert.equal(app.opened.length,0);
  }
});

test('GoldHEN and game-mod artwork remains available while payload art is omitted',()=>{
  const goldhen=hostActions('ps4').filter(a=>a.category==='goldhen');
  const gold=fixture({actions:goldhen,catalogGrid:true,initialCategory:'goldhen'});
  assert.match(gold.ids['host-action-grid'].innerHTML,/<img\b/);
  gold.openMenu();
  assert.match(gold.ids['host-version-detail'].innerHTML,/Choose your PS4 firmware/);
  const choices=gold.ids['host-version-choices'],firmware=choices.querySelector('[data-goldhen-firmware="9.00"]');assert.ok(firmware);choices.fire('click',{target:firmware});
  assert.match(gold.ids['host-version-detail'].innerHTML,/<img\b/);

  const mod=hostActions('ps4').find(a=>a.category==='mods'&&a.game&&a.gameVersion);
  assert.ok(mod);
  const game=fixture({actions:[mod],catalogGrid:true,initialCategory:'mods'});
  const grid=game.ids['host-action-grid'];
  assert.match(grid.innerHTML,/<img\b/);
  grid.fire('click',{target:grid.querySelector('[data-catalog-game]')});
  grid.fire('click',{target:grid.querySelector('[data-catalog-update]')});
  game.openMenu();
  assert.match(game.ids['host-version-detail'].innerHTML,/<img\b/);
  assert.equal(game.sends.length,0);
  assert.equal(gold.sends.length,0);
});
