import {env} from 'cloudflare:workers';
import {db,admin,origin,str,answer,error,fail} from '../../../lib/server';
import {runAssistant,AssistantServiceError,thaiDay} from '../../../lib/assistant-policy.mjs';
import {readClassroomReport,formatQuickReport} from '../../../lib/assistant-reports';
type Row=Record<string,any>;
async function limit(owner:string,now:number){
 for(const [prefix,bucket,max,expires] of [['assistant-minute',Math.floor(now/60000),8,now+120000],['assistant-day',thaiDay(now),100,now+2*86400000]] as const){
  const row=await db().prepare('INSERT INTO login_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(prefix+':'+owner+':'+bucket,expires).first<Row>();
  if(!row||row.count>max)fail(429,prefix==='assistant-day'?'ถึงขีดจำกัด AI 100 คำถามต่อวันแล้ว รายงานด่วนยังใช้ได้':'ถาม AI หลายครั้งเกินไป กรุณารอสักครู่');
 }
}
export async function POST(req:Request){try{
 origin(req);const user=await admin(),now=Date.now();
 const raw=await req.text();if(raw.length>8000)fail(400,'ข้อความยาวเกินกำหนด');
 let body:Row;try{body=JSON.parse(raw)}catch{fail(400,'ข้อมูลไม่ถูกต้อง')}
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'ข้อมูลไม่ถูกต้อง');
 const key=env.OPENAI_API_KEY,configured=typeof key==='string'&&key.length>0;
 if(body.op==='load'){
  const rows=await db().prepare("SELECT id,message,answer,reports,mode,created FROM assistant_requests WHERE owner_id=? AND status='complete' ORDER BY created DESC,id DESC LIMIT 30").bind(user.userId).all<Row>();
  const summary=await readClassroomReport({kind:'activity'},user.userId,now);
  return answer({configured,summary,history:rows.results.reverse().map(r=>({...r,reports:JSON.parse(r.reports)}))});
 }
 if(body.op!=='chat'&&body.op!=='quick')fail(400,'ไม่พบคำสั่ง');
 const id=str(body.requestId,80);if(!/^[a-f0-9-]{36}$/i.test(id))fail(400,'รหัสคำถามไม่ถูกต้อง');
 const existing=await db().prepare('SELECT * FROM assistant_requests WHERE id=?').bind(id).first<Row>();
 if(existing){
  if(existing.owner_id!==user.userId)fail(404,'ไม่พบคำถาม');
  if(existing.status!=='complete')fail(409,'คำถามนี้กำลังประมวลผลหรือเคยไม่สำเร็จ กรุณารีเฟรชประวัติก่อนส่งคำถามใหม่');
  return answer({reply:{...existing,reports:JSON.parse(existing.reports)}});
 }
 if(body.op==='chat'&&!configured)fail(503,'ยังไม่ได้เชื่อมต่อ OpenAI กรุณาเชื่อม OpenAI Developers เพื่อเปิดใช้ AI รายงานด่วนด้านบนยังใช้ได้');
 const quick=body.op==='quick',message=quick?str(body.message||'เปิดรายงาน',200):str(body.message,2000);
 // Validate/read a quick report before reserving the request. AI gets only the
 // allowlisted read functions below, never raw SQL or authentication records.
 const quickReport=quick?await readClassroomReport(body.report,user.userId,now):null;
 if(!quick)await limit(user.userId,now);
 const inserted=await db().prepare("INSERT INTO assistant_requests (id,owner_id,message,mode,status,created) SELECT ?,?,?,?,'pending',? WHERE NOT EXISTS (SELECT 1 FROM assistant_requests WHERE owner_id=? AND status='pending' AND created>?) ON CONFLICT(id) DO NOTHING").bind(id,user.userId,message,quick?'quick':'ai',now,user.userId,now-120000).run();
 if(!inserted.meta.changes)fail(409,'กำลังตอบคำถามก่อนหน้า กรุณารอสักครู่แล้วรีเฟรชประวัติ');
 try{
  let result:{text:string;reports:Row[]};
  if(quickReport)result={text:formatQuickReport(quickReport),reports:[quickReport]};
  else{
   const previous=await db().prepare("SELECT message,answer FROM assistant_requests WHERE owner_id=? AND status='complete' ORDER BY created DESC,id DESC LIMIT 6").bind(user.userId).all<Row>();
   const history=previous.results.reverse().flatMap(r=>[{role:'user',content:r.message},{role:'assistant',content:r.answer}]);
   result=await runAssistant({key,model:env.OPENAI_MODEL||'gpt-6-luna',history,message,now,readReport:(input:Row)=>readClassroomReport(input,user.userId,now)});
  }
  const reports=JSON.stringify(result.reports);
  await db().batch([
   db().prepare("UPDATE assistant_requests SET answer=?,reports=?,status='complete' WHERE id=? AND owner_id=?").bind(result.text,reports,id,user.userId),
   db().prepare('DELETE FROM assistant_requests WHERE created<?').bind(now-90*86400000)
  ]);
  return answer({reply:{id,message,answer:result.text,reports:result.reports,mode:quick?'quick':'ai',created:now}});
 }catch(e){
  await db().prepare("UPDATE assistant_requests SET status='failed' WHERE id=? AND owner_id=?").bind(id,user.userId).run();
  if(e instanceof AssistantServiceError)return answer({error:e.message},502);
  throw e;
 }
}catch(e){return error(e)}}
