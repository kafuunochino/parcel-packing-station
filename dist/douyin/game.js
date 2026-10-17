(function(){
'use strict';
// src/rules.js
/** Pure rules. Cells are integer [x,y] coordinates, relative to normalized top-left. */
function normalizeShape(cells) {
  if (!Array.isArray(cells) || !cells.length || cells.some(c => !Array.isArray(c) || c.length !== 2 || c.some(n => !Number.isInteger(n)))) throw new TypeError('Invalid polyomino');
  const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
  return [...new Map(cells.map(([x,y]) => [`${x-minX},${y-minY}`, [x-minX,y-minY]])).values()].sort((a,b) => a[1]-b[1] || a[0]-b[0]);
}
function rotateShape(cells, turns = 1) {
  if (!Number.isInteger(turns)) throw new TypeError('Rotation must be integer quarter turns');
  let result = normalizeShape(cells);
  for (let n = 0; n < ((turns % 4) + 4) % 4; n++) result = normalizeShape(result.map(([x,y]) => [-y,x]));
  return result;
}
function shapeKey(cells) { return JSON.stringify(normalizeShape(cells)); }
function getPiece(level, id) { return level.pieces.find(p => p.id === id); }
function getShape(piece, form = {}) { return rotateShape(form.compressed && piece.soft ? piece.compressedShape : piece.shape, form.rotation || 0); }
function createState(level) {
  const forms={};
  level.pieces.forEach(p=>{forms[p.id]={rotation:0,compressed:!!p.startCompressed};});
  return { levelId: level.id, placements: {}, forms, history: [], moves: 0 };
}
function occupiedCells(level, state, exceptId = null) {
  const occupied = new Map();
  for (const [id, position] of Object.entries(state.placements)) {
    if (id === exceptId) continue;
    const piece = getPiece(level,id);
    if (!piece) continue;
    for (const [x,y] of getShape(piece,state.forms[id])) occupied.set(`${position.x+x},${position.y+y}`,id);
  }
  return occupied;
}
function canPlace(level,state,id,x,y,form = state.forms[id]) {
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
function copyRecords(records) { const copy={};Object.keys(records).forEach(id=>{copy[id]={...records[id]};});return copy; }
const snapshot = state => ({levelId:state.levelId, placements:copyRecords(state.placements), forms:copyRecords(state.forms), moves:state.moves});
function commit(state,next) { return {...next,history:[...state.history,snapshot(state)].slice(-100),moves:state.moves+1}; }
function applyAction(level,state,action) {
  const fail = reason => ({ok:false,state,reason});
  if (!action || !action.type) return fail('未知操作');
  if (action.type === 'undo') {
    if(!state.history.length) return fail('还没有可以撤回的操作');
    return {ok:true,state:{...state.history[state.history.length-1],history:state.history.slice(0,-1)},reason:''};
  }
  if(action.type === 'reset') return {ok:true,state:createState(level),reason:''};
  const piece=getPiece(level,action.pieceId);
  if(!piece) return fail('请先选一个包裹');
  const next=snapshot(state), id=piece.id;
  if(action.type==='place') {
    const check=canPlace(level,state,id,action.x,action.y);
    if(!check.ok) return fail(check.reason);
    if(state.placements[id] && state.placements[id].x===action.x && state.placements[id].y===action.y) return fail('已经放在这里了');
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
function isWin(level,state) {
  return level.pieces.every(p=>state.placements[p.id] && canPlace(level,state,p.id,state.placements[p.id].x,state.placements[p.id].y).ok)
    && occupiedCells(level,state).size === level.width*level.height-level.blocked.length;
}
function remainingCells(level,state) { return level.width*level.height-level.blocked.length-occupiedCells(level,state).size; }
function restoreState(level,data) {
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

// src/campaign-designs.js
// Frozen offline-designed layouts. Every starting position and seal path is verified.
const CAMPAIGN_DESIGNS=[
  {
    "id": 11,
    "title": "留给后车的长缝",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "AABB",
      "AABB",
      "CCCC",
      "DDDD"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "B",
        "C",
        "D"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 12,
    "title": "第一道封签",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "DDCA",
      "DDCA",
      "BCCA",
      "BBCA"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "C",
        "B"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 13,
    "title": "拐角别先占满",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "SSDD",
      "SAAA",
      "CAAB",
      "CCBB"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "S",
        "D",
        "C",
        "B"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 14,
    "title": "不是空格越多越好",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "ADSS",
      "ADSS",
      "ABBC",
      "AABC"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "S",
        "B",
        "C"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 15,
    "title": "给软包留个弯",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "EBCCC",
      "EBBCD",
      "EAACD",
      "AAADD"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "E",
        "B",
        "C",
        "D"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 16,
    "title": "两批心意同一箱",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "DDAAA",
      "BBBAA",
      "CCBSS",
      "CCCSS"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "B",
        "C",
        "S"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 17,
    "title": "短边上的约定",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "SSCCC",
      "SBBBD",
      "EEBDD",
      "AAAAD"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "S",
        "C",
        "B",
        "D",
        "E"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 18,
    "title": "纸箱里的通道",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CCEEE",
      "CBBBE",
      "DDBFF",
      "DDAAA"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "E",
        "B",
        "D",
        "F"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 3,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 19,
    "title": "先看清下一批",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "DDDCC",
      "DASSC",
      "EASBC",
      "EABBB"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "C",
        "S",
        "E",
        "B"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 20,
    "title": "早班交接单",
    "tag": "第2章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "AAAAA",
      "CCSSB",
      "CCSSB",
      "DDBBB"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "S",
        "B",
        "D"
      ]
    ],
    "chapter": 2,
    "story": "阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 21,
    "title": "留给后车的长缝 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "BBBAA",
      "BBC#A",
      "ECCDA",
      "ECDD#"
    ],
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "B",
        "C",
        "E",
        "D"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 22,
    "title": "第一道封签 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "FB#CC",
      "FBBCC",
      "FAASS",
      "DDASS",
      "DDEEE"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "F",
        "B",
        "C",
        "S",
        "D",
        "E"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 23,
    "title": "拐角别先占满 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "A#CSS",
      "AACSB",
      "DAC#B",
      "DDBBB"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "S",
        "B",
        "D"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 2,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 24,
    "title": "不是空格越多越好 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "EEDGG",
      "#EDDD",
      "FFAAH",
      "BFCAH",
      "BBCCC"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "E",
        "D",
        "G",
        "F",
        "H",
        "B",
        "C"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 25,
    "title": "给软包留个弯 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "SS#CC",
      "SAD#C",
      "AADDD",
      "BBBBD"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "S",
        "C",
        "D",
        "B"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 26,
    "title": "两批心意同一箱 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "EEEEE",
      "BBAAA",
      "BCCDD",
      "SSCDD",
      "SS#FF"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "E",
        "B",
        "C",
        "D",
        "S",
        "F"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 1,
      "compressed": false
    }
  },
  {
    "id": 27,
    "title": "短边上的约定 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "AACFF",
      "AACCB",
      "EE#DB",
      "E#DDB"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "F",
        "B",
        "E",
        "D"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 2,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 28,
    "title": "纸箱里的通道 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CCASS",
      "AAASS",
      "BB#FF",
      "BBEFD",
      "EEEDD"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "S",
        "B",
        "F",
        "E",
        "D"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 29,
    "title": "先看清下一批 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "SSCCC",
      "SBBCA",
      "BBDAA",
      "#BD#A"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "S",
        "C",
        "B",
        "D"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 30,
    "title": "早班交接单 · 雨天隔板",
    "tag": "第3章 · 2批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CCCBB",
      "CCEBB",
      "DEEB#",
      "DDEFF",
      "AAAAF"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "B",
        "E",
        "D",
        "F"
      ]
    ],
    "chapter": 3,
    "story": "屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 31,
    "title": "留给后车的长缝 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "BBFSSA",
      "BBFSAA",
      "#BCCD#",
      "EEECDD",
      "#ECCDD"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "B",
        "F",
        "S"
      ],
      [
        "C",
        "D",
        "E"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 32,
    "title": "第一道封签 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "EEESSC",
      "BBESSC",
      "#BEACC",
      "DDAA##",
      "DD#FFF"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "E",
        "S",
        "C"
      ],
      [
        "B",
        "D",
        "F"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 33,
    "title": "拐角别先占满 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "#AABBE",
      "AAACBE",
      "DDCCBE",
      "DDGCB#",
      "DGGFFF"
    ],
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "B",
        "E",
        "C"
      ],
      [
        "D",
        "G",
        "F"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 3,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 34,
    "title": "不是空格越多越好 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "##CCCC",
      "DDCSSB",
      "DDASSB",
      "E#AAFB",
      "EEAAFF"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "D",
        "S"
      ],
      [
        "B",
        "E",
        "F"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 35,
    "title": "给软包留个弯 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "DDDGEE",
      "DAAGEE",
      "CCAFFF",
      "CSSB#F",
      "CSBBB#"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "G",
        "E",
        "C"
      ],
      [
        "F",
        "S",
        "B"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 4,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 36,
    "title": "两批心意同一箱 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "GGAC#F",
      "DAACCF",
      "DDACCB",
      "DEEBBB",
      "DE#HHB"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "G",
        "C",
        "F",
        "D"
      ],
      [
        "B",
        "E",
        "H"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 37,
    "title": "短边上的约定 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "FFAAA#",
      "#FAASS",
      "EECBSD",
      "E#CBBD",
      "ECCCBD"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "F",
        "S",
        "E"
      ],
      [
        "C",
        "B",
        "D"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 38,
    "title": "纸箱里的通道 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "DDDASS",
      "CDEASS",
      "CEEAFF",
      "C##BF#",
      "CCBBB#"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "S",
        "C"
      ],
      [
        "E",
        "F",
        "B"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 39,
    "title": "先看清下一批 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "#DG#FF",
      "DDGCCF",
      "DACCEF",
      "BAAAEF",
      "BBBEEE"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "D",
        "G",
        "F"
      ],
      [
        "C",
        "E",
        "B"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 40,
    "title": "早班交接单 · 夜班接力",
    "tag": "第4章 · 3批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CCFFEE",
      "CBBA#E",
      "CBDAAE",
      "CBDSSE",
      "#DDSS#"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "F",
        "E"
      ],
      [
        "B",
        "D",
        "S"
      ]
    ],
    "chapter": 4,
    "story": "夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 41,
    "title": "留给后车的长缝 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "#HHEGG",
      "#FFEE#",
      "FFF#CB",
      "DDCCCB",
      "DAASSB",
      "AAASBB"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "H",
        "E",
        "G"
      ],
      [
        "F",
        "C",
        "B"
      ],
      [
        "D",
        "S"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 42,
    "title": "第一道封签 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "GGJJJJ",
      "GECJDD",
      "GECCDD",
      "EEC#FF",
      "HHCAFF",
      "BBBAA#"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "G",
        "J",
        "E"
      ],
      [
        "C",
        "D",
        "F"
      ],
      [
        "H",
        "B"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 2,
      "y": 1,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 43,
    "title": "拐角别先占满 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "FFSSBE",
      "FGSBBE",
      "GGGCEE",
      "A#CCCH",
      "A#CDDH",
      "AA#DDD"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "F",
        "S",
        "B"
      ],
      [
        "E",
        "G",
        "C"
      ],
      [
        "H",
        "D"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 44,
    "title": "不是空格越多越好 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CC#DGE",
      "SSDDGE",
      "SSD#AE",
      "BBD#AE",
      "B#FFAA",
      "BBFHHH"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "D",
        "G"
      ],
      [
        "E",
        "S",
        "B"
      ],
      [
        "F",
        "H"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 2,
      "y": 0,
      "rotation": 3,
      "compressed": false
    }
  },
  {
    "id": 45,
    "title": "给软包留个弯 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "AGGGFF",
      "AHCCCF",
      "AHHCCF",
      "AHDE#F",
      "JDDE#B",
      "JJDEBB"
    ],
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "G",
        "F",
        "H"
      ],
      [
        "C",
        "D",
        "E"
      ],
      [
        "J",
        "B"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 4,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 46,
    "title": "两批心意同一箱 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "BBBBGG",
      "SS#BFG",
      "SSHFFA",
      "DDH#AA",
      "DDCEAE",
      "#CCEEE"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "B",
        "G",
        "S"
      ],
      [
        "F",
        "H",
        "D"
      ],
      [
        "C",
        "E"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 47,
    "title": "短边上的约定 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "FGG##E",
      "FGG#EE",
      "FFSSAA",
      "F#SAAA",
      "DDCCCB",
      "DDDBBB"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "F",
        "G",
        "E"
      ],
      [
        "S",
        "D"
      ],
      [
        "C",
        "B"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 4,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 48,
    "title": "纸箱里的通道 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CCEEE#",
      "CCEHH#",
      "CADDDF",
      "JAABFF",
      "JAABBF",
      "GGGBBF"
    ],
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "E",
        "H"
      ],
      [
        "D",
        "F",
        "J"
      ],
      [
        "B",
        "G"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 49,
    "title": "先看清下一批 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "HHSSFF",
      "GHSBFF",
      "GGBBFE",
      "DCCCEE",
      "DDAAAE",
      "#DAA##"
    ],
    "soft": "S",
    "startCompressed": true,
    "batches": [
      [
        "A"
      ],
      [
        "H",
        "S",
        "F"
      ],
      [
        "G",
        "B",
        "E"
      ],
      [
        "D",
        "C"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 1,
      "y": 3,
      "rotation": 0,
      "compressed": false
    }
  },
  {
    "id": 50,
    "title": "早班交接单 · 最后一车",
    "tag": "第5章 · 4批交接",
    "hint": "先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。",
    "map": [
      "CCCCFF",
      "EECBBB",
      "E###BB",
      "#AAASS",
      "GGAASS",
      "GGGDDD"
    ],
    "soft": "S",
    "startCompressed": false,
    "batches": [
      [
        "A"
      ],
      [
        "C",
        "F",
        "E"
      ],
      [
        "B",
        "S"
      ],
      [
        "G",
        "D"
      ]
    ],
    "chapter": 5,
    "story": "最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。",
    "badSeal": {
      "pieceId": "A",
      "x": 0,
      "y": 0,
      "rotation": 0,
      "compressed": false
    }
  }
];

// src/levels.js
const colors=['mint','gold','blue','peach','lavender','lime','teal','sand'];
const labels=['茶叶礼盒','香氛小样','陶瓷杯','手工饼干','棉袜套装','桌面摆件','旅行套装','文具礼盒'];
/** These are handcrafted solved layouts, not randomized runtime boards. # = fixed separator. */
const designs=[
  {id:1,title:'第一箱，轻轻松松',tag:'入门 · 点击放置',hint:'点一个包裹，再点箱内左上角。把每一格都装满，就能出库。',map:['AAA','BBB']},
  {id:2,title:'转个弯，就合适',tag:'入门 · 旋转包裹',hint:'选好包裹后按「旋转」。L 形包裹换个方向，就能靠在一起。',map:['AAB','ABB','CCC']},
  {id:3,title:'给邻居留个位置',tag:'热身 · 拼形组合',hint:'不一定先放最大的。想想两只弯角包裹可以靠在哪边。',map:['AABB','ACCB','DDCC']},
  {id:4,title:'隔板不能动',tag:'热身 · 固定隔板',hint:'带斜纹的格子是隔板。先看边角，再安排中间的大包裹。',map:['#AAB','CAAB','CCDD','#CDD']},
  {id:5,title:'软包，挤一下！',tag:'新技能 · 软包压缩',hint:'粉色软包可以从 4 格挤成 3 格。选中它，按「挤一下」，空隙就出现了。',map:['SSAA','SBAA','BBCC'],soft:'S'},
  {id:6,title:'也要记得松一松',tag:'新技能 · 软包展开',hint:'这次软包已经压扁了。按「松一松」恢复 4 格，箱子才不会留空。',map:['AASS','ABSS','BBCC','#DDD'],soft:'S',startCompressed:true},
  {id:7,title:'满满一箱心意',tag:'进阶 · 六件拼箱',hint:'先辨认长条与方盒的落点，再让软包填好最后那个弯角。',map:['AAABB','ACCCB','DDSEE','DSSEE'],soft:'S'},
  {id:8,title:'两道隔板的考验',tag:'进阶 · 不规则空间',hint:'上下各一块隔板。大包裹要提前占好位置，别把空间切碎。',map:['#AAAB','CCABB','CDDBB','SDDEE','SS#EE'],soft:'S'},
  {id:9,title:'今天的最后一车',tag:'挑战 · 八件拼箱',hint:'软包这次需要 4 格。长条和大弯角很挑位置，不妨先从它们开始。',map:['AAABBB','ACCDBB','ECCDDD','ESSFFG','ESSFFG'],soft:'S',startCompressed:true},
  {id:10,title:'金牌装箱师',tag:'终章 · 九件大挑战',hint:'给四格长条预留一条边，让压缩后的软包嵌进转角。慢慢来，可以随时撤回。',map:['#AABBB','CAADBB','CCDDDE','FSSGGE','FSHGGE','FFHHHE'],soft:'S'}
];
designs.push(...CAMPAIGN_DESIGNS);
function makeLevel(d) {
  const groups=new Map(),blocked=[];
  d.map.forEach((row,y)=>[...row].forEach((id,x)=>{if(id==='#')blocked.push([x,y]);else {if(!groups.has(id))groups.set(id,[]);groups.get(id).push([x,y]);}}));
  const pieces=[],solution=[];
  let regular=0;
  for(const [id,cells] of groups) {
    const soft=id===d.soft, original=normalizeShape(cells),turns=d.id===1?0:(regular+d.id)%4;
    const piece={id,name:soft?'云朵软包':labels[regular%labels.length],color:soft?'pink':colors[regular%colors.length],soft,
      shape:soft?[[0,0],[1,0],[0,1],[1,1]]:rotateShape(original,turns),
      ...(soft?{compressedShape:[[0,0],[1,0],[0,1]],startCompressed:!!d.startCompressed}:{})};
    const compressed=soft&&cells.length===3, source=compressed?piece.compressedShape:piece.shape;
    const rotation=[0,1,2,3].find(r=>shapeKey(rotateShape(source,r))===shapeKey(original));
    if(rotation===undefined)throw new Error(`Invalid handmade layout ${d.id}/${id}`);
    pieces.push(piece);solution.push({pieceId:id,x:Math.min(...cells.map(c=>c[0])),y:Math.min(...cells.map(c=>c[1])),rotation,compressed});
    if(!soft)regular++;
  }
  const batches=d.batches||[pieces.map(p=>p.id)],order=[].concat(...batches);
  pieces.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));solution.sort((a,b)=>order.indexOf(a.pieceId)-order.indexOf(b.pieceId));
  return {id:d.id,title:d.title,tag:d.tag,hint:d.hint,batches,chapter:d.chapter||1,story:d.story||'阿乔把旧仓钥匙递给你：先把眼前这箱装好。',badSeal:d.badSeal||null,width:d.map[0].length,height:d.map.length,blocked,pieces,solution,solutionMap:d.map};
}
const LEVELS=designs.map(makeLevel);
const getLevel=id=>LEVELS.find(l=>l.id===id)||LEVELS[0];

// src/campaign-rules.js
const clone=value=>JSON.parse(JSON.stringify(value));
function currentBatch(level,state){return (level.batches||[level.pieces.map(p=>p.id)])[state.stage||0]||[];}
function createCampaignState(level){return {...createState(level),stage:0,sealed:[],status:'playing',failure:null,reviveUsed:false,checkpoint:null,toolsUsed:{scan:false,locate:false},briefSeen:false};}
function canSeal(level,state){return state.status!=='failed'&&(state.stage||0)<(level.batches||[[]]).length-1&&currentBatch(level,state).every(id=>state.placements[id]);}
function findCompletion(level,state,options={}){
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
function applyCampaignAction(level,state,action){
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
function campaignWin(level,state){return state.status!=='failed'&&isWin(level,state);}
function restoreCampaignState(level,data){
 const clean={...createCampaignState(level),...restoreState(level,data)};if(!data)return clean;
 const batches=level.batches||[level.pieces.map(p=>p.id)],stage=Number.isInteger(data.stage)&&data.stage>=0&&data.stage<batches.length?data.stage:0,expected=[].concat(...batches.slice(0,stage));
 if(expected.some(id=>!clean.placements[id])||Object.keys(clean.placements).some(id=>![].concat(...batches.slice(0,stage+1)).includes(id)))return createCampaignState(level);
 clean.briefSeen=data.briefSeen===true;clean.stage=stage;clean.sealed=expected;clean.reviveUsed=data.reviveUsed===true;clean.toolsUsed={scan:!!(data.toolsUsed&&data.toolsUsed.scan),locate:!!(data.toolsUsed&&data.toolsUsed.locate)};
 if(data.checkpoint&&typeof data.checkpoint==='object'&&stage>0){const raw={...data.checkpoint,checkpoint:null,status:'playing'},prior=restoreCampaignState(level,raw);if(prior.stage===stage-1&&prior.levelId===level.id&&currentBatch(level,prior).every(id=>prior.placements[id]))clean.checkpoint=prior;}
 if(data.clue&&clean.toolsUsed.locate){const c=data.clue,piece=level.pieces.find(p=>p.id===c.pieceId),probe={...clean,placements:{}};for(const id of clean.sealed)probe.placements[id]=clean.placements[id];if(piece&&Number.isInteger(c.rotation)&&c.rotation>=0&&c.rotation<4&&typeof c.compressed==='boolean'&&canPlace(level,probe,c.pieceId,c.x,c.y,c).ok)clean.clue={pieceId:c.pieceId,x:c.x,y:c.y,rotation:c.rotation,compressed:c.compressed};}
 if(data.status==='failed'&&clean.checkpoint&&findCompletion(level,clean).status==='impossible'){clean.status='failed';clean.failure='封签后的空隙已无法装下后续货物。';}
 return clean;
}

// src/economy.js
const TOOL_PRICES={scan:6,locate:8,revive:10};
function awardClear(save,levelId){
 const awarded=Array.isArray(save.awardedLevels)?save.awardedLevels:[];if(awarded.includes(levelId))return {save,earned:0};
 return {save:{...save,coins:Math.min(100000,(save.coins||0)+20),awardedLevels:[...awarded,levelId]},earned:20};
}
function useBenefit(level,state,kind){
 if(kind==='revive')return applyCampaignAction(level,state,{type:'revive'});
 const fail=reason=>({ok:false,state,reason});if(state.status==='failed')return fail('先处理卡住的封签，或免费重开');
 if(!['scan','locate'].includes(kind))return fail('未知道具');if(state.toolsUsed[kind])return fail('这种道具每箱最多使用一次');
 if(kind==='scan'){
  if(!canSeal(level,state))return fail('先摆好本批包裹，再使用封签预检');
  const check=findCompletion(level,state,{fixedIds:[...state.sealed,...currentBatch(level,state)]});if(check.status==='unknown')return fail('预检未完成，不扣金币或次数');
  return {ok:true,state:{...state,toolsUsed:{...state.toolsUsed,scan:true}},reason:check.status==='solved'?'预检通过：按这个位置封签，后续仍有可行拼法。':'预检提醒：此时封签会卡死。请先调整当前批的位置。',effect:{kind,status:check.status}};
 }
 const check=findCompletion(level,state);if(check.status!=='solved')return fail(check.status==='unknown'?'暂时未找到定位，不扣金币或次数':'已封签的形状造成死局，定位贴无法修复；可免费重开');
 const ids=currentBatch(level,state),id=ids.find(id=>!state.placements[id])||ids[0],target=check.solution.find(p=>p.pieceId===id);
 if(!target)return fail('本批已完成，不扣金币或次数');
 return {ok:true,state:{...state,toolsUsed:{...state.toolsUsed,locate:true},clue:target},reason:`定位贴：${id}放在第${target.x+1}列、第${target.y+1}行；旋转${target.rotation*90}度${target.compressed?'，软包压缩':''}。`,effect:{kind,target}};
}
function purchaseBenefit(level,state,save,kind){
 const price=TOOL_PRICES[kind];if(!Number.isInteger(price))return {ok:false,state,save,reason:'未知道具'};
 if(!Number.isInteger(save.coins)||save.coins<price)return {ok:false,state,save,reason:'金币不足。仍可免费重开，金币只从通关获得。'};
 const result=useBenefit(level,state,kind);if(!result.ok)return {...result,save};
 return {...result,save:{...save,coins:save.coins-price},spent:price};
}

// src/rewards.js
// Reserved reward contract. No ad SDK, real ad unit, payment or network is enabled.
function createMockRewards(options={}){
 let active=null,counter=0,destroyed=false;
 const settle=status=>{if(!active)return false;const request=active;active=null;if(request.timer&&options.timers)options.timers.clearTimeout(request.timer);request.resolve({status,requestId:request.id});return true;};
 return {getState:()=>({mode:'mock',available:!destroyed,busy:!!active}),request({placement,context}={}){if(destroyed||active)return Promise.resolve({status:'unavailable',requestId:null});const id=`mock-${++counter}`;return new Promise(resolve=>{active={id,placement,context,resolve};if(options.timers)active.timer=options.timers.setTimeout(()=>{if(active&&active.id===id)settle('error');},options.timeoutMs||60000);});},completeMock(status){return ['completed','cancelled','unavailable','error'].includes(status)?settle(status):false;},cancel(){settle('cancelled');},destroy(){destroyed=true;settle('cancelled');}};
}
function createDisabledRewards(){let counter=0;return {getState:()=>({mode:'disabled',available:false,busy:false}),request:()=>Promise.resolve({status:'unavailable',requestId:`disabled-${++counter}`}),cancel(){},destroy(){}};}

// src/storage.js
const SAVE_KEY='parcel-packing-station:save:v1';
const SAVE_VERSION=2;
const freshSave=()=>({version:SAVE_VERSION,levelId:1,completed:[],bestMoves:{},sound:false,coins:0,awardedLevels:[],state:createCampaignState(LEVELS[0])});
function loadSave(storage) {
  try {
    const raw=storage ? storage.getItem(SAVE_KEY) : null;
    if(!raw)return {save:freshSave(),status:'new'};
    const data=JSON.parse(raw);
    if((!data || (data.version!==1&&data.version!==SAVE_VERSION)))return {save:freshSave(),status:'incompatible'};
    const level=getLevel(data.levelId),ids=new Set(LEVELS.map(l=>l.id));
    const completed=Array.isArray(data.completed)?[...new Set(data.completed.filter(id=>ids.has(id)))]:[];
    const bestMoves={};
    if(data.bestMoves&&typeof data.bestMoves==='object')for(const [id,moves] of Object.entries(data.bestMoves))if(ids.has(Number(id))&&Number.isSafeInteger(moves)&&moves>=0&&moves<100000)bestMoves[id]=moves;
    const awardedLevels=data.version===1?[...completed]:Array.isArray(data.awardedLevels)?[...new Set(data.awardedLevels.filter(id=>ids.has(id)))]:[];
    const coins=data.version===1?completed.length*20:Number.isSafeInteger(data.coins)&&data.coins>=0&&data.coins<=100000?data.coins:0;
    return {save:{version:SAVE_VERSION,levelId:level.id,completed,bestMoves,sound:data.sound===true,coins,awardedLevels,state:restoreCampaignState(level,data.state)},status:data.version===1?'migrated':'restored'};
  }catch(_error){return {save:freshSave(),status:'unavailable'};}
}
function writeSave(storage,save) {
  try {
    if(!storage)return false;
    const {history,...state}=save.state;
    storage.setItem(SAVE_KEY,JSON.stringify({...save,version:SAVE_VERSION,state,savedAt:new Date().toISOString()}));
    return true;
  }catch(_error){return false;}
}

// src/game.js
const C={ink:'#292c25',muted:'#aeb6a0',warehouse:'#30382f',beam:'#52604d',paper:'#fff2d1',kraft:'#c99554',edge:'#825b35',orange:'#f5b640',red:'#b95640',mint:'#99bf87',gold:'#edc15a',blue:'#85b9d2',peach:'#e49576',lavender:'#aa95c9',lime:'#c2ce75',teal:'#76b6aa',sand:'#d6b987',pink:'#e99ab8'};
const FONT='"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';
/** The entire game, including menus, is painted inside one Canvas. */
function startGame(platform) {
 const ctx=platform.canvas.getContext('2d');
 if(!ctx)throw new Error('A Canvas2D context is required');
 const loaded=loadSave(platform.storage);
 let save=loaded.save,level=getLevel(save.levelId),state=save.state,selected=null,screen='home',modal=null,trail=[],tutorialPage=0,trayPage=0,levelsPage=0,runToken=1,rewardPending=null,earned=0,animation=null,lastBenefit='';
 const rewards=platform.rewards||createDisabledRewards(),creditedRequests=new Set();
 let targets=[],size=platform.getSize(),layout=null,drag=null,frame=null,paused=false,destroyed=false,inputReady=false,toast='',toastUntil=0;
 let saveOK=loaded.status!=='unavailable';
 const disposers=[],sidebar=platform.sidebar||null;
 let sidebarState=sidebar?sidebar.getState():{available:false,enteredFromSidebar:false,pending:false};
 platform.audio.setMuted(!save.sound);
 function persist(){save.levelId=level.id;save.state=state;saveOK=writeSave(platform.storage,save);}
 function invalidate(){inputReady=false;targets=[];requestDraw();}
 function requestDraw(){if(!destroyed&&!paused&&frame===null)frame=platform.requestFrame(draw);}
 function notify(message){toast=message;toastUntil=Date.now()+2200;requestDraw();}
 if(sidebar)disposers.push(sidebar.subscribe(next=>{const returned=!sidebarState.enteredFromSidebar&&next.enteredFromSidebar;sidebarState=next;if(returned)notify('已从侧边栏回到仓库');invalidate();}));
 function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h);}
 function line(x,y,ex,ey,color,width=1){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
 function poly(points,color){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
 function rrect(x,y,w,h,r=3,fill,stroke){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
 function text(value,x,y,font=14,color=C.ink,weight=400,align='left'){ctx.font=`${weight} ${font}px ${FONT}`;ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillStyle=color;ctx.fillText(String(value),x,y);}
 function wrap(value,x,y,width,font=14,color=C.ink,lineHeight=22,maxLines=5){let current='',row=0;ctx.font=`400 ${font}px ${FONT}`;for(const ch of value){if(ctx.measureText(current+ch).width>width&&current){text(current,x,y+row*lineHeight,font,color);row++;current=ch;if(row>=maxLines)return;}else current+=ch;}if(current)text(current,x,y+row*lineHeight,font,color);}
 function barcode(x,y,w,h,color=C.ink){let offset=0;for(let i=0;offset<w;i++){const width=i%3===0?3:1;rect(x+offset,y,Math.min(width,w-offset),h,color);offset+=width+(i%2===0?2:3);}}
 function button(id,label,x,y,w,h,options={}){const disabled=!!options.disabled;ctx.globalAlpha=disabled ? .40 : 1;rect(x+1,y+3,w,h,C.ink);rrect(x,y,w,h,3,options.fill||C.paper,options.border||C.edge);text(label,x+w/2,y+h/2+5,options.font||14,options.color||C.ink,700,'center');if(options.tag)rect(x+6,y+6,4,h-12,C.orange);if(drag&&drag.hit&&drag.hit.id===id&&!drag.cancelled&&!disabled){ctx.globalAlpha=.18;rect(x+2,y+2,w-4,h-4,'#ffffff');}ctx.globalAlpha=1;targets.push({id,label,x,y,w,h,disabled,...options.data});}
 function dimensions(){
  size=platform.getSize();const safe={top:Math.max(0,Number(size.safeTop)||0),bottom:Math.max(0,Number(size.safeBottom)||0),left:Math.max(0,Number(size.safeLeft)||0),right:Math.max(0,Number(size.safeRight)||0)};
  const availableWidth=Math.max(1,size.width-safe.left-safe.right),W=Math.min(480,availableWidth),H=Math.max(1,size.height-safe.top-safe.bottom);
  return {W,H,scale:1,ox:safe.left+(availableWidth-W)/2,oy:safe.top,safeInsets:safe,compact:W<304||H<426,tight:H<482,board:null,footerY:H-54,trayY:H-(H<482?66:122)};
 }
 function logical(event){const l=layout||dimensions();return {x:event.x-l.ox,y:event.y-l.oy};}
 function warehouse(){
  rect(0,0,size.width,size.height,C.warehouse);
  for(let x=18;x<size.width;x+=180){rect(x,0,7,size.height,'#44513f');for(let y=70;y<size.height;y+=176){rect(x+20,y,64,56,'#45503e');rect(x+27,y+8,8,40,'#566045');rect(x+94,y+12,54,44,'#3f4939');}}
  poly([[size.width*.42,0],[size.width*.72,0],[size.width*.94,size.height],[size.width*.55,size.height]],'rgba(244,222,153,0.035)');
  for(let y=132;y<size.height;y+=176){rect(0,y,size.width,8,'#58624a');rect(0,y+8,size.width,4,'#20281f');}
 }
 function cargo(piece){const names=['茶叶','香氛','陶杯','饼干','棉袜','木玩','旅行','文具'];const n=piece.soft?8:Math.max(0,['茶叶礼盒','香氛小样','陶瓷杯','手工饼干','棉袜套装','桌面摆件','旅行套装','文具礼盒'].indexOf(piece.name));return {name:piece.soft?'围巾':names[n],kind:n};}
 function cargoIcon(piece,x,y,size){
  const kind=cargo(piece).kind;ctx.save();ctx.translate(x,y);ctx.scale(size/32,size/32);const dark='#684e36',cream='#fff5dc';
  if(kind===0){rrect(5,7,22,22,3,'#78966b',dark);rect(4,4,24,5,'#b7c49c');rrect(9,12,14,11,1,cream);poly([[13,19],[15,13],[21,14],[18,20]],'#6d8651');line(14,20,20,14,cream,1);}
  else if(kind===1){rrect(7,12,18,17,4,'#d6ae6e',dark);rect(12,4,8,8,'#756348');rect(10,1,12,4,'#a78d61');rrect(11,17,10,8,1,cream);poly([[16,18],[20,21],[16,24],[12,21]],'#ba7962');}
  else if(kind===2){rrect(4,9,19,20,4,'#efeee0',dark);ctx.beginPath();ctx.moveTo(23,12);ctx.quadraticCurveTo(35,10,29,22);ctx.lineTo(23,24);ctx.strokeStyle=dark;ctx.lineWidth=2;ctx.stroke();line(9,3,8,7,'#c39d72',2);line(15,0,14,5,'#c39d72',2);rect(8,17,11,3,'#88a8b1');}
  else if(kind===3){rrect(3,5,26,24,7,'#c99656',dark);rrect(7,8,18,17,5,null,'#eec589');for(const [a,b]of [[11,12],[20,14],[14,20],[22,23],[7,20]])rrect(a,b,3,3,1,'#785037');}
  else if(kind===4){poly([[7,3],[15,3],[15,21],[21,23],[21,29],[7,29],[4,24],[7,19]],'#ba756e');poly([[18,2],[26,2],[26,19],[30,22],[28,27],[17,25],[15,20],[18,16]],'#e4c19d');rect(7,5,8,4,cream);rect(18,4,8,4,cream);}
  else if(kind===5){rrect(6,4,8,8,4,'#bd9567',dark);rrect(19,4,8,8,4,'#bd9567',dark);rrect(6,7,21,20,8,'#d4b288',dark);rect(11,14,2,3,dark);rect(21,14,2,3,dark);rrect(12,19,10,6,3,cream);rect(16,19,3,2,dark);}
  else if(kind===6){rrect(11,1,10,8,2,null,dark);rrect(4,7,24,21,4,'#8b9c9f',dark);rect(10,8,3,19,'#dec9a3');rect(20,8,3,19,'#dec9a3');rect(7,28,4,3,dark);rect(23,28,4,3,dark);}
  else if(kind===7){poly([[5,6],[20,3],[24,26],[9,29]],'#e4c986');line(10,7,14,27,'#9a7751',2);poly([[24,3],[28,4],[23,25],[19,29],[19,23]],'#bd7760');line(22,7,26,8,cream,2);}
  else{poly([[5,3],[18,3],[18,15],[27,15],[27,25],[13,25],[10,13],[5,13]],'#ad6d7e');for(let i=0;i<4;i++){line(6+i*3,4,6+i*3,12,'#e7b8b8',1);line(15,17+i*2,26,17+i*2,'#e7b8b8',1);}for(let i=0;i<4;i++)line(16+i*3,24,16+i*3,29,'#ad6d7e',2);}
  ctx.restore();
 }
 function parcelShape(piece,form,x,y,cell,alpha=1,options={}){
  const cells=getShape(piece,form),has=new Set(cells.map(c=>c.join(','))),cols=Math.max(...cells.map(c=>c[0]))+1,rows=Math.max(...cells.map(c=>c[1]))+1,base=C[piece.color],tiny=cell<24,margin=tiny?.7:2;
  ctx.save();ctx.globalAlpha=alpha;
  for(const [dx,dy]of cells){const px=x+dx*cell,py=y+dy*cell;if(!has.has(`${dx},${dy+1}`))rect(px+margin,py+cell-1,cell-margin*2,4,'rgba(33,32,23,0.28)');if(!has.has(`${dx+1},${dy}`))rect(px+cell-1,py+margin,3,cell-margin*2,'rgba(33,32,23,0.2)');}
  ctx.save();ctx.beginPath();for(const [dx,dy]of cells){const l=has.has(`${dx-1},${dy}`)?0:margin,t=has.has(`${dx},${dy-1}`)?0:margin,r=has.has(`${dx+1},${dy}`)?0:margin,b=has.has(`${dx},${dy+1}`)?0:margin;ctx.rect(x+dx*cell+l,y+dy*cell+t,cell-l-r,cell-t-b);}ctx.clip();
  let surface=base;if(typeof ctx.createLinearGradient==='function'){surface=ctx.createLinearGradient(x,y,x+cols*cell,y+rows*cell);surface.addColorStop(0,base);surface.addColorStop(.55,base);surface.addColorStop(1,'#b29a76');}rect(x,y,cols*cell,rows*cell,surface);
  if(!tiny){for(let yy=5;yy<rows*cell;yy+=8)line(x,y+yy,x+cols*cell,y+yy,piece.soft?'rgba(255,241,222,0.18)':'rgba(100,75,47,0.055)',1);for(let xx=7;xx<cols*cell;xx+=13)line(x+xx,y,x+xx-3,y+rows*cell,'rgba(255,243,218,0.09)',1);}
  const tapeX=x+Math.floor(cols/2)*cell+(cols%2?cell*.48:0),tapeW=Math.max(3,cell*.18);rect(tapeX-tapeW/2,y,tapeW,rows*cell,piece.soft?'rgba(174,100,121,0.33)':'rgba(248,224,174,0.6)');line(tapeX-tapeW/2,y,tapeX-tapeW/2,y+rows*cell,'rgba(115,81,42,0.22)',1);line(tapeX+tapeW/2,y,tapeX+tapeW/2,y+rows*cell,'rgba(255,247,221,0.65)',1);
  if(options.sealed){for(let yy=cell*.4;yy<rows*cell;yy+=cell*1.45){rect(x,y+yy,cols*cell,Math.max(7,cell*.15),'#e6c688');for(let xx=5;xx<cols*cell;xx+=45){text('封签',x+xx,y+yy+Math.max(7,cell*.11),Math.max(6,cell*.1),'#9d5140',700);}}}
  ctx.restore();
  for(const [dx,dy]of cells){const px=x+dx*cell,py=y+dy*cell;const stroke=options.selected?'#fff2b8':piece.soft?'#8f596c':'#806445',lw=options.selected?2:tiny?1:1.5;
   if(piece.soft&&typeof ctx.setLineDash==='function')ctx.setLineDash(tiny?[]:[3,3]);
   if(!has.has(`${dx},${dy-1}`)){line(px+margin,py+margin,px+cell-margin,py+margin,stroke,lw);if(!tiny)line(px+margin+1,py+5,px+cell-margin-1,py+5,'rgba(255,245,214,0.65)',2);}
   if(!has.has(`${dx-1},${dy}`))line(px+margin,py+margin,px+margin,py+cell-margin,stroke,lw);
   if(!has.has(`${dx},${dy+1}`)){line(px+margin,py+cell-margin,px+cell-margin,py+cell-margin,stroke,lw);if(!tiny)line(px+margin+1,py+cell-5,px+cell-margin-1,py+cell-5,'rgba(104,74,43,0.2)',3);}
   if(!has.has(`${dx+1},${dy}`))line(px+cell-margin,py+margin,px+cell-margin,py+cell-margin,stroke,lw);
   if(typeof ctx.setLineDash==='function')ctx.setLineDash([]);
   if(!tiny&&!has.has(`${dx+1},${dy}`)&&!has.has(`${dx},${dy-1}`)){poly([[px+cell-15,py+3],[px+cell-3,py+3],[px+cell-3,py+15]],piece.soft?'#c48c9e':'#d5ba8b');line(px+cell-15,py+3,px+cell-3,py+15,'rgba(105,76,45,0.4)',1);}
  }
  const first=cells[0],px=x+first[0]*cell,py=y+first[1]*cell;
  if(tiny){cargoIcon(piece,px+cell*.13,py+cell*.12,cell*.74);}else{
   const label=Math.min(cell-12,58),lx=px+(cell-label)/2,ly=py+(cell-label)/2;ctx.save();ctx.translate(lx+label/2,ly+label/2);ctx.rotate(piece.soft?-.055:.025);rect(-label/2+1,-label/2+2,label,label,'rgba(56,40,23,0.14)');rrect(-label/2,-label/2,label,label,2,'#fff2d4','#d4bd8f');cargoIcon(piece,-label*.32,-label*.36,label*.64);barcode(-label*.31,label*.28,label*.62,Math.max(3,label*.08),'#785e42');text(cargo(piece).name,0,label*.23,Math.max(7,Math.min(10,label*.2)),C.edge,700,'center');ctx.restore();
   const tag=Math.max(13,Math.min(20,cell*.25));rrect(px+3,py+3,tag,tag,2,options.selected?C.orange:'#e4ceb0','#7c6246');text(piece.id,px+3+tag/2,py+3+tag*.78,Math.max(9,tag*.67),C.ink,700,'center');
  }ctx.restore();
 }
 function boxArt(x,y,w,h){rect(x+8,y+10,w,h,'#20261f');poly([[x,y],[x+w*.82,y],[x+w,y+18],[x+w,y+h],[x,y+h]],C.kraft);rect(x+8,y+9,w-16,h-17,'#a9753d');rect(x+14,y+15,w-28,h-29,'#ead5a8');poly([[x,y],[x+16,y-12],[x+w-12,y-12],[x+w*.82,y]],'#ddaf73');poly([[x+w*.82,y],[x+w,y+18],[x+w,y+h],[x+w-12,y+h-8],[x+w-12,y+20]],'#a87942');for(let i=0;i<9;i++)line(x+15,y+20+i*(h-32)/9,x+w-20,y+19+i*(h-32)/9,'rgba(126,91,47,0.07)');rect(x+w*.43,y,20,h,'rgba(249,222,166,0.5)');barcode(x+w-64,y+h-32,40,16,C.edge);}
 function drawHome(){
  const {W,H}=layout,pad=20;
  rect(pad,20,84,22,C.orange);text('PACK / 50',pad+9,36,12,C.ink,700);text(`${save.coins} 金币`,W-pad,36,13,C.orange,700,'right');
  text('快递收纳站',pad,86,Math.min(40,W*.102),C.paper,800);text('留好下一批的位置，再落下封签。',pad,114,Math.min(14,(W-40)/18),'#c8d1b7');
  const y=layout.tight?132:148,minArt=layout.tight?50:76,artH=Math.min(240,Math.max(minArt,H-428)),artW=Math.min(W-64,300);boxArt((W-artW)/2,y,artW,Math.max(minArt,artH));
  const demo=LEVELS[4],soft=demo.pieces.find(p=>p.soft);parcelShape(soft,{rotation:0,compressed:true},W/2-25,y+18,Math.max(layout.tight?16:24,Math.min(50,artH*.32)));text('本地工位 / 无需赶时间',W/2,y+Math.max(minArt,artH)+34,12,C.muted,400,'center');
  const startY=H-216;button('play',state.moves?'继续装箱':'开始装箱',pad,startY,W-pad*2,52,{fill:C.orange,font:18,tag:true});
  const half=(W-pad*2-10)/2;button('levels','关卡货架',pad,startY+62,half,48);button('help','装箱说明',pad+half+10,startY+62,half,48);button('settings','工位设置',pad,startY+120,W-pad*2,48);
  text(`${save.completed.length} / 50 箱已出库 · ${saveOK?'进度保存在此设备':'此设备无法存档'}`,W/2,H-16,11,C.muted,400,'center');
 }
 function drawCompact(){const {W,H}=layout;text('竖起手机，打开工位',W/2,Math.max(80,H*.3),20,C.paper,700,'center');wrap('请使用竖屏或放大窗口。装箱进度已保留，按钮不会被缩成小图标。',24,Math.max(110,H*.3+36),W-48,14,C.muted,23,4);button('home','返回仓库',24,H-70,W-48,48);}
 function drawPlay(){
  const {W,H,trayY,footerY}=layout;
  button('menu','菜单',10,4,52,44,{fill:'#d3ba88'});button(layout.tight?'rack':'help',layout.tight?'货架':'说明',W-62,4,52,44,{fill:'#d3ba88'});
  if(state.status==='failed')button('showFailure','这箱卡住了',W/2-66,4,132,44,{fill:'#e3a38c'});else if(campaignWin(level,state))button('showWin','出库单',W/2-66,4,132,44,{fill:C.orange});else if(level.batches.length>1)button('manifest',canSeal(level,state)?'本批已齐 · 待封签':`货单 · 第${state.stage+1}/${level.batches.length}批`,W/2-84,4,168,44,{font:12,fill:canSeal(level,state)?C.orange:C.paper});else{text(`${String(level.id).padStart(2,'0')} 号装箱工位`,W/2,25,16,C.paper,700,'center');const chosen=level.pieces.find(p=>p.id===selected);text(chosen?`${chosen.id} ${chosen.name}${chosen.soft?(state.forms[chosen.id].compressed?' · 三格':' · 四格'):''}`:'点击包裹 · 对齐左上角',W/2,43,10,C.muted,400,'center');}
  text(`装入 ${Object.keys(state.placements).length}/${level.pieces.length}`,14,70,12,C.paper,700);text(`空格 ${remainingCells(level,state)}`,W/2,70,12,C.paper,700,'center');text(`${state.moves} 步`,W-14,70,12,C.paper,700,'right');
  const cell=Math.min((W-40)/level.width,(trayY-96)/level.height,88),bw=cell*level.width,bh=cell*level.height,bx=(W-bw)/2,by=84+((trayY-96)-bh)/2;
  layout.board={x:bx,y:by,w:bw,h:bh,cell};rect(bx-12,by-12,bw+24,bh+24,'#80562f');rect(bx-8,by-8,bw+16,bh+16,C.kraft);rect(bx-3,by-3,bw+6,bh+6,'#a97642');
  const occupied=occupiedCells(level,state),blocked=new Set(level.blocked.map(c=>c.join(',')));let preview=null;
  if(drag&&drag.moved&&selected){const p=boardPoint(drag.current,drag.anchor);if(p)preview={...p,...canPlace(level,state,selected,p.x,p.y)};}
  const previewCells=new Set();if(preview){const piece=level.pieces.find(p=>p.id===selected);getShape(piece,state.forms[selected]).forEach(([x,y])=>previewCells.add(`${x+preview.x},${y+preview.y}`));}
  for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){
   const key=`${x},${y}`,px=bx+x*cell+1.5,py=by+y*cell+1.5,edge=cell-3;
   rrect(px,py,edge,edge,2,blocked.has(key)?'#9d8158':'#e4cba1','#b18755');
   if(blocked.has(key)){ctx.save();ctx.beginPath();ctx.rect(px,py,edge,edge);ctx.clip();for(let a=-edge;a<edge*2;a+=10)line(px+a,py,px+a+edge,py+edge,'#645a3e',3);ctx.restore();}
  }
  for(const piece of level.pieces){const at=state.placements[piece.id];if(!at)continue;const bounce=animation&&animation.pieceId===piece.id&&['place','compress','rotate'].includes(animation.kind)&&Date.now()<animation.until?-Math.sin(Math.min(1,(Date.now()-animation.started)/(animation.until-animation.started))*Math.PI)*7:0;parcelShape(piece,state.forms[piece.id],bx+at.x*cell,by+at.y*cell+bounce,cell,1,{selected:selected===piece.id,sealed:state.sealed.includes(piece.id)});}
  for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){const key=`${x},${y}`,px=bx+x*cell+1.5,py=by+y*cell+1.5,edge=cell-3;
   if(state.clue&&state.clue.pieceId===selected){const cp=level.pieces.find(p=>p.id===state.clue.pieceId);if(getShape(cp,state.clue).some(([dx,dy])=>state.clue.x+dx===x&&state.clue.y+dy===y))rrect(px+4,py+4,edge-8,edge-8,2,null,'#235b9b');}
   if(previewCells.has(key)){ctx.globalAlpha=.55;rect(px,py,edge,edge,preview.ok?'#73b473':'#d36153');ctx.globalAlpha=1;}
  }
  // One accessible row of parcels. Pagination preserves 44px targets on 320px phones.
  if(!layout.tight){const pages=Math.ceil(level.pieces.length/3),gap=5,side=44,cardW=(W-20-side*2-gap*4)/3;
  rect(8,trayY-7,W-16,68,'#546148');button('trayPrev','‹',10,trayY,side,56,{disabled:trayPage===0,font:24,fill:'#b8bc94'});
  level.pieces.slice(trayPage*3,trayPage*3+3).forEach((piece,i)=>{const x=10+side+gap+i*(cardW+gap),y=trayY,placed=!!state.placements[piece.id],chosen=selected===piece.id,available=currentBatch(level,state).includes(piece.id)&&!state.sealed.includes(piece.id),batch=level.batches.findIndex(b=>b.includes(piece.id))+1;rect(x+1,y+3,cardW,56,C.ink);rrect(x,y,cardW,56,2,chosen?C.orange:!available?'#cec9b5':piece.soft?'#f1c2d3':C.paper,chosen?C.orange:C.edge);const cells=getShape(piece,state.forms[piece.id]),cols=Math.max(...cells.map(c=>c[0]))+1,rows=Math.max(...cells.map(c=>c[1]))+1,pc=Math.min(12,(cardW-12)/cols,30/rows);parcelShape(piece,state.forms[piece.id],x+(cardW-cols*pc)/2,y+5+(30-rows*pc)/2,pc,placed ? .45 : 1);text(`${piece.id} ${cargo(piece).name}${placed?'✓':''}`,x+cardW/2,y+45,10,C.ink,700,'center');if(level.batches.length>1)text(`第${batch}批${state.sealed.includes(piece.id)?' · 已封':''}`,x+cardW/2,y+54,8,C.edge,700,'center');targets.push({id:'piece',pieceId:piece.id,label:`包裹 ${piece.id}`,x,y,w:cardW,h:56,disabled:false});});
  button('trayNext','›',W-54,trayY,side,56,{disabled:trayPage>=pages-1,font:24,fill:'#b8bc94'});}
  const piece=level.pieces.find(p=>p.id===selected),w=(W-20-18)/4,soft=!!(piece&&piece.soft),editable=!!piece&&state.status!=='failed'&&currentBatch(level,state).includes(piece.id)&&!state.sealed.includes(piece.id);
  button('rotate','旋转',10,footerY,w,48,{disabled:!editable,fill:C.orange});button('compress',soft?(state.forms[selected].compressed?'展开':'压缩'):'软包',10+w+6,footerY,w,48,{disabled:!soft||!editable,fill:'#e7a5be'});button('remove','取出',10+(w+6)*2,footerY,w,48,{disabled:!editable||!state.placements[selected]});button('undo','撤回',10+(w+6)*3,footerY,w,48,{disabled:state.status==='failed'||!state.history.length});
 }
 function modalHeader(title){const {W,H}=layout;rect(4,4,W-8,H-8,C.paper);rect(4,4,W-8,7,C.kraft);barcode(20,22,45,17);text('PACKING RECORD',74,35,10,C.edge,700);button('close','返回',W-70,18,50,44,{fill:'#dfc99e'});text(title,20,88,24,C.ink,800);line(20,103,W-20,103,'#bca77e');targets=targets.filter(t=>t.id==='close');}
 function drawModal(){
  const {W,H}=layout;targets=[];ctx.fillStyle='rgba(20,25,19,0.8)';ctx.fillRect(0,0,W,H);
  const titles={menu:'工位运单夹',levels:'关卡货架',help:'装箱说明',settings:'工位设置',hint:'参考装箱图',restart:'重新装这一箱？',win:'出库成功',sidebarInfo:'侧边栏复访',briefing:'今日交接',manifest:'完整货单',failure:'这箱卡住了',tools:'工位工具箱',rewardMock:'模拟广告',benefit:'工具回执',rack:'包裹货架'};
  modalHeader(titles[modal]||'运单');
  if(modal==='menu'){
   const y=120,w=(W-50)/2;button('play','继续装箱',20,y,W-40,48,{fill:C.orange});
   [['levels','关卡货架'],['manifest','完整货单'],['help','装箱说明'],['hint','参考拼法'],['restart','免费重开'],['tools','金币工具'],['settings','工位设置'],['home','返回仓库']].forEach(([id,label],i)=>button(id,label,20+(i%2)*(w+10),y+56+Math.floor(i/2)*50,w,44));
   wrap(level.title+'。'+level.hint,20,H-70,W-40,12,C.edge,19,3);
  }else if(modal==='levels'){
   const names=['旧仓新手','早班接货','雨天隔板','夜班接力','最后一车'];text(`第${levelsPage+1}章 · ${names[levelsPage]}`,20,126,14,C.edge,700);const w=(W-50)/2,h=44;
   LEVELS.slice(levelsPage*10,levelsPage*10+10).forEach((item,i)=>{const x=20+(i%2)*(w+10),y=(layout.tight?132:141)+Math.floor(i/2)*(layout.tight?46:49);button(`level:${item.id}`,`${String(item.id).padStart(2,'0')}  ${save.completed.includes(item.id)?'已出库':item.batches.length>1?item.batches.length+'批交接':'练习箱'}`,x,y,w,h,{fill:level.id===item.id?C.orange:C.paper,font:13});});
   button('levelsPrev','上一章',20,H-74,(W-50)/2,44,{disabled:levelsPage===0});button('levelsNext','下一章',30+(W-50)/2,H-74,(W-50)/2,44,{disabled:levelsPage===4});text('换关替换当前摆放；金币与通关记录保留',W/2,H-15,10,C.edge,400,'center');
  }else if(modal==='help'){
   const pages=[['选包裹，放进箱子','先点货架上的包裹，再点箱内格子。以形状左上角对齐，也可以拖动放下。'],['转个方向，再试一次','选中包裹后点「旋转」。已放入的包裹也能旋转、挪动或取出。'],['粉色软包会挤也会松','软包可在四格方形和三格L形间切换。压缩或展开后仍可以旋转。'],['全部装入，填满空格','所有包裹都要放进箱子，除隔板外不能留空。前十关可自由撤回。'],['封签前，先看下一批','第十一关起分批到货。所有轮廓从一开始就能看；封签锁住本批，留错形状会卡住。始终可以免费重开。']];
   const page=pages[tutorialPage];text(`${tutorialPage+1} / 5`,W-22,126,12,C.edge,700,'right');text(page[0],22,157,18,C.ink,700);wrap(page[1],22,188,W-44,14,C.ink,24,4);
   const demo=LEVELS[4],piece=tutorialPage===2?demo.pieces.find(p=>p.soft):LEVELS[1].pieces[0],cell=Math.min(44,(H-330)/3);parcelShape(piece,{rotation:tutorialPage===1?1:0,compressed:tutorialPage===2},W/2-cell,Math.max(268,H/2+20),cell);
   const w=(W-50)/2;button('tutorialPrev','上一步',20,H-74,w,48,{disabled:tutorialPage===0});button('tutorialNext',tutorialPage===4?'开始装箱':'下一步',30+w,H-74,w,48,{fill:C.orange});
  }else if(modal==='settings'){
   button('sound',save.sound?'音效：开启':'音效：关闭',20,126,W-40,52,{fill:C.orange});
   if(sidebarState.available)button('sidebarInfo',sidebarState.enteredFromSidebar?'复访已确认':'侧边栏复访',20,192,W-40,48);
   text('存档只在当前设备',20,sidebarState.available?280:228,17,C.ink,700);wrap('清理数据或更换设备后进度可能丢失。重新打开会恢复箱内摆放，但不会保留撤回历史。',20,sidebarState.available?310:258,W-40,14,C.edge,24,5);text(saveOK?'本地存档可用':'存档不可用，仍可继续游玩',20,H-34,12,saveOK?'#536d42':C.red,700);
  }else if(modal==='hint'){
   text('只供参考，不改变当前摆放',20,128,12,C.edge);const cell=Math.min((W-52)/level.width,(H-220)/level.height),bw=cell*level.width,bx=(W-bw)/2,by=151;
   level.solutionMap.forEach((row,y)=>[...row].forEach((id,x)=>{const piece=level.pieces.find(p=>p.id===id);rect(bx+x*cell+1,by+y*cell+1,cell-2,cell-2,piece?C[piece.color]:'#a48f6d');text(id,bx+(x+.5)*cell,by+(y+.5)*cell+5,15,C.ink,700,'center');}));
   const soft=level.solution.find(s=>s.pieceId==='S');wrap(soft?`本关软包：${soft.compressed?'压缩为三格L形':'展开为四格方形'}。`:'相同字母是同一件包裹，也可能有其他拼法。',20,H-42,W-40,12,C.edge,20,2);
  }else if(modal==='restart'){
   wrap('当前摆放、操作步数和撤回历史会清空。已经通关的记录会保留。',22,152,W-44,16,C.ink,27,5);const w=(W-50)/2;button('close','接着装',20,H-86,w,52);button('confirmRestart','重新装箱',30+w,H-86,w,52,{fill:C.orange});
  }else if(modal==='win'){
   rect(22,126,W-44,70,'#e9d8ad');text(save.completed.length===LEVELS.length?'五十箱心意，都送达了！':'刚刚好，出库啦！',W/2,156,20,C.ink,800,'center');text(`${state.moves} 次操作 / ${save.completed.length} 箱已出库`,W/2,181,14,C.edge,400,'center');barcode(34,layout.tight?207:214,W-68,layout.tight?16:24);text(earned?`首次出库 +${earned} 金币 · 余额${save.coins}`:`本关已领过金币 · 余额${save.coins}`,W/2,Math.min(263,H-202),12,C.edge,700,'center');
   button('next',level.id===LEVELS.length?'查看关卡货架':'下一箱，继续装',20,H-186,W-40,48,{fill:C.orange});button('restart','重装这一箱',20,H-128,W-40,48);button('levels','回到关卡货架',20,H-70,W-40,48);
  }else if(modal==='briefing'){
   const lessons=['先从货架选一件，再点箱内左上角。两件都装入就能完成第一箱。','L形包裹要转个方向。旋转只改变方向，不会翻面。','弯角彼此借位，把每一个空隙都用起来。','斜纹是防撞隔板。它不可以移动，也不能放包裹。','粉色软包可以从四格挤成三格，再展开回来。'];
   text(`第${level.chapter}章 / 第${level.id}箱`,20,133,13,C.edge,700);wrap(level.id<=5?lessons[level.id-1]:level.story,20,168,W-40,16,C.ink,27,5);
   boxArt(W/2-62,Math.min(274,H-204),124,60);text(level.batches.length>1?`${level.batches.length}批货物 · 所有轮廓已列在货单`:'阿乔在旁边，不赶时间。',W/2,H-108,12,C.edge,700,'center');button('briefStart','知道了，开工',20,H-74,W-40,48,{fill:C.orange});
  }else if(modal==='rack'){
   text('点选货物后回到箱内，形状不会缩小',20,127,12,C.edge,700);const tw=(W-56)/3;
   level.pieces.forEach((p,i)=>{const x=20+(i%3)*(tw+8),y=140+Math.floor(i/3)*74,batch=level.batches.findIndex(b=>b.includes(p.id)),placed=!!state.placements[p.id],active=currentBatch(level,state).includes(p.id)&&!state.sealed.includes(p.id);rect(x+1,y+3,tw,68,C.edge);rrect(x,y,tw,68,2,active?C.paper:'#ded9c7',C.edge);const shape=getShape(p,state.forms[p.id]),cols=Math.max(...shape.map(v=>v[0]))+1,rows=Math.max(...shape.map(v=>v[1]))+1,cell=Math.min(15,35/rows,(tw-12)/cols);parcelShape(p,state.forms[p.id],x+(tw-cols*cell)/2,y+4,cell);text(`${p.id} ${cargo(p).name}${placed?'✓':''}`,x+tw/2,y+49,11,C.ink,700,'center');text(`第${batch+1}批${state.sealed.includes(p.id)?' · 已封':''}`,x+tw/2,y+62,9,C.edge,700,'center');targets.push({id:'rackPiece:'+p.id,pieceId:p.id,label:p.name,x,y,w:tw,h:68,disabled:false});});button('close','回到装箱工位',20,H-64,W-40,44,{fill:C.orange});
  }else if(modal==='manifest'){
   text(`当前第${state.stage+1}/${level.batches.length}批 · 封签后位置锁定`,20,128,12,C.edge,700);const tw=(W-56)/3;
   level.pieces.forEach((p,i)=>{const x=20+(i%3)*(tw+8),y=144+Math.floor(i/3)*77,batch=level.batches.findIndex(b=>b.includes(p.id));rect(x,y,tw,69,batch===state.stage?'#f2dfaa':'#e5dfcc');const shape=getShape(p,state.forms[p.id]),cols=Math.max(...shape.map(v=>v[0]))+1,rows=Math.max(...shape.map(v=>v[1]))+1,cell=Math.min(13,40/rows,(tw-12)/cols);parcelShape(p,state.forms[p.id],x+(tw-cols*cell)/2,y+6,cell);text(`${p.id} ${cargo(p).name}·${batch+1}批${state.sealed.includes(p.id)?' 封':''}`,x+tw/2,y+58,10,C.ink,700,'center');});
   if(canSeal(level,state))button('seal','确认封签，锁住本批位置',20,H-70,W-40,48,{fill:C.orange,font:13});else button('close','看好了，继续装',20,H-70,W-40,48,{fill:C.orange});
  }else if(modal==='failure'){
   wrap(state.failure||'封签后的空位形状无法容纳后续货物。',20,146,W-40,15,C.ink,25,4);text('每箱最多拆签复活一次；重开一直免费。',20,248,12,C.edge,700);const available=!state.reviveUsed&&!!state.checkpoint,ad=rewards.getState();
   button('freeRestart','免费重开这一箱',20,H-186,W-40,48,{fill:C.orange});button('buy:revive',`10金币拆开上次封签 · 现有${save.coins}`,20,H-128,W-40,48,{disabled:!available||save.coins<10,font:12});button('ad:revive',ad.mode==='mock'?'模拟广告：拆签复活':'广告预留：尚未接入',20,H-70,W-40,48,{disabled:!available||!ad.available,font:13});
  }else if(modal==='tools'){
   text(`金币 ${save.coins} · 只从通关获得，没有充值`,20,130,12,C.edge,700);
   button('buy:scan','6金币 · 封签预检（每箱一次）',20,152,W-40,44,{disabled:state.toolsUsed.scan||!canSeal(level,state)||save.coins<6,font:12});button('buy:locate','8金币 · 定位贴（每箱一次）',20,204,W-40,44,{disabled:state.toolsUsed.locate||state.status==='failed'||save.coins<8,font:12});
   const ad=rewards.getState();button('ad:scan',ad.mode==='mock'?'模拟广告 · 领取封签预检':'广告预检尚未接入',20,268,W-40,44,{disabled:!ad.available||state.toolsUsed.scan||!canSeal(level,state),font:12});button('ad:locate',ad.mode==='mock'?'模拟广告 · 领取定位贴':'广告定位贴尚未接入',20,320,W-40,44,{disabled:!ad.available||state.toolsUsed.locate||state.status==='failed',font:12});
   wrap('预检先看封签是否留有可行解；定位贴标出一件当前包裹的建议位置。道具不会直接过关。',20,H-72,W-40,12,C.edge,20,3);
  }else if(modal==='rewardMock'){
   wrap('开发用模拟广告：不播放视频，不联网。选择「模拟完成」后才会验证并发奖。',20,133,W-40,13,C.edge,21,3);
   [['completed','模拟完成'],['cancelled','提前关闭，不领奖'],['unavailable','模拟无填充'],['error','模拟错误']].forEach(([status,label],i)=>button('mock:'+status,label,20,(layout.tight?180:204)+i*(layout.tight?47:49),W-40,44,{fill:i===0?C.orange:C.paper,font:13}));
   button('freeRestart','取消模拟，免费重开',20,H-64,W-40,44,{font:12});
  }else if(modal==='benefit'){
   wrap(lastBenefit,20,149,W-40,16,C.ink,28,7);barcode(24,H-150,W-48,22);button('benefitContinue','回到工位',20,H-74,W-40,48,{fill:C.orange});
  }else if(modal==='sidebarInfo'){
   wrap('下次可从抖音首页侧边栏找到快递收纳站。点击下方按钮打开侧边栏，再点击游戏返回。',20,149,W-40,15,C.ink,25,5);text(sidebarState.enteredFromSidebar?'复访已确认':'尚未检测到本次从侧边栏返回',20,H-158,12,C.edge,700);button('sidebarNavigate',sidebarState.pending?'正在打开…':'打开侧边栏',20,H-128,W-40,48,{fill:C.orange,disabled:!sidebarState.available||sidebarState.pending});text('快捷入口，不发放或承诺奖励。',20,H-50,12,C.edge);
  }
 }
 function draw(){
  frame=null;if(destroyed)return;layout=dimensions();const dpr=size.dpr||1;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size.width,size.height);warehouse();ctx.translate(layout.ox,layout.oy);targets=[];
  if(layout.compact)drawCompact();else if(screen==='home')drawHome();else drawPlay();
  if(modal&&!layout.compact)drawModal();
  if(animation&&Date.now()<animation.until){const t=(Date.now()-animation.started)/(animation.until-animation.started);if(animation.kind==='seal'&&!modal){const by=layout.board?layout.board.y+layout.board.h/2:layout.H/2;ctx.globalAlpha=1-t;rect(layout.W/2-68,by-28,136,50,C.paper);text('封签 · 下一批',layout.W/2,by+3,17,C.red,800,'center');ctx.globalAlpha=1;}if(animation.kind==='unseal'&&!modal&&layout.board){const b=layout.board;ctx.save();ctx.translate(b.x+b.w/2+t*80,b.y+b.h/2-t*100);ctx.rotate(-t*.5);ctx.globalAlpha=1-t;rect(-b.w*.45,-6,b.w*.9,12,'#f4db9c');text('已拆签 · 重新留位',0,-18,15,C.paper,700,'center');ctx.restore();}if(animation.kind==='tool'&&modal==='benefit'){ctx.globalAlpha=(1-t)*.25;rect(8,8,layout.W-16,layout.H-16,C.blue);ctx.globalAlpha=1;}if(modal==='win'){ctx.globalAlpha=1-t;for(let i=0;i<8;i++)rect(layout.W/2+(i-4)*19,198-t*65+(i%3)*10,8,8,C.orange);ctx.globalAlpha=1;}requestDraw();}
  if(toast&&Date.now()<toastUntil){const w=layout.W-24;rect(12,layout.H-110,w,42,'rgba(34,42,30,0.94)');text(toast,layout.W/2,layout.H-85,12,C.paper,700,'center');}
  inputReady=true;if(Date.now()<toastUntil)requestDraw();
 }
 function openModal(next){toast='';toastUntil=0;if(modal)trail.push(modal);modal=next;if(next==='levels')levelsPage=Math.floor((level.id-1)/10);if(next==='help')tutorialPage=0;drag=null;invalidate();}
 function closeModal(){if(modal==='rewardMock'){rewards.cancel();}if(modal==='briefing'){state.briefSeen=true;persist();}modal=trail.length?trail.pop():null;drag=null;invalidate();}
 function boardPoint(p,anchor={x:0,y:0}){const b=layout&&layout.board;if(!b||p.x<b.x||p.y<b.y||p.x>=b.x+b.w||p.y>=b.y+b.h)return null;return {x:Math.floor((p.x-b.x)/b.cell)-anchor.x,y:Math.floor((p.y-b.y)/b.cell)-anchor.y};}
 function cancelRewardRun(){runToken++;if(rewardPending){rewardPending=null;rewards.cancel();}}
 function applyBenefit(kind,paid){const result=paid?purchaseBenefit(level,state,save,kind):useBenefit(level,state,kind);if(!result.ok){notify(result.reason);return false;}toast='';toastUntil=0;state=result.state;if(paid)save=result.save;lastBenefit=result.reason;persist();trail=[];modal=kind==='revive'?null:'benefit';animation={kind:kind==='revive'?'unseal':'tool',started:Date.now(),until:Date.now()+700};invalidate();return true;}
 function requestBenefit(kind){
  if(rewardPending)return;const eligibility=useBenefit(level,state,kind);if(!eligibility.ok){notify(eligibility.reason);return;}const capability=rewards.getState();if(!capability.available){notify('广告尚未接入，可以用金币或免费重开');return;}
  const pending={kind,run:runToken,levelId:level.id,stage:state.stage,failed:state.status==='failed'};rewardPending=pending;if(capability.mode==='mock')openModal('rewardMock');
  rewards.request({placement:'parcel_'+kind,context:{runId:runToken,levelId:level.id,stage:state.stage,failure:state.status==='failed'}}).then(result=>{
   if(destroyed||rewardPending!==pending||runToken!==pending.run||level.id!==pending.levelId)return;rewardPending=null;
   if(result.status==='completed'&&result.requestId&&!creditedRequests.has(result.requestId)&&state.stage===pending.stage&&(state.status==='failed')===pending.failed){creditedRequests.add(result.requestId);applyBenefit(kind,false);}
   else{modal=state.status==='failed'?'failure':'tools';trail=[];notify(result.status==='completed'?'请求已失效，没有重复发奖':'本次未完成，不发奖励');invalidate();}
  }).catch(()=>{if(!destroyed&&rewardPending===pending){rewardPending=null;modal=state.status==='failed'?'failure':'tools';trail=[];notify('模拟请求异常，没有发奖');invalidate();}});
 }
 function action(type,extra={}){
  const beforeWin=campaignWin(level,state),result=applyCampaignAction(level,state,{type,pieceId:selected,...extra});if(!result.ok){notify(result.reason);platform.audio.play('error');return;}
  state=result.state;animation={kind:type,started:Date.now(),until:Date.now()+(type==='seal'?650:240),pieceId:selected};persist();platform.audio.play(type==='place'?'place':type==='compress'?'squeeze':'tap');
  if(type==='seal'&&state.status!=='failed'){modal=null;trail=[];selected=null;trayPage=Math.floor(level.pieces.findIndex(p=>currentBatch(level,state).includes(p.id))/3);}
  if(state.status==='failed'){modal='failure';trail=[];}
  if(!beforeWin&&campaignWin(level,state)){if(!save.completed.includes(level.id))save.completed.push(level.id);const award=awardClear(save,level.id);save=award.save;earned=award.earned;save.bestMoves[level.id]=Math.min(save.bestMoves[level.id]||Infinity,state.moves);persist();modal='win';trail=[];platform.audio.play('win');}invalidate();
 }
 function switchLevel(id){toast='';toastUntil=0;cancelRewardRun();level=getLevel(id);state=createCampaignState(level);selected=null;modal=null;trail=[];drag=null;trayPage=0;screen='play';modal='briefing';persist();invalidate();}
 function activate(hit){
  if(!hit||hit.disabled)return;const id=hit.id;
  if(id==='piece'){selected=hit.pieceId;platform.audio.play('tap');}
  else if(id==='play'){screen='play';modal=state.status==='failed'?'failure':!state.briefSeen?'briefing':null;trail=[];}
  else if(id==='home'){toast='';toastUntil=0;cancelRewardRun();screen='home';modal=null;trail=[];persist();}
  else if(id==='sound'){save.sound=!save.sound;platform.audio.setMuted(!save.sound);persist();platform.audio.play('tap');}
  else if(['menu','help','levels','hint','restart','settings','sidebarInfo','manifest','tools','rack'].includes(id))openModal(id);
  else if(id==='close')closeModal();
  else if(id.startsWith('rackPiece:')){selected=id.split(':')[1];modal=null;trail=[];platform.audio.play('tap');}
  else if(id==='briefStart'){state.briefSeen=true;modal=null;trail=[];persist();}
  else if(id==='levelsPrev')levelsPage=Math.max(0,levelsPage-1);
  else if(id==='levelsNext')levelsPage=Math.min(4,levelsPage+1);
  else if(id==='showFailure'){modal='failure';trail=[];}
  else if(id==='benefitContinue'){modal=null;trail=[];}
  else if(id.startsWith('buy:'))applyBenefit(id.split(':')[1],true);
  else if(id.startsWith('ad:'))requestBenefit(id.split(':')[1]);
  else if(id.startsWith('mock:')&&typeof rewards.completeMock==='function')rewards.completeMock(id.split(':')[1]);
  else if(id==='tutorialPrev')tutorialPage=Math.max(0,tutorialPage-1);
  else if(id==='tutorialNext'){if(tutorialPage<4)tutorialPage++;else{state.briefSeen=true;persist();screen='play';modal=null;trail=[];}}
  else if(id==='trayPrev')trayPage=Math.max(0,trayPage-1);
  else if(id==='trayNext')trayPage=Math.min(Math.ceil(level.pieces.length/3)-1,trayPage+1);
  else if(id.startsWith('level:'))switchLevel(Number(id.split(':')[1]));
  else if(id==='confirmRestart'||id==='freeRestart'){toast='';toastUntil=0;cancelRewardRun();state=createCampaignState(level);selected=null;modal=null;trail=[];screen='play';trayPage=0;persist();}
  else if(['rotate','compress','remove','undo','seal'].includes(id))action(id);
  else if(id==='showWin'){modal='win';trail=[];}
  else if(id==='next'){if(level.id===LEVELS.length){modal='levels';levelsPage=4;trail=[];}else switchLevel(level.id+1);}
  else if(id==='sidebarNavigate'&&sidebar&&sidebarState.available&&!sidebarState.pending){sidebar.navigate().then(ok=>{if(!ok&&!destroyed)notify('暂时无法打开侧边栏');}).catch(()=>{if(!destroyed)notify('暂时无法打开侧边栏');});}
  invalidate();
 }
 function pointer(event){
  if(destroyed||paused)return;const p=logical(event);
  if(event.type==='down'){
   if(drag||!inputReady)return;const hit=[...targets].reverse().find(h=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h);
   if(hit){if(hit.id==='piece'&&!hit.disabled){selected=hit.pieceId;drag={id:event.id,start:p,current:p,moved:false,pieceId:selected,anchor:{x:0,y:0},hit};requestDraw();}else {drag={id:event.id,start:p,current:p,moved:false,hit};requestDraw();}return;}
   if(modal||screen!=='play'||layout.compact)return;const at=boardPoint(p);if(at){const id=occupiedCells(level,state).get(`${at.x},${at.y}`);if(selected&&selected!==id&&canPlace(level,state,selected,at.x,at.y).ok)drag={id:event.id,start:p,current:p,moved:false,at};else if(id){selected=id;const pos=state.placements[id];drag={id:event.id,start:p,current:p,moved:false,pieceId:id,anchor:{x:at.x-pos.x,y:at.y-pos.y}};requestDraw();}else drag={id:event.id,start:p,current:p,moved:false,at};}
  }else if(drag&&event.id===drag.id){
   if(event.type==='cancel'){drag=null;requestDraw();return;}if(event.type==='move'){drag.current=p;const distance=Math.hypot(p.x-drag.start.x,p.y-drag.start.y);if(drag.pieceId&&distance>6)drag.moved=true;else if(!drag.pieceId&&(distance>10||(drag.hit&&(p.x<drag.hit.x||p.x>drag.hit.x+drag.hit.w||p.y<drag.hit.y||p.y>drag.hit.y+drag.hit.h))))drag.cancelled=true;requestDraw();}
   else if(event.type==='up'){const ended=drag;drag=null;if(ended.moved&&ended.pieceId){const at=boardPoint(p,ended.anchor);if(at)action('place',at);else notify('未放下，包裹仍在原位');}else if(ended.hit&&!ended.cancelled){const hit=ended.hit;if(p.x>=hit.x&&p.x<=hit.x+hit.w&&p.y>=hit.y&&p.y<=hit.y+hit.h)activate(hit);}else if(ended.at&&!ended.cancelled&&Math.hypot(p.x-ended.start.x,p.y-ended.start.y)<10){if(selected)action('place',ended.at);else notify('先选一件包裹');}requestDraw();}
  }
 }
 disposers.push(platform.onPointer(pointer),platform.onResize(()=>{size=platform.getSize();drag=null;invalidate();}),platform.onPause(()=>{paused=true;drag=null;inputReady=false;targets=[];if(frame!==null){platform.cancelFrame(frame);frame=null;}persist();}),platform.onResume(()=>{paused=false;invalidate();}));
 if(loaded.status==='unavailable')notify('存档暂时不可用，仍可游玩');requestDraw();
 return {
  getSnapshot(){const l=layout||dimensions();return JSON.parse(JSON.stringify({screen,modal,tutorialPage,trayPage,levelsPage,coins:save.coins,earned,reward:rewards.getState(),rewardPending:rewardPending?{kind:rewardPending.kind,run:rewardPending.run}:null,levelId:level.id,selected,state,completed:save.completed,sound:save.sound,saveOK,paused,destroyed,sidebar:sidebarState,layout:l,hitTargets:targets.map(t=>({...t,screenX:t.x+l.ox,screenY:t.y+l.oy,screenWidth:t.w,screenHeight:t.h}))}));},
  destroy(){if(destroyed)return;cancelRewardRun();persist();destroyed=true;disposers.forEach(fn=>{if(fn)fn();});if(frame!==null)platform.cancelFrame(frame);}
 };
}

// platforms/douyin-sidebar.js
/** Actual optional Douyin sidebar capability. No reward or navigation is implied by a successful API callback. */
function createDouyinSidebar(tt) {
  let state = { available: false, checked: false, enteredFromSidebar: false, pending: false, error: null };
  let destroyed = false, finishPending = null;
  const listeners = new Set();
  const update = patch => {
    if (destroyed) return;
    state = { ...state, ...patch };
    listeners.forEach(fn => fn({ ...state }));
  };
  const onShow = options => {
    const entered = !!options && options.launch_from === 'homepage' && options.location === 'sidebar_card';
    // Every foreground event replaces the prior entry state, including ordinary resumes.
    update({ enteredFromSidebar: entered });
    if (finishPending) finishPending(entered, entered ? null : 'Navigation did not return through sidebar');
  };
  // Subscribe synchronously before canvas or game creation, as required by the platform guide.
  if (typeof tt.onShow === 'function') tt.onShow(onShow);
  if (typeof tt.checkScene === 'function' && typeof tt.navigateToScene === 'function') {
    try {
      tt.checkScene({
        scene: 'sidebar',
        success: result => update({ checked: true, available: !!result && result.isExist === true, error: null }),
        fail: result => update({ checked: true, available: false, error: result && result.errMsg || 'Sidebar capability check failed' })
      });
    } catch (_error) { update({ checked: true, available: false, error: 'Sidebar capability check failed' }); }
  } else update({ checked: true, available: false });
  return {
    getState: () => ({ ...state }),
    subscribe(fn) { if (destroyed) return () => {}; listeners.add(fn); return () => listeners.delete(fn); },
    navigate() {
      if (destroyed || !state.available || state.pending) return Promise.resolve(false);
      update({ pending: true, error: null });
      return new Promise(resolve => {
        let settled = false;
        const finish = (ok, error = null) => {
          if (settled) return;
          settled = true;
          if (finishPending === finish) finishPending = null;
          update({ pending: false, error });
          resolve(ok);
        };
        finishPending = finish;
        try {
          tt.navigateToScene({
            scene: 'sidebar',
            success: result => finish(!(result && result.code === 1), result && result.code === 1 ? 'Navigation cancelled' : null),
            fail: result => finish(false, result && result.errMsg || 'Sidebar navigation failed')
          });
        } catch (_error) { finish(false, 'Sidebar navigation failed'); }
      });
    },
    destroy() {
      if (destroyed) return;
      if (finishPending) finishPending(false, 'Sidebar adapter destroyed');
      destroyed = true;
      if (typeof tt.offShow === 'function') tt.offShow(onShow);
      listeners.clear();
    }
  };
}

// platforms/tt.js
// No browser globals. tt and the frame scheduler are explicitly injected.
function createTTPlatform(api, scheduler, audioPaths = {}) {
  const sidebar = createDouyinSidebar(api);
  const rewards=createDisabledRewards();
  const canvas = api.createCanvas(); // Exactly one on-screen canvas.
  const listeners = { pointer: new Set(), resize: new Set(), pause: new Set(), resume: new Set() };
  const removers = [];
  const sounds = new Map();
  const emit = (name, value) => listeners[name].forEach(fn => fn(value));
  const subscribe = name => fn => { listeners[name].add(fn); return () => listeners[name].delete(fn); };
  const bind = (on, off, fn) => { if (typeof api[on] === 'function') { api[on](fn); removers.push(() => { if (typeof api[off] === 'function') api[off](fn); }); } };
  let size;
  function resize(event) {
    const info = api.getSystemInfoSync();
    const changed = event && (event.size || event) || {};
    const positive = n => Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0;
    const width = positive(changed.windowWidth) || positive(info.screenWidth) || positive(info.windowWidth);
    const height = positive(changed.windowHeight) || positive(info.screenHeight) || positive(info.windowHeight);
    const safe = info.safeArea || {}, bounded = (n,max) => Math.max(0,Math.min(Number(n)||0,max));
    let menuBottom = 0;
    try {
      const menu = typeof api.getMenuButtonLayout === 'function' ? api.getMenuButtonLayout() :
        typeof api.getMenuButtonBoundingClientRect === 'function' ? api.getMenuButtonBoundingClientRect() : null;
      if (menu && Number.isFinite(menu.bottom) && menu.bottom > 0) menuBottom = menu.bottom + 6;
    } catch (_error) { /* Optional host menu capability. */ }
    const next = { width, height, dpr: Math.min(positive(info.pixelRatio) || 1, 3),
      safeTop: bounded(Math.max(Number(safe.top)||0,menuBottom || ((Number(info.statusBarHeight)||0)+48)),height/3),
      safeBottom: bounded(Math.max(12,Number.isFinite(safe.bottom)?height-safe.bottom:0),height/3),
      safeLeft: bounded(safe.left,width/4),
      safeRight: bounded(Number.isFinite(safe.right)?width-safe.right:0,width/4) };
    if (!(next.width > 0 && next.height > 0)) throw new Error('Platform viewport dimensions are missing');
    if (size && next.width === size.width && next.height === size.height && next.dpr === size.dpr && next.safeTop === size.safeTop && next.safeBottom === size.safeBottom && next.safeLeft === size.safeLeft && next.safeRight === size.safeRight) return;
    size = next;
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
    emit('resize', { ...size });
  }
  resize();
  for (const [suffix, type] of [['Start','down'],['Move','move'],['End','up'],['Cancel','cancel']]) {
    bind('onTouch' + suffix, 'offTouch' + suffix, event => {
      const touches = (event.changedTouches && event.changedTouches.length) ? event.changedTouches : event.touches || [];
      touches.forEach(touch => emit('pointer', { type, x: touch.clientX, y: touch.clientY, id: touch.identifier }));
    });
  }
  let muted = false, audioPaused = false, audioDestroyed = false;
  const safeAudioCall = (sound, method, ...args) => { try { if (typeof sound[method] === 'function') sound[method](...args); } catch (_) { /* A broken optional audio method must not interrupt game lifecycle. */ } };
  const stopAudio = () => sounds.forEach(sound => safeAudioCall(sound, 'pause'));
  bind('onHide', 'offHide', () => { audioPaused = true; stopAudio(); emit('pause'); });
  bind('onShow', 'offShow', () => { audioPaused = false; resize(); emit('resume'); });
  // Touch coordinates stay logical pixels; resize invalidates the game gesture.
  bind('onWindowResize', 'offWindowResize', resize);
  return {
    canvas, sidebar, rewards, getSize: () => ({ ...size }),
    onPointer: subscribe('pointer'), onResize: subscribe('resize'), onPause: subscribe('pause'), onResume: subscribe('resume'),
    requestFrame: fn => scheduler.requestAnimationFrame(fn), cancelFrame: id => scheduler.cancelAnimationFrame(id),
    storage: {
      getItem(key) { const value = api.getStorageSync(key); return value === undefined || value === null || value === '' ? null : String(value); },
      setItem(key, value) { api.setStorageSync(key, String(value)); }
    },
    audio: {
      play(name) {
        if (muted || audioPaused || audioDestroyed || !audioPaths[name] || typeof api.createInnerAudioContext !== 'function') return;
        try {
          let sound = sounds.get(name);
          if (!sound) { sound = api.createInnerAudioContext(); sound.src = audioPaths[name]; if(typeof sound.onError==='function')sound.onError(() => {}); sounds.set(name, sound); }
          safeAudioCall(sound, 'seek', 0); safeAudioCall(sound, 'play');
        } catch (_error) { /* Audio failure must not block play. */ }
      },
      setMuted(value) { muted = Boolean(value); if (muted) stopAudio(); }
    },
    destroy() { if (audioDestroyed) return; audioDestroyed = true; stopAudio(); rewards.destroy(); sidebar.destroy(); removers.forEach(fn => fn()); sounds.forEach(sound => safeAudioCall(sound, 'destroy')); sounds.clear(); Object.values(listeners).forEach(set => set.clear()); }
  };
}

const platform=createTTPlatform(tt,{requestAnimationFrame,cancelAnimationFrame},{"tap":"assets/tap.wav","place":"assets/place.wav","squeeze":"assets/squeeze.wav","error":"assets/error.wav","win":"assets/win.wav"});
startGame(platform);
})();
