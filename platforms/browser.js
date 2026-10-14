import {startGame} from '../src/game.js';
import {createBrowserPlatform} from './browser-adapter.js';
const canvas=document.getElementById('game');
const platform=createBrowserPlatform(canvas,window,Object.fromEntries(['tap','place','squeeze','error','win'].map(name=>[name,`assets/${name}.wav`])));
const game=startGame(platform);
window.addEventListener('pagehide',()=>{game.destroy();platform.destroy();},{once:true});
