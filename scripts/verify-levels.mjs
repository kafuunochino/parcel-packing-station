import {LEVELS} from '../src/levels.js';
import {createState,applyAction,isWin} from '../src/rules.js';
for(const level of LEVELS) {
 let state=createState(level);
 for(const p of level.solution) {
  if(state.forms[p.pieceId].compressed!==p.compressed)state=applyAction(level,state,{type:'compress',pieceId:p.pieceId}).state;
  for(let r=0;r<p.rotation;r++)state=applyAction(level,state,{type:'rotate',pieceId:p.pieceId}).state;
  const result=applyAction(level,state,{type:'place',...p});
  if(!result.ok)throw new Error(`${level.id}: ${result.reason}`);state=result.state;
 }
 if(!isWin(level,state))throw new Error(`Level ${level.id} is not solved`);
 console.log(`✓ 第 ${String(level.id).padStart(2,'0')} 关 ${level.width}×${level.height}，${level.pieces.length} 件，参考解 ${state.moves} 步：${level.title}`);
}
console.log('10 / 10 手工关卡参考解通过规则引擎验证。');
