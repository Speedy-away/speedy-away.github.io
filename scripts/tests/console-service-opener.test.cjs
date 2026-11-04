const test = require('node:test');
const assert = require('node:assert/strict');
const {buildServiceUrl,normalizeAddress,consoleAddress} = require('../../assets/console-service-opener.js');
test('PS5 services retain their documented ports and routes',()=>{
  assert.equal(buildServiceUrl('192.168.1.50','manager'),'http://192.168.1.50:8084/');
  assert.equal(buildServiceUrl('192.168.1.50','files'),'http://192.168.1.50:8080/fs/');
  assert.equal(buildServiceUrl('127.0.0.1','homebrew'),'http://127.0.0.1:8080/index.html');
  assert.equal(buildServiceUrl('192.168.1.50','patches'),'http://192.168.1.50:23900/');
});
test('opener refuses URL injection, malformed addresses and public destinations',()=>{
  for(const value of ['https://example.com','127.0.0.1:9021','192.168.1.50/path','192.168.1.999','192.168.1.50@evil.test','8.8.8.8','172.32.0.1',''])assert.throws(()=>normalizeAddress(value));
  assert.throws(()=>buildServiceUrl('192.168.1.50','shutdown'));
});
test('private network ranges and explicit console loopback remain available',()=>{
  for(const value of ['10.0.0.2','172.16.0.2','172.31.255.2','192.168.0.2','127.0.0.1'])assert.equal(normalizeAddress(value),value);
});
test('PC and other-console views cannot accidentally open their own loopback manager',()=>{
  assert.throws(()=>consoleAddress('127.0.0.1','ps5','Windows NT 10.0'),/PS5 LAN address/);
  assert.throws(()=>consoleAddress('127.0.0.1','ps4','PlayStation 5/13.60'),/PS4 LAN address/);
  assert.equal(consoleAddress('127.0.0.1','ps4','Playstation; Playstation 4/9.00'),'127.0.0.1');
  assert.equal(consoleAddress('192.168.1.50','ps5','Windows NT 10.0'),'192.168.1.50');
  assert.equal(buildServiceUrl('192.168.1.50','ps4-files'),'http://192.168.1.50:8080/');
});
