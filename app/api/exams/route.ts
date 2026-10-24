import {db,identity,ownerId,courseAccess,origin,str,answer,error,fail} from '../../../lib/server';
import {normalizeExam,publicExamQuestions,gradeExam,attemptView,ExamValidationError} from '../../../lib/exam-policy.mjs';

type Row=Record<string,any>;
const metadata='id,course_id,title,description,published,show_answers,revision,created,updated,json_array_length(questions) AS question_count';
export async function POST(req:Request){try{
 origin(req);const user=await identity(),isOwner=await ownerId()===user.userId;
 const body=await req.json() as Row;
 if(!body||typeof body!=='object')fail(400,'ข้อมูลไม่ถูกต้อง');
 const manage=isOwner&&!body.studentView;
 if(body.op==='list'){
  const courseId=str(body.courseId);
  if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(courseId).first()||!await courseAccess(user.userId,courseId))fail(403,'ไม่มีสิทธิ์เปิดข้อสอบในคอร์สนี้');
  const exams=await db().prepare(`SELECT ${metadata} FROM exams WHERE course_id=?${manage?'':' AND published=1'} ORDER BY created DESC`).bind(courseId).all();
  const attempts=await db().prepare('SELECT id,exam_id,revision,score,total_points,created FROM exam_attempts WHERE course_id=? AND user_id=? ORDER BY created DESC LIMIT 200').bind(courseId,user.userId).all();
  return answer({exams:exams.results,attempts:attempts.results});
 }
 if(body.op==='save'){
  if(!isOwner)fail(403,'เฉพาะผู้สอนเท่านั้นที่สร้างหรือแก้ไขข้อสอบได้');
  const courseId=str(body.courseId);
  if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(courseId).first())fail(404,'ไม่พบคอร์ส');
  const input=normalizeExam(body.exam);
  const imageIds=[...new Set(input.questions.map((q:Row)=>q.imageId).filter(Boolean))];
  if(imageIds.length){
   const images=await db().prepare(`SELECT id FROM exam_images WHERE course_id=? AND id IN (${imageIds.map(()=>'?').join(',')})`).bind(courseId,...imageIds).all();
   if(images.results.length!==imageIds.length)fail(400,'รูปภาพบางรูปไม่อยู่ในคอร์สนี้ กรุณาแนบรูปใหม่');
  }
  const id=body.exam.id?str(body.exam.id):crypto.randomUUID(),now=Date.now();
  if(body.exam.id){
   const previous=await db().prepare('SELECT id,course_id,revision FROM exams WHERE id=?').bind(id).first<Row>();
   if(!previous||previous.course_id!==courseId)fail(404,'ไม่พบข้อสอบ');
   if(!Number.isInteger(body.exam.revision)||previous.revision!==body.exam.revision)fail(409,'ข้อสอบถูกแก้ไขจากอีกหน้าแล้ว กรุณากลับไปเปิดข้อสอบใหม่');
   const updated=await db().prepare('UPDATE exams SET title=?,description=?,questions=?,published=?,show_answers=?,updated=?,revision=revision+1 WHERE id=? AND revision=?').bind(input.title,input.description,JSON.stringify(input.questions),Number(input.published),Number(input.showAnswers),now,id,previous.revision).run();
   if(!updated.meta.changes)fail(409,'ข้อสอบถูกแก้ไขจากอีกหน้าแล้ว กรุณาเปิดใหม่');
  }else{
   await db().prepare('INSERT INTO exams (id,course_id,title,description,questions,published,show_answers,revision,created,updated) VALUES (?,?,?,?,?,?,?,1,?,?)').bind(id,courseId,input.title,input.description,JSON.stringify(input.questions),Number(input.published),Number(input.showAnswers),now,now).run();
  }
  return answer({id});
 }
 const examId=str(body.examId);
 const exam=await db().prepare('SELECT * FROM exams WHERE id=?').bind(examId).first<Row>();
 if(!exam||!await courseAccess(user.userId,exam.course_id)||(!manage&&!exam.published))fail(403,'ไม่มีสิทธิ์เปิดข้อสอบนี้ หรือข้อสอบยังไม่เปิดใช้งาน');
 const questions=JSON.parse(exam.questions);
 if(body.op==='get'){
  const attempts=await db().prepare('SELECT id,exam_id,revision,score,total_points,created FROM exam_attempts WHERE exam_id=? AND user_id=? ORDER BY created DESC LIMIT 50').bind(examId,user.userId).all();
  return answer({exam:{id:exam.id,courseId:exam.course_id,title:exam.title,description:exam.description,published:!!exam.published,showAnswers:!!exam.show_answers,revision:exam.revision,questions:manage?questions:publicExamQuestions(questions)},attempts:attempts.results});
 }
 if(body.op==='submit'){
  if(!exam.published&&!isOwner)fail(403,'ข้อสอบยังไม่เปิดใช้งาน');
  const attemptId=str(body.attemptId,80);
  if(!/^[a-f0-9-]{36}$/i.test(attemptId))fail(400,'รหัสการส่งคำตอบไม่ถูกต้อง');
  const existing=await db().prepare('SELECT * FROM exam_attempts WHERE id=?').bind(attemptId).first<Row>();
  if(existing){if(existing.user_id!==user.userId||existing.exam_id!==examId)fail(409,'รหัสการส่งคำตอบซ้ำ');return answer({attempt:attemptView(existing,!!exam.show_answers||isOwner)});}
  if(body.revision!==exam.revision)fail(409,'ผู้สอนปรับปรุงข้อสอบแล้ว กรุณาเปิดข้อสอบใหม่ก่อนส่งคำตอบ');
  // Validate even legacy/draft definitions before grading; never trust client scores.
  normalizeExam({title:exam.title,description:exam.description,published:true,questions});
  const result=gradeExam(questions,body.responses);
  const row={id:attemptId,exam_id:examId,course_id:exam.course_id,user_id:user.userId,revision:exam.revision,score:result.score,total_points:result.totalPoints,result:JSON.stringify(result),created:Date.now()};
  if(!isOwner){
   // Re-check revision/publication/access in the write to close the edit/revoke race.
   const insert=await db().prepare("INSERT INTO exam_attempts (id,exam_id,course_id,user_id,revision,score,total_points,result,created) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM exams e JOIN courses c ON c.id=e.course_id WHERE e.id=? AND e.revision=? AND e.published=1 AND c.published=1 AND (c.visibility='all' OR EXISTS (SELECT 1 FROM enrollments n WHERE n.course_id=c.id AND n.user_id=? AND n.status='active' AND (n.expires IS NULL OR n.expires>?)))) AND EXISTS (SELECT 1 FROM login_accounts a WHERE a.user_id=? AND a.disabled=0 AND a.name_status NOT IN ('pending','needs_change')) ON CONFLICT(id) DO NOTHING").bind(row.id,row.exam_id,row.course_id,row.user_id,row.revision,row.score,row.total_points,row.result,row.created,examId,exam.revision,user.userId,Date.now(),user.userId).run();
   if(!insert.meta.changes){
    const retry=await db().prepare('SELECT * FROM exam_attempts WHERE id=? AND user_id=? AND exam_id=?').bind(attemptId,user.userId,examId).first<Row>();
    if(retry)return answer({attempt:attemptView(retry,!!exam.show_answers)});
    fail(409,'ข้อสอบหรือสิทธิ์เข้าเรียนเปลี่ยนไป กรุณาเปิดข้อสอบใหม่');
   }
  }
  return answer({attempt:attemptView(row,!!exam.show_answers||isOwner),preview:isOwner});
 }
 if(body.op==='attempt'){
  const row=await db().prepare('SELECT * FROM exam_attempts WHERE id=? AND exam_id=?').bind(str(body.attemptId),examId).first<Row>();
  if(!row||(!isOwner&&row.user_id!==user.userId))fail(404,'ไม่พบผลข้อสอบ');
  return answer({attempt:attemptView(row,isOwner||!!exam.show_answers)});
 }
 if(body.op==='statistics'){
  if(!isOwner)fail(403,'เฉพาะผู้สอนเท่านั้นที่ดูสถิติได้');
  const all=body.attemptMode==='all',revision=Number(body.revision)||0;
  const base=`WITH ranked AS (SELECT *,ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created DESC,id DESC) AS position FROM exam_attempts WHERE exam_id=? AND (?=0 OR revision=?)), selected AS (SELECT *,100.0*score/NULLIF(total_points,0) AS percentage FROM ranked WHERE ${all?'1=1':'position=1'})`;
  const query=(sql:string)=>db().prepare(base+sql).bind(examId,revision,revision);
  const summary=await query(' SELECT COUNT(*) AS submissions,COUNT(DISTINCT user_id) AS students,AVG(percentage) AS average,MIN(percentage) AS minimum,MAX(percentage) AS maximum FROM selected').first();
  const histogram=await query(' SELECT MIN(9,CAST(percentage/10 AS INTEGER)) AS bucket,COUNT(*) AS count FROM selected GROUP BY bucket ORDER BY bucket').all();
  const items=await query(" SELECT s.revision,json_extract(j.value,'$.id') AS question_id,json_extract(j.value,'$.prompt') AS prompt,COUNT(*) AS responses,SUM(CASE WHEN json_extract(j.value,'$.correct')=1 THEN 1 ELSE 0 END) AS correct FROM selected s,json_each(s.result,'$.details') j GROUP BY s.revision,question_id ORDER BY s.revision DESC,MIN(CAST(j.key AS INTEGER))").all();
  const rows=await query(' SELECT s.id,s.exam_id,s.user_id,s.revision,s.score,s.total_points,s.created,a.name,a.username FROM selected s LEFT JOIN login_accounts a ON a.user_id=s.user_id ORDER BY s.created DESC,s.id DESC LIMIT 200').all();
  const revisions=await db().prepare('SELECT DISTINCT revision FROM exam_attempts WHERE exam_id=? ORDER BY revision DESC').bind(examId).all();
  return answer({summary,histogram:histogram.results,questions:items.results,attempts:rows.results,revisions:revisions.results});
 }
 if(body.op==='results'){
  if(!isOwner)fail(403,'เฉพาะผู้สอนเท่านั้นที่ดูผลของนักเรียนทั้งหมดได้');
  const rows=await db().prepare('SELECT t.id,t.exam_id,t.user_id,t.revision,t.score,t.total_points,t.created,a.name,a.username FROM exam_attempts t LEFT JOIN login_accounts a ON a.user_id=t.user_id WHERE t.exam_id=? ORDER BY t.created DESC LIMIT 200').bind(examId).all();
  return answer({attempts:rows.results});
 }
 fail(400,'ไม่พบคำสั่ง');
}catch(e){if(e instanceof ExamValidationError)return answer({error:e.message},400);return error(e)}}
