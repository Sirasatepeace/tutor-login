import {db,fail} from './server';
import {thaiDay,validateReport} from './assistant-policy.mjs';
type Row=Record<string,any>;
export async function readClassroomReport(input:Row,owner:string,now=Date.now()){
 const p=validateReport(input,now),database=db();
 const report:Row={kind:p.kind,title:'',generatedAt:now,source:'ฐานข้อมูล Yingyai Classroom',period:{from:p.from,to:p.to,timeZone:p.timeZone},metrics:[],columns:[],rows:[]};
 const metric=(label:string,value:unknown)=>report.metrics.push({label,value});
 if(p.kind==='activity'){
  const stats=await database.prepare('SELECT COUNT(DISTINCT user_id) AS students,COALESCE(SUM(page_views),0) AS page_views FROM site_daily_activity WHERE day>=? AND day<=? AND user_id!=?').bind(p.from,p.to,owner).first<Row>();
  const started=Number((await database.prepare("SELECT value FROM settings WHERE key='analytics_started'").first<Row>())?.value||now);
  const daily=await database.prepare('SELECT day,COUNT(*) AS students,SUM(page_views) AS views FROM site_daily_activity WHERE day>=? AND day<=? AND user_id!=? GROUP BY day ORDER BY day DESC LIMIT 90').bind(p.from,p.to,owner).all<Row>();
  report.title='สถิติการเข้าใช้งาน';metric('บัญชีนักเรียนไม่ซ้ำ',stats?.students||0);metric('ครั้งที่เปิดหน้า',stats?.page_views||0);
  report.columns=['วันที่','บัญชีนักเรียน','เปิดหน้า'];report.rows=daily.results.map(r=>[r.day,r.students,r.views]);
  report.trackingStartedAt=started;report.note=`เริ่มเก็บข้อมูล ${thaiDay(started)} เก็บย้อนหลัง 90 วัน นับเฉพาะนักเรียนที่ล็อกอินและเปิดเว็บ ไม่นับผู้สอนหรือผู้ชมก่อนล็อกอิน ช่วงก่อนเริ่มเก็บข้อมูลไม่มีสถิติ ไม่ใช่จำนวนครั้งที่ล็อกอิน`;
 }else if(p.kind==='signups'){
  const count=await database.prepare('SELECT COUNT(*) AS n FROM login_accounts WHERE user_id!=? AND created>=? AND created<?').bind(owner,p.fromMs,p.untilMs).first<Row>();
  const rows=await database.prepare('SELECT name,username,grade,school FROM login_accounts WHERE user_id!=? AND created>=? AND created<? ORDER BY created DESC,user_id LIMIT 20').bind(owner,p.fromMs,p.untilMs).all<Row>();
  report.title='นักเรียนสมัครใหม่';metric('บัญชีใหม่',count?.n||0);report.columns=['ชื่อ','Username','ชั้นเรียน','โรงเรียน'];report.rows=rows.results.map(r=>[r.name,r.username,r.grade,r.school]);report.note='รายชื่อแสดง 20 บัญชีล่าสุด ยอดรวมคำนวณจากทุกบัญชีในช่วงวันที่เลือก';
 }else if(p.kind==='courses'){
  const count=await database.prepare('SELECT COUNT(*) AS n FROM courses').first<Row>();
  const rows=await database.prepare('SELECT id,title,published,visibility FROM courses ORDER BY created DESC LIMIT 100').all<Row>();
  report.title='คอร์สในห้องเรียน';report.period=null;metric('คอร์สทั้งหมด',count?.n||0);
  report.columns=['รหัสคอร์ส','คอร์ส','สถานะ'];report.rows=rows.results.map(r=>[r.id,r.title,r.published?'เปิดเรียน':'แบบร่าง']);report.note='แสดง 100 คอร์สล่าสุด';
 }else if(p.kind==='exams'){
  const filter=p.courseId?' WHERE e.course_id=?':'';
  const rows=await database.prepare(`SELECT e.id,e.course_id,e.title,e.published,c.title AS course_title,(SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id=e.id AND a.user_id!=?) AS attempts FROM exams e JOIN courses c ON c.id=e.course_id${filter} ORDER BY e.created DESC LIMIT 100`).bind(owner,...(p.courseId?[p.courseId]:[])).all<Row>();
  const count=await database.prepare('SELECT COUNT(*) AS n FROM exams e'+filter).bind(...(p.courseId?[p.courseId]:[])).first<Row>();
  report.title='ข้อสอบและจำนวนการส่ง';report.period=null;metric('ข้อสอบทั้งหมด',count?.n||0);report.columns=['รหัสข้อสอบ','ข้อสอบ','คอร์ส','สถานะ','ครั้งที่ส่ง'];report.rows=rows.results.map(r=>[r.id,r.title,r.course_title,r.published?'เปิดทำ':'แบบร่าง',r.attempts]);report.note='จำนวนครั้งที่ส่งนับทุกครั้งตลอดช่วงที่เก็บผลสอบ แสดง 100 ชุดล่าสุด';
  report.exams=rows.results.map(r=>({id:r.id,title:r.title,courseId:r.course_id}));
 }else{
  const exam=await database.prepare('SELECT e.id,e.title,e.course_id,e.published,c.published AS course_published,c.visibility FROM exams e JOIN courses c ON c.id=e.course_id WHERE e.id=?').bind(p.examId).first<Row>();
  if(!exam)fail(404,'ไม่พบข้อสอบ');
  report.target={courseId:exam.course_id,examId:exam.id};report.examTitle=exam.title;
  const hasDate=!!(input.date_start||input.date_end);report.period=hasDate?report.period:null;
  const base='WITH ranked AS (SELECT a.*,ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created DESC,id DESC) AS position FROM exam_attempts a WHERE exam_id=? AND user_id!=? AND (?=0 OR (created>=? AND created<?))),selected AS (SELECT *,100.0*score/NULLIF(total_points,0) AS percentage FROM ranked WHERE position=1)';
  const query=(sql:string)=>database.prepare(base+sql).bind(exam.id,owner,hasDate?1:0,p.fromMs,p.untilMs);
  if(p.kind==='exam_results'){
   const stats=await query(' SELECT COUNT(*) AS students,AVG(percentage) AS average,MIN(percentage) AS minimum,MAX(percentage) AS maximum FROM selected').first<Row>();
   const rows=await query(' SELECT s.score,s.total_points,s.revision,s.percentage,a.name,a.username FROM selected s LEFT JOIN login_accounts a ON a.user_id=s.user_id ORDER BY s.created DESC,s.id DESC LIMIT 200').all<Row>();
   report.title='ผลสอบ: '+exam.title;metric('ผู้ส่งคำตอบ',stats?.students||0);metric('คะแนนเฉลี่ย (%)',stats?.average==null?null:Number(stats.average.toFixed(2)));metric('สูงสุด (%)',stats?.maximum??null);metric('ต่ำสุด (%)',stats?.minimum??null);
   report.columns=['ชื่อ','Username','คะแนน','ฉบับ','ร้อยละ'];report.rows=rows.results.map(r=>[r.name||'บัญชีเดิม',r.username||'',`${r.score}/${r.total_points}`,r.revision,Number(r.percentage.toFixed(2))]);report.note='ใช้ครั้งล่าสุดของแต่ละคนภายในช่วงวันที่เลือก หากไม่เลือกวันใช้ตลอดเวลา รวมทุกฉบับโดยเทียบเป็นร้อยละ รายชื่อแสดง 200 คนล่าสุด';
  }else if(p.kind==='questions'){
   const rows=await query(" SELECT s.revision,json_extract(j.value,'$.id') AS question_id,json_extract(j.value,'$.prompt') AS prompt,COUNT(*) AS n,SUM(CASE WHEN json_extract(j.value,'$.correct')=1 THEN 1 ELSE 0 END) AS correct FROM selected s,json_each(s.result,'$.details') j GROUP BY s.revision,question_id ORDER BY (1.0*SUM(CASE WHEN json_extract(j.value,'$.correct')=1 THEN 1 ELSE 0 END)/COUNT(*)),s.revision DESC,question_id LIMIT 100").all<Row>();
   report.title='ข้อที่ตอบผิดบ่อย: '+exam.title;report.columns=['ฉบับ','โจทย์','ถูก/ทั้งหมด','ตอบผิด (%)'];report.rows=rows.results.map(r=>[r.revision,String(r.prompt).slice(0,240),`${r.correct}/${r.n}`,Number((100*(r.n-r.correct)/r.n).toFixed(2))]);report.note='ใช้ผลล่าสุดต่อคน แยกฉบับข้อสอบ เรียงจากสัดส่วนตอบผิดมากที่สุด แสดงสูงสุด 100 ข้อ';
  }else{
   const filter="FROM login_accounts a WHERE a.user_id!=? AND a.disabled=0 AND a.name_status NOT IN ('pending','needs_change') AND (?='all' OR EXISTS (SELECT 1 FROM enrollments n WHERE n.user_id=a.user_id AND n.course_id=? AND n.status='active' AND (n.expires IS NULL OR n.expires>?))) AND NOT EXISTS (SELECT 1 FROM exam_attempts t WHERE t.exam_id=? AND t.user_id=a.user_id)";
   const params=[owner,exam.visibility,exam.course_id,now,exam.id];
   report.title='นักเรียนที่ยังไม่ส่ง: '+exam.title;report.period=null;
   if(!exam.published||!exam.course_published){metric('ข้อสอบยังไม่เปิด',0);report.note='ข้อสอบหรือคอร์สยังไม่เปิด จึงยังไม่จัดว่าใครค้างส่ง';}
   else{
    const count=await database.prepare('SELECT COUNT(*) AS n '+filter).bind(...params).first<Row>();
    const rows=await database.prepare('SELECT a.name,a.username,a.grade '+filter+' ORDER BY a.name,a.user_id LIMIT 200').bind(...params).all<Row>();
    metric('ยังไม่ส่งคำตอบ',count?.n||0);report.columns=['ชื่อ','Username','ชั้นเรียน'];report.rows=rows.results.map(r=>[r.name,r.username,r.grade]);report.note='เทียบเฉพาะบัญชีที่ยังใช้งานได้และมีสิทธิ์ปัจจุบัน ผู้ที่เคยส่งฉบับใดแล้วถือว่าส่งแล้ว แสดงรายชื่อสูงสุด 200 คน';
   }
  }
 }
 return report;
}
export function formatQuickReport(report:Row){
 const range=report.period?` (${report.period.from} ถึง ${report.period.to} เวลาไทย)`:'';
 return report.title+range+'\n'+report.metrics.map((m:Row)=>`${m.label}: ${m.value??'ยังไม่มีข้อมูล'}`).join('\n')+(report.note?'\n'+report.note:'');
}
