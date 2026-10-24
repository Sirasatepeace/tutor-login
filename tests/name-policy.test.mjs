import test from 'node:test';
import assert from 'node:assert/strict';
import {assessName,readNameInput} from '../lib/name-policy.mjs';
test('Thai and international names preserve legitimate spelling and punctuation',()=>{
 for(const [first,last] of [['สมชาย','ใจดี'],['สุภาพร','ณ อยุธยา'],['Jean-Luc',"O’Connor"],['Zoë','García'],['Li','Ng'],['Dick','Smith'],['Pornchai','Wong'],['J. R.','Tolkien'],['王','小明']]){
  const result=assessName(first,last);assert.equal(result.valid,true,first+' '+last+': '+result.error);assert.deepEqual(result.flags,[],first+' '+last);
 }
 const normalized=assessName('  สมชาย  ','ณ\u00a0\u00a0อยุธยา');assert.equal(normalized.name,'สมชาย ณ อยุธยา');
});
test('links, emoji, invalid formats and hidden controls cannot register',()=>{
 for(const first of ['สมชาย123','😀','https://example.com','www.example.com','Som\u200bchai','Som\u202echai','Som\nchai',"<script>alert('x')</script>",'ก'.repeat(101)])assert.equal(assessName(first,'ใจดี').valid,false,first);
 assert.equal(assessName('สมชาย','').valid,false);assert.equal(assessName('','ใจดี').valid,false);
});
test('the reported nonsense examples are review hints; unfamiliar names are not blocked',()=>{
 const english=assessName('wefvev','verve');assert.equal(english.valid,true);assert.ok(english.flags.includes('unusual_latin'));
 const thai=assessName('อะอะ','อุอุง');assert.equal(thai.valid,true);assert.ok(thai.flags.includes('repeated'));
 const rare=assessName('Szczęsny','Qasim');assert.equal(rare.valid,true);assert.ok(rare.flags.length>0);
 assert.ok(assessName('สมชาย','สมชาย').flags.includes('same_parts'));
 assert.ok(assessName('สมaชาย','ใจดี').flags.includes('mixed_script'));
});
test('repetition warnings allow exactly three Thai น or ก in either name, including incomplete forms',()=>{
 for(const [first,last] of [['aaa','ddd'],['Aaa','Smith'],['สมชาย','มมม'],['สมขขขชาย','ใจดี'],['Saaaa','Smith'],['นนนน','ใจดี'],['สมชาย','กกกก'],['กกกกกก','ใจดี'],['นนนaaa','ใจดี'],['สมชาย','กกกนนนน']]){
  const result=assessName(first,last);assert.equal(result.valid,true);assert.ok(result.flags.includes('repeated'),first+' '+last);
 }
 assert.ok(assessName('aaa','',{allowIncomplete:true}).flags.includes('repeated'));
 assert.ok(assessName('','ddd',{allowIncomplete:true}).flags.includes('repeated'));
 for(const [first,last] of [['Aaron','Smith'],['Anna','Schmidt'],['สมมิตร','ใจดี'],['นนน','ใจดี'],['สมชาย','กกก'],['สมนนนชาย','ใฝ่เรียน'],['กกก','นนน']]){
  const result=assessName(first,last);assert.equal(result.valid,true);assert.deepEqual(result.flags,[],first+' '+last+' keeps ordinary doubles and the two Thai triple exceptions');
 }
 assert.deepEqual(assessName('นนน','',{allowIncomplete:true}).flags,[]);
 assert.deepEqual(assessName('','กกก',{allowIncomplete:true}).flags,[]);
});
test('vowelless Latin words and malformed Thai vowel order are review hints, never hard rejections',()=>{
 for(const value of ['svrnhj','SVRNHJ','bnmk','Anne-svrnhj']){
  const result=assessName(value,'Smith');assert.equal(result.valid,true);assert.ok(result.flags.includes('unusual_latin'),value);
  assert.ok(assessName('Anna',value).flags.includes('unusual_latin'),'surname '+value);
 }
 for(const value of ['กหีำพด','กิีด','กีําพด','สมช้ิาย','สมช้่าย','กเาด']){
  const result=assessName(value,'ใจดี');assert.equal(result.valid,true);assert.ok(result.flags.includes('unusual_thai'),value);
  assert.ok(assessName('สมชาย',value).flags.includes('unusual_thai'),'surname '+value);
 }
 for(const [first,last] of [['Lynn','Smyth'],['Rhys','Schmidt'],['Christopher','Nguyen'],['พร','กนก'],['ธน','สมพร'],['น้ำทิพย์','พุฒิ'],['กฤษณ์','อำพล'],['อําพล','ใจดี']]){
  const result=assessName(first,last);assert.equal(result.valid,true);assert.deepEqual(result.flags,[],first+' '+last);
 }
 assert.ok(assessName('กหีำพด','',{allowIncomplete:true}).flags.includes('unusual_thai'));
 assert.ok(assessName('svrnhj','',{allowIncomplete:true}).flags.includes('unusual_latin'));
});
test('legacy full-name submissions use the same validation and cannot override the split fields',()=>{
 assert.equal(readNameInput({name:'สมชาย ใจดี'}).name,'สมชาย ใจดี');
 assert.equal(readNameInput({name:'Onlyone'}).valid,false);
 assert.ok(readNameInput({name:'wefvev verve',name_status:'approved',name_flags:[]}).flags.length>0);
 assert.ok(readNameInput({firstName:'ทดสอบ',lastName:'ใจดี',name:'สมชาย ใจดี'}).flags.includes('placeholder'));
});

test('placeholder and inappropriate names can only continue through review, with warnings before the surname is complete',()=>{
 for(const first of ['ทดสอบ','ชื่อ','test','qwerty','f u c k','เหี้ย']){const result=assessName(first,'ใจดี');assert.equal(result.valid,true);assert.ok(result.flags.length>0)}
 const partial=assessName('wefvev','',{allowIncomplete:true});assert.ok(partial.flags.includes('unusual_latin'));
 assert.equal(assessName('wefvev','').valid,false,'the server still requires both components');
});
