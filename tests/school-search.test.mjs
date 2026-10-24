import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildSchoolIndex,suggestSchools,schoolInputValue} from '../lib/school-search.mjs';

const sample=buildSchoolIndex([
 ['a','โรงเรียนสตรีวิทยา ๒','กรุงเทพมหานคร','เขตลาดพร้าว'],
 ['b','โรงเรียนสตรีวิทยา','กรุงเทพมหานคร','เขตพระนคร'],
 ['c','โรงเรียนบ้านสตรีวิทยา','เชียงใหม่','เมืองเชียงใหม่'],
 ['d','โรงเรียนบ้านใหม่','เชียงใหม่','แม่ริม'],
 ['e','โรงเรียนบ้านใหม่','เชียงราย','แม่สาย'],
]);

test('Thai spelling, optional school prefixes, and exact/prefix ranking',()=>{
 for(const query of ['สตรีวิทยา','โรงเรียนสตรีวิทยา','ร.ร.สตรีวิทยา','โรงเรียน สตรีวิทยา']){
  assert.deepEqual(suggestSchools(sample,query).map(row=>row.id),['b','a','c']);
 }
 assert.deepEqual(suggestSchools(sample,'สตรีวิท').map(row=>row.id),['a','b','c']);
 assert.deepEqual(suggestSchools(sample,'สตร่วิทยา'),[]);
});

test('same-name schools stay distinct and can be narrowed by province or district',()=>{
 assert.equal(suggestSchools(sample,'บ้านใหม่').length,2);
 assert.deepEqual(suggestSchools(sample,'บ้านใหม่ เชียงราย').map(row=>row.id),['e']);
 assert.deepEqual(suggestSchools(sample,'แม่ริม บ้านใหม่').map(row=>row.id),['d']);
 const selected=schoolInputValue(suggestSchools(sample,'บ้านใหม่ เชียงราย')[0]);
 assert.equal(selected,'โรงเรียนบ้านใหม่ (เชียงราย)');
 assert.deepEqual(suggestSchools(sample,selected).map(row=>row.id),['e']);
});

test('empty/unmatched searches do not replace manual school entry; result count is bounded',()=>{
 for(const query of ['','  ','โรงเรียน','ชื่อโรงเรียนที่ไม่มีในรายการ'])assert.deepEqual(suggestSchools(sample,query),[]);
 assert.equal(suggestSchools(sample,'วิทยา',2).length,2);
 assert.equal(schoolInputValue({name:'โรงเรียนใหม่',province:''}),'โรงเรียนใหม่');
});

const directory=JSON.parse(readFileSync(new URL('../public/data/thai-schools-20261021.json',import.meta.url),'utf8'));
const national=buildSchoolIndex(directory.schools);
test('published snapshot has unique usable choices across all 77 provinces',()=>{
 assert.equal(directory.schema,1);
 assert.equal(national.length,directory.count);
 assert.ok(national.length>30000);
 assert.equal(new Set(national.map(row=>row.id)).size,national.length);
 assert.equal(new Set(national.map(row=>row.province).filter(Boolean)).size,77);
 for(const school of national)assert.ok(schoolInputValue(school).length<=200);
 assert.equal(directory.sources.reduce((total,source)=>total+source.suggestionCount,0),national.length);
});

test('real data includes current public/local schools and nationwide school sectors',()=>{
 for(const [query,province] of [
  ['สตรีวิทยา','กรุงเทพมหานคร'],
  ['สวนกุหลาบวิทยาลัย','กรุงเทพมหานคร'],
  ['ราชินี','กรุงเทพมหานคร'],
  ['มหิดลวิทยานุสรณ์','นครปฐม'],
  ['เทศบาลตำบลเขาพนม','กระบี่'],
 ])assert.ok(suggestSchools(national,query).some(row=>row.province===province),query);
});
