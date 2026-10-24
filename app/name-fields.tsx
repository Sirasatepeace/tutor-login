'use client';
import {useId,useState} from 'react';
import {assessName,NAME_FLAG_LABELS} from '../lib/name-policy.mjs';
export default function NameFields({firstName='',lastName='',instructor=false}:{firstName?:string;lastName?:string;instructor?:boolean}){
 const [first,setFirst]=useState(firstName),[last,setLast]=useState(lastName),id=useId();
 const result=assessName(first,last,{allowIncomplete:true}),hasAny=!!first.trim()||!!last.trim(),review=result.valid&&result.flags.length>0;
 return <div className={'name-fields '+(review?'requires-review':'')}>
  <div className="profile-field-row"><label htmlFor={id+'-first'}>ชื่อจริง<input id={id+'-first'} name="firstName" required maxLength={100} autoComplete="given-name" value={first} onChange={e=>setFirst(e.target.value)} placeholder="ชื่อจริง" aria-describedby={id+'-help'+(review?' '+id+'-warning':'')}/></label><label htmlFor={id+'-last'}>นามสกุล<input id={id+'-last'} name="lastName" required maxLength={100} autoComplete="family-name" value={last} onChange={e=>setLast(e.target.value)} placeholder="นามสกุลจริง" aria-describedby={id+'-help'+(review?' '+id+'-warning':'')}/></label></div>
  <p id={id+'-help'} className="name-help">ใช้ชื่อ–นามสกุลจริง เพื่อให้ผู้สอนตรวจสอบข้อมูลและสิทธิ์เข้าเรียน รองรับชื่อไทยและภาษาอื่น</p>
  {hasAny&&!result.valid&&<p className="name-invalid" role="status">{result.error}</p>}
  {review&&<div id={id+'-warning'} className="name-review-warning" role="status"><strong>กรุณาตรวจชื่อ–นามสกุลก่อนส่ง</strong><p>{result.flags.map(flag=>NAME_FLAG_LABELS[flag as keyof typeof NAME_FLAG_LABELS]).join(' · ')}</p>{instructor?<p>ชื่อที่คุณบันทึกจะถือว่าผู้สอนตรวจสอบแล้ว</p>:<><p>หากยืนยันส่งชื่อนี้ บัญชีจะรอผู้สอนอนุมัติก่อนเข้าเรียน ชื่อที่ผ่านการตรวจจะอนุมัติอัตโนมัติ</p><label className="name-confirm" key={result.name}><input type="checkbox" name="nameConfirmed" value="yes" required/><span>ยืนยันส่งชื่อนี้ และรับทราบว่าต้องรอผู้สอนอนุมัติก่อนเข้าเรียน</span></label></>}</div>}
 </div>;
}
