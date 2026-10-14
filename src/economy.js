import {currentBatch,canSeal,findCompletion,applyCampaignAction} from './campaign-rules.js';
export const TOOL_PRICES={scan:6,locate:8,revive:10};
export function awardClear(save,levelId){
 const awarded=Array.isArray(save.awardedLevels)?save.awardedLevels:[];if(awarded.includes(levelId))return {save,earned:0};
 return {save:{...save,coins:Math.min(100000,(save.coins||0)+20),awardedLevels:[...awarded,levelId]},earned:20};
}
export function useBenefit(level,state,kind){
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
export function purchaseBenefit(level,state,save,kind){
 const price=TOOL_PRICES[kind];if(!Number.isInteger(price))return {ok:false,state,save,reason:'未知道具'};
 if(!Number.isInteger(save.coins)||save.coins<price)return {ok:false,state,save,reason:'金币不足。仍可免费重开，金币只从通关获得。'};
 const result=useBenefit(level,state,kind);if(!result.ok)return {...result,save};
 return {...result,save:{...save,coins:save.coins-price},spent:price};
}
