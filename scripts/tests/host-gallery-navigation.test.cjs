'use strict';
// Exercise authored navigation/guards only; never contact a console or run a file.
const test=require('node:test'),assert=require('node:assert/strict');
const {fixture}=require('./host-continuation-dom.cjs');
const menu=(id,game,update,extra={})=>({id,label:id,menuFamily:'Cyprus',platform:'ps4',category:'mods',game,gameVersion:update,menuVersion:'2.0',firmwares:['9.00'],format:'BIN',downloadURL:'/downloads/fixture/'+id+'.bin',consoleFileId:'file-'+id,run:{type:'goldhen-http',port:9090},requirements:['Match the exact update.'],...extra});
const actions=[menu('gta157','GTA V','1.57'),menu('gta156','GTA V','1.56'),menu('gta157second','GTA V','1.57',{menuVersion:'3.0'}),menu('rdr129','RDR2','1.29')];
function click(app,attribute,value){const grid=app.ids['host-action-grid'],button=grid.querySelector('['+attribute+'="'+value+'"]');assert.ok(button,'Missing navigation '+attribute+' '+value);grid.fire('click',{target:button});}
function noDispatch(app){assert.equal(app.sends.length,0);assert.equal(app.checks.length,0);assert.equal(app.opened.length,0);assert.equal(app.anchorClicks.length,0);}

test('game and exact update buttons precede menu families; only that update reaches the popup',()=>{
 const app=fixture({catalogGrid:true,actions});
 assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-catalog-game]').length,2);
 assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-choose-group]').length,0);
 click(app,'data-catalog-game','gta5');
 assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-catalog-update]').length,2);
 click(app,'data-catalog-update','1.57');
 assert.equal(app.ids['host-action-grid'].querySelectorAll('[data-choose-group]').length,1);
 app.openMenu();
 assert.match(app.ids['host-version-choices'].innerHTML,/gta157second/);
 assert.match(app.ids['host-version-choices'].innerHTML,/gta157/);
 assert.doesNotMatch(app.ids['host-version-choices'].innerHTML,/gta156|rdr129/);
 noDispatch(app);
 app.choose('gta157');
 assert.match(app.ids['host-version-detail'].innerHTML,/data-download-action="gta157"/);
 assert.match(app.ids['host-version-detail'].innerHTML,/menuVersion|Menu version/);
 noDispatch(app);
});

test('breadcrumb buttons move between games and updates without dispatch or dropdowns',()=>{
 const app=fixture({catalogGrid:true,actions});
 click(app,'data-catalog-game','rdr2');click(app,'data-catalog-update','1.29');
 click(app,'data-catalog-back','updates');
 assert.ok(app.ids['host-action-grid'].querySelector('[data-catalog-update="1.29"]'));
 click(app,'data-catalog-back','games');
 assert.ok(app.ids['host-action-grid'].querySelector('[data-catalog-game="gta5"]'));
 assert.doesNotMatch(app.ids['host-action-grid'].innerHTML,/<select\b|host-file-row/);
 noDispatch(app);
});

test('changing firmware keeps exact mod downloads browseable while mismatch still refuses Load',()=>{
 const app=fixture({catalogGrid:true,actions});
 app.selectFirmware('14.00');click(app,'data-catalog-game','gta5');click(app,'data-catalog-update','1.56');app.openMenu();
 assert.match(app.ids['host-version-detail'].innerHTML,/data-download-action="gta156"/);
 const detail=app.ids['host-version-detail'],load=detail.querySelector('[data-launch]');
 detail.fire('click',{target:load});
 assert.match(app.ids['host-status'].textContent,/matching the installed firmware/);
 noDispatch(app);
});

test('payload and tool tiles open exact file details; opening never sends or downloads',()=>{
 for(const category of ['payloads','tools']){
  const action=menu('payload-'+category,undefined,undefined,{category,label:'FTP server',menuFamily:undefined,format:'ELF',version:'1.0',run:{type:'elf-tcp',port:9021}});
  const app=fixture({catalogGrid:true,initialCategory:category,actions:[action]});
  assert.match(app.ids['host-action-grid'].innerHTML,/host-catalog-tile/);
  assert.doesNotMatch(app.ids['host-action-grid'].innerHTML,/host-file-row/);
  app.openMenu();
  assert.match(app.ids['host-version-detail'].innerHTML,/data-download-action="payload-/);
  assert.equal(app.ids['host-version-detail'].querySelector('[data-launch]').disabled,true);
  noDispatch(app);
 }
});

test('filtering an open menu rebuilds its version buttons and retains the selected exact file',()=>{
 const app=fixture({catalogGrid:true,actions});
 click(app,'data-catalog-game','gta5');click(app,'data-catalog-update','1.57');app.openMenu();app.choose('gta157second');
 app.ids['host-search'].value='3.0';app.ids['host-search'].fire('input');
 const choices=app.ids['host-version-choices'];
 assert.equal(choices.querySelectorAll('[data-version-id]').length,1);
 assert.equal(choices.querySelector('[data-version-id]').getAttribute('data-version-id'),'gta157second');
 assert.match(app.ids['host-version-detail'].innerHTML,/data-download-action="gta157second"/);
 noDispatch(app);
});
