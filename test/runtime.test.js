import test from 'node:test';
import assert from 'node:assert/strict';
import {startGame} from '../src/game.js';
import {LEVELS} from '../src/levels.js';
import {SAVE_KEY} from '../src/storage.js';
import {isWin} from '../src/rules.js';
function harness(width=390,height=800,initial=null){
 const texts=[],methods=['beginPath','moveTo','lineTo','quadraticCurveTo','closePath','fill','stroke','clearRect','fillRect','translate','scale','setTransform','save','restore','setLineDash','rect','clip'];
 const ctx=Object.fromEntries(methods.map(name=>[name,()=>{}]));ctx.fillText=(text,x,y)=>texts.push({text:String(text),x,y});ctx.measureText=text=>({width:String(text).length*8});
 const callbacks={pointer:new Set(),resize:new Set(),pause:new Set(),resume:new Set()},frames=new Map(),store=new Map(initial?[[SAVE_KEY,JSON.stringify(initial)]]:[]),sounds=[];let count=0,muted;
 const sub=key=>fn=>{callbacks[key].add(fn);return()=>callbacks[key].delete(fn);};
 const platform={canvas:{getContext:()=>ctx},getSize:()=>({width,height,dpr:2}),onPointer:sub('pointer'),onResize:sub('resize'),onPause:sub('pause'),onResume:sub('resume'),requestFrame:fn=>{const id=++count;frames.set(id,fn);return id;},cancelFrame:id=>frames.delete(id),storage:{getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)},audio:{play:name=>{if(!muted)sounds.push(name);},setMuted:value=>{muted=value;}}};
 const game=startGame(platform);
 function flush(){const current=[...frames];frames.clear();if(current.length)texts.length=0;current.forEach(([,fn])=>fn());}
 function coords(x,y){const desktop=width>=850&&height>=560,W=desktop?1100:390,H=desktop?760:800,scale=Math.min(width/W,height/H);return {x:x*scale+(width-W*scale)/2,y:y*scale+(height-H*scale)/2};}
 function raw(type,x,y,id=1){const p=coords(x,y);callbacks.pointer.forEach(fn=>fn({type,...p,id}));}
 function event(type,x,y,id=1){raw(type,x,y,id);flush();}
 function click(x,y){event('down',x,y);event('up',x,y);}
 function button(label){const t=texts.findLast(t=>t.text===label);assert.ok(t,`button text exists: ${label}`);click(t.x,t.y-4);}
 function chooseLevel(id){button(`第 ${String(read()?.levelId||1).padStart(2,'0')} / 10 箱 ↗`);button(String(id).padStart(2,'0'));}
 function select(level,id){const desktop=width>=850&&height>=560,index=level.pieces.findIndex(p=>p.id===id),tray=desktop?{x:702,y:328,w:338,cols:3,h:83,gap:9}:{x:20,y:604,w:350,cols:level.pieces.length>8?5:Math.max(3,Math.min(4,level.pieces.length)),h:61,gap:7},cw=(tray.w-(tray.cols-1)*tray.gap)/tray.cols;click(tray.x+(index%tray.cols)*(cw+tray.gap)+cw/2,tray.y+Math.floor(index/tray.cols)*(tray.h+tray.gap)+tray.h/2);}
 function board(level,x,y){const desktop=width>=850&&height>=560,area=desktop?{x:94,y:351,w:512,h:296}:{x:30,y:218,w:330,h:287},cell=Math.min((area.w-52)/level.width,(area.h-48)/level.height),bw=cell*level.width,bh=cell*level.height;return {x:area.x+(area.w-bw)/2+(x+.5)*cell,y:area.y+(area.h-bh)/2+(y+.5)*cell};}
 function read(){return JSON.parse(store.get(SAVE_KEY)||'null');}
 flush();return {game,platform,frames,callbacks,texts,sounds,store,read,flush,event,raw,click,button,chooseLevel,select,board};
}
for(const [width,height] of [[390,800],[360,740],[1100,760]])test(`runtime ${width}×${height}: all ten levels complete via canvas pointer actions`,()=>{const h=harness(width,height);for(const level of LEVELS){h.chooseLevel(level.id);for(const item of level.solution){h.select(level,item.pieceId);if((h.read().state.forms[item.pieceId].compressed)!==item.compressed)h.button(item.compressed?'⇢ 挤一下':'⇠ 松一松');for(let n=0;n<item.rotation;n++)h.button('↻ 旋转');const target=h.board(level,item.x,item.y);h.click(target.x,target.y);}const saved=h.read();assert.equal(isWin(level,saved.state),true,`level ${level.id} win`);assert.ok(saved.completed.includes(level.id));assert.ok(h.texts.some(t=>t.text.includes(level.id===10?'十箱心意':'刚刚好，出库')));h.button('×');}assert.equal(h.read().completed.length,10);h.game.destroy();});
test('runtime drag from tray places and pointer cancel never places',()=>{const h=harness(),level=LEVELS[0],at=h.board(level,0,0);h.event('down',76,634);h.event('move',at.x,at.y);h.event('cancel',at.x,at.y);assert.equal(h.read(),null);h.event('down',76,634);h.event('move',at.x,at.y);h.event('up',at.x,at.y);assert.deepEqual(h.read().state.placements.A,{x:0,y:0});h.game.destroy();});
test('runtime invalid placement gives feedback and preserves legal save',()=>{const h=harness(),level=LEVELS[0];h.select(level,'A');const at=h.board(level,1,0);h.click(at.x,at.y);assert.ok(h.texts.some(t=>t.text.includes('超出箱子')));assert.equal(h.read(),null);const good=h.board(level,0,0);h.click(good.x,good.y);assert.deepEqual(h.read().state.placements.A,{x:0,y:0});h.game.destroy();});
test('runtime undo/remove/restart and cancel work through canvas controls',()=>{const h=harness(),level=LEVELS[0];h.select(level,'A');const at=h.board(level,0,0);h.click(at.x,at.y);h.button('取出');assert.deepEqual(h.read().state.placements,{});h.button('↶ 撤回');assert.deepEqual(h.read().state.placements.A,{x:0,y:0});h.button('↻ 重装');h.button('接着装');assert.deepEqual(h.read().state.placements.A,{x:0,y:0});h.button('↻ 重装');h.button('重新装箱');assert.deepEqual(h.read().state.placements,{});assert.equal(h.read().state.moves,0);h.game.destroy();});
test('runtime pause/resume cancels frames and preserves state; destroy unsubscribes',()=>{const h=harness();h.button('♫ 关');assert.ok(h.sounds.includes('tap'));h.callbacks.pause.forEach(fn=>fn());assert.equal(h.frames.size,0);h.event('down',30,30);assert.equal(h.frames.size,0);h.callbacks.resume.forEach(fn=>fn());assert.ok(h.frames.size>0);h.flush();h.game.destroy();assert.ok(Object.values(h.callbacks).every(set=>set.size===0));assert.equal(h.frames.size,0);h.game.destroy();});
test('runtime reload resumes saved state, no undo history',()=>{let h=harness(),level=LEVELS[0];h.select(level,'A');const at=h.board(level,0,0);h.click(at.x,at.y);const save=h.read();h.game.destroy();h=harness(390,800,save);h.button('↶ 撤回');assert.equal(h.read().state.placements.A.x,0);h.game.destroy();});
test('runtime blocked storage does not prevent rendering or interactions',()=>{const h=harness();h.game.destroy();h.platform.storage={getItem(){throw Error('blocked');},setItem(){throw Error('full');}};const game=startGame(h.platform);h.flush();assert.ok(h.texts.some(t=>t.text.includes('存档暂时不可用')));game.destroy();});

test('modal transition invalidates background hit targets before next animation frame',()=>{const h=harness(),level=LEVELS[0];h.select(level,'A');h.raw('down',349,35);h.raw('up',349,35);h.raw('down',100,767);h.raw('up',100,767);h.flush();assert.ok(h.texts.some(t=>t.text==='装箱小抄'));assert.equal(h.read(),null,'background rotate must not mutate or persist state');h.game.destroy();});
