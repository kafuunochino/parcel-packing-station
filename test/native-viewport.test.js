import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../dist/douyin/game.js',import.meta.url),'utf8');
export function harness(info,realCanvas){
 const events={},frames=new Map(),paint=[],gradient={addColorStop(){}};let serial=0;
 const ctx=new Proxy({measureText:s=>({width:String(s).length*8}),fillRect:(...a)=>paint.push(a),createLinearGradient:()=>gradient},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 const canvas=realCanvas||{getContext:()=>ctx},store=new Map();
 const tt={createCanvas:()=>canvas,getSystemInfoSync:()=>info,getMenuButtonLayout:()=>({bottom:84}),getStorageSync:k=>store.get(k),setStorageSync:(k,v)=>store.set(k,v)};
 for(const n of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show','WindowResize']){tt['on'+n]=fn=>events[n]=fn;tt['off'+n]=fn=>{if(events[n]===fn)delete events[n];};}
 const context={tt,requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(source.replace('startGame(platform);','globalThis.game=startGame(platform);globalThis.platform=platform;'),context);
 const flush=()=>{const f=frames.entries().next().value;if(f){frames.delete(f[0]);f[1]();}};
 const snap=()=>context.game.getSnapshot();
 const target=id=>{const t=snap().hitTargets.find(t=>t.id===id);assert.ok(t,id);return {identifier:1,clientX:t.screenX+t.w/2,clientY:t.screenY+t.h/2};};
 const emit=(kind,t)=>events[kind]({changedTouches:[t],touches:kind==='TouchEnd'||kind==='TouchCancel'?[]:[t]});
 const tap=id=>{const t=target(id);emit('TouchStart',t);emit('TouchEnd',t);flush();};
 flush();return {canvas,events,paint,info,context,snap,target,emit,tap,flush};
}
const profiles=[[320,568,1],[390,844,2],[430,932,3],[540,1200,2],[768,1024,2]];
for(const [w,h,d] of profiles)test(`exact native bundle screen/window mismatch ${w} DPR${d}`,()=>{
 const x=harness({screenWidth:w,screenHeight:h,windowWidth:300,windowHeight:500,pixelRatio:d,safeArea:{top:44,bottom:h-34,left:0,right:w}});
 assert.equal(x.canvas.width,w*d);assert.equal(x.canvas.height,h*d);assert.ok(x.paint.some(p=>p[0]===0&&p[1]===0&&p[2]===w&&p[3]===h),'warehouse paints full viewport behind readable centered controls');
 assert.equal(x.snap().layout.oy,90);
 for(const t of x.snap().hitTargets){assert.ok(t.screenX>=0&&t.screenX+t.w<=w);assert.ok(t.screenY>=90&&t.screenY+t.h<=h-34);assert.ok(t.w>=44&&t.h>=44);}
 x.tap('play');assert.equal(x.snap().screen,'play');x.tap('briefStart');assert.equal(x.snap().modal,null);
});
test('resize event overrides stale system dimensions and cancels pressed button',()=>{
 const x=harness({screenWidth:390,screenHeight:844,windowWidth:320,windowHeight:568,pixelRatio:2,safeArea:{top:44,bottom:810,right:390}}),p=x.target('play');x.emit('TouchStart',p);
 x.events.WindowResize({size:{windowWidth:430,windowHeight:932}});x.emit('TouchEnd',p);x.flush();assert.equal(x.snap().screen,'home');assert.equal(x.canvas.width,860);assert.equal(x.canvas.height,1864);
 x.tap('play');assert.equal(x.snap().screen,'play');
});
test('touch cancellation and hide prevent old action, cleanup removes resize listener',()=>{
 const x=harness({screenWidth:390,screenHeight:844,pixelRatio:3}),p=x.target('play');x.emit('TouchStart',p);x.emit('TouchCancel',p);x.emit('TouchEnd',p);x.flush();assert.equal(x.snap().screen,'home');
 x.emit('TouchStart',p);x.events.Hide();x.emit('TouchEnd',p);x.events.Show();x.flush();assert.equal(x.snap().screen,'home');x.context.game.destroy();x.context.platform.destroy();assert.equal(x.events.WindowResize,undefined);
});
test('invalid safe values bounded while window-only hosts remain supported',()=>{
 const x=harness({windowWidth:390,windowHeight:844,pixelRatio:2,safeArea:{left:-99,right:999,top:99999,bottom:-999}});assert.equal(x.canvas.width,780);const l=x.snap().layout;assert.ok(l.safeInsets.top<=844/3);assert.ok(l.safeInsets.bottom<=844/3);assert.equal(l.safeInsets.left,0);assert.equal(l.safeInsets.right,0);
});
