import {createState,applyAction,getShape,canPlace,isWin,restoreState} from './rules.js';
const clone=value=>JSON.parse(JSON.stringify(value));
export function currentBatch(level,state){return (level.batches||[level.pieces.map(p=>p.id)])[state.stage||0]||[];}
export function createCampaignState(level){return {...createState(level),stage:0,sealed:[],status:'playing',failure:null,reviveUsed:false,checkpoint:null,toolsUsed:{scan:false,locate:false},briefSeen:false};}
export function canSeal(level,state){return state.status!=='failed'&&(state.stage||0)<(level.batches||[[]]).length-1&&currentBatch(level,state).every(id=>state.placements[id]);}
export function findCompletion(level,state,options={}){
 const limit=options.maxNodes||60000,fixedIds=options.fixedIds||state.sealed||[],occupied=Array(level.width*level.height).fill(false),used=new Set(),solution=[];
 for(const [x,y]of level.blocked)occupied[y*level.width+x]=true;
 for(const id of fixedIds){const piece=level.pieces.find(p=>p.id===id),at=state.placements[id];if(!piece||!at||!canPlace(level,state,id,at.x,at.y).ok)return {status:'impossible',nodes:0,solution:[]};used.add(id);for(const [dx,dy]of getShape(piece,state.forms[id]))occupied[(at.y+dy)*level.width+at.x+dx]=true;solution.push({pieceId:id,x:at.x,y:at.y,...state.forms[id]});}
 const byCell=Array.from({length:occupied.length},()=>[]),candidates=[];
 for(const piece of level.pieces){if(used.has(piece.id))continue;const seen=new Set();for(const compressed of piece.soft?[false,true]:[false])for(let rotation=0;rotation<4;rotation++){
  const form={rotation,compressed},shape=getShape(piece,form),signature=JSON.stringify(shape);if(seen.has(signature))continue;seen.add(signature);
  for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){const cells=shape.map(([dx,dy])=>[x+dx,y+dy]);if(cells.some(([px,py])=>px>=level.width||py>=level.height||occupied[py*level.width+px]))continue;const c={pieceId:piece.id,x,y,rotation,compressed,cells:cells.map(([px,py])=>py*level.width+px)};candidates.push(c);for(const i of c.cells)byCell[i].push(c);}
 }}
 let nodes=0,aborted=false;
 function search(){if(++nodes>limit){aborted=true;return false;}if(used.size===level.pieces.length)return occupied.every(Boolean);let best=null;
  for(let i=0;i<occupied.length;i++){if(occupied[i])continue;const legal=byCell[i].filter(c=>!used.has(c.pieceId)&&c.cells.every(j=>!occupied[j]));if(!legal.length)return false;if(!best||legal.length<best.length)best=legal;if(best.length===1)break;}
  if(!best)return false;for(const c of best){used.add(c.pieceId);c.cells.forEach(i=>occupied[i]=true);solution.push(c);if(search())return true;solution.pop();c.cells.forEach(i=>occupied[i]=false);used.delete(c.pieceId);if(aborted)return false;}return false;
 }
 const ok=search();return {status:ok?'solved':aborted?'unknown':'impossible',nodes,solution:ok?solution.map(({cells,...p})=>p):[]};
}
export function applyCampaignAction(level,state,action){
 const fail=reason=>({ok:false,state,reason});if(!action||!action.type)return fail('未知操作');
 if(action.type==='reset')return {ok:true,state:createCampaignState(level),reason:''};
 if(action.type==='revive'){
  if(state.status!=='failed'||state.reviveUsed||!state.checkpoint)return fail('本箱无法再次拆签，仍可免费重开');
  return {ok:true,state:{...clone(state.checkpoint),history:[],status:'playing',failure:null,reviveUsed:true,checkpoint:null,toolsUsed:{...state.toolsUsed}},reason:'已拆开最后一道封签，调整位置后重新封签'};
 }
 if(state.status==='failed')return fail('本箱已卡住。可免费重开，或选择拆签复活');
 if(action.type==='seal'){
  if(!canSeal(level,state))return fail('先装入本批全部包裹，才能封签');
  const checkpoint=clone({...state,history:[],checkpoint:null}),sealed=[...state.sealed,...currentBatch(level,state)],next={...state,stage:state.stage+1,sealed,checkpoint,clue:null,history:[],moves:state.moves+1};
  const check=findCompletion(level,next);if(check.status==='impossible'){next.status='failed';next.failure='封签后留下的空隙形状，已无法装下后续货物。不是空格数量的问题。';}
  return {ok:true,state:next,reason:check.status==='unknown'?'验货暂未完成，可继续调整未封签货物':next.status==='failed'?next.failure:'本批已封签，下一批到站'};
 }
 if(action.type!=='undo'){
  if(state.sealed.includes(action.pieceId))return fail('这件包裹已封签，不能移动；免费重开始终可用');
  if(!currentBatch(level,state).includes(action.pieceId))return fail('后续货物可以提前查看，完成本批并封签后才能装入');
 }
 const result=applyAction(level,state,action);if(!result.ok)return result;
 const {stage,sealed,status,failure,reviveUsed,checkpoint,toolsUsed}=state;
 return {...result,state:{...state,...result.state,stage,sealed:[...sealed],status,failure,reviveUsed,checkpoint,toolsUsed:{...toolsUsed}}};
}
export function campaignWin(level,state){return state.status!=='failed'&&isWin(level,state);}
export function restoreCampaignState(level,data){
 const clean={...createCampaignState(level),...restoreState(level,data)};if(!data)return clean;
 const batches=level.batches||[level.pieces.map(p=>p.id)],stage=Number.isInteger(data.stage)&&data.stage>=0&&data.stage<batches.length?data.stage:0,expected=[].concat(...batches.slice(0,stage));
 if(expected.some(id=>!clean.placements[id])||Object.keys(clean.placements).some(id=>![].concat(...batches.slice(0,stage+1)).includes(id)))return createCampaignState(level);
 clean.briefSeen=data.briefSeen===true;clean.stage=stage;clean.sealed=expected;clean.reviveUsed=data.reviveUsed===true;clean.toolsUsed={scan:!!(data.toolsUsed&&data.toolsUsed.scan),locate:!!(data.toolsUsed&&data.toolsUsed.locate)};
 if(data.checkpoint&&typeof data.checkpoint==='object'&&stage>0){const raw={...data.checkpoint,checkpoint:null,status:'playing'},prior=restoreCampaignState(level,raw);if(prior.stage===stage-1&&prior.levelId===level.id&&currentBatch(level,prior).every(id=>prior.placements[id]))clean.checkpoint=prior;}
 if(data.clue&&clean.toolsUsed.locate){const c=data.clue,piece=level.pieces.find(p=>p.id===c.pieceId),probe={...clean,placements:{}};for(const id of clean.sealed)probe.placements[id]=clean.placements[id];if(piece&&Number.isInteger(c.rotation)&&c.rotation>=0&&c.rotation<4&&typeof c.compressed==='boolean'&&canPlace(level,probe,c.pieceId,c.x,c.y,c).ok)clean.clue={pieceId:c.pieceId,x:c.x,y:c.y,rotation:c.rotation,compressed:c.compressed};}
 if(data.status==='failed'&&clean.checkpoint&&findCompletion(level,clean).status==='impossible'){clean.status='failed';clean.failure='封签后的空隙已无法装下后续货物。';}
 return clean;
}
