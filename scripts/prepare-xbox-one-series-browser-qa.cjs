// Prepare a local same-origin fixture; browser control is performed through CUA.
const fs=require('node:fs'),path=require('node:path');
const data=require('../docs/xbox-one-series-catalogue.json');
const expectations={total:data.apps.length,tools:data.apps.filter(a=>a.category==='Tools').length,engines:data.apps.filter(a=>a.category==='Engines').map(a=>a.id),unspecified:data.apps.filter(a=>a.models.includes('unspecified')||a.files.some(f=>!f.framework&&f.models.includes('unspecified'))).map(a=>a.id),one:data.apps.filter(a=>a.models.includes('one')).map(a=>a.id),series:data.apps.filter(a=>a.models.includes('series')).map(a=>a.id)};
const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Xbox local rendering checks</title><style>body{margin:0;background:#202020;color:white;font:12px monospace}pre{white-space:pre-wrap;margin:8px;max-width:1400px}iframe{border:0;display:block}</style></head><body><pre id="result">Loading local Xbox guide…</pre><script>
const expected=${JSON.stringify(expectations)};
const params=new URLSearchParams(location.search),width=Number(params.get('width')||1366),height=Number(params.get('height')||850),frame=document.createElement('iframe');frame.width=width;frame.height=height;
frame.onload=()=>setTimeout(async()=>{
 const w=frame.contentWindow,d=w.document,checks=[],errors=[];
 const images=[...d.querySelectorAll('img[src*="xbox-one-series"]')];images.forEach(i=>i.loading='eager');await Promise.allSettled(images.map(i=>i.decode()));
 const check=(v,label)=>{checks.push({passed:!!v,label});if(!v)errors.push(label)};
 const search=d.getElementById('xboxSearch'),model=d.getElementById('xboxModel'),category=d.getElementById('xboxCategory'),form=d.getElementById('xboxFilters');
 const visible=()=>[...d.querySelectorAll('[data-xbox-app]')].filter(a=>!a.hidden);
 check(w.innerWidth===width,'Exact requested viewport');
 check(d.documentElement.scrollWidth<=width,'No horizontal overflow');
 check(d.querySelectorAll('[data-xbox-app]').length===expected.total,'All '+expected.total+' apps rendered');
 check(images.every(i=>i.complete&&i.naturalWidth>0),'All local publisher artwork loaded');
 search.value='moonlight';search.dispatchEvent(new w.Event('input',{bubbles:true}));check(visible().length===1&&visible()[0].id==='moonlight','Search matches one app');
 search.value='zzzzz';search.dispatchEvent(new w.Event('input',{bubbles:true}));check(visible().length===0&&!d.getElementById('xboxEmpty').hidden,'Empty search feedback');
 form.reset();check(visible().length===expected.total,'Clear filters restores all apps');
 category.value='tools';category.dispatchEvent(new w.Event('change',{bubbles:true}));check(visible().length===expected.tools,'Tools category count');
 category.value='engines';category.dispatchEvent(new w.Event('change',{bubbles:true}));check(JSON.stringify(visible().map(a=>a.id))===JSON.stringify(expected.engines),'Game engines category contains only native engine ports');
 form.reset();model.value='unspecified';model.dispatchEvent(new w.Event('change',{bubbles:true}));check(JSON.stringify(visible().map(a=>a.id))===JSON.stringify(expected.unspecified),'Unconfirmed-model filter preserves compatibility limits');
 form.reset();model.value='one';model.dispatchEvent(new w.Event('change',{bubbles:true}));
 check(JSON.stringify(visible().map(a=>a.id))===JSON.stringify(expected.one),'Xbox One has only source-confirmed apps');
 check(d.querySelector('#xbsx2 .xbox-file[data-models="series"]').hidden&&!d.querySelector('#xbsx2 .xbox-file[data-models="one"]').hidden,'Xbox One hides XBSX2 AVX2');
 check(d.querySelector('#dolphin .xbox-file[data-models="unspecified"]').hidden,'Model filter excludes unconfirmed Dolphin successor');
 check(d.querySelector('#retroarch .xbox-file[data-models="series"]').hidden&&!d.querySelector('#retroarch .xbox-file[data-models="one"]').hidden,'Xbox One gets RetroArch ANGLE');
 model.value='series';model.dispatchEvent(new w.Event('change',{bubbles:true}));
 check(JSON.stringify(visible().map(a=>a.id))===JSON.stringify(expected.series),'Series has only source-confirmed apps');
 check(d.querySelector('#xbsx2 .xbox-file[data-models="one"]').hidden&&!d.querySelector('#xbsx2 .xbox-file[data-models="series"]').hidden,'Series hides XBSX2 SSE4');
 check(d.querySelector('#retroarch .xbox-file[data-models="one"]').hidden&&!d.querySelector('#retroarch .xbox-file[data-models="series"]').hidden,'Series gets RetroArch Mesa');
 form.reset();
 check([...form.querySelectorAll('input,select,button')].every(e=>e.getBoundingClientRect().height>=44),'Filter touch targets at least 44px');
 const checksum=d.querySelector('#xenia .xbox-checksum');checksum.open=true;check(d.documentElement.scrollWidth<=width,'Expanded filenames and SHA-256 do not overflow');checksum.open=false;
 check(!!d.querySelector('script[src="/languages/i18n.js?v=3"]')&&!!d.querySelector('.i18n-float,.i18n-selector,[aria-label="Change language"]'),'Language loader and controls');
 check(!!d.querySelector('#site-background-controls'),'Background controls');
 if(params.get('anchor')){const a=d.getElementById(params.get('anchor'));if(a){d.documentElement.style.scrollBehavior='auto';w.scrollTo(0,w.scrollY+a.getBoundingClientRect().top-(width<=760?90:24))}}
 const report={width,height,documentWidth:d.documentElement.scrollWidth,apps:expected.total,checks,errors};document.getElementById('result').textContent=JSON.stringify(report);document.title=(errors.length?'FAIL':'PASS')+' · '+width+'px Xbox guide';
},1500);
frame.src='/console/xbox-one-series/apps.html';document.body.appendChild(frame);
</script></body></html>`;
const destination=path.resolve(__dirname,'../tmp/xbox-one-series/qa.html');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,html);console.log(destination);
