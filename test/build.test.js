import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
const bundle=readFileSync(root+'dist/douyin/game.js','utf8');
test('final Douyin bundle parses and starts in a DOM-free tt VM mock',()=>{
 const texts=[],calls={},frames=new Map(),saved=new Map();let frameId=0,canvasCount=0;
 const context=new Proxy({fillText:(value,x,y)=>texts.push({value:String(value),x,y}),measureText:t=>({width:String(t).length*8})},{get(target,key){return key in target?target[key]:(()=>{});},set(target,key,value){target[key]=value;return true;}});
 const canvas={getContext:type=>{assert.equal(type,'2d');return context;}};
 const tt={createCanvas(){canvasCount++;return canvas;},getSystemInfoSync:()=>({windowWidth:390,windowHeight:800,pixelRatio:2}),getStorageSync:key=>saved.get(key),setStorageSync:(key,value)=>saved.set(key,value),createInnerAudioContext:()=>({src:'',seek(){},play(){},pause(){},destroy(){},onError(){}})};
 for(const suffix of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show']){tt['on'+suffix]=fn=>calls[suffix]=fn;tt['off'+suffix]=()=>{};}
 const sandbox={tt,requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)};
 new vm.Script(bundle,{filename:'dist/douyin/game.js'}).runInNewContext(sandbox,{timeout:2000});
 const flush=()=>{const now=[...frames.values()];frames.clear();texts.length=0;now.forEach(fn=>fn());};flush();
 assert.equal(canvasCount,1);assert.equal(canvas.width,780);assert.equal(canvas.height,1600);assert.ok(texts.some(t=>t.value==='软包挤挤站'));
 const touch=(x,y)=>{calls.TouchStart({changedTouches:[{clientX:x,clientY:y,identifier:1}]});flush();calls.TouchEnd({changedTouches:[{clientX:x,clientY:y,identifier:1}]});flush();};
 touch(76,634);touch(102.3,315.2);touch(195,634);touch(102.3,407.8);
 assert.ok(texts.some(t=>t.value==='刚刚好，出库啦！'),'real bundle pointer input completes first level');
 const value=JSON.parse([...saved.values()][0]);assert.deepEqual(value.completed,[1]);
 calls.Hide();assert.equal(frames.size,0);calls.Show();assert.ok(frames.size>0);flush();
 assert.equal('document' in sandbox,false);assert.equal('window' in sandbox,false);
});
test('generated platform configs never invent an AppID or imply publication',()=>{const config=JSON.parse(readFileSync(root+'dist/douyin/project.config.json'));assert.equal(config.appid,'');assert.equal(JSON.parse(readFileSync(root+'dist/douyin/game.json')).deviceOrientation,'portrait');});
test('standalone browser file embeds game code and audio without module fetches',()=>{const html=readFileSync(root+'dist/parcel-demo.html','utf8');assert.ok(html.includes('function startGame(platform)'));assert.ok(html.includes('data:audio/wav;base64,'));assert.equal(/<script[^>]+src=/.test(html),false);assert.equal(/<link[^>]+href="(?:https?:|\/)\//.test(html),false);const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(code));});
