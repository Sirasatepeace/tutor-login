'use client';
import {useState} from 'react';
import {Plus,KeyRound,Lock,UserRound,ShieldCheck,X,Eye,EyeOff,Check,Copy,LoaderCircle} from 'lucide-react';
import SchoolAutocomplete from './school-autocomplete';
import NameFields from './name-fields';
import {NAME_FLAG_LABELS,nameStatusLabel} from '../lib/name-policy.mjs';
type Row=Record<string,any>;
export async function authApi(body:Row){const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d:any=await r.json();if(!r.ok)throw Error(d.error||'ดำเนินการไม่สำเร็จ');return d;}
function StudentProfileFields({required=true}:{required?:boolean}){
 return <div className="student-profile-fields">
  <NameFields instructor={!required}/>
  <div className="profile-field-row">
   <label>ชื่อเล่น{!required&&' (ไม่บังคับ)'}<input name="nickname" required={required} maxLength={80} placeholder="ชื่อเล่นของคุณ"/></label>
   <label>ชั้นเรียน{!required&&' (ไม่บังคับ)'}<input name="grade" required={required} maxLength={80} placeholder="เช่น ม.4"/></label>
  </div>
  <SchoolAutocomplete required={required}/>
 </div>
}
export function Login({onLogin}:{onLogin:()=>Promise<any>}){
 const [mode,setMode]=useState<'login'|'register'>('login'),[busy,setBusy]=useState(false),[err,setErr]=useState(''),[show,setShow]=useState(false),[registeredUsername,setRegisteredUsername]=useState('');
 const [registeredPending,setRegisteredPending]=useState(false);
 const register=mode==='register';
 function switchMode(next:'login'|'register'){setMode(next);setErr('');setShow(false);setRegisteredUsername('');setRegisteredPending(false)}
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();const f=new FormData(e.currentTarget);setErr('');
  if(register&&f.get('password')!==f.get('confirmPassword')){setErr('รหัสผ่านทั้งสองช่องไม่ตรงกัน');return}
  setBusy(true);
  try{
   if(register){
    const result=await authApi({op:'register',username:f.get('username'),password:f.get('password'),firstName:f.get('firstName'),lastName:f.get('lastName'),nameConfirmed:f.get('nameConfirmed')==='yes',nickname:f.get('nickname'),grade:f.get('grade'),school:f.get('school')});
    setRegisteredUsername(result.username);setRegisteredPending(!!result.approvalRequired);setMode('login');setShow(false);
   }else{await authApi({op:'login',username:f.get('username'),password:f.get('password')});await onLogin()}
  }catch(e:any){setErr(e.message)}finally{setBusy(false)}
 }
 return <main className="login-screen">
  <section className="login-welcome">
   <div className="brand"><span className="brand-icon"><UserRound/></span><span>Yingyai<span className="brand-sub">CLASSROOM</span></span></div>
   <span className="eyebrow">YOUR NEXT CHAPTER</span><h1>พื้นที่ของความรู้<br/>พร้อมให้คุณเริ่มต้น</h1>
   <p>เปิดบทเรียน ทบทวนวิดีโอ และเรียนรู้<br/>ในจังหวะที่เป็นของคุณ</p>
   <div className="login-illustration" aria-hidden="true"><div className="book book-back"/><div className="book book-front"><span>Y.</span><p>LEARN A LITTLE<br/>EVERY DAY</p></div></div>
   <small><ShieldCheck size={15}/> สมัครบัญชี แล้วค้นพบบทเรียนของคุณ</small>
  </section>
  <section className="login-form-wrap">
   <div className="login-form">
    <div className="auth-tabs" aria-label="เลือกเข้าสู่ระบบหรือสมัครบัญชี">
     <button type="button" aria-pressed={!register} className={!register?'selected':''} disabled={busy} onClick={()=>switchMode('login')}>เข้าสู่ระบบ</button>
     <button type="button" aria-pressed={register} className={register?'selected':''} disabled={busy} onClick={()=>switchMode('register')}>สมัครบัญชี</button>
    </div>
    <span className="eyebrow">{register?'JOIN YOUR CLASSROOM':'WELCOME BACK'}</span>
    <h2>{register?'สมัครบัญชีนักเรียน':'เข้าสู่ห้องเรียน'}</h2>
    <p>{register?'ตั้งข้อมูลเข้าสู่ระบบของคุณ ผู้สอนเป็นผู้ดูแลสิทธิ์เข้าเรียน':'เข้าสู่ระบบด้วย username และ password ของคุณ'}</p>
    {registeredUsername&&<div className="auth-success" role="status"><Check size={18}/><span>{registeredPending?'รับคำขอสมัครแล้ว บัญชีรอผู้สอนอนุมัติชื่อ สามารถเข้าสู่ระบบเพื่อตรวจสถานะหรือแก้ชื่อได้':'ชื่อผ่านการตรวจอัตโนมัติแล้ว เข้าสู่ระบบเพื่อเริ่มใช้งานได้เลย'}</span></div>}
    {err&&<div className="alert error" role="alert">{err}</div>}
    <form key={mode+registeredUsername} onSubmit={submit}>
     <fieldset className="auth-fields" disabled={busy}>
      <label>Username<input name="username" autoComplete="username" defaultValue={registeredUsername} required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}" placeholder="ชื่อผู้ใช้ของคุณ" autoCapitalize="none" spellCheck={false}/>{register&&<small>3–40 ตัว ใช้ a–z, 0–9, จุด, ขีดกลาง หรือขีดล่าง</small>}</label>
      <label>Password<div className="password-field"><input name="password" type={show?'text':'password'} autoComplete={register?'new-password':'current-password'} required minLength={register?12:undefined} maxLength={128} placeholder={register?'อย่างน้อย 12 ตัวอักษร':'รหัสผ่านของคุณ'}/><button type="button" className="icon-btn" onClick={()=>setShow(!show)} aria-label={show?'ซ่อนรหัสผ่าน':'แสดงรหัสผ่าน'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
      {register&&<>
       <label>ยืนยัน Password<input name="confirmPassword" type={show?'text':'password'} autoComplete="new-password" required minLength={12} maxLength={128} placeholder="กรอกรหัสผ่านอีกครั้ง"/></label>
       <div className="signup-profile"><h3>ข้อมูลผู้เรียน</h3><StudentProfileFields/></div>
       <p className="auth-note">ชื่อที่ผ่านการตรวจจะอนุมัติอัตโนมัติ หากยืนยันส่งชื่อที่ถูกแจ้งเตือน จะต้องรอผู้สอนอนุมัติก่อนเข้าเรียน</p>
      </>}
      <button className="btn primary login-submit" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:register?<UserRound size={16}/>:<Lock size={16}/>} {register?'สร้างบัญชีนักเรียน':'เข้าสู่ระบบ'}</button>
     </fieldset>
    </form>
   </div>
  </section>
 </main>
}
export default function Accounts({data,reload}:{data:Row;reload:()=>Promise<any>}){
 const [modal,setModal]=useState<string|null>(null),[selected,setSelected]=useState<Row|null>(null),[err,setErr]=useState(''),[busy,setBusy]=useState(false),[pw,setPw]=useState(''),[show,setShow]=useState(false),[message,setMessage]=useState('');
 const [nameFilter,setNameFilter]=useState('all'),[reviewNote,setReviewNote]=useState('');
 const pendingNames=data.accounts.filter((a:Row)=>a.user_id!==data.user.id&&a.name_status==='pending');
 const visibleAccounts=data.accounts.filter((a:Row)=>nameFilter==='all'||a.name_status===nameFilter);
 const flags=(a:Row)=>{try{const parsed=JSON.parse(a.name_flags||'[]');return Array.isArray(parsed)?parsed.filter((v:unknown)=>typeof v==='string'):[]}catch{return []}};
 const own=data.accounts.find((a:Row)=>a.user_id===data.user.id);const legacy=[...new Map<string,Row>(data.enrollments.filter((e:Row)=>e.user_id&&e.user_id!==data.user.id&&!data.accounts.some((a:Row)=>a.user_id===e.user_id)).map((e:Row)=>[e.user_id,e])).values()];
 function open(kind:string,a:Row|null=null){setSelected(a);setModal(kind);setReviewNote(a?.name_review_note||'กรุณากรอกชื่อและนามสกุลให้ตรงกับชื่อจริง');setPw('');setShow(false);setErr('');setMessage('')}
 async function perform(body:Row){setBusy(true);setErr('');try{const r=await authApi(body);if(r.relogin){await authApi({op:'logout'});window.location.assign('/');return}await reload();setModal(null);setPw('');setMessage('บันทึกบัญชีเรียบร้อย');}catch(e:any){setErr(e.message)}finally{setBusy(false)}}
 function generate(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#_';const bytes=crypto.getRandomValues(new Uint8Array(20));setPw(Array.from(bytes,b=>chars[b%chars.length]).join(''));setShow(true)}
 return <><div className="section-top"><div><span className="eyebrow">ACCOUNTS & SECURITY</span><h1>บัญชีเข้าสู่ระบบ</h1><p>ดูข้อมูลผู้สมัคร จัดการบัญชี และกำหนดสิทธิ์เข้าเรียน</p></div><button className="btn primary" onClick={()=>open('create')}><Plus size={18}/> สร้างบัญชีนักเรียน</button></div>
 {!own&&<div className="setup"><div><h2>ตั้งค่าบัญชีผู้สอนของคุณ</h2><p>สร้าง username/password เพื่อเข้าสู่เว็บได้โดยตรงครั้งถัดไป</p></div><button className="btn primary" onClick={()=>open('owner')}><KeyRound size={17}/> ตั้งค่า username/password</button></div>}
 <div className="info-note"><ShieldCheck size={20}/><div><strong>นักเรียนสมัครเองได้ คุณเป็นผู้ดูแลสิทธิ์ทั้งหมด</strong><p>ชื่อปกติอนุมัติอัตโนมัติและเข้าคอร์สแบบทุกคนได้หลังล็อกอิน ส่วนชื่อที่ถูกแจ้งเตือนจะรอคุณอนุมัติก่อนเข้าเรียน สำหรับคอร์สจำกัดสิทธิ์ ให้คุณเพิ่มรายชื่อใน “นักเรียนและสิทธิ์” คุณยังเป็นผู้เปลี่ยนรหัสผ่านและระงับบัญชี การเปลี่ยนรหัสหรือระงับบัญชีจะยกเลิกการเข้าสู่ระบบเดิม</p></div></div>
 {message&&<p className="account-success" role="status"><Check size={16}/> {message}</p>}{err&&!modal&&<p className="alert error" role="alert">{err}</p>}
 <section className="panel name-review-queue"><div><h2>ตรวจสอบชื่อผู้เรียน</h2><p>มี {pendingNames.length} ชื่อรอตรวจ · รูปแบบที่น่าสงสัยเป็นเพียงตัวช่วยคัดกรอง คุณเป็นผู้ยืนยันชื่อ</p></div><div className="name-review-filters"><label>แสดงบัญชี<select value={nameFilter} onChange={e=>setNameFilter(e.target.value)}><option value="all">บัญชีทั้งหมด</option><option value="pending">ชื่อรอตรวจสอบ</option><option value="needs_change">ขอให้แก้ชื่อแล้ว</option></select></label>{pendingNames.length>0&&<button className="btn" onClick={()=>setNameFilter('pending')}>ดูชื่อรอตรวจ {pendingNames.length} คน</button>}</div></section>
 <div className="panel table-panel"><table><thead><tr><th>ชื่อ–สกุล / Username</th><th>ชื่อเล่น</th><th>ชั้นเรียน / โรงเรียน</th><th>บทบาท</th><th>สถานะ</th><th>เครื่องที่ล็อกอินอยู่</th><th>จัดการบัญชี</th></tr></thead><tbody>{visibleAccounts.map((a:Row)=><tr key={a.user_id}><td><b>{a.name}</b><small>@{a.username}</small>{a.user_id!==data.user.id&&<span className={'name-status '+(a.name_status||'legacy')}>{nameStatusLabel(a.name_status)}</span>}</td><td>{a.nickname||'—'}</td><td className="account-school"><b>{a.grade||'—'}</b><small>{a.school||'—'}</small></td><td>{a.user_id===data.user.id?'ผู้สอน':'นักเรียน'}</td><td><span className={'pill '+(!a.disabled?'live':'')}>{a.disabled?'ระงับบัญชี':'เปิดใช้งาน'}</span></td><td><span className={'pill '+(Number(a.active_devices)>0?'live':'')}>{Number(a.active_devices||0)} เครื่อง</span></td><td><div className="account-actions"><button className="btn small" onClick={()=>open('reset',a)}><KeyRound size={13}/> เปลี่ยนรหัส</button>{a.user_id!==data.user.id&&<button className="btn small" disabled={busy} onClick={()=>open('nameReview',a)}>ตรวจชื่อ</button>}{a.user_id!==data.user.id&&<button className="btn small" disabled={busy} onClick={()=>perform({op:'disable',userId:a.user_id,disabled:!a.disabled})}>{a.disabled?'เปิดใช้งาน':'ระงับบัญชี'}</button>}</div></td></tr>)}</tbody></table>{!visibleAccounts.length&&<div className="empty"><UserRound size={32}/><h3>ไม่มีบัญชีในรายการนี้</h3><p>เลือกบัญชีทั้งหมด หรือรอผู้สมัครรายใหม่</p></div>}</div>
 <section className="login-history"><div className="section-top"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>ประวัติการเข้าสู่ระบบ</h2><p>แสดงสูงสุด 200 รายการล่าสุด ภายใน 1 ปี</p></div></div><div className="panel table-panel"><table><thead><tr><th>วันและเวลา</th><th>บัญชี</th><th>กิจกรรม</th><th>อุปกรณ์ / เบราว์เซอร์</th><th>สถานะตอนนี้</th></tr></thead><tbody>{(data.authEvents||[]).map((event:Row)=><tr key={event.id}><td>{new Date(event.created).toLocaleString('th-TH',{timeZone:'Asia/Bangkok',dateStyle:'medium',timeStyle:'short'})}</td><td>@{event.username}</td><td>{event.event==='login'?'เข้าสู่ระบบ':event.event==='logout'?'ออกจากระบบ':'ออกจากระบบโดยผู้สอน'}</td><td>อุปกรณ์ · {String(event.device_id).slice(-6).toUpperCase()}</td><td>{(data.activeDeviceIds||[]).some((d:Row)=>d.user_id===event.user_id&&d.device_id===event.device_id)?<span className="pill live">ยังล็อกอินอยู่</span>:<span className="pill">สิ้นสุดเซสชันแล้ว</span>}</td></tr>)}</tbody></table>{!(data.authEvents||[]).length&&<div className="empty"><Lock size={29}/><h3>ยังไม่มีประวัติการเข้าสู่ระบบ</h3><p>กิจกรรมล็อกอินของบัญชีจะปรากฏที่นี่</p></div>}</div><p className="login-history-note">นับตามเบราว์เซอร์ที่ได้รับคุกกี้อุปกรณ์ อาจนับเบราว์เซอร์หรือโปรไฟล์เดียวกันเป็นหลายเครื่องถ้าแยกโปรไฟล์หรือลบคุกกี้ · ไม่บันทึก IP</p></section>
 {modal&&modal!=='nameReview'&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="account-title"><button className="modal-close icon-btn" onClick={()=>{if(!busy){setModal(null);setPw('')}}} disabled={busy} aria-label="ปิด"><X/></button><span className="eyebrow">LOGIN DETAILS</span><h2 id="account-title">{modal==='owner'?'ตั้งค่าบัญชีผู้สอน':modal==='reset'?'เปลี่ยนรหัสผ่าน':'สร้างบัญชีนักเรียน'}</h2><p className="muted">{modal==='reset'?selected?.username:modal==='owner'?'ตั้งข้อมูลเข้าสู่ระบบสำหรับบัญชีผู้สอนของคุณ':'กรอกข้อมูลแล้วส่ง username/password ให้นักเรียนด้วยตัวเอง'}</p>{err&&<p className="form-error" role="alert">{err}</p>}<form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);perform({op:modal,userId:selected?.user_id,username:f.get('username'),firstName:f.get('firstName'),lastName:f.get('lastName'),nameConfirmed:f.get('nameConfirmed')==='yes',nickname:f.get('nickname'),grade:f.get('grade'),school:f.get('school'),email:f.get('email'),legacyUserId:f.get('legacy'),password:pw})}}>
 {modal==='create'&&<><StudentProfileFields required={false}/><label>อีเมลติดต่อ (ไม่บังคับ)<input name="email" type="email" maxLength={200}/></label>{legacy.length>0&&<label>เชื่อมสิทธิ์ของผู้เรียนเดิม (ไม่บังคับ)<select name="legacy"><option value="">สร้างเป็นผู้เรียนใหม่</option>{legacy.map(e=><option key={e.user_id} value={e.user_id}>{e.name} — {e.email}</option>)}</select><small>เลือกเฉพาะเมื่อเป็นคนเดียวกัน เพื่อรักษาคอร์สและประวัติการเรียนเดิม</small></label>}</>}
 {modal!=='reset'&&<label>Username<input name="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9._\-]{2,39}" autoCapitalize="none" autoComplete="off" spellCheck={false} placeholder="เช่น student001"/><small>3–40 ตัว ใช้ a–z, 0–9, จุด, ขีดกลาง หรือขีดล่าง</small></label>}
 <label>{modal==='reset'?'รหัสผ่านใหม่':'Password'}<div className="password-field"><input type={show?'text':'password'} value={pw} onChange={e=>setPw(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required placeholder="อย่างน้อย 12 ตัวอักษร"/><button type="button" className="icon-btn" onClick={()=>setShow(!show)} aria-label="แสดงหรือซ่อนรหัสผ่าน">{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label><div className="account-actions"><button type="button" className="btn small" onClick={generate}>สุ่มรหัสผ่าน</button><button type="button" className="btn small" disabled={!pw} onClick={async()=>{try{await navigator.clipboard.writeText(pw);setMessage('คัดลอกรหัสผ่านแล้ว')}catch{setMessage('คัดลอกอัตโนมัติไม่ได้ กดแสดงรหัสแล้วคัดลอกด้วยตัวเอง')}}}><Copy size={13}/> คัดลอกรหัส</button></div>{message&&<p className="muted" role="status">{message}</p>}<p className="muted account-hint">เก็บรหัสผ่านไว้ก่อนบันทึก ระบบไม่ส่งข้อความหรืออีเมลให้นักเรียนอัตโนมัติ</p><div className="modal-actions"><button className="btn" type="button" disabled={busy} onClick={()=>{setModal(null);setPw('')}}>ยกเลิก</button><button className="btn primary" disabled={busy}>{busy?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} บันทึก</button></div></form></section></div>}
 {modal==='nameReview'&&selected&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="name-review-title"><button className="modal-close icon-btn" disabled={busy} onClick={()=>setModal(null)} aria-label="ปิด"><X/></button><h2 id="name-review-title">ตรวจชื่อ–นามสกุล</h2><p className="muted">@{selected.username}</p><div className="name-review-profile"><strong>{selected.name}</strong><span className={'name-status '+selected.name_status}>{nameStatusLabel(selected.name_status)}</span>{flags(selected).length>0&&<ul>{flags(selected).map((flag:string)=><li key={flag}>{NAME_FLAG_LABELS[flag as keyof typeof NAME_FLAG_LABELS]||'รูปแบบชื่อควรตรวจสอบ'}</li>)}</ul>}<p>เครื่องมือนี้คัดกรองรูปแบบ ไม่ได้ยืนยันตัวตน โปรดตรวจชื่อกับข้อมูลผู้เรียนที่คุณมี</p></div>{err&&<p className="form-error" role="alert">{err}</p>}<label>ข้อความขอให้ผู้เรียนแก้ชื่อ<textarea rows={3} maxLength={300} value={reviewNote} disabled={busy} onChange={e=>setReviewNote(e.target.value)}/></label><div className="modal-actions"><button className="btn" disabled={busy||!reviewNote.trim()} onClick={()=>perform({op:'reviewName',userId:selected.user_id,nameVersion:selected.name_version,action:'requestChange',note:reviewNote})}>ขอให้แก้ชื่อ</button><button className="btn primary" disabled={busy} onClick={()=>perform({op:'reviewName',userId:selected.user_id,nameVersion:selected.name_version,action:'approve'})}>{busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} ยืนยันชื่อนี้</button></div></section></div>}
 </>
}
