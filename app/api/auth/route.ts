import {cookies} from 'next/headers';
import {db,admin,identity,ownerId,origin,str,email,answer,error,fail} from '../../../lib/server';
import {readNameInput} from '../../../lib/name-policy.mjs';
import {SESSION_COOKIE,DEVICE_COOKIE,SESSION_SECONDS,DEVICE_SECONDS,normalizeUsername,validUsername,validPassword,hashPassword,verifyPassword,randomSession,digest,sessionCookie,deviceCookie} from '../../../lib/password.mjs';
async function throttle(key:string,max:number,windowMs:number,message='ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่'){const now=Date.now();const row=await db().prepare('INSERT INTO login_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN login_limits.expires<=? THEN 1 ELSE login_limits.count+1 END,expires=CASE WHEN login_limits.expires<=? THEN excluded.expires ELSE login_limits.expires END RETURNING count').bind(key,now+windowMs,now,now).first<{count:number}>();if(!row||row.count>max)fail(429,message);}
function password(value:unknown){if(!validPassword(value))fail(400,'รหัสผ่านต้องมีความยาว 12–128 ตัวอักษร');return value as string;}
function username(value:unknown){const n=normalizeUsername(value);if(!validUsername(n))fail(400,'Username ใช้ a–z, 0–9, จุด, ขีดกลาง หรือขีดล่าง ความยาว 3–40 ตัว และขึ้นต้นด้วยตัวอักษรหรือตัวเลข');return n;}
function studentName(body:any,instructor=false){const result=readNameInput(body);if(!result.valid)fail(400,result.error);if(result.flags.length&&!instructor&&body.nameConfirmed!==true)fail(400,'รูปแบบชื่อนี้ต้องยืนยันว่าเป็นชื่อจริง ก่อนส่งให้ผู้สอนตรวจสอบ');return result;}
export async function POST(req:Request){try{
 origin(req);if(Number(req.headers.get('content-length')||0)>8192)fail(413,'ข้อมูลยาวเกินไป');const raw=await req.text();if(raw.length>8192)fail(413,'ข้อมูลยาวเกินไป');let b:any;try{b=JSON.parse(raw)}catch{fail(400,'ข้อมูลไม่ถูกต้อง')}if(!b||typeof b!=='object'||Array.isArray(b))fail(400,'ข้อมูลไม่ถูกต้อง');
 if(b.op==='register'){
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 await throttle('register:ip:'+digest(ip),30,15*60*1000,'มีการสมัครหลายครั้งจากเครือข่ายนี้ กรุณารอ 15 นาทีแล้วลองใหม่');
 const name=username(b.username),pw=password(b.password);
 const profile=studentName(b),display=profile.name,nickname=str(b.nickname,80),grade=str(b.grade,80),school=str(b.school);
 if(await db().prepare('SELECT user_id FROM login_accounts WHERE username=?').bind(name).first())fail(409,'Username นี้ถูกใช้แล้ว');
 // Public registration always creates a new student; owner identity and grants stay owner-managed.
 const uid='student-'+crypto.randomUUID(),em=uid+'@classroom.invalid',hash=hashPassword(pw),now=Date.now();
 try{await db().batch([
 db().prepare('INSERT INTO login_accounts (user_id,username,name,nickname,grade,school,email,password_hash,disabled,version,created,first_name,last_name,name_status,name_flags) VALUES (?,?,?,?,?,?,?,?,0,1,?,?,?,?,?)').bind(uid,name,display,nickname,grade,school,em,hash,now,profile.firstName,profile.lastName,profile.flags.length?'pending':'format_ok',JSON.stringify(profile.flags)),
 db().prepare('INSERT INTO people (id,email,name,created) VALUES (?,?,?,?)').bind(uid,em,display,now)
 ]);}catch(e){if(String(e).includes('UNIQUE'))fail(409,'Username นี้ถูกใช้แล้ว');throw e;}
 return answer({ok:true,username:name,approvalRequired:profile.flags.length>0},201);
 }
 if(b.op==='login'){
 const ip=req.headers.get('cf-connecting-ip')||'unknown';await throttle('ip:'+digest(ip),60,15*60*1000);
 const name=normalizeUsername(b.username);if(!validUsername(name)||typeof b.password!=='string'||b.password.length>128)fail(401,'Username หรือ password ไม่ถูกต้อง');
 await throttle('name:'+digest(name),10,15*60*1000);
 const a=await db().prepare('SELECT * FROM login_accounts WHERE username=?').bind(name).first<any>();
 // A dummy KDF makes unknown usernames take the same expensive verification path.
 const dummy='scrypt$32768$8$3$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
 const valid=verifyPassword(b.password,a?.password_hash||dummy);
 if(!a||!valid||a.disabled)fail(401,'Username หรือ password ไม่ถูกต้อง');
 const token=randomSession();const expires=Date.now()+SESSION_SECONDS*1000;const jar=await cookies();let deviceToken=jar.get(DEVICE_COOKIE)?.value;if(!deviceToken||!/^[a-f0-9]{64}$/.test(deviceToken))deviceToken=randomSession();const deviceId=digest(deviceToken);
 // Conditional insert prevents a reset or suspension racing with password verification.
 await db().prepare('INSERT INTO login_sessions (token_hash,user_id,account_version,device_id,expires) SELECT ?,user_id,version,?,? FROM login_accounts WHERE user_id=? AND version=? AND disabled=0').bind(digest(token),deviceId,expires,a.user_id,a.version).run();
 const saved=await db().prepare('SELECT token_hash FROM login_sessions WHERE token_hash=?').bind(digest(token)).first();if(!saved)fail(401,'บัญชีมีการเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่');
 await db().prepare("INSERT INTO auth_events (id,user_id,username,device_id,event,created) VALUES (?,?,?,?, 'login',?)").bind(crypto.randomUUID(),a.user_id,a.username,deviceId,Date.now()).run();
 await db().batch([db().prepare('DELETE FROM login_limits WHERE key=?').bind('name:'+digest(name)),db().prepare('DELETE FROM login_sessions WHERE expires<?').bind(Date.now()),db().prepare('DELETE FROM login_limits WHERE expires<?').bind(Date.now())]);
 await db().prepare('DELETE FROM auth_events WHERE created<?').bind(Date.now()-365*24*60*60*1000).run();
 const res=answer({ok:true});res.headers.append('Set-Cookie',sessionCookie(token));res.headers.append('Set-Cookie',deviceCookie(deviceToken));res.headers.append('Set-Cookie','yingyai-owner-signed-out=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return res;
 }
 if(b.op==='logout'){
 const token=(await cookies()).get(SESSION_COOKIE)?.value;if(token){const active=await db().prepare('SELECT s.user_id,a.username,s.device_id FROM login_sessions s JOIN login_accounts a ON a.user_id=s.user_id WHERE s.token_hash=?').bind(digest(token)).first<any>();if(active)await db().batch([db().prepare("INSERT INTO auth_events (id,user_id,username,device_id,event,created) VALUES (?,?,?,?,'logout',?)").bind(crypto.randomUUID(),active.user_id,active.username,active.device_id,Date.now()),db().prepare('DELETE FROM login_sessions WHERE token_hash=?').bind(digest(token))]);}
 const res=answer({ok:true});res.headers.append('Set-Cookie',sessionCookie('',0));res.headers.append('Set-Cookie','yingyai-owner-signed-out=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800');return res;
 }
 if(b.op==='updateName'){
  const user=await identity();if(b.userId&&b.userId!==user.userId)fail(403,'แก้ชื่อได้เฉพาะบัญชีของตัวเอง');
  const row=await db().prepare('SELECT name_status,name_version FROM login_accounts WHERE user_id=?').bind(user.userId).first<any>();
  if(!row||!['pending','needs_change'].includes(row.name_status))fail(403,'ชื่อบัญชีนี้ต้องให้ผู้สอนขอแก้ไขก่อน');
  if(!Number.isInteger(b.nameVersion)||b.nameVersion!==row.name_version)fail(409,'ข้อมูลชื่อเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข');
  await throttle('rename:'+user.userId,10,15*60*1000,'มีการแก้ชื่อหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  const profile=studentName(b),nextStatus=profile.flags.length?'pending':'format_ok';
  const changed=await db().batch([
   db().prepare("UPDATE login_accounts SET name=?,first_name=?,last_name=?,name_status=?,name_flags=?,name_review_note='',name_reviewed_by=NULL,name_reviewed_at=NULL,name_version=name_version+1 WHERE user_id=? AND name_version=? AND name_status IN ('pending','needs_change')").bind(profile.name,profile.firstName,profile.lastName,nextStatus,JSON.stringify(profile.flags),user.userId,b.nameVersion),
   db().prepare('UPDATE people SET name=(SELECT name FROM login_accounts WHERE user_id=?) WHERE id=?').bind(user.userId,user.userId),
   db().prepare('UPDATE enrollments SET name=(SELECT name FROM login_accounts WHERE user_id=?) WHERE user_id=?').bind(user.userId,user.userId)
  ]);
  if(!changed[0].meta.changes)fail(409,'ข้อมูลชื่อเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข');
  return answer({ok:true,nameStatus:nextStatus,approvalRequired:nextStatus==='pending'});
 }
 const owner=await admin();
 if(b.op==='reviewName'){
  const uid=str(b.userId);if(uid===await ownerId())fail(400,'ไม่ต้องตรวจชื่อบัญชีผู้สอน');
  if(!['approve','requestChange'].includes(b.action)||!Number.isInteger(b.nameVersion))fail(400,'คำสั่งตรวจชื่อไม่ถูกต้อง');
  const note=b.action==='requestChange'?str(b.note||'กรุณากรอกชื่อและนามสกุลจริงให้ครบ',300):'';
  const updated=await db().prepare('UPDATE login_accounts SET name_status=?,name_review_note=?,name_reviewed_by=?,name_reviewed_at=?,name_version=name_version+1 WHERE user_id=? AND name_version=?').bind(b.action==='approve'?'approved':'needs_change',note,owner.userId,Date.now(),uid,b.nameVersion).run();
  if(!updated.meta.changes)fail(409,'ชื่อถูกแก้ไขหรือได้รับการตรวจแล้ว กรุณารีเฟรชรายการก่อนตรวจอีกครั้ง');
  return answer({ok:true});
 }
 if(b.op==='create'||b.op==='owner'){
 const name=username(b.username),pw=password(b.password);const own=b.op==='owner';
 if(await db().prepare('SELECT user_id FROM login_accounts WHERE username=?').bind(name).first())fail(409,'Username นี้ถูกใช้แล้ว');
 const uid=own?owner.userId:'student-'+crypto.randomUUID();
 if(own&&await db().prepare('SELECT user_id FROM login_accounts WHERE user_id=?').bind(uid).first())fail(409,'ตั้งค่าบัญชีผู้สอนแล้ว ใช้ปุ่มเปลี่ยนรหัสผ่านได้');
 const profile=own?null:studentName(b,true),display=own?owner.displayName:profile!.name;const em=own?owner.email:b.email?email(b.email):uid+'@classroom.invalid';
 const nickname=!own&&b.nickname?str(b.nickname,80):'',grade=!own&&b.grade?str(b.grade,80):'',school=!own&&b.school?str(b.school):'';
 // Existing access is transferred only when the owner explicitly selects an existing learner.
 const legacy=b.legacyUserId?str(b.legacyUserId):null;
 if(legacy){if(own||legacy===await ownerId())fail(400,'ไม่สามารถใช้บัญชีผู้สอนเป็นนักเรียน');if(await db().prepare('SELECT user_id FROM login_accounts WHERE user_id=?').bind(legacy).first())fail(409,'ผู้เรียนนี้มีบัญชีแล้ว');if(!await db().prepare('SELECT id FROM people WHERE id=?').bind(legacy).first())fail(404,'ไม่พบผู้เรียนเดิม');}
 const finalId=legacy||uid;const hash=hashPassword(pw);
 try{await db().batch([db().prepare("INSERT INTO login_accounts (user_id,username,name,nickname,grade,school,email,password_hash,disabled,version,created,first_name,last_name,name_status,name_flags,name_reviewed_by,name_reviewed_at) VALUES (?,?,?,?,?,?,?,?,0,1,?,?,?,'approved',?,?,?)").bind(finalId,name,display,nickname,grade,school,em,hash,Date.now(),profile?.firstName||'',profile?.lastName||'',JSON.stringify(profile?.flags||[]),owner.userId,Date.now()),db().prepare('INSERT INTO people (id,email,name,created) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name').bind(finalId,em,display,Date.now())]);}catch(e){if(String(e).includes('UNIQUE'))fail(409,'Username หรือบัญชีนี้ถูกใช้แล้ว');throw e}return answer({ok:true});
 }
 if(b.op==='reset'){
 const now=Date.now();const uid=str(b.userId);if(!await db().prepare('SELECT user_id FROM login_accounts WHERE user_id=?').bind(uid).first())fail(404,'ไม่พบบัญชี');
 await db().batch([db().prepare("INSERT INTO auth_events (id,user_id,username,device_id,event,created) SELECT lower(hex(randomblob(16))),s.user_id,a.username,s.device_id,'revoked',? FROM login_sessions s JOIN login_accounts a ON a.user_id=s.user_id WHERE s.user_id=? AND s.expires>? AND s.account_version=a.version").bind(now,uid,now),db().prepare('UPDATE login_accounts SET password_hash=?,version=version+1 WHERE user_id=?').bind(hashPassword(password(b.password)),uid),db().prepare('DELETE FROM login_sessions WHERE user_id=?').bind(uid)]);return answer({ok:true,relogin:uid===owner.userId&&owner.authMethod==='password'});
 }
 if(b.op==='disable'){
 const uid=str(b.userId);if(uid===await ownerId())fail(400,'ไม่สามารถระงับบัญชีผู้สอน');
 if(typeof b.disabled!=='boolean')fail(400,'สถานะไม่ถูกต้อง');await db().batch([db().prepare("INSERT INTO auth_events (id,user_id,username,device_id,event,created) SELECT lower(hex(randomblob(16))),s.user_id,a.username,s.device_id,'revoked',? FROM login_sessions s JOIN login_accounts a ON a.user_id=s.user_id WHERE s.user_id=? AND s.expires>? AND s.account_version=a.version").bind(Date.now(),uid,Date.now()),db().prepare('UPDATE login_accounts SET disabled=?,version=version+1 WHERE user_id=?').bind(b.disabled?1:0,uid),db().prepare('DELETE FROM login_sessions WHERE user_id=?').bind(uid)]);return answer({ok:true});
 }
 fail(400,'ไม่พบคำสั่ง');
}catch(e){return error(e)}}
