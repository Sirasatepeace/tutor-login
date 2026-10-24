import {nameApprovalRequired} from '../../../lib/name-policy.mjs';
import {db,bucket,identity,ownerId,admin,origin,str,email,answer,error,fail,courseAccess} from '../../../lib/server';
export async function POST(req:Request){try{origin(req);const u=await identity();const b=await req.json() as any;const op=b.op;const now=Date.now();const oid=await ownerId();
if(op==='load'){
 await db().prepare('INSERT INTO people (id,email,name,created) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name').bind(u.userId,u.email.toLowerCase(),u.displayName,now).run();
 
 const isAdmin=oid===u.userId,waitingForName=!isAdmin&&nameApprovalRequired(u.nameStatus);
 const cs=waitingForName?{results:[]}:isAdmin?await db().prepare('SELECT * FROM courses ORDER BY created DESC').all():await db().prepare("SELECT c.* FROM courses c WHERE c.published=1 AND (c.visibility='all' OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id=c.id AND e.user_id=? AND e.status='active' AND (e.expires IS NULL OR e.expires>?))) ORDER BY c.created DESC").bind(u.userId,now).all();
 const es=waitingForName?{results:[]}:isAdmin?await db().prepare('SELECT * FROM enrollments ORDER BY created DESC').all():await db().prepare('SELECT * FROM enrollments WHERE user_id=?').bind(u.userId).all();
 const ls:any[]=[];const fs:any[]=[];const notices:any[]=[];
 for(const c of cs.results as any[]){if(isAdmin||await courseAccess(u.userId,c.id)){
 const a=await db().prepare('SELECT * FROM lessons WHERE course_id=? ORDER BY position,created').bind(c.id).all();ls.push(...a.results);
 const f=await db().prepare('SELECT f.id,f.lesson_id,f.name,f.kind,f.size FROM files f JOIN lessons l ON f.lesson_id=l.id WHERE l.course_id=? ORDER BY f.created').bind(c.id).all();fs.push(...f.results);
 const n=await db().prepare('SELECT n.id,n.lesson_id,n.content,n.created FROM lesson_notices n JOIN lessons l ON n.lesson_id=l.id WHERE l.course_id=? ORDER BY n.created DESC').bind(c.id).all();notices.push(...n.results);
 }}
 const ps=waitingForName?{results:[]}:await db().prepare('SELECT lesson_id,seconds,done FROM progress WHERE user_id=?').bind(u.userId).all();
 const accounts=isAdmin?(await db().prepare('SELECT a.user_id,a.username,a.name,a.first_name,a.last_name,a.name_status,a.name_flags,a.name_version,a.name_review_note,a.name_reviewed_at,a.nickname,a.grade,a.school,a.email,a.disabled,a.created,(SELECT COUNT(DISTINCT s.device_id) FROM login_sessions s WHERE s.user_id=a.user_id AND s.expires>? AND s.account_version=a.version) AS active_devices FROM login_accounts a ORDER BY a.created DESC').bind(now).all()).results:[];
 const activeDeviceIds=isAdmin?(await db().prepare('SELECT DISTINCT s.user_id,s.device_id FROM login_sessions s JOIN login_accounts a ON a.user_id=s.user_id WHERE s.expires>? AND s.account_version=a.version AND a.disabled=0').bind(now).all()).results:[];
 const authEvents=isAdmin?(await db().prepare('SELECT id,user_id,username,device_id,event,created FROM auth_events WHERE created>? ORDER BY created DESC LIMIT 200').bind(now-365*24*60*60*1000).all()).results:[];
 const ownProfile=await db().prepare('SELECT first_name,last_name,name_status,name_version,name_review_note FROM login_accounts WHERE user_id=?').bind(u.userId).first<any>();
 return answer({user:{nameApprovalRequired:waitingForName,firstName:ownProfile?.first_name||'',lastName:ownProfile?.last_name||'',nameStatus:ownProfile?.name_status||'legacy',nameVersion:ownProfile?.name_version||1,nameReviewNote:ownProfile?.name_review_note||'',name:u.displayName,email:u.email,id:u.userId,username:u.username,authMethod:u.authMethod},isAdmin,accounts,activeDeviceIds,authEvents,needsSetup:false,canSetup:false,courses:cs.results,lessons:ls,files:fs,notices,enrollments:es.results,progress:ps.results});
}
if(op==='progress'){
 const l=await db().prepare('SELECT course_id FROM lessons WHERE id=?').bind(str(b.lessonId)).first<any>();if(!l||!await courseAccess(u.userId,l.course_id))fail(403,'ไม่มีสิทธิ์เรียนบทนี้');
 const seconds=Math.max(0,Math.min(86400,Math.floor(Number(b.seconds)||0)));
 await db().prepare('INSERT INTO progress (id,user_id,lesson_id,seconds,done) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET seconds=excluded.seconds,done=MAX(progress.done,excluded.done)').bind(u.userId+':'+b.lessonId,u.userId,b.lessonId,seconds,b.done?1:0).run();return answer({ok:true});
}
await admin();
if(op==='addLessonNotice'){
 const lessonId=str(b.lessonId),content=str(b.content,3000);
 if(!await db().prepare('SELECT id FROM lessons WHERE id=?').bind(lessonId).first())fail(404,'ไม่พบบทเรียนนี้');
 const id=crypto.randomUUID();
 await db().prepare('INSERT INTO lesson_notices (id,lesson_id,content,created) VALUES (?,?,?,?)').bind(id,lessonId,content,now).run();return answer({id});
}
if(op==='deleteLessonNotice'){
 const id=str(b.id);
 const notice=await db().prepare('SELECT id FROM lesson_notices WHERE id=?').bind(id).first();if(!notice)fail(404,'ไม่พบข้อความชี้แจงนี้');
 await db().prepare('DELETE FROM lesson_notices WHERE id=?').bind(id).run();return answer({ok:true});
}
if(op==='deleteVideo'){
 const id=str(b.id);
 const file=await db().prepare("SELECT f.id,f.object_key,f.kind FROM files f WHERE f.id=?").bind(id).first<any>();
 if(!file)fail(404,'ไม่พบวิดีโอนี้');
 if(file.kind!=='video')fail(400,'ลบได้เฉพาะไฟล์วิดีโอ');
 await bucket().delete(file.object_key);
 await db().prepare('DELETE FROM files WHERE id=?').bind(id).run();
 return answer({ok:true});
}
if(op==='course'){
 const id=b.id?str(b.id):crypto.randomUUID();const title=str(b.title);const description=typeof b.description==='string'?b.description.trim().slice(0,2000):'';const category=str(b.category||'คอร์สเรียน',80);
 if(b.visibility!==undefined&&!['restricted','all'].includes(b.visibility))fail(400,'การมองเห็นคอร์สไม่ถูกต้อง');
 const existing=b.id?await db().prepare('SELECT visibility FROM courses WHERE id=?').bind(id).first<{visibility:string}>():null;
 const visibility=b.visibility??existing?.visibility??'restricted';
 await db().prepare('INSERT INTO courses (id,title,description,category,published,visibility,created) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,category=excluded.category,published=excluded.published,visibility=excluded.visibility').bind(id,title,description,category,b.published?1:0,visibility,now).run();return answer({id});
}
if(op==='lesson'){
 const course=str(b.courseId);if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first())fail(404,'ไม่พบคอร์ส');
 const id=crypto.randomUUID();await db().prepare('INSERT INTO lessons (id,course_id,title,description,position,created) VALUES (?,?,?,?,?,?)').bind(id,course,str(b.title),String(b.description||'').slice(0,2000),now,now).run();return answer({id});
}
if(op==='enroll'){
 const course=str(b.courseId);if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(course).first())fail(404,'ไม่พบคอร์ส');
 const account=await db().prepare('SELECT user_id,email,name FROM login_accounts WHERE user_id=? AND disabled=0').bind(str(b.userId)).first<any>();if(!account)fail(400,'กรุณาเลือกบัญชีนักเรียนที่เปิดใช้งาน');
 const exp=b.expires?Number(b.expires):null;if(exp!==null&&(!Number.isFinite(exp)||exp<=now))fail(400,'วันหมดอายุต้องอยู่ในอนาคต');
 const existing=await db().prepare('SELECT id FROM enrollments WHERE course_id=? AND user_id=?').bind(course,account.user_id).first<any>();
 await db().prepare('INSERT INTO enrollments (id,course_id,email,user_id,name,status,expires,created) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,expires=excluded.expires').bind(existing?.id||crypto.randomUUID(),course,account.email,account.user_id,account.name,'active',exp,now).run();return answer({ok:true});
}
if(op==='enrollmentStatus'){
 if(!['active','revoked'].includes(b.status))fail(400,'สถานะไม่ถูกต้อง');await db().prepare('UPDATE enrollments SET status=? WHERE id=?').bind(b.status,str(b.id)).run();return answer({ok:true});
}
fail(400,'ไม่พบคำสั่ง');
}catch(e){return error(e)}}
