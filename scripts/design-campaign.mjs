// Offline authored-parameter level construction. Outputs frozen data, never randomizes live boards.
import fs from 'node:fs';
import {normalizeShape,rotateShape,shapeKey} from '../src/rules.js';
import {createCampaignState,findCompletion} from '../src/campaign-rules.js';
let seed=740521;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};const pick=a=>a[Math.floor(rand()*a.length)];
const adjacent=(x,y,w,h)=>[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].filter(([a,b])=>a>=0&&b>=0&&a<w&&b<h);
function model(rows,id){const groups=new Map(),blocked=[];rows.forEach((row,y)=>[...row].forEach((label,x)=>{if(label==='#')blocked.push([x,y]);else{if(!groups.has(label))groups.set(label,[]);groups.get(label).push([x,y]);}}));const pieces=[],solution=[];for(const [label,cells]of groups){const soft=label==='S',original=normalizeShape(cells),turns=(id+pieces.filter(p=>!p.soft).length)%4,piece={id:label,soft,shape:soft?[[0,0],[1,0],[0,1],[1,1]]:rotateShape(original,turns),compressedShape:[[0,0],[1,0],[0,1]]};const compressed=soft&&cells.length===3,base=compressed?piece.compressedShape:piece.shape,rotation=[0,1,2,3].find(r=>shapeKey(rotateShape(base,r))===shapeKey(original));if(rotation===undefined)return null;pieces.push(piece);solution.push({pieceId:label,x:Math.min(...cells.map(p=>p[0])),y:Math.min(...cells.map(p=>p[1])),rotation,compressed});}return {id,width:rows[0].length,height:rows.length,blocked,pieces,solution};}
function makeGrid(id,attempt){const chapter=Math.floor((id-1)/10),w=chapter===1?(id<15?4:5):chapter===2?5:6,h=chapter===1?4:chapter===2?(id%2?4:5):chapter===3?5:6,grid=Array.from({length:h},()=>Array(w).fill('.'));
 const walls=chapter===1?0:chapter===2?1+(id%2):2+(id%3);for(let n=0;n<walls;n++){const x=Math.floor(rand()*w),y=Math.floor(rand()*h);grid[y][x]='#';}
 if(id%3!==0){const soft=id%2?[[0,0],[1,0],[0,1]]:[[0,0],[1,0],[0,1],[1,1]],x=Math.floor(rand()*(w-1)),y=Math.floor(rand()*(h-1));if(soft.some(([dx,dy])=>grid[y+dy][x+dx]!=='.'))return null;soft.forEach(([dx,dy])=>grid[y+dy][x+dx]='S');}
 let letter=0;while(grid.some(row=>row.includes('.'))){if(letter>=9)return null;const free=[];grid.forEach((r,y)=>r.forEach((v,x)=>{if(v==='.')free.push([x,y]);}));const start=pick(free),cells=[start],label='ABCDEFGHJ'[letter++];grid[start[1]][start[0]]=label;const target=3+Math.floor(rand()*3);
  while(cells.length<target){const edge=cells.flatMap(([x,y])=>adjacent(x,y,w,h)).filter(([x,y])=>grid[y][x]==='.');if(!edge.length)break;const at=pick(edge);grid[at[1]][at[0]]=label;cells.push(at);}
  if(cells.length<2)return null;
 }
 const rows=grid.map(r=>r.join('')),m=model(rows,id);if(!m||m.pieces.length>9||m.pieces.length<(id<21?4:5))return null;return rows;
}
const titles=['留给后车的长缝','第一道封签','拐角别先占满','不是空格越多越好','给软包留个弯','两批心意同一箱','短边上的约定','纸箱里的通道','先看清下一批','早班交接单'];
const chapters=['旧仓新手','早班接货','雨天隔板','夜班接力','最后一车'];
const stories=['阿乔把旧仓钥匙递给你：先把眼前这箱装好。','阿乔：后车还在路上，完整货单先给你。封签前想一想，那些形状放哪儿？','屋檐滴着雨，纸箱加上了防撞隔板。能放下的空隙，比空格数量更重要。','夜班同事一批批送来货物。你留下的位置，决定下一次交接能不能继续。','最后一车开往远方。别急着落下封签，替还没装入的每一份心意留条路。'];
const designs=[],proof=[],seen=new Set();
for(let id=11;id<=50;id++){
 let accepted=false;for(let attempt=0;attempt<30000&&!accepted;attempt++){
  const rows=id===11?['AABB','AABB','CCCC','DDDD']:makeGrid(id,attempt);if(!rows)continue;const level=model(rows,id);if(!level)continue;
  const signature=[level.width,level.height,level.blocked.map(p=>p.join(',')).sort(),level.pieces.map(p=>[0,1,2,3].map(r=>shapeKey(rotateShape(p.shape,r))).sort()[0]).sort()].join('|');if(seen.has(signature))continue;
  const state=createCampaignState(level),initial=findCompletion(level,state,{maxNodes:30000});if(initial.status!=='solved')continue;
  const first=level.pieces.find(p=>p.id==='A');if(!first||first.shape.length<3)continue;let witness=null,legal=0,bad=0;
  for(let rotation=0;rotation<4&&!witness;rotation++)for(let y=0;y<level.height&&!witness;y++)for(let x=0;x<level.width&&!witness;x++){
   const candidate=createCampaignState(level);candidate.forms.A={rotation,compressed:false};candidate.placements.A={x,y};candidate.sealed=['A'];const check=findCompletion(level,candidate,{maxNodes:12000});if(check.status==='impossible'){
    const shape=rotateShape(first.shape,rotation);if(shape.some(([dx,dy])=>x+dx>=level.width||y+dy>=level.height||level.blocked.some(([bx,by])=>bx===x+dx&&by===y+dy)))continue;
    witness={pieceId:'A',x,y,rotation,compressed:false};bad++;}legal++;
  }
  if(!witness)continue;
  const others=level.pieces.map(p=>p.id).filter(x=>x!=='A'),batchCount=id<31?2:id<41?3:4,batches=[['A']];for(let n=1;n<batchCount;n++){const remaining=batchCount-n,amount=Math.ceil(others.length/remaining);batches.push(others.splice(0,amount));}
  if(batches.some(b=>!b.length))continue;
  const chapter=Math.floor((id-1)/10),d={id,title:titles[(id-11)%10]+(chapter>1?' · '+chapters[chapter]:''),tag:`第${chapter+1}章 · ${batchCount}批交接`,hint:'先查看全部货物轮廓。装完当前批再封签；封签会锁住位置，留错空隙可能卡住。',map:rows,soft:rows.some(r=>r.includes('S'))?'S':undefined,startCompressed:id%4===1,batches,chapter:chapter+1,story:stories[chapter],badSeal:witness};
  designs.push(d);proof.push({id,initialSolver:initial.status,nodes:initial.nodes,pieces:level.pieces.length,batches:batchCount,deadlockWitness:witness});seen.add(signature);accepted=true;console.log(id,rows.join('/'),'nodes',initial.nodes,'batches',batchCount);
 }
 if(!accepted)throw Error('Unable to construct deliberate solvable-risk level '+id);
}
fs.writeFileSync(new URL('../src/campaign-designs.js',import.meta.url),'// Frozen offline-designed layouts. Every starting position and seal path is verified.\nexport const CAMPAIGN_DESIGNS='+JSON.stringify(designs,null,2)+';\n');
fs.writeFileSync(new URL('../artifacts/campaign-design-proof.json',import.meta.url),JSON.stringify(proof,null,2)+'\n');
