'use strict';
// Only the authored landing controller is included; no upstream module or payload URL is reachable.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/afterglow-entry.js'),'utf8').replaceAll('whatsite.afterglow','whatsite.inert-qa.afterglow');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Inert Afterglow controls QA</title><style>body{background:#0b0d10;color:#eee;font:18px system-ui;max-width:800px;margin:60px auto}label,button{margin:20px;display:inline-block}pre{white-space:pre-wrap}button{padding:15px}</style><h1>Inert Afterglow controls QA</h1><p>Authored controls only. Navigation is captured as text. No exploit code or downloaded payloads.</p><p id="browser-firmware"></p><form id="pick"><label><input type="radio" name="payload" value="hen">ps4-hen</label><label><input type="radio" name="payload" value="goldhen" checked>GoldHEN</label><label><input type="checkbox" id="auto">Autostart</label><button id="start">Start</button><button id="cancel" type="button">Cancel</button><p id="count"></p><p id="cache"></p></form><pre id="navigation">No navigation requested</pre><script>var capturedLocation={search:''};Object.defineProperty(capturedLocation,'href',{set:function(value){document.getElementById('navigation').textContent='Captured inert target: '+value;}});var mockWindow={applicationCache:null,addEventListener:window.addEventListener.bind(window)};new Function('navigator','location','performance','sessionStorage','localStorage','window',${JSON.stringify(source)})({userAgent:'PlayStation 4/14.00'},capturedLocation,{navigation:{type:0}},sessionStorage,localStorage,mockWindow);</script></html>`;
fs.mkdirSync(path.join(root,'assets/qa'),{recursive:true});fs.writeFileSync(path.join(root,'assets/qa/afterglow-inert.html'),html);
const build=JSON.parse(fs.readFileSync(path.join(root,'docs/afterglow-build.json')));
let landing=fs.readFileSync(path.join(root,build.base,'web/index.html'),'utf8').replace(/ manifest="[^"]*"/,'').replace(/<script\b[\s\S]*?<\/script>/g,'');
landing=landing.replace(/(href|src)="(style\.css|landing-layout\.css|meme\.png)"/g,(_,attr,file)=>attr+'="/'+build.base+'/web/'+file+'"');
landing=landing.replaceAll('href="../../../ps4/','href="/hosts/ps4/').replaceAll('href="../README.md"','href="/'+build.base+'/README.md"');
const boot=html.match(/<script>([\s\S]*?)<\/script>/)[1];
landing=landing.replace('</body>','<pre id="navigation" style="text-align:center">Inert preview: no exploit code</pre><script>'+boot+'</script></body>');
fs.writeFileSync(path.join(root,'assets/qa/afterglow-landing-inert.html'),landing);
