import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {hashPassword,randomSession,digest} from '../lib/password.mjs';
const require=createRequire(import.meta.url),{Miniflare}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
const root=path.resolve('dist/server');
const moduleFiles=(await readdir(root,{recursive:true})).filter(file=>file.endsWith('.js')||file.endsWith('.mjs')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf=new Miniflare({modules:moduleFiles.map(file=>({type:'ESModule',path:path.join(root,file)})),modulesRoot:root,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
const origin='https://classroom.test';
const send=(body,headers={})=>mf.dispatchFetch(origin+'/api/exams',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)});
async function expect(response,status,label){if(response.status!==status)throw Error(`${label}: ${response.status} ${await response.text()}`);return response;}
async function json(body,user){return (await expect(await send(body,user),200,body.op)).json();}
const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));
try{
 const db=await mf.getD1Database('DB');
 for(const file of (await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())for(const sql of (await readFile('drizzle/'+file,'utf8')).split('--> statement-breakpoint').map(sql=>sql.trim()).filter(Boolean))await db.prepare(sql).run();
 await db.prepare("INSERT INTO settings (key,value) VALUES ('owner','teacher')").run();
 const users={};
 for(const id of ['teacher','student','other']){
  await db.prepare('INSERT INTO login_accounts (user_id,username,name,email,password_hash,created) VALUES (?,?,?,?,?,?)').bind(id,id,id,id+'@example.test',hashPassword('Test-only-password-123!'),Date.now()).run();
  const token=randomSession();await db.prepare('INSERT INTO login_sessions (token_hash,user_id,account_version,device_id,expires) VALUES (?,?,1,?,?)').bind(digest(token),id,'test-'+id,Date.now()+3600000).run();
  users[id]={cookie:'__Host-yingyai-session='+token};
 }
 const teacher=users.teacher,student=users.student,other=users.other;
 for(const [id,visibility,published] of [['restricted','restricted',1],['all','all',1],['draft-course','all',0]])await db.prepare('INSERT INTO courses (id,title,description,category,published,visibility,created) VALUES (?,?,?,?,?,?,?)').bind(id,id,'','Test',published,visibility,Date.now()).run();
 await db.prepare("INSERT INTO enrollments (id,course_id,email,user_id,name,status,created) VALUES ('grant','restricted','student@example.test','student','Student','active',?)").bind(Date.now()).run();
 await expect(await send({op:'list',courseId:'restricted'}),401,'anonymous blocked');
 await expect(await send({op:'save',courseId:'restricted',exam:{}},student),403,'student cannot author');
 await expect(await send({op:'list',courseId:'restricted'},other),403,'unenrolled student cannot list hidden exams');
 const upload=(courseId,bytes,user=teacher,name='question.png')=>mf.dispatchFetch(origin+'/api/exam-images?courseId='+courseId+'&name='+name,{method:'POST',headers:{origin,'content-type':'image/png',...user},body:bytes});
 await expect(await upload('restricted',png,student),403,'student cannot upload question images');
 await expect(await upload('restricted',new TextEncoder().encode('<svg onload="x"></svg>')),400,'SVG disguised as PNG rejected');
 const image=await (await expect(await upload('restricted',png),200,'teacher image upload')).json();
 const otherImage=await (await expect(await upload('all',png),200,'other course image upload')).json();
 await expect(await mf.dispatchFetch(origin+'/api/exam-images/'+image.id,{headers:student}),403,'unused image hidden');
 const questions=[
  {id:'choice',kind:'choice',prompt:'เลือกตัวเลือกที่ถูกต้อง',imageId:image.id,choices:[{id:'a',text:'หนึ่ง'},{id:'b',text:'สอง'}],answer:'b',points:2,explanation:'เฉลยที่ต้องไม่รั่ว'},
  {id:'numeric',kind:'numeric',prompt:'เติมค่าตัวเลข ไม่มีรูป',answer:'-2.5',tolerance:'0.01',points:3,explanation:'คำอธิบายตัวเลข'},
 ];
 let definition={title:'ข้อสอบผสม',description:'คำชี้แจง',published:false,showAnswers:false,questions};
 const saved=await json({op:'save',courseId:'restricted',exam:definition},teacher),examId=saved.id;
 assert.equal((await json({op:'list',courseId:'restricted'},student)).exams.length,0,'draft excluded from list');
 await expect(await send({op:'get',examId},student),403,'draft cannot be fetched by guessing ID');
 await expect(await mf.dispatchFetch(origin+'/api/exam-images/'+image.id,{headers:student}),403,'draft image hidden');
 let edit=(await json({op:'get',examId},teacher)).exam;assert.equal(edit.questions[0].answer,'b');
 await expect(await send({op:'save',courseId:'restricted',exam:{...edit,published:true,questions:[{...questions[0],imageId:otherImage.id}]}},teacher),400,'cross-course image rejected');
 await json({op:'save',courseId:'restricted',exam:{...edit,published:true}},teacher);
 await expect(await send({op:'save',courseId:'restricted',exam:edit},teacher),409,'stale owner edits rejected');
 const publicData=await json({op:'get',examId},student);definition=publicData.exam;
 assert.equal(definition.questions[1].imageId,null,'image optional');
 assert.ok(definition.questions.every(q=>!('answer' in q)&&!('tolerance' in q)&&!('explanation' in q)),'no answer keys before submit');
 assert.ok(!JSON.stringify(publicData).includes('เฉลยที่ต้องไม่รั่ว'));
 await expect(await mf.dispatchFetch(origin+'/api/exam-images/'+image.id,{headers:student}),200,'enrolled student can see published question image');
 await expect(await mf.dispatchFetch(origin+'/api/exam-images/'+image.id,{headers:other}),403,'image respects course enrollment');
 await expect(await mf.dispatchFetch(origin+'/api/exam-images/'+image.id),401,'image requires login');
 const attemptId=crypto.randomUUID(),responses=[{questionId:'choice',value:'b'},{questionId:'numeric',value:'-2.49'}];
 await expect(await send({op:'submit',examId,revision:1,attemptId,responses},student),409,'student must use current revision');
 const submitted=await json({op:'submit',examId,revision:definition.revision,attemptId,responses,score:999,totalPoints:999},student);
 assert.equal(submitted.attempt.score,5);assert.equal(submitted.attempt.totalPoints,5);assert.ok(!submitted.attempt.details,'answers hidden after submit when disabled');
 const duplicate=await json({op:'submit',examId,revision:definition.revision,attemptId,responses:[]},student);assert.equal(duplicate.attempt.score,5,'retry is idempotent');
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM exam_attempts WHERE id=?').bind(attemptId).first()).n,1);
 await expect(await send({op:'results',examId},student),403,'student cannot read class results');
 assert.equal((await json({op:'results',examId},teacher)).attempts.length,1);
 await expect(await send({op:'statistics',examId},student),403,'statistics owner only');
 const stats=await json({op:'statistics',examId},teacher);
 assert.equal(stats.summary.students,1);assert.equal(stats.summary.average,100);assert.equal(stats.histogram[0].bucket,9);assert.equal(stats.questions.length,2);
 await json({op:'submit',examId,revision:definition.revision,attemptId:crypto.randomUUID(),responses:[]},student);
 const latest=await json({op:'statistics',examId},teacher);assert.equal(latest.summary.submissions,1);assert.equal(latest.summary.average,0);
 const allStats=await json({op:'statistics',examId,attemptMode:'all'},teacher);assert.equal(allStats.summary.submissions,2);assert.equal(allStats.summary.average,50);
 assert.equal(allStats.questions[0].correct,1);
 const emptyStats=await json({op:'statistics',examId,revision:999},teacher);assert.equal(emptyStats.summary.submissions,0);assert.equal(emptyStats.summary.average,null);
 await db.prepare('DELETE FROM exam_attempts WHERE id!=? AND exam_id=?').bind(attemptId,examId).run();
 const teacherResult=await json({op:'attempt',examId,attemptId},teacher);assert.equal(teacherResult.attempt.details[0].answer,'b');
 const preview=await json({op:'submit',examId,revision:definition.revision,attemptId:crypto.randomUUID(),responses},teacher);assert.equal(preview.preview,true);
 assert.equal((await json({op:'results',examId},teacher)).attempts.length,1,'teacher previews are not student results');
 edit=(await json({op:'get',examId},teacher)).exam;
 await json({op:'save',courseId:'restricted',exam:{...edit,showAnswers:true,questions:edit.questions.map(q=>({...q,points:10}))}},teacher);
 const historical=await json({op:'attempt',examId,attemptId},student);assert.equal(historical.attempt.score,5);assert.equal(historical.attempt.totalPoints,5);assert.equal(historical.attempt.details[0].points,2,'saved attempt keeps grading snapshot across edits');
 const publicExam=await json({op:'save',courseId:'all',exam:{title:'ทุกคน',description:'',published:true,showAnswers:true,questions:[{...questions[1],id:'only'}]}},teacher);
 const everyone=await json({op:'get',examId:publicExam.id},other);
 const second=await json({op:'submit',examId:publicExam.id,revision:everyone.exam.revision,attemptId:crypto.randomUUID(),responses:[{questionId:'only',value:'-2.5'}]},other);assert.equal(second.attempt.score,3);assert.ok(second.attempt.details);
 await expect(await send({op:'attempt',examId:publicExam.id,attemptId:second.attempt.id},student),404,'attempt belongs only to its student');
 await json({op:'save',courseId:'draft-course',exam:{title:'คอร์สแบบร่าง',description:'',published:true,questions:[questions[1]]}},teacher);
 await expect(await send({op:'list',courseId:'draft-course'},other),403,'unpublished course blocks even published exams');
 await db.prepare("UPDATE enrollments SET status='revoked' WHERE id='grant'").run();
 await expect(await send({op:'attempt',examId,attemptId},student),403,'revoked course blocks old result');
 await expect(await mf.dispatchFetch(origin+'/api/exam-images/'+image.id,{headers:student}),403,'revocation blocks question image');
 await db.prepare("UPDATE login_accounts SET disabled=1 WHERE user_id='other'").run();
 await expect(await send({op:'get',examId:publicExam.id},other),401,'suspension blocks everyone-course exam');
 await expect(await mf.dispatchFetch(origin+'/api/exams',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json',...teacher},body:JSON.stringify({op:'save',courseId:'all',exam:{}})}),403,'cross-origin exam changes blocked');
 console.log('PASS: mixed exams, optional protected images, drafts, owner-only authoring/results, server-side grading, hidden keys, numeric tolerance, course access, revision snapshots, retries and CSRF.');
}finally{await mf.dispose()}
