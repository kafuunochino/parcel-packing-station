import {normalizeShape,rotateShape,shapeKey} from './rules.js';
import {CAMPAIGN_DESIGNS} from './campaign-designs.js';
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
export const LEVELS=designs.map(makeLevel);
export const getLevel=id=>LEVELS.find(l=>l.id===id)||LEVELS[0];
