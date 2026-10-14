// Deliberately tiny, fixed-file spike assembler. Not a general ESM compiler.
// Production game projects should use a vetted bundler with a locked version.
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + 'dist/douyin/';
await mkdir(out + 'assets', { recursive: true });
const inputs = ['src/core.js','src/renderer.js','src/runtime.js','adapters/tt.js','adapters/douyin-sidebar.js'];
const parts = await Promise.all(inputs.map(async path => '// ' + path + '\n' + (await readFile(root + path,'utf8')).replace(/^import .*;\n/gm,'').replace(/^export /gm,'')));
const entry = '\nconst sidebar = createDouyinSidebar(tt);\nconst platform = createTTPlatform(tt, { requestAnimationFrame, cancelAnimationFrame }, {tap:"assets/tap.wav"});\nplatform.sidebar = sidebar;\nstartGame(platform);';
await writeFile(out + 'game.js', '(function(){\n"use strict";\n' + parts.join('\n') + entry + '\n})();\n');
await writeFile(out + 'game.json', JSON.stringify({ deviceOrientation:'portrait' },null,2) + '\n');
await writeFile(out + 'project.config.json', JSON.stringify({ description:'Canvas2D runtime proof. AppID intentionally unset.',projectname:'runtime-spike',appid:'',setting:{es6:true}},null,2) + '\n');
await copyFile(root + 'assets/tap.wav', out + 'assets/tap.wav');
console.log('Generated dist/douyin. No AppID; not uploaded or platform-validated.');
