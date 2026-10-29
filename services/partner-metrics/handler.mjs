import {readFileSync} from 'node:fs';
import {parseHistory} from './history-model.mjs';
export function createHistoryHandler({read=()=>readFileSync('/home/rawdata/.local/share/cradleos-partner-metrics/report.json','utf8'),now=Date.now}={}){
 return (_req,res)=>{
  res.setHeader('Cache-Control','no-store');
  try{return res.json(parseHistory(JSON.parse(read()),now()));}
  catch{return res.status(503).json({error:'report_unavailable'});}
 };
}
export const handlePartnerHistory=createHistoryHandler();
