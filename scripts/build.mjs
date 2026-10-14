/** Fixed-graph assembler for this small, audited dependency-free prototype only.
 * Exact imports/exports are asserted. This is NOT a general JavaScript compiler.
 * No syntax transpilation; the real Douyin compiler/runtime still must be tested.
 */
import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const config=JSON.parse(await readFile(path.join(root,'config/douyin.json'),'utf8'));
const appid=process.env.DOUYIN_APP_ID===undefined?config.appid:process.env.DOUYIN_APP_ID;
if(appid!==''&&!/^tt[a-zA-Z0-9]{8,64}$/.test(appid))throw Error('Invalid DOUYIN_APP_ID override');
const graph=[
 ['src/rules.js',[],['normalizeShape','rotateShape','shapeKey','getPiece','getShape','createState','occupiedCells','canPlace','applyAction','isWin','remainingCells','restoreState']],
 ['src/levels.js',["import {normalizeShape,rotateShape,shapeKey} from './rules.js';"],['LEVELS','getLevel']],
 ['src/storage.js',["import {LEVELS,getLevel} from './levels.js';","import {createState,restoreState} from './rules.js';"],['SAVE_KEY','SAVE_VERSION','freshSave','loadSave','writeSave']],
 ['src/game.js',["import {LEVELS,getLevel} from './levels.js';","import {createState,applyAction,getShape,occupiedCells,canPlace,isWin,remainingCells} from './rules.js';","import {loadSave,writeSave} from './storage.js';"],['startGame']]
];
const declared=new Set();
async function auditedModule(file,imports,exports){
 let source=await readFile(path.join(root,file),'utf8');
 const actualImports=source.match(/^import[^\n]*$/gm)||[];
 if(JSON.stringify(actualImports)!==JSON.stringify(imports))throw Error(`Unreviewed import graph: ${file}`);
 const actualExports=[...source.matchAll(/^export (?:function|const)\s+(\w+)/gm)].map(m=>m[1]);
 if(JSON.stringify(actualExports)!==JSON.stringify(exports))throw Error(`Unreviewed exports: ${file}`);
 for(const name of actualExports){if(declared.has(name))throw Error(`Duplicate export: ${name}`);declared.add(name);}
 source=source.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,'');
 if(/\bimport\s*\(|^\s*(?:export|import)\b/m.test(source))throw Error(`Unsupported module syntax: ${file}`);
 return `// ${file}\n${source}`;
}
const core=(await Promise.all(graph.map(args=>auditedModule(...args)))).join('\n');
const sidebar=await auditedModule('platforms/douyin-sidebar.js',[],['createDouyinSidebar']);
const tt=await auditedModule('platforms/tt.js',["import {createDouyinSidebar} from './douyin-sidebar.js';"],['createTTPlatform']);
const browser=await auditedModule('platforms/browser-adapter.js',[],['createBrowserPlatform']);
const names=['tap','place','squeeze','error','win'];
const out=path.join(root,'dist');await mkdir(path.join(out,'douyin/assets'),{recursive:true});
const audio=Object.fromEntries(names.map(name=>[name,`assets/${name}.wav`]));
const ttCode=`(function(){\n'use strict';\n${core}\n${sidebar}\n${tt}\nconst platform=createTTPlatform(tt,{requestAnimationFrame,cancelAnimationFrame},${JSON.stringify(audio)});\nstartGame(platform);\n})();\n`;
await writeFile(path.join(out,'douyin/game.js'),ttCode);
await writeFile(path.join(out,'douyin/game.json'),JSON.stringify({deviceOrientation:'portrait',showStatusBar:false,menuButtonStyle:'light'},null,2)+'\n');
await writeFile(path.join(out,'douyin/project.config.json'),JSON.stringify({description:config.description,projectname:config.projectname,appid,setting:{es6:true}},null,2)+'\n');
const embedded={};for(const name of names){const file=path.join(root,`assets/${name}.wav`);await copyFile(file,path.join(out,`douyin/assets/${name}.wav`));embedded[name]='data:audio/wav;base64,'+(await readFile(file)).toString('base64');}
const bootstrap=`const canvas=document.getElementById('game');const platform=createBrowserPlatform(canvas,window,${JSON.stringify(embedded)});const game=startGame(platform);window.addEventListener('pagehide',event=>{if(!event.persisted){game.destroy();platform.destroy();}});`;
const base=(await readFile(path.join(root,'index.html'),'utf8')).replace('<script type="module" src="platforms/browser.js"></script>',`<script>(function(){'use strict';\n${core}\n${browser}\n${bootstrap}\n})();</script>`);
await writeFile(path.join(out,'parcel-demo.html'),base);
await writeFile(path.join(out,'README.txt'),'parcel-demo.html: self-contained browser demo, all game controls drawn on Canvas.\ndouyin/: candidate source import directory for verified nonsecret AppID. This build step does not upload, compile with official tools, approve, or phone-verify anything.\nBuild uses an explicit audited module graph, not a general bundler or transpiler.\n');
const files=['game.js','game.json','project.config.json',...names.map(name=>`assets/${name}.wav`)];
const hashes={};for(const file of files)hashes[file]=createHash('sha256').update(await readFile(path.join(out,'douyin',file))).digest('hex');
await writeFile(path.join(out,'douyin-build-manifest.json'),JSON.stringify({appid,projectname:config.projectname,version:config.version,files:hashes},null,2)+'\n');
console.log(`Built dist/parcel-demo.html and dist/douyin for ${config.projectname}; AppID=${appid||'(empty test override)'}. Official compilation, upload and phone validation are separate.`);
