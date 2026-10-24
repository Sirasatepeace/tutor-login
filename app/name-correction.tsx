'use client';
import {useState} from 'react';
import {Check,LoaderCircle} from 'lucide-react';
import NameFields from './name-fields';
export default function NameCorrection({user,reload}:{user:Record<string,any>;reload:()=>Promise<any>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!['pending','needs_change'].includes(user.nameStatus))return null;
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');const f=new FormData(event.currentTarget);
  try{const response=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'updateName',firstName:f.get('firstName'),lastName:f.get('lastName'),nameConfirmed:f.get('nameConfirmed')==='yes',nameVersion:user.nameVersion})});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'แก้ไขชื่อไม่สำเร็จ');await reload()}catch(e:any){setError(e.message)}finally{setBusy(false)}
 }
 return <section className="name-correction panel"><strong>{user.nameStatus==='needs_change'?'ผู้สอนขอให้แก้ชื่อ–นามสกุล':'ชื่อของคุณอยู่ระหว่างรอผู้สอนตรวจสอบ'}</strong><p>{user.nameReviewNote||'แก้เป็นชื่อ–นามสกุลจริงได้ที่นี่ ชื่อที่ผ่านการตรวจจะอนุมัติอัตโนมัติ หากยังมีคำเตือนจะรอผู้สอนอนุมัติ'}</p><details open={user.nameStatus==='needs_change'}><summary>ตรวจและแก้ชื่อ–นามสกุล</summary><form onSubmit={save}><fieldset disabled={busy}><NameFields key={user.nameVersion} firstName={user.firstName} lastName={user.lastName}/>{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>} บันทึกชื่อที่แก้แล้ว</button></fieldset></form></details></section>;
}
