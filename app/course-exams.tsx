'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowUp,ArrowDown,Plus,Trash2,ImagePlus,ClipboardList,Pencil,Check,CheckCircle2,LoaderCircle,BarChart3,Play,X} from 'lucide-react';
import {MAX_EXAM_IMAGE_BYTES,MAX_EXAM_QUESTIONS} from '../lib/exam-policy.mjs';

type Row=Record<string,any>;
type Choice={id:string;text:string};
type Question={id:string;kind:'choice'|'numeric';prompt:string;imageId:string|null;choices:Choice[];answer:string;tolerance:string;points:number;explanation:string};
type Exam={id?:string;courseId:string;title:string;description:string;published:boolean;showAnswers:boolean;revision?:number;questions:Question[]};
function uuid(){
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const time=(value:number)=>new Date(value).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'});
const label=(index:number)=>['ก','ข','ค','ง','จ','ฉ'][index];
async function examApi(body:Row){
 const response=await fetch('/api/exams',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await response.json() as Row;
 if(!response.ok)throw Error(data.error||'ดำเนินการกับข้อสอบไม่สำเร็จ');
 return data;
}
function newQuestion(kind:'choice'|'numeric'='choice'):Question{
 return {id:uuid(),kind,prompt:'',imageId:null,choices:kind==='choice'?Array.from({length:4},()=>({id:uuid(),text:''})):[],answer:'',tolerance:'0',points:1,explanation:''};
}
function displayAnswer(question:Row,value:string){
 if(!value)return 'ไม่ได้ตอบ';
 if(question.kind==='numeric')return value;
 const index=question.choices.findIndex((choice:Choice)=>choice.id===value);
 return index<0?'ไม่ได้ตอบ':`${label(index)}. ${question.choices[index].text}`;
}

export default function CourseExams({course,canManage,onBack,onDirtyChange}:{course:Row;canManage:boolean;onBack:()=>void;onDirtyChange:(value:boolean)=>void}){
 const [mode,setMode]=useState<'list'|'edit'|'take'|'result'|'results'>('list');
 const [exams,setExams]=useState<Row[]>([]),[attempts,setAttempts]=useState<Row[]>([]),[exam,setExam]=useState<Exam|null>(null);
 const [responses,setResponses]=useState<Record<string,string>>({}),[result,setResult]=useState<Row|null>(null),[resultRows,setResultRows]=useState<Row[]>([]),[resultName,setResultName]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(''),[dirty,setDirty]=useState(false),[err,setErr]=useState(''),[message,setMessage]=useState('');
 const [statistics,setStatistics]=useState<Row|null>(null),[attemptMode,setAttemptMode]=useState('latest'),[statsRevision,setStatsRevision]=useState('0');
 const attemptKey=useRef('');
 const pending=dirty||!!uploading||(mode==='take'&&Object.values(responses).some(Boolean));
 useEffect(()=>{onDirtyChange(pending);return()=>onDirtyChange(false)},[pending,onDirtyChange]);
 useEffect(()=>{
  let current=true;setLoading(true);setErr('');
  examApi({op:'list',courseId:course.id,studentView:!canManage}).then(data=>{if(current){setExams(data.exams);setAttempts(data.attempts)}}).catch(error=>{if(current)setErr(error.message)}).finally(()=>{if(current)setLoading(false)});
  return()=>{current=false};
 },[course.id,canManage]);
 async function refresh(){const data=await examApi({op:'list',courseId:course.id,studentView:!canManage});setExams(data.exams);setAttempts(data.attempts)}
 function leave(){
  if(busy||uploading)return;
  if(pending&&!window.confirm('ยังไม่ได้บันทึกข้อมูลหรือส่งคำตอบ ต้องการออกจากหน้านี้หรือไม่?'))return;
  setDirty(false);setResponses({});setMode('list');setErr('');onDirtyChange(false);
 }
 function create(){
  setExam({courseId:course.id,title:'',description:'',published:false,showAnswers:false,questions:[newQuestion()]});
  setDirty(true);setMode('edit');setErr('');setMessage('');
 }
 async function open(id:string,next:'edit'|'take'|'results'){
  setBusy(true);setErr('');setMessage('');
  try{
   const data=await examApi({op:'get',examId:id,studentView:next==='take'});
   if(next==='results'){const rows=await examApi({op:'statistics',examId:id});setStatistics(rows);setResultRows(rows.attempts);setAttemptMode('latest');setStatsRevision('0')}
   setExam(data.exam);setResponses({});attemptKey.current='';setDirty(false);setMode(next);
  }catch(error:any){setErr(error.message)}finally{setBusy(false)}
 }
 function patchExam(patch:Partial<Exam>){setExam(current=>current?{...current,...patch}:current);setDirty(true)}
 function patchQuestion(id:string,patch:Partial<Question>){setExam(current=>current?{...current,questions:current.questions.map(q=>q.id===id?{...q,...patch}:q)}:current);setDirty(true)}
 function moveQuestion(index:number,direction:number){
  if(!exam)return;const questions=[...exam.questions];[questions[index],questions[index+direction]]=[questions[index+direction],questions[index]];patchExam({questions});
 }
 async function uploadImage(questionId:string,file:File){
  if(!file.size||file.size>MAX_EXAM_IMAGE_BYTES){setErr('รูปภาพต้องมีขนาดไม่เกิน 5 MB');return}
  if(!/\.(png|jpe?g|webp)$/i.test(file.name)){setErr('กรุณาเลือกรูป PNG, JPG หรือ WebP');return}
  setUploading(questionId);setErr('');
  try{
   const response=await fetch(`/api/exam-images?courseId=${encodeURIComponent(course.id)}&name=${encodeURIComponent(file.name)}`,{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});
   const data=await response.json() as Row;if(!response.ok)throw Error(data.error||'อัปโหลดรูปภาพไม่สำเร็จ');
   patchQuestion(questionId,{imageId:data.id});
  }catch(error:any){setErr(error.message)}finally{setUploading('')}
 }
 async function save(event:React.FormEvent){
  event.preventDefault();if(!exam||busy||uploading)return;setBusy(true);setErr('');
  try{
   await examApi({op:'save',courseId:course.id,exam});setDirty(false);onDirtyChange(false);setMode('list');
   setMessage(exam.published?'บันทึกและเปิดข้อสอบให้นักเรียนแล้ว':'บันทึกข้อสอบเป็นแบบร่างแล้ว');
   await refresh();
  }catch(error:any){setErr(error.message)}finally{setBusy(false)}
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!exam||busy)return;
  const unanswered=exam.questions.filter(q=>!responses[q.id]?.trim()).length;
  if(!window.confirm(unanswered?`ยังไม่ได้ตอบ ${unanswered} ข้อ ต้องการส่งคำตอบเลยหรือไม่?`:'ยืนยันส่งคำตอบเพื่อตรวจคะแนน?'))return;
  setBusy(true);setErr('');if(!attemptKey.current)attemptKey.current=uuid();
  try{
   const data=await examApi({op:'submit',examId:exam.id,revision:exam.revision,attemptId:attemptKey.current,responses:exam.questions.map(q=>({questionId:q.id,value:responses[q.id]||''}))});
   setResult({...data.attempt,preview:data.preview});setResultName('');setMode('result');setResponses({});onDirtyChange(false);await refresh();
  }catch(error:any){setErr(error.message)}finally{setBusy(false)}
 }
 async function viewResult(item:Row,examRow:Row){
  setBusy(true);setErr('');
  try{
   const data=await examApi({op:'attempt',examId:examRow.id,attemptId:item.id});
   setResult(data.attempt);setResultName(item.name?`${item.name} (@${item.username})`:'');
   setExam(current=>current?.id===examRow.id?current:{id:examRow.id,title:examRow.title,description:examRow.description||'',published:!!examRow.published,showAnswers:!!examRow.show_answers,revision:examRow.revision,courseId:course.id,questions:[]});setMode('result');
  }catch(error:any){setErr(error.message)}finally{setBusy(false)}
 }

 function percent(value:any){return value===null||value===undefined?'—':Number(value).toFixed(1)+'%'}
 async function loadStatistics(nextMode:string,revision:string){
  if(!exam)return;setBusy(true);setErr('');
  try{const data=await examApi({op:'statistics',examId:exam.id,attemptMode:nextMode,revision:Number(revision)});setStatistics(data);setResultRows(data.attempts);setAttemptMode(nextMode);setStatsRevision(revision)}catch(error:any){setErr(error.message)}finally{setBusy(false)}
 }
 const total=exam?.questions.reduce((sum,q)=>sum+q.points,0)||0;
 return <section className="course-exams">
  {mode==='list'?<>
   <button className="back" onClick={onBack}><ArrowLeft size={16}/> กลับไปคอร์สทั้งหมด</button>
   <div className="section-top lesson-heading"><div><span className="eyebrow">{course.category}</span><h1>{course.title}</h1><p>{course.description}</p></div>{canManage&&<button className="btn primary" disabled={busy||loading} onClick={create}><Plus size={18}/> สร้างข้อสอบ</button>}</div>
  </>:<button className="back" disabled={busy||!!uploading} onClick={leave}><ArrowLeft size={16}/> กลับไปรายการข้อสอบ</button>}
  {err&&<div className="alert error exam-alert" role="alert">{err}<button type="button" onClick={()=>setErr('')} aria-label="ปิดข้อความผิดพลาด"><X size={16}/></button></div>}
  {message&&mode==='list'&&<p className="exam-success" role="status"><CheckCircle2 size={17}/>{message}</p>}
  {mode==='list'&&<>
   <div className="exam-section-heading"><div><h2>ข้อสอบในคอร์ส</h2><p>{canManage?'สร้างโจทย์แบบเลือกตอบและเติมตัวเลข พร้อมรูปประกอบได้ในชุดเดียว':'เลือกข้อสอบเพื่อเริ่มทำ และดูผลการส่งคำตอบของคุณ'}</p></div><span>{exams.length} ชุด</span></div>
   {loading?<div className="empty panel"><LoaderCircle className="spin"/><p>กำลังโหลดข้อสอบ</p></div>:exams.length?<div className="exam-grid">{exams.map(item=>{
    const history=attempts.filter(attempt=>attempt.exam_id===item.id);
    return <article className="exam-card panel" key={item.id}>
     <div className="exam-card-top"><span className="exam-icon"><ClipboardList size={24}/></span><span className={'pill '+(item.published?'live':'')}>{item.published?'เปิดทำข้อสอบ':'แบบร่าง'}</span></div>
     <h3>{item.title}</h3><p className="exam-card-description">{item.description||'แบบทดสอบสำหรับผู้เรียนในคอร์สนี้'}</p>
     <div className="exam-card-meta"><span>{item.question_count} ข้อ</span><span>{item.show_answers?'มีเฉลยหลังส่ง':'แสดงคะแนนหลังส่ง'}</span></div>
     <div className="exam-card-actions">{canManage?<><button className="btn primary" disabled={busy} onClick={()=>open(item.id,'edit')}><Pencil size={15}/> แก้ไขข้อสอบ</button><button className="btn" disabled={busy} onClick={()=>open(item.id,'results')}><BarChart3 size={15}/> สถิติคะแนน</button>{!!item.published&&<button className="text-btn" disabled={busy} onClick={()=>open(item.id,'take')}>ลองทำข้อสอบ <Play size={14}/></button>}</>:<button className="btn primary" disabled={busy} onClick={()=>open(item.id,'take')}><Pencil size={16}/> ทำข้อสอบ</button>}</div>
     {!canManage&&history.length>0&&<details className="exam-history"><summary>ผลการทำข้อสอบของฉัน ({history.length} ครั้ง)</summary>{history.slice(0,10).map(attempt=><button key={attempt.id} disabled={busy} onClick={()=>viewResult(attempt,item)}><span>{time(attempt.created)}{attempt.revision!==item.revision?' · ฉบับก่อนหน้า':''}</span><b>{attempt.score}/{attempt.total_points}</b></button>)}</details>}
    </article>;
   })}</div>:<div className="empty panel"><ClipboardList size={40}/><h3>{canManage?'สร้างข้อสอบชุดแรกของคอร์สนี้':'ยังไม่มีข้อสอบที่เปิดให้ทำ'}</h3><p>{canManage?'ใส่ข้อความโจทย์ แนบรูปตามต้องการ แล้วเลือกชนิดคำตอบในแต่ละข้อ':'ข้อสอบจะปรากฏที่นี่เมื่อผู้สอนเปิดใช้งาน'}</p>{canManage&&<button className="btn primary" onClick={create}><Plus size={17}/> สร้างข้อสอบ</button>}{err&&<button className="btn" onClick={()=>{setLoading(true);refresh().catch(error=>setErr(error.message)).finally(()=>setLoading(false))}}>ลองโหลดใหม่</button>}</div>}
  </>}
  {mode==='edit'&&exam&&<form className="exam-editor" onSubmit={save}>
   <div className="exam-page-heading"><span className="eyebrow">EXAM BUILDER</span><h1>{exam.id?'แก้ไขข้อสอบ':'สร้างข้อสอบ'}</h1><p>เพิ่มได้สูงสุด {MAX_EXAM_QUESTIONS} ข้อ · เลือกชนิดคำตอบแยกแต่ละข้อได้</p></div>
   <fieldset disabled={busy||!!uploading} className="exam-fields">
    <section className="panel exam-settings"><label>ชื่อข้อสอบ<input autoFocus required maxLength={200} value={exam.title} onChange={event=>patchExam({title:event.target.value})} placeholder="เช่น แบบทดสอบการแปลงหน่วย"/></label><label>คำชี้แจง (ไม่บังคับ)<textarea rows={3} maxLength={2000} value={exam.description} onChange={event=>patchExam({description:event.target.value})} placeholder="วิธีทำข้อสอบ หรือสิ่งที่ต้องการให้นักเรียนทราบ"/></label></section>
    <div className="exam-question-list">{exam.questions.map((question,index)=><section className="panel exam-question-editor" key={question.id}>
     <div className="exam-question-toolbar"><strong>ข้อ {index+1}</strong><select aria-label={`ชนิดคำตอบข้อ ${index+1}`} value={question.kind} onChange={event=>{const kind=event.target.value as 'choice'|'numeric';patchQuestion(question.id,{kind,choices:kind==='choice'?newQuestion().choices:[],answer:'',tolerance:'0'})}}><option value="choice">เลือกตอบ</option><option value="numeric">เติมตัวเลข</option></select><div className="exam-question-tools"><button type="button" className="icon-btn" disabled={index===0} aria-label={`เลื่อนข้อ ${index+1} ขึ้น`} onClick={()=>moveQuestion(index,-1)}><ArrowUp size={17}/></button><button type="button" className="icon-btn" disabled={index===exam.questions.length-1} aria-label={`เลื่อนข้อ ${index+1} ลง`} onClick={()=>moveQuestion(index,1)}><ArrowDown size={17}/></button><button type="button" className="icon-btn exam-delete" aria-label={`ลบข้อ ${index+1}`} onClick={()=>{if(window.confirm(`ลบข้อ ${index+1} ออกจากข้อสอบนี้?`))patchExam({questions:exam.questions.filter(q=>q.id!==question.id)})}}><Trash2 size={17}/></button></div></div>
     <label>ข้อความโจทย์<textarea rows={3} maxLength={4000} value={question.prompt} onChange={event=>patchQuestion(question.id,{prompt:event.target.value})} placeholder="พิมพ์โจทย์ของข้อนี้"/></label>
     <div className="exam-image-field"><div className="exam-image-label"><b>รูปประกอบโจทย์ <span>(ไม่บังคับ)</span></b><label className="btn small exam-file-label"><ImagePlus size={16}/> {uploading===question.id?'กำลังอัปโหลด…':question.imageId?'เปลี่ยนรูป':'แนบรูป'}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`แนบรูปข้อ ${index+1}`} onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(file)uploadImage(question.id,file)}}/></label></div>{question.imageId?<div className="exam-image-preview"><img src={'/api/exam-images/'+question.imageId} alt={`รูปประกอบข้อ ${index+1}`}/><button type="button" className="btn small" onClick={()=>patchQuestion(question.id,{imageId:null})}><X size={14}/> เอารูปออก</button></div>:<p className="exam-help">เว้นว่างได้ · PNG, JPG หรือ WebP สูงสุด 5 MB</p>}</div>
     {question.kind==='choice'?<fieldset className="exam-choice-editor"><legend>ตัวเลือกและคำตอบที่ถูกต้อง</legend><p className="exam-help">กดวงกลมหน้าตัวเลือกที่เป็นคำตอบที่ถูกต้อง 1 ข้อ</p>{question.choices.map((choice,choiceIndex)=><div className={'exam-choice-edit-row '+(question.answer===choice.id?'is-correct':'')} key={choice.id}><label className="exam-correct-choice"><input type="radio" name={'correct-'+question.id} checked={question.answer===choice.id} onChange={()=>patchQuestion(question.id,{answer:choice.id})} aria-label={`คำตอบที่ถูกต้อง ${label(choiceIndex)} ข้อ ${index+1}`}/><span>{label(choiceIndex)}.</span></label><input aria-label={`ข้อความตัวเลือก ${label(choiceIndex)} ข้อ ${index+1}`} maxLength={500} value={choice.text} onChange={event=>patchQuestion(question.id,{choices:question.choices.map(c=>c.id===choice.id?{...c,text:event.target.value}:c)})} placeholder={`ตัวเลือก ${label(choiceIndex)}`}/><button type="button" className="icon-btn" disabled={question.choices.length<=2} aria-label={`ลบตัวเลือก ${label(choiceIndex)} ข้อ ${index+1}`} onClick={()=>patchQuestion(question.id,{choices:question.choices.filter(c=>c.id!==choice.id),answer:question.answer===choice.id?'':question.answer})}><X size={16}/></button></div>)}{question.choices.length<6&&<button type="button" className="text-btn" onClick={()=>patchQuestion(question.id,{choices:[...question.choices,{id:uuid(),text:''}]})}><Plus size={15}/> เพิ่มตัวเลือก</button>}</fieldset>:<div className="exam-number-settings"><label>คำตอบตัวเลขที่ถูกต้อง<input type="text" inputMode="decimal" maxLength={100} value={question.answer} onChange={event=>patchQuestion(question.id,{answer:event.target.value})} placeholder="เช่น -2.5 หรือ 1e3"/><small>ใส่เฉพาะตัวเลข ไม่ต้องใส่หน่วย</small></label><label>ยอมรับค่าคลาดเคลื่อน ±<input type="text" inputMode="decimal" maxLength={100} value={question.tolerance} onChange={event=>patchQuestion(question.id,{tolerance:event.target.value})}/><small>0 = ตรงคำตอบ · 0.01 = ยอมให้ต่างได้ 0.01</small></label></div>}
     <div className="exam-question-bottom"><label>คะแนนข้อนี้<input type="number" min={1} max={100} step={1} value={question.points} onChange={event=>patchQuestion(question.id,{points:Number(event.target.value)})}/></label><label>คำอธิบายเฉลย (ไม่บังคับ)<textarea rows={2} maxLength={3000} value={question.explanation} onChange={event=>patchQuestion(question.id,{explanation:event.target.value})} placeholder="แสดงหลังส่งเฉพาะเมื่อเปิดการแสดงเฉลย"/></label></div>
    </section>)}</div>
    {exam.questions.length<MAX_EXAM_QUESTIONS&&<div className="exam-add-question"><button type="button" className="btn" onClick={()=>patchExam({questions:[...exam.questions,newQuestion('choice')]})}><Plus size={17}/> เพิ่มข้อเลือกตอบ</button><button type="button" className="btn" onClick={()=>patchExam({questions:[...exam.questions,newQuestion('numeric')]})}><Plus size={17}/> เพิ่มข้อเติมตัวเลข</button></div>}
    <section className="panel exam-publish"><div><h3>การเปิดข้อสอบ</h3><p>{exam.questions.length} ข้อ · รวม {total} คะแนน</p></div><label className="exam-checkbox"><input type="checkbox" checked={exam.published} onChange={event=>patchExam({published:event.target.checked})}/><span><b>เปิดให้นักเรียนทำข้อสอบ</b><small>ใช้สิทธิ์ตามคอร์สนี้ หากยังไม่เปิดจะเป็นแบบร่างที่เห็นเฉพาะผู้สอน</small></span></label><label className="exam-checkbox"><input type="checkbox" checked={exam.showAnswers} onChange={event=>patchExam({showAnswers:event.target.checked})}/><span><b>แสดงเฉลยหลังส่งคำตอบ</b><small>หากไม่เลือก นักเรียนจะเห็นเฉพาะคะแนนรวม</small></span></label><div className="exam-save-actions"><button type="button" className="btn" onClick={leave}>ยกเลิก</button><button className="btn primary" disabled={!!uploading}>{busy?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>} {exam.published?'บันทึกและเปิดข้อสอบ':'บันทึกแบบร่าง'}</button></div></section>
   </fieldset>
   {!!uploading&&<p className="exam-busy-note" role="status"><LoaderCircle className="spin" size={17}/> กำลังอัปโหลดรูป กรุณารอสักครู่</p>}
  </form>}
  {mode==='take'&&exam&&<form className="exam-paper" onSubmit={submit}>
   <div className="panel exam-paper-heading"><span className="eyebrow">YOUR EXAM</span><h1>{exam.title}</h1><p className="exam-text">{exam.description}</p><div className="exam-card-meta"><span>{exam.questions.length} ข้อ</span><span>{total} คะแนน</span><span>{exam.showAnswers?'ดูเฉลยได้หลังส่ง':'แสดงคะแนนรวมหลังส่ง'}</span></div>{canManage&&<p className="exam-preview-note">ลองทำในฐานะผู้สอน ระบบไม่บันทึกผลรวมกับนักเรียน</p>}</div>
   <fieldset disabled={busy} className="exam-fields"><div className="exam-question-list">{exam.questions.map((question,index)=><section className="panel exam-take-question" key={question.id}><div className="exam-take-top"><h2>ข้อ {index+1}</h2><span>{question.points} คะแนน</span></div><p className="exam-prompt">{question.prompt}</p>{question.imageId&&<img className="exam-question-image" src={'/api/exam-images/'+question.imageId} alt={`รูปประกอบโจทย์ข้อ ${index+1}`} loading="lazy"/>}{question.kind==='choice'?<fieldset className="exam-student-choices"><legend className="sr-only">เลือกคำตอบข้อ {index+1}</legend>{question.choices.map((choice,choiceIndex)=><label className={'exam-student-choice '+(responses[question.id]===choice.id?'selected':'')} key={choice.id}><input type="radio" name={'answer-'+question.id} value={choice.id} checked={responses[question.id]===choice.id} onChange={()=>setResponses(values=>({...values,[question.id]:choice.id}))}/><span className="exam-choice-letter">{label(choiceIndex)}.</span><span>{choice.text}</span></label>)}</fieldset>:<label className="exam-student-number">คำตอบข้อ {index+1}<input type="text" inputMode="decimal" maxLength={100} value={responses[question.id]||''} onChange={event=>setResponses(values=>({...values,[question.id]:event.target.value}))} placeholder="กรอกตัวเลข เช่น -2.5 หรือ 1e3"/><small>ใช้จุดสำหรับทศนิยม และไม่ต้องใส่หน่วย</small></label>}</section>)}</div><div className="panel exam-submit"><p>ตอบแล้ว {exam.questions.filter(q=>responses[q.id]?.trim()).length}/{exam.questions.length} ข้อ</p><button className="btn primary" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<CheckCircle2 size={17}/>} ส่งคำตอบและดูคะแนน</button></div></fieldset>
  </form>}
  {mode==='result'&&result&&<div className="exam-result"><div className="panel exam-score"><span className="exam-score-icon"><CheckCircle2 size={32}/></span><span className="eyebrow">EXAM RESULT</span><h1>{exam?.title}</h1>{resultName&&<p>{resultName}</p>}<p>คะแนนที่ได้</p><strong>{result.score}<small> / {result.totalPoints}</small></strong><p>{time(result.created)} · ข้อสอบฉบับที่ {result.revision}</p>{result.preview?<p className="exam-preview-note">ผลทดลองทำของผู้สอน ไม่ได้บันทึกในประวัตินักเรียน</p>:<p className="exam-saved-result">บันทึกผลการทำข้อสอบแล้ว</p>}{!result.details&&<p>ผู้สอนกำหนดให้แสดงเฉพาะคะแนนรวม</p>}<button className="btn" onClick={leave}>กลับไปรายการข้อสอบ</button></div>{result.details&&<div className="exam-question-list">{result.details.map((question:Row,index:number)=><article className="panel exam-reviewed-question" key={question.id}><div className="exam-take-top"><h2>ข้อ {index+1}</h2><span className={'exam-mark '+(question.correct?'correct':'incorrect')}>{question.correct?'ถูกต้อง':'ไม่ถูกต้อง'} · {question.earned}/{question.points}</span></div><p className="exam-prompt">{question.prompt}</p>{question.imageId&&<img className="exam-question-image" src={'/api/exam-images/'+question.imageId} alt={`รูปประกอบข้อ ${index+1}`} loading="lazy"/>}<dl className="exam-answer-review"><dt>คำตอบที่ส่ง</dt><dd>{displayAnswer(question,question.response)}</dd><dt>คำตอบที่ถูกต้อง</dt><dd>{displayAnswer(question,question.answer)}{question.kind==='numeric'&&Number(question.tolerance)>0?` (± ${question.tolerance})`:''}</dd></dl>{question.explanation&&<div className="exam-explanation"><b>คำอธิบาย</b><p className="exam-text">{question.explanation}</p></div>}</article>)}</div>}</div>}
  {mode==='results'&&exam&&statistics&&<><div className="exam-page-heading"><span className="eyebrow">EXAM STATISTICS</span><h1>สถิติคะแนนข้อสอบ</h1><p>{exam.title}</p></div>
   <section className="panel exam-stats-filters"><label>ผลที่ใช้คำนวณ<select disabled={busy} value={attemptMode} onChange={event=>loadStatistics(event.target.value,statsRevision)}><option value="latest">ครั้งล่าสุดของแต่ละคน</option><option value="all">ทุกครั้งที่ส่งคำตอบ</option></select></label><label>ฉบับข้อสอบ<select disabled={busy} value={statsRevision} onChange={event=>loadStatistics(attemptMode,event.target.value)}><option value="0">ทุกฉบับ</option>{statistics.revisions.map((r:Row)=><option key={r.revision} value={r.revision}>ฉบับที่ {r.revision}</option>)}</select></label><button className="btn" disabled={busy} onClick={()=>loadStatistics(attemptMode,statsRevision)}>{busy?'กำลังโหลด…':'รีเฟรชสถิติ'}</button><p>คะแนนแสดงเป็นร้อยละเพื่อเทียบข้อสอบต่างฉบับ · ครั้งล่าสุดนับภายในฉบับที่เลือก</p></section>
   <div className="exam-stats-grid">{[['ผู้เข้าสอบ',statistics.summary.students+' คน'],['จำนวนผลที่นำมาคำนวณ',statistics.summary.submissions+' ครั้ง'],['คะแนนเฉลี่ย',percent(statistics.summary.average)],['คะแนนสูงสุด',percent(statistics.summary.maximum)],['คะแนนต่ำสุด',percent(statistics.summary.minimum)]].map(([title,value])=><div className="panel exam-stat" key={title}><span>{title}</span><strong>{value}</strong></div>)}</div>
   {statistics.summary.submissions>0?<><section className="panel exam-stats-chart"><h2>การกระจายคะแนน</h2><p>จำนวนผลสอบในแต่ละช่วงคะแนน (%)</p>{Array.from({length:10},(_,i)=>{const count=Number(statistics.histogram.find((h:Row)=>h.bucket===i)?.count||0),max=Math.max(1,...statistics.histogram.map((h:Row)=>h.count));return <div className="exam-histogram-row" key={i}><span>{i*10}–{i===9?'100':i*10+9.99}%</span><div><i style={{width:(count/max*100)+'%'}}/></div><b>{count}</b></div>})}</section><section className="panel exam-stats-chart"><h2>สถิติรายข้อ</h2><p>แยกตามฉบับข้อสอบ เพื่อไม่รวมโจทย์ที่เคยแก้ไขเข้าด้วยกัน</p>{statistics.questions.map((q:Row,index:number)=><div className="exam-question-stat" key={q.revision+'-'+q.question_id}><span>ฉบับ {q.revision} · {q.prompt||'โจทย์ไม่มีข้อความ'}</span><b>ถูก {q.correct}/{q.responses} ({(100*q.correct/q.responses).toFixed(1)}%)</b></div>)}</section></>:<div className="panel empty"><BarChart3 size={32}/><h3>ยังไม่มีผลสอบสำหรับตัวเลือกนี้</h3><p>สถิติจะแสดงเมื่อนักเรียนส่งคำตอบ</p></div>}
   <div className="exam-section-heading"><div><h2>ผลคะแนนรายคน</h2><p>แสดง 200 ผลล่าสุดตามตัวกรอง · สถิติด้านบนคำนวณจากผลทั้งหมดตามตัวกรอง</p></div></div><div className="panel table-panel"><table><thead><tr><th>นักเรียน</th><th>คะแนน</th><th>ฉบับข้อสอบ</th><th>วันและเวลาส่ง</th><th>รายละเอียด</th></tr></thead><tbody>{resultRows.map(row=><tr key={row.id}><td><b>{row.name||'บัญชีเดิม'}</b><small>@{row.username||'—'}</small></td><td>{row.score}/{row.total_points}</td><td>{row.revision}</td><td>{time(row.created)}</td><td><button className="btn small" disabled={busy} onClick={()=>viewResult(row,exam)}>ดูคำตอบ</button></td></tr>)}</tbody></table>{!resultRows.length&&<div className="empty"><BarChart3 size={32}/><h3>ยังไม่มีการส่งคำตอบ</h3><p>ผลของนักเรียนจะแสดงที่นี่เมื่อส่งข้อสอบ</p></div>}</div></>}
 </section>;
}
