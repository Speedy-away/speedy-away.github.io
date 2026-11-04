const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../../assets/mobile-downloads.js');
const origin = 'https://whatwhatboy.com';

test('shared mobile updates preserve archived standalone console helper bytes and embedded dependencies', () => {
    const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
    const root = path.resolve(__dirname, '../..');
    const mobile = require('../apply-mobile-layout.cjs');
    const jobs = JSON.parse(fs.readFileSync(path.join(root, 'docs/console-companion-download-jobs.json'), 'utf8')).jobs;
    const activationPath = path.join(root, 'docs/host-menu-companion-build.json');
    const activation = fs.existsSync(activationPath) ? JSON.parse(fs.readFileSync(activationPath, 'utf8')) : null;
    for (const platform of ['PS4', 'PS5']) {
        const job = jobs.findLast(item => item.platform === platform);
        const current = activation?.activated ? activation.records.find(item => item.platform === platform.toLowerCase()) : null;
        const bytes = fs.readFileSync(path.join(root, current?.path || job.importPath));
        const html = bytes.toString('utf8');
        assert.equal(bytes.length, current?.bytes || job.expectedBytes);
        assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), current?.sha256 || job.expectedSha256);
        if (current) {
            const immutable = fs.readFileSync(path.join(root, current.immutablePath));
            assert.deepEqual(immutable, bytes, 'activated live and immutable helper match');
            const retained = fs.readFileSync(path.join(root, current.previousPublicSnapshot));
            const activationJobs = activation.previousJobsPath ? JSON.parse(fs.readFileSync(path.join(root, activation.previousJobsPath), 'utf8')).jobs : [];
            const previous = [...jobs, ...activationJobs].find(item => item.platform === platform && item.expectedSha256 === current.previousSha256);
            assert.ok(previous, 'retained companion has an independently pinned previous build');
            assert.equal(retained.length, previous.expectedBytes);
            assert.equal(crypto.createHash('sha256').update(retained).digest('hex'), previous.expectedSha256);
        }
        assert.equal(mobile.improve(html), html);
        assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:src|href)=["']\/assets\//i);
    }
    assert.ok(!mobile.pages().some(file => /whatsite-ps[45]\.html$/.test(file)));
});

test('file classification preserves pinned URLs and excludes webpages, providers and screenshot previews', () => {
    const href = '/downloads/ps4/GTA5/157/Menu%20v1.57.bin?build=pinned#sha256';
    const info = api.describeDownload(href, origin + '/console/ps4/');
    assert.equal(info.href, href);
    assert.equal(info.url, origin + href);
    assert.equal(info.filename, 'Menu v1.57.bin');
    assert.equal(info.sameOrigin, true);
    assert.equal(api.describeDownload('/console/ps4/apps.html', origin), null);
    assert.equal(api.describeDownload('https://bstlar.com/F/key.zip', origin, {explicitDownload:true}), null);
    assert.equal(api.describeDownload('https://github.com/author/menu/blob/main/main.lua', origin), null);
    assert.equal(api.describeDownload('javascript:download()', origin, {explicitDownload:true}), null);
    assert.equal(api.describeDownload('https://name:secret@example.com/menu.bin', origin), null);
    assert.equal(api.describeDownload('/assets/images/screenshot.jpg', origin), null);
    assert.equal(api.describeDownload('/preview.mp4', origin), null);
    assert.equal(api.describeDownload('/docs/guide.md', origin, {label:'Read Markdown guide'}), null);
    assert.equal(api.describeDownload('/docs/guide.md', origin, {label:'Download Markdown'}).filename,'guide.md');
    assert.equal(api.describeDownload('/downloads/game/assets.rpf',origin).filename,'assets.rpf');
    assert.equal(api.describeDownload('/downloads/game/menu%2520literal.bin',origin).filename,'menu%20literal.bin');
    assert.equal(api.describeDownload('/downloads/game/menu.bin',origin,{explicitDownload:true,downloadName:'literal%20name.bin'}).filename,'literal%20name.bin');
    assert.equal(api.describeDownload('/assets/images/screenshot.jpg', origin, {label:'View screenshot'}), null);
    assert.equal(api.describeDownload('/assets/images/wallpaper.jpg', origin, {label:'Download wallpaper'}).filename, 'wallpaper.jpg');
    assert.equal(api.describeDownload('/console/ps4/whatsite-ps4.html', origin, {explicitDownload:true,downloadName:'receiver.html'}).filename, 'receiver.html');
    const external = api.describeDownload('https://github.com/author/menu/releases/download/v1.57/menu.bin', origin);
    assert.equal(external.sameOrigin, false);
    assert.equal(api.describeDownload('/api/scooby-key.html', origin, {explicitDownload:true}), null);
});

test('iPhone, touch iPad and Android instructions distinguish native saving without claiming installation', () => {
    assert.equal(api.deviceType({userAgent:'Mozilla iPhone Safari'}), 'ios');
    assert.equal(api.deviceType({platform:'MacIntel',maxTouchPoints:5}), 'ios');
    assert.equal(api.deviceType({userAgent:'Mozilla Android Chrome'}), 'android');
    assert.equal(api.deviceType({platform:'MacIntel',maxTouchPoints:0}), 'other');
    assert.match(api.saveInstructions({userAgent:'iPhone'}), /Share → Save to Files/);
    assert.match(api.saveInstructions({userAgent:'Android'}), /Downloads folder in Files \/ My Files/);
    assert.match(api.saveInstructions({}), /browser chooses the save location/);
    assert.equal(api.filename('../../bad:name?.zip'), '.._.._bad_name_.zip');
    assert.equal(api.filename('..'), 'download');
});

test('console themes, firmware and handheld builds receive file options while keeping exact source versions',()=>{
    for(const name of ['theme.p3t','theme.ptf','theme.ctf','menu.nxtheme','app.wuhb','default.xbe','EBOOT.PBP','PS4UPDATE.PUP','module.rpl']){
        const href='https://publisher.example/releases/pinned/'+name+'?version=original';
        const result=api.describeDownload(href,origin);
        assert.equal(result.url,href);
        assert.equal(result.filename,name);
        assert.equal(result.sameOrigin,false);
    }
    assert.equal(api.describeDownload('https://publisher.example/theme.html',origin),null);
});

function fileWindow(fetch) { return {location:{href:origin + '/console/ps4/'}, File, fetch}; }
function response(chunks, {type='application/octet-stream', length, url=origin + '/downloads/file.bin', status=200, range=null, encoding=null, redirected=false} = {}) {
    let index = 0, cancelled = false;
    return {
        ok:status >= 200 && status < 300, type:'basic', url, status, redirected,
        headers:{get(name) { return name === 'Content-Length' ? length === undefined ? null : String(length) : name === 'Content-Type' ? type : name === 'Content-Range' ? range : name === 'Content-Encoding' ? encoding : null; }},
        body:{getReader() { return {async read(){return index < chunks.length ? {done:false,value:chunks[index++]} : {done:true};}, async cancel(){cancelled = true;},releaseLock(){}}; },async cancel(){cancelled = true;}},
        get cancelled(){return cancelled;}
    };
}
const info = {url:origin + '/downloads/file.bin',filename:'file.bin',sameOrigin:true};

test('share preparation only fetches same-origin files with redirects disabled and keeps the exact filename', async () => {
    const calls = [];
    const window = fileWindow(async (...args) => {calls.push(args);return response([new Uint8Array([1,2,3])]);});
    const signal = new AbortController().signal;
    const file = await api.readShareFile(info, window, signal);
    assert.equal(file.name, 'file.bin');
    assert.equal(file.size, 3);
    assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1,2,3]);
    assert.equal(calls[0][0], info.url);
    assert.equal(calls[0][1].redirect, 'error');
    assert.equal(calls[0][1].credentials, 'same-origin');
    assert.equal(calls[0][1].signal, signal);
    await assert.rejects(api.readShareFile({...info,url:'https://other.example/file.bin'}, window, signal), error => error.code === 'EXTERNAL');
    assert.equal(calls.length, 1);
});

test('sharing rejects large, unbounded fallback, empty, redirected and HTML error responses', async () => {
    const signal = new AbortController().signal;
    let value = response([new Uint8Array([1])], {length:99});
    await assert.rejects(api.readShareFile(info, fileWindow(async () => value), signal, 4), error => error.code === 'TOO_LARGE');
    assert.equal(value.cancelled, true);
    value = response([new Uint8Array([1,2,3]),new Uint8Array([4,5])]);
    await assert.rejects(api.readShareFile(info,fileWindow(async () => value),signal,4),error=>error.code === 'TOO_LARGE');
    assert.equal(value.cancelled,true);
    value = response([], {type:'text/html'});
    await assert.rejects(api.readShareFile(info,fileWindow(async () => value),signal),error=>error.code === 'UNAVAILABLE');
    value = response([]);
    await assert.rejects(api.readShareFile(info,fileWindow(async () => value),signal),error=>error.code === 'UNAVAILABLE');
    value = response([new Uint8Array([1])],{url:'https://cdn.example/file.bin'});
    await assert.rejects(api.readShareFile(info,fileWindow(async () => value),signal),error=>error.code === 'UNAVAILABLE');
    value = {ok:true,headers:{get(){return null;}},blob(){throw Error('Must not buffer an unknown-size response');}};
    await assert.rejects(api.readShareFile(info,fileWindow(async()=>value),signal),error=>error.code === 'USE_DOWNLOAD');
});

test('sharing rejects partial files and byte-count mismatches while allowing decoded compressed responses', async () => {
    const bytes = new Uint8Array([1,2,3]);
    for (const options of [{status:206}, {range:'bytes 0-2/9'}, {length:5}, {length:2}, {length:0}]) {
        await assert.rejects(api.readShareFile(info, fileWindow(async()=>response([bytes],options))), error=>error.code==='INCOMPLETE');
    }
    for (const length of ['invalid', '-2']) {
        await assert.rejects(api.readShareFile(info, fileWindow(async()=>response([bytes],{length}))), error=>error.code==='UNAVAILABLE');
    }
    assert.equal((await api.readShareFile(info,fileWindow(async()=>response([bytes],{length:2,encoding:'gzip'})))).size,3);
    assert.equal((await api.readShareFile(info,fileWindow(async()=>response([bytes])))).size,3);
});

test('sharing detects disguised HTML and LFS pointers but preserves deliberate HTML companions', async () => {
    const encode=text=>new TextEncoder().encode(text);
    for (const text of ['<!DOCTYPE html><html>Not found</html>', '\uFEFF  <!-- proxy -->\n<html lang="en">Login</html>', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml">Error</html>', 'version https://git-lfs.github.com/spec/v1\noid sha256:abcdef\nsize 10\n']) {
        await assert.rejects(api.readShareFile(info,fileWindow(async()=>response([encode(text)]))),error=>error.code==='UNAVAILABLE');
    }
    await assert.rejects(api.readShareFile(info,fileWindow(async()=>response([encode('error')],{type:'Application/XHTML+XML; charset=utf-8'}))),error=>error.code==='UNAVAILABLE');
    const htmlInfo={...info,url:origin+'/console/ps4/helper.html',filename:'helper.html'};
    const html='<!doctype html><html><body>Console helper</body></html>';
    const file=await api.readShareFile(htmlInfo,fileWindow(async()=>response([encode(html)],{url:htmlInfo.url,type:'text/html'})));
    assert.equal(file.name,'helper.html');assert.equal(file.type,'text/html');assert.equal(await file.text(),html);
});

test('sharing keeps URL pins, rejects redirects and uses known file MIME for generic download headers', async () => {
    const pinned={...info,url:info.url+'?version=1.57#sha256'};
    assert.equal((await api.readShareFile(pinned,fileWindow(async()=>response([new Uint8Array([1])],{url:info.url+'?version=1.57'})))).size,1);
    for(const options of [{url:info.url+'?version=2'}, {url:origin+'/downloads/other.bin'}, {redirected:true}]) {
        await assert.rejects(api.readShareFile(info,fileWindow(async()=>response([new Uint8Array([1])],options))),error=>error.code==='UNAVAILABLE');
    }
    const jsonInfo={...info,url:origin+'/downloads/file.json',filename:'file.json'};
    const json=await api.readShareFile(jsonInfo,fileWindow(async()=>response([new TextEncoder().encode('{"build":"pinned"}')],{url:jsonInfo.url})));
    assert.equal(json.type,'application/json');assert.equal(await json.text(),'{"build":"pinned"}');
});

test('non-stream fallback only buffers a bounded unencoded body and verifies its actual bytes', async () => {
    const fallback=(length,encoding,content)=>({ok:true,headers:{get(name){return name==='Content-Length'?String(length):name==='Content-Encoding'?encoding:null;}},async blob(){return new Blob([content]);}});
    assert.equal((await api.readShareFile(info,fileWindow(async()=>fallback(3,null,'abc')))).size,3);
    await assert.rejects(api.readShareFile(info,fileWindow(async()=>fallback(3,'identity','abcde'))),error=>error.code==='INCOMPLETE');
    let buffered=false;
    const compressed=fallback(3,'gzip','abc');compressed.blob=()=>{buffered=true;throw Error('Do not buffer compressed unknown-size content');};
    await assert.rejects(api.readShareFile(info,fileWindow(async()=>compressed)),error=>error.code==='USE_DOWNLOAD');
    assert.equal(buffered,false);
});

test('aborting preparation cancels the reader and releases its lock', async () => {
    const controller = new AbortController();
    let cancelled = false, released = false;
    const value = {ok:true,headers:{get(){return null;}},body:{getReader(){return {async read(){controller.abort();return {done:false,value:new Uint8Array([1])};},async cancel(){cancelled=true;},releaseLock(){released=true;}};}}};
    await assert.rejects(api.readShareFile(info,fileWindow(async()=>value),controller.signal),error=>error.code === 'ABORTED');
    assert.equal(cancelled,true);assert.equal(released,true);
});

test('clipboard denial falls back to actual copy results or honest manual selection', async () => {
    const field = {value:origin + '/downloads/file.bin',focus(){this.focused=true;},select(){this.selected=true;},setSelectionRange(start,end){this.range=[start,end];}};
    let copied;
    assert.equal(await api.copyLink({}, {clipboard:{async writeText(text){copied=text;}}}, field),'copied');
    assert.equal(copied,field.value);
    assert.equal(await api.copyLink({execCommand(){return true;}},{clipboard:{async writeText(){throw Error('Denied');}}},field),'copied');
    assert.equal(await api.copyLink({execCommand(){return false;}},{clipboard:{async writeText(){throw Error('Denied');}}},field),'manual');
    assert.equal(field.focused,true);assert.equal(field.selected,true);assert.deepEqual(field.range,[0,field.value.length]);
    assert.equal(await api.copyLink({execCommand(){throw Error('Unsupported');}},{},field),'manual');
});

test('a late clipboard denial cannot select or copy a different reopened file', async () => {
    let reject,focused=false,copies=0;
    const field={value:origin+'/downloads/first.bin',focus(){focused=true;},select(){},setSelectionRange(){}};
    const pending=api.copyLink({execCommand(){copies++;return true;}},{clipboard:{writeText(){return new Promise((_resolve,fail)=>{reject=fail;});}}},field);
    field.value=origin+'/downloads/second.bin';reject(Error('Denied'));
    assert.equal(await pending,'cancelled');assert.equal(focused,false);assert.equal(copies,0);
});

function fixture({sharing=true,copySuccess=true,nativeDialog=true}={}) {
    let document;
    class Element {
        constructor(tag) {this.nodeType=1;this.tagName=tag.toUpperCase();this.attrs=new Map();this.children=[];this.events=new Map();this.style={};this.parentNode=null;this._text='';this.hidden=false;this.disabled=false;}
        get id(){return this.getAttribute('id')||'';} set id(value){this.setAttribute('id',value);}
        get className(){return this.getAttribute('class')||'';} set className(value){this.setAttribute('class',value);}
        get classList(){return {contains:value=>this.className.split(/\s+/).includes(value),add:value=>{this.className+=(this.className?' ':'')+value;}};}
        get textContent(){return this._text+this.children.map(child=>child.textContent).join('');} set textContent(value){this._text=String(value);this.children=[];}
        get parentElement(){return this.parentNode;}
        get nextSibling(){if(!this.parentNode)return null;return this.parentNode.children[this.parentNode.children.indexOf(this)+1]||null;}
        get isConnected(){return document.body===this||!!this.parentNode?.isConnected;}
        get open(){return this.hasAttribute('open');}
        setAttribute(name,value){this.attrs.set(name,String(value));}getAttribute(name){return this.attrs.get(name)??null;}hasAttribute(name){return this.attrs.has(name);}removeAttribute(name){this.attrs.delete(name);}
        appendChild(child){child.remove();child.parentNode=this;this.children.push(child);return child;}
        insertBefore(child,next){child.remove();child.parentNode=this;const index=this.children.indexOf(next);index<0?this.children.push(child):this.children.splice(index,0,child);return child;}
        remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(child=>child!==this);this.parentNode=null;}
        matches(selector){return selector.split(',').some(part=>{part=part.trim();const tag=part.match(/^[a-z]+/i);if(tag&&this.tagName!==tag[0].toUpperCase())return false;for(const match of part.matchAll(/\.([\w-]+)/g))if(!this.classList.contains(match[1]))return false;for(const match of part.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g))if(!this.hasAttribute(match[1])||match[2]!==undefined&&this.getAttribute(match[1])!==match[2])return false;return true;});}
        closest(selector){return this.matches(selector)?this:this.parentNode?.closest(selector)||null;}
        querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
        querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
        addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,[]);this.events.get(type).push(fn);}
        async emit(type,extra={}){const event={type,target:this,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of this.events.get(type)||[])await fn(event);return event;}
        focus(){document.activeElement=this;}select(){this.selected=true;}setSelectionRange(){}
        getClientRects(){return this.hidden?[]:[{}];}getBoundingClientRect(){return {left:0,top:0,right:300,bottom:600};}
        showModal(){this.setAttribute('open','');}close(){this.removeAttribute('open');this.emit('close');}
    }
    document={body:new Element('body'),createElement:tag=>{const node=new Element(tag);if(tag==='dialog'&&!nativeDialog){node.showModal=undefined;node.close=undefined;}return node;},execCommand:()=>copySuccess};
    document.body.isConnected=true;
    const add=(tag,attrs={},parent=document.body)=>{const node=new Element(tag);for(const [name,value]of Object.entries(attrs))node.setAttribute(name,value);parent.appendChild(node);return node;};
    const main=add('main');
    const link=add('a',{href:'/downloads/file.bin',target:'_blank'},main);link.textContent='Download file';
    const preview=add('a',{href:'/assets/screenshot.png',target:'_blank'},main);preview.textContent='Screenshot';
    const external=add('a',{href:'https://example.com/file.zip',target:'_blank'},main);external.textContent='Download';
    const receiver=add('a',{href:'http://127.0.0.1:6701/save.bin','data-receiver-file':'x'},main);receiver.textContent='Save on PS4';
    let observerCallback,fetchCount=0,shareCount=0,shareError=null;
    const window={location:{href:origin+'/console/ps4/'},File,AbortController,isSecureContext:true,navigator:{userAgent:'iPhone',canShare:()=>sharing,async share(){shareCount++;if(shareError)throw shareError;}},MutationObserver:class{constructor(callback){observerCallback=callback;}observe(){}disconnect(){}},async fetch(){fetchCount++;return response([new Uint8Array([1,2,3])]);}};
    const controller=api.install(document,window);
    return {document,window,controller,main,link,preview,external,receiver,add,observer:(records)=>observerCallback(records),fetchCount:()=>fetchCount,shareCount:()=>shareCount,setShareError:error=>{shareError=error;}};
}

test('enhancement is idempotent, keeps original navigation and leaves screenshots and receiver controls intact', () => {
    const f=fixture();
    assert.equal(f.link.getAttribute('href'),'/downloads/file.bin');
    assert.equal(f.link.getAttribute('download'),'file.bin');
    assert.equal(f.link.getAttribute('target'),null);
    assert.equal(f.link.events.has('click'),false);
    assert.equal(f.preview.getAttribute('target'),'_blank');assert.equal(f.preview.hasAttribute('download'),false);
    assert.equal(f.external.getAttribute('target'),'_blank');assert.equal(f.external.hasAttribute('download'),false);
    assert.equal(f.receiver.hasAttribute('download'),false);
    assert.equal(f.main.querySelectorAll('.mobile-file-options').length,2);
    assert.equal(api.install(f.document,f.window),f.controller);
    f.controller.refresh();assert.equal(f.main.querySelectorAll('.mobile-file-options').length,2);
    const added=f.add('a',{href:'/downloads/new%20file.lua'},f.main);
    f.observer([{type:'childList',addedNodes:[added]}]);
    assert.equal(f.main.querySelectorAll('.mobile-file-options').length,3);
    assert.equal(added.getAttribute('download'),'new file.lua');
    added.removeAttribute('href');f.observer([{type:'attributes',target:added}]);
    assert.equal(f.main.querySelectorAll('.mobile-file-options').length,2);
});

test('file sharing requires prepare then a distinct second tap, preserves download fallback and handles cancellation honestly', async () => {
    const f=fixture();const trigger=f.link.nextSibling;
    trigger.focus();await trigger.emit('click');
    const dialog=f.controller.getDialog();
    assert.equal(dialog.open,true);assert.equal(f.fetchCount(),0);assert.equal(f.shareCount(),0);
    assert.equal(dialog.querySelector('.phone-download-filename').textContent,'file.bin');
    const prepare=dialog.querySelectorAll('button').find(node=>node.textContent==='Prepare file for sharing');
    const share=dialog.querySelectorAll('button').find(node=>node.textContent==='Save or share file');
    const download=dialog.querySelector('a');
    assert.equal(download.getAttribute('href'),'/downloads/file.bin');assert.equal(download.getAttribute('download'),'file.bin');
    await prepare.emit('click');assert.equal(f.fetchCount(),1);assert.equal(f.shareCount(),0);assert.equal(share.hidden,false);
    await share.emit('click');assert.equal(f.shareCount(),1);assert.match(dialog.querySelector('.phone-download-status').textContent,/Check Files or your chosen app/);
    f.setShareError(Object.assign(new Error('Cancelled'),{name:'AbortError'}));
    await share.emit('click');assert.match(dialog.querySelector('.phone-download-status').textContent,/Sharing cancelled/);
    assert.equal(dialog.querySelector('.phone-download-status').getAttribute('data-state'),'info');
    await dialog.querySelector('.phone-download-close').emit('click');
    assert.equal(dialog.open,false);assert.equal(f.document.activeElement,trigger);assert.equal(f.document.body.style.overflow,undefined);
    dialog.scrollTop=150;
    await trigger.emit('click');assert.equal(dialog.scrollTop,0);
});

test('external downloads and unsupported browsers never fetch a sharing copy', async () => {
    const f=fixture({sharing:false});
    f.controller.open(f.link,f.link.nextSibling);
    const dialog=f.controller.getDialog();
    let prepare=dialog.querySelectorAll('button').find(node=>node.textContent==='Prepare file for sharing');
    assert.equal(prepare.hidden,true);assert.equal(f.fetchCount(),0);
    f.controller.open(f.external,f.external.nextSibling);
    assert.equal(prepare.hidden,true);assert.equal(dialog.querySelector('a').hasAttribute('download'),false);
    assert.match(dialog.querySelector('.phone-download-status').textContent,/hosted on another site/);
    assert.equal(f.fetchCount(),0);
});

test('fallback dialog blocks background pointer hits and restores state after backdrop, Escape and destroy', async () => {
    const native=fixture();native.controller.open(native.link,native.link.nextSibling);
    assert.equal(native.document.body.querySelector('.phone-download-backdrop'),null);
    native.controller.destroy();
    const f=fixture({nativeDialog:false});const trigger=f.link.nextSibling;
    f.document.body.style.overflow='clip';trigger.focus();
    await trigger.emit('click');
    const dialog=f.controller.getDialog(),backdrop=f.document.body.querySelector('.phone-download-backdrop');
    assert.ok(backdrop);assert.equal(backdrop.hidden,false);assert.equal(backdrop.getAttribute('aria-hidden'),'true');
    assert.equal(backdrop.nextSibling,dialog);assert.equal(dialog.open,true);assert.equal(dialog.getAttribute('aria-modal'),'true');
    assert.equal(f.document.body.style.overflow,'hidden');
    await backdrop.emit('click');
    assert.equal(dialog.open,false);assert.equal(backdrop.hidden,true);assert.equal(f.document.body.style.overflow,'clip');assert.equal(f.document.activeElement,trigger);
    await trigger.emit('click');assert.equal(backdrop.hidden,false);
    const escape=await dialog.emit('keydown',{key:'Escape'});
    assert.equal(escape.defaultPrevented,true);assert.equal(backdrop.hidden,true);assert.equal(dialog.open,false);assert.equal(f.document.activeElement,trigger);
    assert.equal(f.document.body.style.overflow,'clip');
    f.document.body.style.overflow='auto';f.controller.close();assert.equal(f.document.body.style.overflow,'auto');
    await trigger.emit('click');f.controller.destroy();
    assert.equal(f.document.body.querySelector('.phone-download-backdrop'),null);assert.equal(f.document.body.querySelector('.phone-download-dialog'),null);
    assert.equal(f.document.body.style.overflow,'auto');assert.equal(f.document.activeElement,trigger);
});

test('closing during preparation aborts the request and does not let a late result change a reopened dialog', async () => {
    const f=fixture();let resolve,signal;
    f.window.fetch=(_url,options)=>{signal=options.signal;return new Promise(done=>{resolve=done;});};
    f.controller.open(f.link,f.link.nextSibling);
    const dialog=f.controller.getDialog();const prepare=dialog.querySelectorAll('button').find(node=>node.textContent==='Prepare file for sharing');
    const pending=prepare.emit('click');
    f.controller.close();assert.equal(signal.aborted,true);
    f.controller.open(f.external,f.external.nextSibling);
    resolve(response([new Uint8Array([1])]));await pending;
    assert.equal(dialog.querySelector('.phone-download-filename').textContent,'file.zip');
    assert.match(dialog.querySelector('.phone-download-status').textContent,/hosted on another site/);
    const share=dialog.querySelectorAll('button').find(node=>node.textContent==='Save or share file');assert.equal(share.hidden,true);
});
