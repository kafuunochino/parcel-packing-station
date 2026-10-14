import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { createTTPlatform } from '../adapters/tt.js';
import { startGame } from '../src/runtime.js';
function fakeHost(failStorage=false) {
 const events={}, data=new Map(), frames=new Map(), calls=[]; let next=0;
 const ctx=new Proxy({}, {get(target,key){ return target[key] || ((...args)=>calls.push([key,...args])); }, set(target,key,value){target[key]=value;return true;}});
 const canvas={width:0,height:0,getContext:type=>type==='2d'?ctx:null};
 const api={createCanvas(){calls.push(['createCanvas']);return canvas;},getSystemInfoSync:()=>({windowWidth:390,windowHeight:844,pixelRatio:2}),getStorageSync:k=>{if(failStorage)throw Error('blocked');return data.get(k);},setStorageSync:(k,v)=>{if(failStorage)throw Error('blocked');data.set(k,v);}};
 for(const name of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show']) {
  events[name]=new Set(); api['on'+name]=fn=>events[name].add(fn); api['off'+name]=fn=>events[name].delete(fn);
 }
 const scheduler={requestAnimationFrame:fn=>{frames.set(++next,fn);return next;},cancelAnimationFrame:id=>frames.delete(id)};
 return {api,scheduler,events,frames,calls,canvas,data,emit:(name,event)=>events[name].forEach(fn=>fn(event))};
}
test('tt adapter uses one canvas, DPR sizing and logical touch coordinates',()=>{
 const h=fakeHost(), p=createTTPlatform(h.api,h.scheduler), output=[];
 const off=p.onPointer(e=>output.push(e));
 assert.deepEqual(p.getSize(),{width:390,height:844,dpr:2}); assert.equal(h.canvas.width,780); assert.equal(h.canvas.height,1688);
 h.emit('TouchStart',{touches:[{identifier:7,clientX:120,clientY:250}]});
 h.emit('TouchEnd',{touches:[],changedTouches:[{identifier:7,clientX:125,clientY:255}]});
 assert.deepEqual(output,[{type:'down',x:120,y:250,id:7},{type:'up',x:125,y:255,id:7}]);
 off(); h.emit('TouchCancel',{changedTouches:[{identifier:7,clientX:0,clientY:0}]});assert.equal(output.length,2);
 assert.equal(h.calls.filter(x=>x[0]==='createCanvas').length,1);p.destroy();
 assert.equal([...Object.values(h.events)].reduce((n,set)=>n+set.size,0),0);
});
test('shared runtime survives storage denial, pauses, resumes once and destroys cleanly',()=>{
 const h=fakeHost(true), p=createTTPlatform(h.api,h.scheduler), game=startGame(p);
 assert.equal(h.frames.size,1);
 h.emit('TouchStart',{touches:[{identifier:1,clientX:15,clientY:25}]});assert.equal(game.getState().taps,1);
 h.emit('Hide'); assert.equal(h.frames.size,0);
 h.emit('TouchStart',{touches:[{identifier:1,clientX:15,clientY:25}]}); assert.equal(game.getState().taps,1);
 h.emit('Show');h.emit('Show');assert.equal(h.frames.size,1);
 game.destroy();game.destroy();assert.equal(h.frames.size,0);p.destroy();
});
test('built Douyin entry boots in a DOM-free VM with only fake tt host APIs',()=>{
 const h=fakeHost();const context={tt:h.api,...h.scheduler};
 assert.equal('window' in context,false);assert.equal('document' in context,false);assert.equal('localStorage' in context,false);
 vm.runInNewContext(fs.readFileSync(new URL('../dist/douyin/game.js',import.meta.url),'utf8'),context,{timeout:1000});
 assert.equal(h.frames.size,1);h.emit('TouchStart',{touches:[{identifier:1,clientX:40,clientY:50}]});
 assert.equal(h.data.get('runtime-spike.v1'),'1');assert.ok(h.calls.some(c=>c[0]==='fillRect'));
});

test('sidebar uses real API path only after host support and tracks latest onShow',async()=>{
 const {createDouyinSidebar}=await import('../adapters/douyin-sidebar.js');
 let onShow,navCalls=0,failNavigation=false;
 const tt={onShow:fn=>onShow=fn,offShow:()=>{},checkScene:opts=>opts.success({isExist:true}),navigateToScene:opts=>{navCalls++;assert.equal(opts.scene,'sidebar');failNavigation?opts.fail({errMsg:'host denied'}):opts.success({errMsg:'navigateToScene:ok'});}};
 const sidebar=createDouyinSidebar(tt);assert.equal(sidebar.getState().available,true);
 assert.equal(await sidebar.navigate(),true);assert.equal(navCalls,1);
 onShow({launch_from:'homepage',location:'sidebar_card'});assert.equal(sidebar.getState().enteredFromSidebar,true);
 onShow({launch_from:'other',location:'other'});assert.equal(sidebar.getState().enteredFromSidebar,false);
 failNavigation=true;assert.equal(await sidebar.navigate(),false);assert.equal(sidebar.getState().error,'host denied');
 sidebar.destroy();assert.equal(await sidebar.navigate(),false);
 const absent=createDouyinSidebar({});assert.equal(await absent.navigate(),false);assert.equal(absent.getState().available,false);
});
