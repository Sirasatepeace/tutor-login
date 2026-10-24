import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExam,parseExamNumber,gradeExam,publicExamQuestions,attemptView,examImageType} from '../lib/exam-policy.mjs';

const choice={id:'choice-q',kind:'choice',prompt:'ตัวเลือกที่ถูกต้อง',choices:[{id:'a',text:'คำตอบ ก'},{id:'b',text:'คำตอบ ข'}],answer:'b',points:2,explanation:'คำอธิบายลับ'};
const numeric={id:'numeric-q',kind:'numeric',prompt:'ค่าตัวเลข',answer:'-2.5',tolerance:'0.01',points:3};
const make=(questions=[choice,numeric],published=true)=>normalizeExam({title:'ข้อสอบ',description:'',published,questions});
test('mixed question types, text without image, and drafts are supported',()=>{
 const exam=make();assert.equal(exam.questions[0].imageId,null);assert.equal(exam.questions[1].kind,'numeric');
 assert.equal(make([],false).questions.length,0);
 assert.equal(make([{...numeric,prompt:'',answer:''}],false).questions[0].answer,'');
 assert.throws(()=>make([]));assert.throws(()=>make([{...numeric,prompt:''}]));
 assert.throws(()=>make([{...choice,answer:'missing'}]));
 assert.throws(()=>make([{...choice,choices:[{id:'a',text:'a'},{id:'a',text:'b'}]}]));
 assert.throws(()=>make([numeric,{...numeric}]));
 assert.throws(()=>make([{...numeric,tolerance:'-1'}]));
});
test('numeric grading accepts negative, decimal, scientific notation and Thai digits',()=>{
 for(const [text,value] of [['-2.5',-2.5],['๐.๐๑',.01],['1e3',1000],['−2',-2],['.25',.25]])assert.equal(parseExamNumber(text),value);
 for(const value of ['Infinity','NaN','1/2','2 kg','1,000','1e999','1e-999',''])assert.equal(parseExamNumber(value),null);
 const questions=make().questions;
 assert.equal(gradeExam(questions,[{questionId:'choice-q',value:'b'},{questionId:'numeric-q',value:'-2.49'}]).score,5);
 assert.equal(gradeExam(questions,[{questionId:'choice-q',value:'a'},{questionId:'numeric-q',value:'-2.48'}]).score,0);
 assert.equal(gradeExam(make([{...numeric,answer:'1e-20',tolerance:'0'}]).questions,[{questionId:'numeric-q',value:'0'}]).score,0,'tiny expected values must not round to zero');
 assert.equal(gradeExam(make([{...numeric,answer:'1000',tolerance:'0'}]).questions,[{questionId:'numeric-q',value:'1e3'}]).score,3);
 assert.equal(gradeExam(make([{...numeric,answer:'1.7e308',tolerance:'1.79e308'}]).questions,[{questionId:'numeric-q',value:'-1.7e308'}]).score,0,'overflowed differences cannot match a finite tolerance');
 assert.equal(gradeExam(questions,[]).score,0);
 assert.throws(()=>gradeExam(questions,[{questionId:'fake',value:'b'}]));
 assert.throws(()=>gradeExam(questions,[{questionId:'choice-q',value:'a'},{questionId:'choice-q',value:'b'}]));
 assert.throws(()=>gradeExam(questions,[{questionId:'numeric-q',value:'2 kg'}]));
});
test('public question and hidden-result projections omit answers, explanations and marking',()=>{
 const exam=make(),questions=publicExamQuestions(exam.questions);
 assert.ok(questions.every(q=>!('answer' in q)&&!('explanation' in q)&&!('tolerance' in q)));
 const graded=gradeExam(exam.questions,[{questionId:'choice-q',value:'b'}]);
 const row={id:'attempt',exam_id:'exam',revision:1,score:graded.score,total_points:graded.totalPoints,result:JSON.stringify(graded),created:1};
 const hidden=attemptView(row,false);assert.ok(!('details' in hidden));assert.ok(!JSON.stringify(hidden).includes('คำอธิบายลับ'));
 assert.equal(attemptView(row,true).details[0].answer,'b');
});
test('image formats are detected from content and active SVG is rejected',()=>{
 assert.equal(examImageType(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(examImageType(Uint8Array.from([255,216,255,224])),'image/jpeg');
 assert.equal(examImageType(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');
 assert.equal(examImageType(new TextEncoder().encode('<svg onload="alert(1)"></svg>')),null);
});
