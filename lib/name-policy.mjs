// Conservative format checks and review hints, not proof of a person's identity.
export const NAME_FLAG_LABELS={placeholder:'พบข้อความทดลองหรือข้อความแทนชื่อจริง',offensive:'พบข้อความที่ไม่เหมาะสมในช่องชื่อ',repeated:'มีตัวอักษรซ้ำติดกันเกินเกณฑ์หรือพยางค์ซ้ำต่อเนื่อง',keyboard:'คล้ายข้อความทดลองหรือการกดแป้นพิมพ์',unusual_latin:'มีลำดับอักษรที่อาจเป็นการพิมพ์สุ่ม',unusual_thai:'มีลำดับสระหรือวรรณยุกต์ไทยที่อาจพิมพ์ผิดหรือพิมพ์สุ่ม',mixed_script:'มีอักษรต่างระบบปนในคำเดียวกัน',same_parts:'ชื่อและนามสกุลเหมือนกัน'};
const placeholders=new Set(['ทดสอบ','ทดลอง','ไม่บอก','ไม่ระบุ','ชื่อ','นามสกุล','ชื่อจริง','ชื่อเล่น','firstname','lastname','first name','last name','your name','test','testing','asdf','qwerty','abcdef','abc','xxx']);
// Whole components only: never reject a legitimate name for containing a short
// substring. In particular, Dick, Pornchai and สุภาพร remain valid.
const offensive=new Set(['fuck','fucking','shit','asshole','เหี้ย','ควย','หี','เย็ด','ไอ้เหี้ย','สัส']);
function normalize(value){return typeof value==='string'?value.normalize('NFC').replace(/[\p{Zs}]+/gu,' ').replace(/[’‘]/g,"'").replace(/[‐‑]/g,'-').trim():''}
export function assessName(firstValue,lastValue,{allowIncomplete=false}={}){
 const firstName=normalize(firstValue),lastName=normalize(lastValue),flags=[];
 const bad=error=>({valid:false,error,firstName,lastName,name:firstName+' '+lastName,flags:[]});
 for(const [title,raw,part] of [['ชื่อ',firstValue,firstName],['นามสกุล',lastValue,lastName]]){
  if(!part){if(allowIncomplete)continue;return bad('กรุณากรอก'+title+'จริงให้ครบ')}
  if(typeof raw!=='string'||raw.length>120||part.length>100)return bad(title+'ต้องไม่เกิน 100 ตัวอักษร');
  if(/[\p{Cc}\p{Cf}]/u.test(raw)||!/^\p{L}[\p{L}\p{M}]*\.?(?:[ '\-]\p{L}[\p{L}\p{M}]*\.?)*$/u.test(part)||!/[\p{L}]/u.test(part))return bad(title+'ใช้ตัวอักษรได้ รวมช่องว่าง ขีดกลาง และเครื่องหมายในชื่อ กรุณานำตัวเลข อีโมจิ ลิงก์ หรืออักขระพิเศษออก');
  const lower=part.toLocaleLowerCase('en-US');
  if(placeholders.has(lower)||placeholders.has(lower.replace(/[ .'-]/g,'')))flags.push('placeholder');
  if(offensive.has(lower)||offensive.has(lower.replace(/[ .'-]/g,'')))flags.push('offensive');
  const letters=lower.replace(/[ .'-]/g,'');
  // Thai น and ก may repeat exactly three times; longer runs still need review.
  if(/([^นก])\1{2,}|([นก])\2{3,}/u.test(letters)||/^(.{2,4})\1+$/u.test(letters))flags.push('repeated');
  if(/(?:asdf|qwerty|zxcv|hjkl|กดหก|ฟหกด)/iu.test(lower))flags.push('keyboard');
  const latin=lower.normalize('NFD').replace(/\p{M}/gu,'');
  // Check whole vowelless words rather than shorter internal clusters: Schmidt
  // and Christopher are ordinary names, and y can supply a vowel (Lynn, Rhys).
  const vowellessLatin=latin.split(/[ .'-]/).some(word=>/^[a-z]{4,}$/.test(word)&&!/[aeiouy]/.test(word));
  if(/\p{Script=Latin}/u.test(lower)&&(vowellessLatin||/(?:fv|vf|zx|xz|jq|qj|wq|qw|q(?!u)|[bcdfghjklmnpqrstvwxz]{6,})/i.test(latin)))flags.push('unusual_latin');
  // Thai can have implied vowels (พร, กนก), so absence of written vowels is
  // not suspicious by itself. Review incompatible vowel/mark order instead.
  if(/[ัิีึืุู็]{2,}|[ัิีึืุู็][่้๊๋]?(?:ำ|ํา)|[่้๊๋]{2,}|[่้๊๋][ัิีึืุู็]|[เแโใไ](?![ก-ฮ])/u.test(lower))flags.push('unusual_thai');
  for(const word of part.split(/[ '\-]/))if(/\p{Script=Latin}/u.test(word)&&/[\p{Script=Thai}\p{Script=Cyrillic}]/u.test(word))flags.push('mixed_script');
 }
 if(firstName&&lastName&&firstName.toLocaleLowerCase()===lastName.toLocaleLowerCase())flags.push('same_parts');
 return {valid:true,error:'',firstName,lastName,name:firstName+' '+lastName,flags:[...new Set(flags)]};
}
export function readNameInput(input){
 if('firstName' in input||'lastName' in input)return assessName(input.firstName,input.lastName);
 // Old tabs may still submit the former full-name field; they go through the
 // same checks, and cannot supply their own flags, approval or identity.
 const full=normalize(input.name),parts=full.split(' ');
 return assessName(parts.shift(),parts.join(' '));
}
export const nameApprovalRequired=status=>status==='pending'||status==='needs_change';
export function nameStatusLabel(status){return ({pending:'รออนุมัติชื่อ',needs_change:'ขอให้แก้ชื่อ',approved:'ผู้สอนอนุมัติแล้ว',format_ok:'อนุมัติอัตโนมัติ',legacy:'ข้อมูลเดิม'})[status]||'ข้อมูลเดิม'}
