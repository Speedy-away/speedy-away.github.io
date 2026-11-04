const test=require('node:test'),assert=require('node:assert/strict'),api=require('../../assets/host-karo-builds.js');
test('online Load works before cache exists or finishes, while retaining the native-attempt lock',()=>{
 for(const status of [undefined,0,2,3,1,4]){
  const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
  const w={navigator:{userAgent:'PlayStation 4/13.50'},document:{visibilityState:'visible'},localStorage:storage(),sessionStorage:storage()};if(status!==undefined)w.applicationCache={status};
  const e={platform:'ps4',firmwares:['13.50'],path:'g2all/index.html',scope:'g2all/',cacheRequired:true};
  assert.equal(api.authorize(w,e,'/native/web/',true,true),'/native/web/g2all/index.html');
  assert.throws(()=>api.authorize(w,e,'/native/web/',true,true),/previous native attempt/);
 }
});
