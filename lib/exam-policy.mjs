export const MAX_EXAM_QUESTIONS=50;
export const MAX_EXAM_IMAGE_BYTES=5*1024*1024;
export class ExamValidationError extends Error {}
function invalid(message){throw new ExamValidationError(message)}
function text(value,max,label,required=false){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))invalid(label);
 return value.trim();
}
function identifier(value,label){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(value))invalid(label);
 return value;
}

// Decimal/scientific notation, including Thai digits; never evaluate expressions.
export function parseExamNumber(value){
 if(typeof value!=='string'||value.length>100)return null;
 const normalized=value.normalize('NFKC').trim().replace(/−/g,'-').replace(/[๐-๙]/g,d=>String(d.charCodeAt(0)-0x0e50));
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized))return null;
 const number=Number(normalized);
 if(!Number.isFinite(number)||(number===0&&/[1-9]/.test(normalized.split(/[eE]/)[0])))return null;
 return number;
}

export function normalizeExam(input){
 if(!input||typeof input!=='object')invalid('ข้อมูลข้อสอบไม่ถูกต้อง');
 const published=input.published===true,showAnswers=input.showAnswers===true;
 const title=text(input.title,200,'กรุณาใส่ชื่อข้อสอบ ไม่เกิน 200 ตัวอักษร',true);
 const description=text(input.description??'',2000,'คำชี้แจงยาวเกิน 2,000 ตัวอักษร');
 if(!Array.isArray(input.questions)||input.questions.length>MAX_EXAM_QUESTIONS||(published&&!input.questions.length))invalid('ข้อสอบที่เปิดใช้งานต้องมี 1–50 ข้อ');
 const ids=new Set();
 const questions=input.questions.map((question,i)=>{
  const label=`ข้อ ${i+1}: `;
  if(!question||typeof question!=='object')invalid(label+'ข้อมูลไม่ถูกต้อง');
  const id=identifier(question.id,label+'รหัสข้อไม่ถูกต้อง');
  if(ids.has(id))invalid('รหัสข้อซ้ำกัน');ids.add(id);
  if(!['choice','numeric'].includes(question.kind))invalid(label+'เลือกชนิดคำตอบให้ถูกต้อง');
  const prompt=text(question.prompt??'',4000,label+'กรุณาใส่ข้อความโจทย์ ไม่เกิน 4,000 ตัวอักษร',published);
  const explanation=text(question.explanation??'',3000,label+'คำอธิบายเฉลยยาวเกิน 3,000 ตัวอักษร');
  const imageId=question.imageId?identifier(question.imageId,label+'รูปภาพไม่ถูกต้อง'):null;
  const points=question.points??1;if(!Number.isInteger(points)||points<1||points>100)invalid(label+'คะแนนต้องเป็นจำนวนเต็ม 1–100');
  let choices=[],answer='',tolerance='0';
  if(question.kind==='choice'){
   if(!Array.isArray(question.choices)||question.choices.length<2||question.choices.length>6)invalid(label+'ต้องมีตัวเลือก 2–6 ตัวเลือก');
   const choiceIds=new Set();
   choices=question.choices.map(choice=>{
    if(!choice||typeof choice!=='object')invalid(label+'ตัวเลือกไม่ถูกต้อง');
    const choiceId=identifier(choice.id,label+'รหัสตัวเลือกไม่ถูกต้อง');
    if(choiceIds.has(choiceId))invalid(label+'รหัสตัวเลือกซ้ำกัน');choiceIds.add(choiceId);
    return {id:choiceId,text:text(choice.text??'',500,label+'กรุณาใส่ข้อความทุกตัวเลือก ไม่เกิน 500 ตัวอักษร',published)};
   });
   answer=typeof question.answer==='string'?question.answer:'';
   if((answer||published)&&!choiceIds.has(answer))invalid(label+'กรุณาเลือกคำตอบที่ถูกต้อง');
  }else{
   answer=text(question.answer??'',100,label+'คำตอบตัวเลขไม่ถูกต้อง');
   tolerance=text(question.tolerance??'0',100,label+'ค่าคลาดเคลื่อนไม่ถูกต้อง')||'0';
   if((answer||published)&&parseExamNumber(answer)===null)invalid(label+'กรุณาใส่คำตอบเป็นตัวเลข เช่น -2.5 หรือ 1e3');
   const allowedError=parseExamNumber(tolerance);
   if(allowedError===null||allowedError<0)invalid(label+'ค่าคลาดเคลื่อนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
  }
  return {id,kind:question.kind,prompt,imageId,choices,answer,tolerance,points,explanation};
 });
 return {title,description,published,showAnswers,questions};
}

export function publicExamQuestions(questions){
 return questions.map(({id,kind,prompt,imageId,choices,points})=>({id,kind,prompt,imageId,choices,points}));
}

export function gradeExam(questions,responses){
 if(!Array.isArray(responses)||responses.length>questions.length)invalid('รูปแบบคำตอบไม่ถูกต้อง');
 const validIds=new Set(questions.map(q=>q.id)),values=new Map();
 for(const response of responses){
  if(!response||!validIds.has(response.questionId)||values.has(response.questionId)||typeof response.value!=='string'||response.value.length>100)invalid('รูปแบบคำตอบไม่ถูกต้อง');
  values.set(response.questionId,response.value.trim());
 }
 let score=0,totalPoints=0;
 const details=questions.map(question=>{
  const response=values.get(question.id)||'';let correct=false;
  if(question.kind==='choice'){
   if(response&&!question.choices.some(c=>c.id===response))invalid('คำตอบแบบตัวเลือกไม่ถูกต้อง');
   correct=response!==''&&response===question.answer;
  }else{
   const value=parseExamNumber(response),expected=parseExamNumber(question.answer),tolerance=parseExamNumber(question.tolerance);
   if(response&&value===null)invalid('คำตอบแบบเติมตัวเลขต้องเป็นตัวเลข ไม่ต้องใส่หน่วย');
   if(value!==null&&expected!==null&&tolerance!==null){
    const rounding=Number.EPSILON*Math.max(Math.abs(value),Math.abs(expected),tolerance,Number.MIN_VALUE)*4;
    const difference=Math.abs(value-expected);
    correct=difference<=tolerance||(Number.isFinite(difference)&&difference-tolerance<=rounding);
   }
  }
  const earned=correct?question.points:0;score+=earned;totalPoints+=question.points;
  return {...question,response,correct,earned};
 });
 return {score,totalPoints,details};
}

export function attemptView(row,reveal=false){
 const result=typeof row.result==='string'?JSON.parse(row.result):row.result;
 return {id:row.id,examId:row.exam_id,revision:row.revision,score:row.score,totalPoints:row.total_points,created:row.created,...(reveal?{details:result.details}:{})};
}

export function examImageType(bytes){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return 'image/png';
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
