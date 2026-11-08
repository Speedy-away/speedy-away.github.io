'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),locales=require('../host-locales.cjs'),metadata=require('../host-page-metadata.cjs'),extra=require('../../i18n-tools/host-current-translations.cjs');
test('all twenty languages have current UI translations with the exact placeholders retained',()=>{for(const [key,values]of Object.entries(extra.table))for(const code of extra.codes){assert.equal(typeof values[code],'string',code+' '+key);assert.ok(values[code].trim());assert.deepEqual((values[code].match(/\{\w+\}/g)||[]).sort(),(key.match(/\{\w+\}/g)||[]).sort(),code+' '+key);}});
test('translated metadata keeps all requested firmware identities and the empty-entry qualification',()=>{for(const code of extra.codes){const table=locales.dictionary(root,code);for(const platform of ['ps4','ps5']){const original=metadata.descriptor('hosts/'+platform+'/index.html'),data=locales.localized(original,code,table);assert.equal(data.language,code);assert.notEqual(data.description,original.description);assert.equal(data.description.includes(platform==='ps4'?'14.02':'14.00 (14.0), 14.10, 14.20'),true);for(const version of platform==='ps4'?['14.02']:['14.0','14.00','14.10','14.20'])assert.ok(data.keywords.some(k=>k.includes(version)),code+' '+version);assert.ok(data.description.includes(locales.translate('{versions}: empty firmware choices; no exploit or payload is provided.',table).split('{versions}')[1]));}}});
test('server text translation preserves native data, source text, controls and literal technical examples',()=>{const table={'Save for offline':'Guardar sin conexión','Load':'Cargar'},source='<html><body><button id="save">Save for offline</button><code>Load</code><p translate="no">Load</p><script type="application/json">{"id":"Load","sha256":"exact"}</script><select><option value="load">Load</option></select></body></html>',html=locales.bodyHTML(source,table);assert.ok(html.includes('<button id="save"><span data-i18n-source="Save for offline">Guardar sin conexión</span></button>'));assert.ok(html.includes('<code>Load</code>'));assert.ok(html.includes('<p translate="no">Load</p>'));assert.ok(html.includes('{"id":"Load","sha256":"exact"}'));assert.ok(html.includes('<option value="load">Cargar</option>'));});
test('sitemap has reciprocal language alternatives and excludes execution and offline setup pages',()=>{
 const xml=metadata.sitemap(),urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 const indexablePages=Object.entries(metadata.pages).filter(([,page])=>page.index!==false);
 assert.equal(urls.length,indexablePages.length*locales.codes.length);
 const unique=new Set(urls);
 assert.equal(unique.size,urls.length);
 for(const code of locales.codes){
  for(const route of ['hosts/ps5/index.html','hosts/ps4/downloads/index.html','hosts/ps5/downloads/index.html']){
   assert.ok(unique.has(locales.url(route,code)),route+' '+code);
  }
  assert.ok(xml.includes('hreflang="'+code+'"'));
 }
 assert.ok(xml.includes('xmlns:xhtml='));
 assert.doesNotMatch(urls.join(' '),/runtime|exploit|offline\/|karo/);
});
test('server templates enforce numeric and filename captures and prefer specific phrases',()=>{const table={'{count} games':'{count} juegos','Download {filename}':'Descargar {filename}','Open {label}':'Abrir {label}','Open on {platform}':'Abrir en {platform}'};assert.equal(locales.translate('169 games',table),'169 juegos');assert.equal(locales.translate('unknown games',table),'unknown games');assert.equal(locales.translate('Download CUSA03041.xml',table),'Descargar CUSA03041.xml');assert.equal(locales.translate('Download settings',table),'Download settings');assert.equal(locales.translate('Open on PS5',table),'Abrir en PS5');});
