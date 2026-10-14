import {LEVELS,getLevel} from './levels.js';
import {createState,restoreState} from './rules.js';
export const SAVE_KEY='parcel-packing-station:save:v1';
export const SAVE_VERSION=1;
export const freshSave=()=>({version:SAVE_VERSION,levelId:1,completed:[],bestMoves:{},sound:false,state:createState(LEVELS[0])});
export function loadSave(storage) {
  try {
    const raw=storage ? storage.getItem(SAVE_KEY) : null;
    if(!raw)return {save:freshSave(),status:'new'};
    const data=JSON.parse(raw);
    if((!data || data.version!==SAVE_VERSION))return {save:freshSave(),status:'incompatible'};
    const level=getLevel(data.levelId),ids=new Set(LEVELS.map(l=>l.id));
    const completed=Array.isArray(data.completed)?[...new Set(data.completed.filter(id=>ids.has(id)))]:[];
    const bestMoves={};
    if(data.bestMoves&&typeof data.bestMoves==='object')for(const [id,moves] of Object.entries(data.bestMoves))if(ids.has(Number(id))&&Number.isSafeInteger(moves)&&moves>=0&&moves<100000)bestMoves[id]=moves;
    return {save:{version:SAVE_VERSION,levelId:level.id,completed,bestMoves,sound:data.sound===true,state:restoreState(level,data.state)},status:'restored'};
  }catch(_error){return {save:freshSave(),status:'unavailable'};}
}
export function writeSave(storage,save) {
  try {
    if(!storage)return false;
    const {history,...state}=save.state;
    storage.setItem(SAVE_KEY,JSON.stringify({...save,version:SAVE_VERSION,state,savedAt:new Date().toISOString()}));
    return true;
  }catch(_error){return false;}
}
