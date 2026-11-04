const test = require('node:test');
const assert = require('node:assert/strict');
const {isGenericKeyword} = require('../search-keyword-quality.cjs');

test('navigation and CTA keyword labels from the whole-site audit are rejected', () => {
  const labels = [
    'Choose your console', 'Choose the online service', 'Choose a game',
    'Related Switch apps', 'More for your PS3', 'Choose a PS3 resource',
    'Choose your PS3 route', 'Choose a Call of Duty game', 'Choose an Uncharted game',
    'Choose your PS3 game', 'Choose files for your console', 'Choose a console emulator',
    'Choose the right file and engine', 'Choose the correct HEN resource',
    'Choose your PS4 firmware', 'Choose your customization route', 'Choose a transfer method',
    'Choose a system', 'Choose your PS5 firmware', 'More for your PS5',
    'Choose your PS5 setup', 'Choose your setup tool', 'Choose how to play',
    'More for your Xbox 360', 'Choose your Xbox 360 method', 'Choose your console setup',
    'Choose your Xbox 360 game', 'Best Free CS2 Cheats & Auto Updated',
    'BEST Free Mod Menus (UPDATED)', 'Additional Tools:', 'Before You Download',
    'Choose a guide', 'Choose a download route', 'Choose a payload',
    'More for your games.', 'Choose a platform'
  ];
  for (const label of labels) assert.equal(isGenericKeyword(label), true, label);
});

test('specific projects, game names and firmware requirements remain searchable', () => {
  const names = [
    'Counter-Strike Source', 'Counter Strike Source', 'Source code archives',
    'Disable BattlEye', 'Apollo Save Tool', 'Apollo Save Tool · PS2',
    'Call of Duty Black Ops III', 'Uncharted 2: Among Thieves',
    'GTA V 1.57', 'PS3 HFW 4.93.1', 'PS5 13.60 Relapse',
    'GoldHEN 2.3', 'Open PS2 Loader', 'PS Vita game downloads',
    'Nintendo Switch 2 tools', 'Xbox 360 JTAG / RGH', 'Antivirus & False Positives',
    'Choose Your Own Adventure'
  ];
  for (const name of names) assert.equal(isGenericKeyword(name), false, name);
});

test('label matching handles case and whitespace without broad word removal', () => {
  assert.equal(isGenericKeyword('  RELATED   Switch  apps  '), true);
  assert.equal(isGenericKeyword('additional tools'), true);
  assert.equal(isGenericKeyword('Best Free CS2 Cheats & Auto Updated'), true);
  assert.equal(isGenericKeyword('Open Source Tools'), false);
  assert.equal(isGenericKeyword('Your PS5 payload loader'), false);
  assert.equal(isGenericKeyword(''), true);
});
