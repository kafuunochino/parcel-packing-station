import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
const bundle=readFileSync(root+'dist/douyin/game.js','utf8');
function runtime({sidebar=false,legacy=false}={}){
 const texts=[],calls={},frames=new Map(),saved=new Map(),navigation=[];let frameId=0,canvasCount=0;
 const context=Object.fromEntries(['beginPath','moveTo','lineTo','quadraticCurveTo','closePath','fill','stroke','clearRect','fillRect','translate','scale','setTransform','save','restore','rect','clip'].map(method=>[method,()=>{}]));
 if(!legacy)context.setLineDash=()=>{};
 context.fillText=(value,x,y)=>texts.push({value:String(value),x,y});context.measureText=t=>({width:String(t).length*8});
 const canvas={getContext:type=>{assert.equal(type,'2d');return context;}};
 const tt={createCanvas(){canvasCount++;return canvas;},getSystemInfoSync:()=>({windowWidth:390,windowHeight:800,pixelRatio:2}),getStorageSync:key=>saved.get(key),setStorageSync:(key,value)=>saved.set(key,value),createInnerAudioContext:()=>({src:'',seek(){},play(){},pause(){},destroy(){},onError(){}})};
 for(const suffix of ['TouchStart','TouchMove','TouchEnd','TouchCancel','Hide','Show']){const listeners=new Set();calls[suffix]=options=>listeners.forEach(fn=>fn(options));tt['on'+suffix]=fn=>listeners.add(fn);tt['off'+suffix]=fn=>listeners.delete(fn);}
 if(sidebar){tt.checkScene=options=>options.success({isExist:true});tt.navigateToScene=options=>navigation.push(options);}
 const sandbox=vm.createContext({tt,requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 if(legacy)vm.runInContext('Object.fromEntries=undefined;Array.prototype.at=undefined;',sandbox);
 new vm.Script(bundle,{filename:'dist/douyin/game.js'}).runInContext(sandbox,{timeout:2000});
 const flush=()=>{const now=[...frames.values()];frames.clear();if(now.length)texts.length=0;now.forEach(fn=>fn());};flush();
 const touch=(x,y)=>{const scale=(800-48-12)/800,px=(390-390*scale)/2+x*scale,py=48+y*scale;calls.TouchStart({changedTouches:[{clientX:px,clientY:py,identifier:1}]});flush();calls.TouchEnd({changedTouches:[{clientX:px,clientY:py,identifier:1}]});flush();};
 const button=label=>{const found=texts.findLast(t=>t.value===label);assert.ok(found,`expected Canvas button ${label}`);touch(found.x,found.y-4);};
 return {texts,calls,frames,saved,canvas,canvasCount,sandbox,navigation,flush,touch,button};
}
test('final Douyin bundle parses and starts in a DOM-free tt VM mock',()=>{const h=runtime();assert.equal(h.canvasCount,1);assert.equal(h.canvas.width,780);assert.equal(h.canvas.height,1600);assert.ok(h.texts.some(t=>t.value==='快递收纳站'));h.touch(76,634);h.touch(102.3,315.2);h.touch(195,634);h.touch(102.3,407.8);assert.ok(h.texts.some(t=>t.value==='刚刚好，出库啦！'));const value=JSON.parse([...h.saved.values()][0]);assert.deepEqual(value.completed,[1]);h.calls.Hide();assert.equal(h.frames.size,0);h.calls.Show();assert.ok(h.frames.size>0);h.flush();assert.equal('document' in h.sandbox,false);assert.equal('window' in h.sandbox,false);});
test('final bundle sidebar button invokes real API path only after explicit click and tracks latest onShow',async()=>{const h=runtime({sidebar:true});assert.equal(h.navigation.length,0);h.button('侧边栏复访');assert.equal(h.navigation.length,0);h.button('打开侧边栏');assert.equal(h.navigation.length,1);assert.equal(h.navigation[0].scene,'sidebar');h.navigation[0].success({errMsg:'navigateToScene:ok'});await Promise.resolve();h.flush();assert.equal(h.texts.some(t=>t.value==='复访已确认'),false);h.calls.Hide();h.calls.Show({launch_from:'homepage',location:'sidebar_card'});h.flush();assert.ok(h.texts.some(t=>t.value==='复访已确认'));assert.deepEqual(JSON.parse([...h.saved.values()][0]).completed,[]);h.calls.Show({launch_from:'other',location:'other'});h.flush();assert.ok(h.texts.some(t=>t.value==='侧边栏复访'));});
test('candidate does not require Array.at, Object.fromEntries or optional setLineDash',()=>{const h=runtime({legacy:true});h.touch(76,634);h.touch(102.3,315.2);h.button('↶ 撤回');assert.deepEqual(JSON.parse([...h.saved.values()][0]).state.placements,{});assert.equal(/\.at\s*\(|Object\.fromEntries|structuredClone|\?\.(?!\d)|\?\?/.test(bundle),false);});
test('generated platform config uses only the verified nonsecret AppID',()=>{const config=JSON.parse(readFileSync(root+'dist/douyin/project.config.json'));assert.equal(config.appid,'tt8a23fc9e145a412a02');assert.equal(config.projectname,'快递收纳站');assert.equal(JSON.parse(readFileSync(root+'dist/douyin/game.json')).deviceOrientation,'portrait');});
test('standalone browser file embeds game code and audio without module fetches',()=>{const html=readFileSync(root+'dist/parcel-demo.html','utf8');assert.ok(html.includes('function startGame(platform)'));assert.ok(html.includes('data:audio/wav;base64,'));assert.equal(/<script[^>]+src=/.test(html),false);assert.equal(/<link[^>]+href="(?:https?:|\/)\//.test(html),false);const code=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert.doesNotThrow(()=>new vm.Script(code));});
test('AppID test override works and canonical verified build is restored',()=>{try{execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,DOUYIN_APP_ID:''}});assert.equal(JSON.parse(readFileSync(root+'dist/douyin/project.config.json')).appid,'');}finally{execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root,env:{...process.env,DOUYIN_APP_ID:'tt8a23fc9e145a412a02'}});}assert.equal(JSON.parse(readFileSync(root+'dist/douyin/project.config.json')).appid,'tt8a23fc9e145a412a02');});
