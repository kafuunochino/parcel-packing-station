// Reserved reward contract. No ad SDK, real ad unit, payment or network is enabled.
export function createMockRewards(options={}){
 let active=null,counter=0,destroyed=false;
 const settle=status=>{if(!active)return false;const request=active;active=null;if(request.timer&&options.timers)options.timers.clearTimeout(request.timer);request.resolve({status,requestId:request.id});return true;};
 return {getState:()=>({mode:'mock',available:!destroyed,busy:!!active}),request({placement,context}={}){if(destroyed||active)return Promise.resolve({status:'unavailable',requestId:null});const id=`mock-${++counter}`;return new Promise(resolve=>{active={id,placement,context,resolve};if(options.timers)active.timer=options.timers.setTimeout(()=>{if(active&&active.id===id)settle('error');},options.timeoutMs||60000);});},completeMock(status){return ['completed','cancelled','unavailable','error'].includes(status)?settle(status):false;},cancel(){settle('cancelled');},destroy(){destroyed=true;settle('cancelled');}};
}
export function createDisabledRewards(){let counter=0;return {getState:()=>({mode:'disabled',available:false,busy:false}),request:()=>Promise.resolve({status:'unavailable',requestId:`disabled-${++counter}`}),cancel(){},destroy(){}};}
