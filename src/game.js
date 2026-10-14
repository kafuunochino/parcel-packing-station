import {LEVELS,getLevel} from './levels.js';
import {getShape,occupiedCells,canPlace,remainingCells} from './rules.js';
import {createCampaignState,applyCampaignAction,campaignWin,currentBatch,canSeal} from './campaign-rules.js';
import {awardClear,purchaseBenefit,useBenefit} from './economy.js';
import {createDisabledRewards} from './rewards.js';
import {loadSave,writeSave} from './storage.js';
const C={ink:'#292c25',muted:'#aeb6a0',warehouse:'#30382f',beam:'#52604d',paper:'#fff2d1',kraft:'#c99554',edge:'#825b35',orange:'#f5b640',red:'#b95640',mint:'#99bf87',gold:'#edc15a',blue:'#85b9d2',peach:'#e49576',lavender:'#aa95c9',lime:'#c2ce75',teal:'#76b6aa',sand:'#d6b987',pink:'#e99ab8'};
const FONT='"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';
/** The entire game, including menus, is painted inside one Canvas. */
export function startGame(platform) {
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
 function button(id,label,x,y,w,h,options={}){const disabled=!!options.disabled;ctx.globalAlpha=disabled ? .40 : 1;rect(x+1,y+3,w,h,C.ink);rrect(x,y,w,h,3,options.fill||C.paper,options.border||C.edge);text(label,x+w/2,y+h/2+5,options.font||14,options.color||C.ink,700,'center');if(options.tag)rect(x+6,y+6,4,h-12,C.orange);ctx.globalAlpha=1;targets.push({id,label,x,y,w,h,disabled,...options.data});}
 function dimensions(){
  size=platform.getSize();const safe={top:Math.max(0,Number(size.safeTop)||0),bottom:Math.max(0,Number(size.safeBottom)||0),left:Math.max(0,Number(size.safeLeft)||0),right:Math.max(0,Number(size.safeRight)||0)};
  const availableWidth=Math.max(1,size.width-safe.left-safe.right),W=Math.min(480,availableWidth),H=Math.max(1,size.height-safe.top-safe.bottom);
  return {W,H,scale:1,ox:safe.left+(availableWidth-W)/2,oy:safe.top,safeInsets:safe,compact:W<304||H<482,board:null,footerY:H-54,trayY:H-122};
 }
 function logical(event){const l=layout||dimensions();return {x:event.x-l.ox,y:event.y-l.oy};}
 function warehouse(){
  rect(0,0,size.width,size.height,C.warehouse);
  for(let x=18;x<size.width;x+=180){rect(x,0,7,size.height,'#44513f');for(let y=70;y<size.height;y+=176){rect(x+20,y,64,56,'#45503e');rect(x+27,y+8,8,40,'#566045');rect(x+94,y+12,54,44,'#3f4939');}}
  poly([[size.width*.42,0],[size.width*.72,0],[size.width*.94,size.height],[size.width*.55,size.height]],'rgba(244,222,153,0.035)');
  for(let y=132;y<size.height;y+=176){rect(0,y,size.width,8,'#58624a');rect(0,y+8,size.width,4,'#20281f');}
 }
 function parcelShape(piece,form,x,y,cell,alpha=1){const cells=getShape(piece,form);ctx.globalAlpha=alpha;for(const [dx,dy]of cells){const px=x+dx*cell,py=y+dy*cell;rrect(px,py,cell-2,cell-2,piece.soft?5:2,C[piece.color],C.edge);if(piece.soft){ctx.save();if(typeof ctx.setLineDash==='function')ctx.setLineDash([3,2]);rrect(px+3,py+3,cell-8,cell-8,3,null,'#994e74');ctx.restore();}else rect(px+cell*.42,py+2,Math.max(2,cell*.14),cell-6,'rgba(255,245,214,0.42)');}ctx.globalAlpha=1;}
 function boxArt(x,y,w,h){rect(x+8,y+10,w,h,'#20261f');poly([[x,y],[x+w*.82,y],[x+w,y+18],[x+w,y+h],[x,y+h]],C.kraft);rect(x+8,y+9,w-16,h-17,'#a9753d');rect(x+14,y+15,w-28,h-29,'#ead5a8');poly([[x,y],[x+16,y-12],[x+w-12,y-12],[x+w*.82,y]],'#ddaf73');poly([[x+w*.82,y],[x+w,y+18],[x+w,y+h],[x+w-12,y+h-8],[x+w-12,y+20]],'#a87942');for(let i=0;i<9;i++)line(x+15,y+20+i*(h-32)/9,x+w-20,y+19+i*(h-32)/9,'rgba(126,91,47,0.07)');rect(x+w*.43,y,20,h,'rgba(249,222,166,0.5)');barcode(x+w-64,y+h-32,40,16,C.edge);}
 function drawHome(){
  const {W,H}=layout,pad=20;
  rect(pad,20,84,22,C.orange);text('PACK / 50',pad+9,36,12,C.ink,700);text(`${save.coins} 金币`,W-pad,36,13,C.orange,700,'right');
  text('快递收纳站',pad,86,Math.min(40,W*.102),C.paper,800);text('留好下一批的位置，再落下封签。',pad,114,Math.min(14,(W-40)/18),'#c8d1b7');
  const y=148,artH=Math.min(240,Math.max(76,H-428)),artW=Math.min(W-64,300);boxArt((W-artW)/2,y,artW,Math.max(76,artH));
  const demo=LEVELS[4],soft=demo.pieces.find(p=>p.soft);parcelShape(soft,{rotation:0,compressed:true},W/2-25,y+18,Math.max(24,Math.min(50,artH*.32)));text('本地工位 / 无需赶时间',W/2,y+Math.max(76,artH)+34,12,C.muted,400,'center');
  const startY=H-216;button('play',state.moves?'继续装箱':'开始装箱',pad,startY,W-pad*2,52,{fill:C.orange,font:18,tag:true});
  const half=(W-pad*2-10)/2;button('levels','关卡货架',pad,startY+62,half,48);button('help','装箱说明',pad+half+10,startY+62,half,48);button('settings','工位设置',pad,startY+120,W-pad*2,48);
  text(`${save.completed.length} / 50 箱已出库 · ${saveOK?'进度保存在此设备':'此设备无法存档'}`,W/2,H-16,11,C.muted,400,'center');
 }
 function drawCompact(){const {W,H}=layout;text('竖起手机，打开工位',W/2,Math.max(80,H*.3),20,C.paper,700,'center');wrap('请使用竖屏或放大窗口。装箱进度已保留，按钮不会被缩成小图标。',24,Math.max(110,H*.3+36),W-48,14,C.muted,23,4);button('home','返回仓库',24,H-70,W-48,48);}
 function drawPlay(){
  const {W,H,trayY,footerY}=layout;
  button('menu','菜单',10,4,52,44,{fill:'#d3ba88'});button('help','说明',W-62,4,52,44,{fill:'#d3ba88'});
  if(state.status==='failed')button('showFailure','这箱卡住了',W/2-66,4,132,44,{fill:'#e3a38c'});else if(campaignWin(level,state))button('showWin','出库单',W/2-66,4,132,44,{fill:C.orange});else if(level.batches.length>1)button('manifest',canSeal(level,state)?'本批已齐 · 待封签':`货单 · 第${state.stage+1}/${level.batches.length}批`,W/2-84,4,168,44,{font:12,fill:canSeal(level,state)?C.orange:C.paper});else{text(`${String(level.id).padStart(2,'0')} 号装箱工位`,W/2,25,16,C.paper,700,'center');const chosen=level.pieces.find(p=>p.id===selected);text(chosen?`${chosen.id} ${chosen.name}${chosen.soft?(state.forms[chosen.id].compressed?' · 三格':' · 四格'):''}`:'点击包裹 · 对齐左上角',W/2,43,10,C.muted,400,'center');}
  text(`装入 ${Object.keys(state.placements).length}/${level.pieces.length}`,14,70,12,C.paper,700);text(`空格 ${remainingCells(level,state)}`,W/2,70,12,C.paper,700,'center');text(`${state.moves} 步`,W-14,70,12,C.paper,700,'right');
  const cell=Math.min((W-40)/level.width,(trayY-96)/level.height,88),bw=cell*level.width,bh=cell*level.height,bx=(W-bw)/2,by=84+((trayY-96)-bh)/2;
  layout.board={x:bx,y:by,w:bw,h:bh,cell};rect(bx-12,by-12,bw+24,bh+24,'#80562f');rect(bx-8,by-8,bw+16,bh+16,C.kraft);rect(bx-3,by-3,bw+6,bh+6,'#a97642');
  const occupied=occupiedCells(level,state),blocked=new Set(level.blocked.map(c=>c.join(',')));let preview=null;
  if(drag&&drag.moved&&selected){const p=boardPoint(drag.current,drag.anchor);if(p)preview={...p,...canPlace(level,state,selected,p.x,p.y)};}
  const previewCells=new Set();if(preview){const piece=level.pieces.find(p=>p.id===selected);getShape(piece,state.forms[selected]).forEach(([x,y])=>previewCells.add(`${x+preview.x},${y+preview.y}`));}
  for(let y=0;y<level.height;y++)for(let x=0;x<level.width;x++){
   const key=`${x},${y}`,id=occupied.get(key),piece=level.pieces.find(p=>p.id===id),px=bx+x*cell+1.5,py=by+y*cell+1.5+(piece&&animation&&animation.pieceId===id&&['place','compress','rotate'].includes(animation.kind)&&Date.now()<animation.until?-Math.sin(Math.min(1,(Date.now()-animation.started)/(animation.until-animation.started))*Math.PI)*7:0),edge=cell-3;
   rrect(px,py,edge,edge,piece&&piece.soft?5:2,piece?C[piece.color]:blocked.has(key)?'#9d8158':'#e4cba1','#b18755');
   if(blocked.has(key)){ctx.save();ctx.beginPath();ctx.rect(px,py,edge,edge);ctx.clip();for(let a=-edge;a<edge*2;a+=10)line(px+a,py,px+a+edge,py+edge,'#645a3e',3);ctx.restore();}
   if(piece){rect(px-1.5,py-1.5,cell,cell,C[piece.color]);const cellKey=(dx,dy)=>occupied.get(`${x+dx},${y+dy}`)===id;if(!cellKey(0,-1))line(px,py,px+edge,py,'rgba(255,251,220,0.7)',2);if(!cellKey(-1,0))line(px,py,px,py+edge,'rgba(255,251,220,0.45)',2);if(!cellKey(0,1))line(px,py+edge,px+edge,py+edge,C.edge,2);if(!cellKey(1,0))line(px+edge,py,px+edge,py+edge,C.edge,2);if(piece.soft){ctx.save();if(typeof ctx.setLineDash==='function')ctx.setLineDash([4,3]);rrect(px+3,py+3,edge-6,edge-6,5,null,'#994e74');ctx.restore();}else rect(px+edge*.43,py+2,edge*.13,edge-4,'rgba(255,245,214,0.42)');if(id===selected){rrect(px+2,py+2,edge-4,edge-4,2,null,C.ink);rrect(px+3,py+3,edge-6,edge-6,2,null,C.ink);}const first=getShape(piece,state.forms[id])[0],at=state.placements[id];if(x===at.x+first[0]&&y===at.y+first[1]){rect(px+5,py+5,20,21,C.paper);text(id,px+15,py+21,13,C.ink,700,'center');}}
   if(piece&&state.sealed.includes(id)){rect(px,py+edge*.46,edge,8,'rgba(244,219,156,0.9)');if((x+y)%2===0)text('封',px+edge/2,py+edge*.46+8,8,C.red,700,'center');}
   if(state.clue&&state.clue.pieceId===selected){const cp=level.pieces.find(p=>p.id===state.clue.pieceId);if(getShape(cp,state.clue).some(([dx,dy])=>state.clue.x+dx===x&&state.clue.y+dy===y)){rrect(px+4,py+4,edge-8,edge-8,2,null,'#235b9b');}}
   if(previewCells.has(key)){ctx.globalAlpha=.55;rect(px,py,edge,edge,preview.ok?'#73b473':'#d36153');ctx.globalAlpha=1;}
  }
  // One accessible row of parcels. Pagination preserves 44px targets on 320px phones.
  const pages=Math.ceil(level.pieces.length/3),gap=5,side=44,cardW=(W-20-side*2-gap*4)/3;
  rect(8,trayY-7,W-16,68,'#546148');button('trayPrev','‹',10,trayY,side,56,{disabled:trayPage===0,font:24,fill:'#b8bc94'});
  level.pieces.slice(trayPage*3,trayPage*3+3).forEach((piece,i)=>{const x=10+side+gap+i*(cardW+gap),y=trayY,placed=!!state.placements[piece.id],chosen=selected===piece.id,available=currentBatch(level,state).includes(piece.id)&&!state.sealed.includes(piece.id),batch=level.batches.findIndex(b=>b.includes(piece.id))+1;rect(x+1,y+3,cardW,56,C.ink);rrect(x,y,cardW,56,2,chosen?C.orange:!available?'#cec9b5':piece.soft?'#f1c2d3':C.paper,chosen?C.orange:C.edge);const cells=getShape(piece,state.forms[piece.id]),cols=Math.max(...cells.map(c=>c[0]))+1,rows=Math.max(...cells.map(c=>c[1]))+1,pc=Math.min(12,(cardW-12)/cols,30/rows);parcelShape(piece,state.forms[piece.id],x+(cardW-cols*pc)/2,y+5+(30-rows*pc)/2,pc,placed ? .45 : 1);text(`${piece.id}${level.batches.length>1?'·'+batch+'批':piece.soft?' 软包':''}${placed?' ✓':''}`,x+cardW/2,y+48,11,C.ink,700,'center');targets.push({id:'piece',pieceId:piece.id,label:`包裹 ${piece.id}`,x,y,w:cardW,h:56,disabled:false});});
  button('trayNext','›',W-54,trayY,side,56,{disabled:trayPage>=pages-1,font:24,fill:'#b8bc94'});
  const piece=level.pieces.find(p=>p.id===selected),w=(W-20-18)/4,soft=!!(piece&&piece.soft),editable=!!piece&&state.status!=='failed'&&currentBatch(level,state).includes(piece.id)&&!state.sealed.includes(piece.id);
  button('rotate','旋转',10,footerY,w,48,{disabled:!editable,fill:C.orange});button('compress',soft?(state.forms[selected].compressed?'展开':'压缩'):'软包',10+w+6,footerY,w,48,{disabled:!soft||!editable,fill:'#e7a5be'});button('remove','取出',10+(w+6)*2,footerY,w,48,{disabled:!editable||!state.placements[selected]});button('undo','撤回',10+(w+6)*3,footerY,w,48,{disabled:state.status==='failed'||!state.history.length});
 }
 function modalHeader(title){const {W,H}=layout;rect(4,4,W-8,H-8,C.paper);rect(4,4,W-8,7,C.kraft);barcode(20,22,45,17);text('PACKING RECORD',74,35,10,C.edge,700);button('close','返回',W-70,18,50,44,{fill:'#dfc99e'});text(title,20,88,24,C.ink,800);line(20,103,W-20,103,'#bca77e');targets=targets.filter(t=>t.id==='close');}
 function drawModal(){
  const {W,H}=layout;targets=[];ctx.fillStyle='rgba(20,25,19,0.8)';ctx.fillRect(0,0,W,H);
  const titles={menu:'工位运单夹',levels:'关卡货架',help:'装箱说明',settings:'工位设置',hint:'参考装箱图',restart:'重新装这一箱？',win:'出库成功',sidebarInfo:'侧边栏复访',briefing:'今日交接',manifest:'完整货单',failure:'这箱卡住了',tools:'工位工具箱',rewardMock:'模拟广告',benefit:'工具回执'};
  modalHeader(titles[modal]||'运单');
  if(modal==='menu'){
   const y=120,w=(W-50)/2;button('play','继续装箱',20,y,W-40,48,{fill:C.orange});
   [['levels','关卡货架'],['manifest','完整货单'],['help','装箱说明'],['hint','参考拼法'],['restart','免费重开'],['tools','金币工具'],['settings','工位设置'],['home','返回仓库']].forEach(([id,label],i)=>button(id,label,20+(i%2)*(w+10),y+56+Math.floor(i/2)*50,w,44));
   wrap(level.title+'。'+level.hint,20,H-70,W-40,12,C.edge,19,3);
  }else if(modal==='levels'){
   const names=['旧仓新手','早班接货','雨天隔板','夜班接力','最后一车'];text(`第${levelsPage+1}章 · ${names[levelsPage]}`,20,126,14,C.edge,700);const w=(W-50)/2,h=44;
   LEVELS.slice(levelsPage*10,levelsPage*10+10).forEach((item,i)=>{const x=20+(i%2)*(w+10),y=141+Math.floor(i/2)*49;button(`level:${item.id}`,`${String(item.id).padStart(2,'0')}  ${save.completed.includes(item.id)?'已出库':item.batches.length>1?item.batches.length+'批交接':'练习箱'}`,x,y,w,h,{fill:level.id===item.id?C.orange:C.paper,font:13});});
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
   rect(22,126,W-44,70,'#e9d8ad');text(save.completed.length===LEVELS.length?'五十箱心意，都送达了！':'刚刚好，出库啦！',W/2,156,20,C.ink,800,'center');text(`${state.moves} 次操作 / ${save.completed.length} 箱已出库`,W/2,181,14,C.edge,400,'center');barcode(34,214,W-68,24);text(earned?`首次出库 +${earned} 金币 · 余额${save.coins}`:`本关已领过金币 · 余额${save.coins}`,W/2,263,12,C.edge,700,'center');
   button('next',level.id===LEVELS.length?'查看关卡货架':'下一箱，继续装',20,H-186,W-40,48,{fill:C.orange});button('restart','重装这一箱',20,H-128,W-40,48);button('levels','回到关卡货架',20,H-70,W-40,48);
  }else if(modal==='briefing'){
   const lessons=['先从货架选一件，再点箱内左上角。两件都装入就能完成第一箱。','L形包裹要转个方向。旋转只改变方向，不会翻面。','弯角彼此借位，把每一个空隙都用起来。','斜纹是防撞隔板。它不可以移动，也不能放包裹。','粉色软包可以从四格挤成三格，再展开回来。'];
   text(`第${level.chapter}章 / 第${level.id}箱`,20,133,13,C.edge,700);wrap(level.id<=5?lessons[level.id-1]:level.story,20,168,W-40,16,C.ink,27,5);
   boxArt(W/2-62,Math.min(274,H-204),124,60);text(level.batches.length>1?`${level.batches.length}批货物 · 所有轮廓已列在货单`:'阿乔在旁边，不赶时间。',W/2,H-108,12,C.edge,700,'center');button('briefStart','知道了，开工',20,H-74,W-40,48,{fill:C.orange});
  }else if(modal==='manifest'){
   text(`当前第${state.stage+1}/${level.batches.length}批 · 封签后位置锁定`,20,128,12,C.edge,700);const tw=(W-56)/3;
   level.pieces.forEach((p,i)=>{const x=20+(i%3)*(tw+8),y=144+Math.floor(i/3)*77,batch=level.batches.findIndex(b=>b.includes(p.id));rect(x,y,tw,69,batch===state.stage?'#f2dfaa':'#e5dfcc');const shape=getShape(p,state.forms[p.id]),cols=Math.max(...shape.map(v=>v[0]))+1,rows=Math.max(...shape.map(v=>v[1]))+1,cell=Math.min(13,40/rows,(tw-12)/cols);parcelShape(p,state.forms[p.id],x+(tw-cols*cell)/2,y+6,cell);text(`${p.id} · 第${batch+1}批${state.sealed.includes(p.id)?' 封':''}`,x+tw/2,y+58,11,C.ink,700,'center');});
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
   [['completed','模拟完成'],['cancelled','提前关闭，不领奖'],['unavailable','模拟无填充'],['error','模拟错误']].forEach(([status,label],i)=>button('mock:'+status,label,20,204+i*49,W-40,44,{fill:i===0?C.orange:C.paper,font:13}));
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
  else if(['menu','help','levels','hint','restart','settings','sidebarInfo','manifest','tools'].includes(id))openModal(id);
  else if(id==='close')closeModal();
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
   if(hit){if(hit.id==='piece'&&!hit.disabled){selected=hit.pieceId;drag={id:event.id,start:p,current:p,moved:false,pieceId:selected,anchor:{x:0,y:0},hit};requestDraw();}else drag={id:event.id,start:p,current:p,moved:false,hit};return;}
   if(modal||screen!=='play'||layout.compact)return;const at=boardPoint(p);if(at){const id=occupiedCells(level,state).get(`${at.x},${at.y}`);if(selected&&selected!==id&&canPlace(level,state,selected,at.x,at.y).ok)drag={id:event.id,start:p,current:p,moved:false,at};else if(id){selected=id;const pos=state.placements[id];drag={id:event.id,start:p,current:p,moved:false,pieceId:id,anchor:{x:at.x-pos.x,y:at.y-pos.y}};requestDraw();}else drag={id:event.id,start:p,current:p,moved:false,at};}
  }else if(drag&&event.id===drag.id){
   if(event.type==='cancel'){drag=null;requestDraw();return;}if(event.type==='move'){drag.current=p;if(drag.pieceId&&Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>6)drag.moved=true;requestDraw();}
   else if(event.type==='up'){const ended=drag;drag=null;if(ended.moved&&ended.pieceId){const at=boardPoint(p,ended.anchor);if(at)action('place',at);else notify('未放下，包裹仍在原位');}else if(ended.hit){const hit=ended.hit;if(p.x>=hit.x&&p.x<=hit.x+hit.w&&p.y>=hit.y&&p.y<=hit.y+hit.h)activate(hit);}else if(ended.at&&Math.hypot(p.x-ended.start.x,p.y-ended.start.y)<10){if(selected)action('place',ended.at);else notify('先选一件包裹');}requestDraw();}
  }
 }
 disposers.push(platform.onPointer(pointer),platform.onResize(()=>{size=platform.getSize();drag=null;invalidate();}),platform.onPause(()=>{paused=true;drag=null;inputReady=false;targets=[];if(frame!==null){platform.cancelFrame(frame);frame=null;}persist();}),platform.onResume(()=>{paused=false;invalidate();}));
 if(loaded.status==='unavailable')notify('存档暂时不可用，仍可游玩');requestDraw();
 return {
  getSnapshot(){const l=layout||dimensions();return JSON.parse(JSON.stringify({screen,modal,tutorialPage,trayPage,levelsPage,coins:save.coins,earned,reward:rewards.getState(),rewardPending:rewardPending?{kind:rewardPending.kind,run:rewardPending.run}:null,levelId:level.id,selected,state,completed:save.completed,sound:save.sound,saveOK,paused,destroyed,sidebar:sidebarState,layout:l,hitTargets:targets.map(t=>({...t,screenX:t.x+l.ox,screenY:t.y+l.oy,screenWidth:t.w,screenHeight:t.h}))}));},
  destroy(){if(destroyed)return;cancelRewardRun();persist();destroyed=true;disposers.forEach(fn=>{if(fn)fn();});if(frame!==null)platform.cancelFrame(frame);}
 };
}
