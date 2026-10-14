/** Pure rules. Cells are integer [x,y] coordinates, relative to normalized top-left. */
export function normalizeShape(cells) {
  if (!Array.isArray(cells) || !cells.length || cells.some(c => !Array.isArray(c) || c.length !== 2 || c.some(n => !Number.isInteger(n)))) throw new TypeError('Invalid polyomino');
  const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
  return [...new Map(cells.map(([x,y]) => [`${x-minX},${y-minY}`, [x-minX,y-minY]])).values()].sort((a,b) => a[1]-b[1] || a[0]-b[0]);
}
export function rotateShape(cells, turns = 1) {
  if (!Number.isInteger(turns)) throw new TypeError('Rotation must be integer quarter turns');
  let result = normalizeShape(cells);
  for (let n = 0; n < ((turns % 4) + 4) % 4; n++) result = normalizeShape(result.map(([x,y]) => [-y,x]));
  return result;
}
export function shapeKey(cells) { return JSON.stringify(normalizeShape(cells)); }
export function getPiece(level, id) { return level.pieces.find(p => p.id === id); }
export function getShape(piece, form = {}) { return rotateShape(form.compressed && piece.soft ? piece.compressedShape : piece.shape, form.rotation || 0); }
export function createState(level) {
  return { levelId: level.id, placements: {}, forms: Object.fromEntries(level.pieces.map(p => [p.id, {rotation: 0, compressed: !!p.startCompressed}])), history: [], moves: 0 };
}
export function occupiedCells(level, state, exceptId = null) {
  const occupied = new Map();
  for (const [id, position] of Object.entries(state.placements)) {
    if (id === exceptId) continue;
    const piece = getPiece(level,id);
    if (!piece) continue;
    for (const [x,y] of getShape(piece,state.forms[id])) occupied.set(`${position.x+x},${position.y+y}`,id);
  }
  return occupied;
}
export function canPlace(level,state,id,x,y,form = state.forms[id]) {
  const piece = getPiece(level,id);
  if (!piece || !Number.isInteger(x) || !Number.isInteger(y)) return {ok:false,reason:'请把包裹放在格子里'};
  const blocked = new Set(level.blocked.map(c=>c.join(','))), occupied = occupiedCells(level,state,id);
  for (const [dx,dy] of getShape(piece,form)) {
    const px=x+dx,py=y+dy,key=`${px},${py}`;
    if(px<0||py<0||px>=level.width||py>=level.height) return {ok:false,reason:'包裹超出箱子啦，往里挪一点'};
    if(blocked.has(key)) return {ok:false,reason:'这里是固定隔板，不能放包裹'};
    if(occupied.has(key)) return {ok:false,reason:'包裹碰在一起了，换个位置试试'};
  }
  return {ok:true,reason:''};
}
const snapshot = state => ({levelId:state.levelId, placements:structuredClone(state.placements), forms:structuredClone(state.forms), moves:state.moves});
function commit(state,next) { return {...next,history:[...state.history,snapshot(state)].slice(-100),moves:state.moves+1}; }
export function applyAction(level,state,action) {
  const fail = reason => ({ok:false,state,reason});
  if (!action || !action.type) return fail('未知操作');
  if (action.type === 'undo') {
    if(!state.history.length) return fail('还没有可以撤回的操作');
    return {ok:true,state:{...state.history.at(-1),history:state.history.slice(0,-1)},reason:''};
  }
  if(action.type === 'reset') return {ok:true,state:createState(level),reason:''};
  const piece=getPiece(level,action.pieceId);
  if(!piece) return fail('请先选一个包裹');
  const next=snapshot(state), id=piece.id;
  if(action.type==='place') {
    const check=canPlace(level,state,id,action.x,action.y);
    if(!check.ok) return fail(check.reason);
    if(state.placements[id]?.x===action.x && state.placements[id]?.y===action.y) return fail('已经放在这里了');
    next.placements[id]={x:action.x,y:action.y};
  } else if(action.type==='remove') {
    if(!state.placements[id]) return fail('这个包裹还没有装箱');
    delete next.placements[id];
  } else if(action.type==='rotate' || action.type==='compress') {
    const form={...state.forms[id]};
    if(action.type==='rotate') form.rotation=(form.rotation+1)%4;
    else {
      if(!piece.soft) return fail('只有粉色软包可以压缩');
      form.compressed=!form.compressed;
    }
    const at=state.placements[id];
    if(at) {
      const check=canPlace(level,state,id,at.x,at.y,form);
      if(!check.ok) return fail(`${check.reason}；可以先取出再变形`);
    }
    next.forms[id]=form;
  } else return fail('未知操作');
  return {ok:true,state:commit(state,next),reason:''};
}
export function isWin(level,state) {
  return level.pieces.every(p=>state.placements[p.id] && canPlace(level,state,p.id,state.placements[p.id].x,state.placements[p.id].y).ok)
    && occupiedCells(level,state).size === level.width*level.height-level.blocked.length;
}
export function remainingCells(level,state) { return level.width*level.height-level.blocked.length-occupiedCells(level,state).size; }
export function restoreState(level,data) {
  const clean=createState(level);
  if(!data || data.levelId!==level.id || !data.forms || !data.placements || typeof data.forms!=='object' || typeof data.placements!=='object' || Array.isArray(data.placements)) return clean;
  if(Object.keys(data.placements).some(id=>!getPiece(level,id))) return clean;
  for(const piece of level.pieces) {
    const form=data.forms[piece.id];
    if(!form || !Number.isInteger(form.rotation) || form.rotation<0 || form.rotation>3 || typeof form.compressed!=='boolean' || (!piece.soft&&form.compressed)) return createState(level);
    clean.forms[piece.id]={rotation:form.rotation,compressed:form.compressed};
  }
  for(const piece of level.pieces) {
    const at=data.placements[piece.id];
    if(!at) continue;
    if(!canPlace(level,clean,piece.id,at.x,at.y).ok) return createState(level);
    clean.placements[piece.id]={x:at.x,y:at.y};
  }
  clean.moves=Number.isSafeInteger(data.moves)&&data.moves>=0&&data.moves<=100000 ? data.moves:0;
  return clean;
}
