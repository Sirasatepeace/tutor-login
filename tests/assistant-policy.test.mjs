import test from 'node:test';
import assert from 'node:assert/strict';
import {thaiDay,reportRange,validateReport,runAssistant,AssistantServiceError} from '../lib/assistant-policy.mjs';
test('Thai date boundary, leap dates and bounded report ranges',()=>{
 const now=Date.parse('2026-10-21T17:00:00Z');assert.equal(thaiDay(now),'2026-10-22');assert.equal(thaiDay(now-1),'2026-10-21');
 const range=reportRange(null,null,now);assert.equal(range.fromMs,now);assert.equal(range.untilMs,now+86400000);
 for(const dates of [['2026-02-30','2026-03-01'],['2026-10-22','2026-10-21'],['2024-01-01','2026-01-01'],['x','2026-10-21']])assert.throws(()=>reportRange(...dates));
 assert.throws(()=>validateReport({kind:'delete_users'}));assert.throws(()=>validateReport({kind:'exam_results'}));
 assert.equal(validateReport({kind:'questions',exam_id:'exam1'}).examId,'exam1');
});
test('AI must obtain a report; tool output is passed back without persistence',async()=>{
 const sent=[];let reads=0;
 const transport=async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(options.body);sent.push(body);
  return Response.json({output:sent.length===1?[{type:'function_call',name:'get_classroom_report',call_id:'call1',arguments:JSON.stringify({kind:'activity',date_start:null,date_end:null,course_id:null,exam_id:null})}]:[{type:'message',content:[{type:'output_text',text:'มีนักเรียน 3 บัญชี'}]}]});
 };
 const result=await runAssistant({key:'test-key',message:'วันนี้มีคนกี่คน',readReport:async args=>{validateReport(args);reads++;return {kind:'activity',students:3}},transport});
 assert.equal(result.text,'มีนักเรียน 3 บัญชี');assert.equal(result.reports.length,1);assert.equal(reads,1);assert.equal(sent[0].tool_choice,'required');assert.equal(sent[0].store,false);assert.equal(sent[1].input.at(-1).call_id,'call1');assert.ok(sent[1].input.at(-1).output.includes('3'));assert.equal(sent[0].tools.length,1);
});
test('unrecognized model tools cannot execute; errors do not disclose credentials',async()=>{
 let requests=0,reads=0;
 const result=await runAssistant({key:'never-disclose',message:'ลบบัญชี',readReport:async()=>{reads++;return {}},transport:async()=>Response.json({output:++requests===1?[{type:'function_call',name:'execute_sql',call_id:'x',arguments:'{"sql":"DELETE FROM login_accounts"}'}]:[{type:'message',content:[{type:'output_text',text:'อ่านรายงานเท่านั้น'}]}]})});
 assert.equal(reads,0);assert.equal(result.reports.length,0);
 await assert.rejects(runAssistant({key:'never-disclose',message:'x',readReport:async()=>({}),transport:async()=>{throw Error('never-disclose')}}),e=>e instanceof AssistantServiceError&&!e.message.includes('never-disclose'));
});
