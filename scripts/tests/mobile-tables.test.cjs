const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../script.js'),'utf8');

function fixture({wide=true, existing=false, scroll=true}={}) {
    const attributes = new Map(existing ? [['tabindex','0'],['aria-label','Storage destinations']] : []);
    const classes = new Set();
    const scroller = {
        scrollWidth:wide?700:300, clientWidth:300,
        hasAttribute:name=>attributes.has(name),
        getAttribute:name=>attributes.get(name),
        setAttribute:(name,value)=>attributes.set(name,String(value)),
        removeAttribute:name=>attributes.delete(name),
        classList:{add:name=>classes.add(name)}
    };
    const table = {parentElement:scroller,querySelector:selector=>selector==='caption'?{textContent:'Firmware compatibility'}:null};
    const observers=[];
    const window = {getComputedStyle:()=>({overflowX:scroll?'auto':'visible'}),ResizeObserver:class {
        constructor(callback){this.callback=callback;this.targets=[];observers.push(this);}
        observe(target){this.targets.push(target);}
    }};
    const context = {document:{addEventListener(){},querySelectorAll:()=>[table]},window};
    vm.createContext(context);vm.runInContext(source,context);
    return {run:()=>context.initResponsiveTables(),attributes,scroller,table,observers,classes};
}

test('wide tables retain table semantics and get a named keyboard-scroll region only while overflowing',()=>{
    const f=fixture();f.run();
    assert.equal(f.table.parentElement,f.scroller);
    assert.equal(f.attributes.get('tabindex'),'0');
    assert.equal(f.attributes.get('role'),'region');
    assert.match(f.attributes.get('aria-label'),/Firmware compatibility.*Scroll horizontally/);
    assert.equal(f.observers.length,1);
    f.scroller.clientWidth=800;f.observers[0].callback();
    assert.equal(f.attributes.has('tabindex'),false);
    assert.equal(f.attributes.get('data-table-overflow'),'false');
    f.scroller.clientWidth=300;f.observers[0].callback();
    assert.equal(f.attributes.get('tabindex'),'0');
    f.run();assert.equal(f.observers.length,1);
});

test('existing table labels and explicit keyboard access survive resizing',()=>{
    const f=fixture({existing:true,wide:false});f.run();
    assert.equal(f.attributes.get('aria-label'),'Storage destinations');
    assert.equal(f.attributes.get('tabindex'),'0');
});

test('ordinary fitting tables are not restructured or given scrolling controls',()=>{
    const f=fixture({scroll:false,wide:false});f.run();
    assert.equal(f.attributes.size,0);
    assert.equal(f.observers.length,0);
});
