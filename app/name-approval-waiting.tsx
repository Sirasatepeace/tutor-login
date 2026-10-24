'use client';
import {useEffect,useState} from 'react';
import {BookOpen,Clock,RefreshCw,LogOut} from 'lucide-react';
import NameCorrection from './name-correction';
export default function NameApprovalWaiting({user,error,onRefresh,onLogout}:{user:Record<string,any>;error:string;onRefresh:()=>Promise<any>;onLogout:()=>Promise<void>}){
 const [checking,setChecking]=useState(false);
 useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')void onRefresh()},30000);return()=>clearInterval(timer)},[onRefresh]);
 async function refresh(){setChecking(true);try{await onRefresh()}finally{setChecking(false)}}
 return <main className="name-waiting-screen"><section className="name-waiting-card"><div className="brand"><span className="brand-icon"><BookOpen size={23}/></span><span>Yingyai<span className="brand-sub">CLASSROOM</span></span></div><span className="name-waiting-icon"><Clock size={30}/></span><h1>บัญชีของคุณรออนุมัติชื่อ</h1><p>ชื่อที่ส่งมาต้องให้ผู้สอนตรวจสอบก่อน จึงยังเปิดบทเรียน วิดีโอ หรือข้อสอบไม่ได้</p><p>คุณสามารถแก้ชื่อด้านล่าง หากชื่อผ่านการตรวจอัตโนมัติ จะเข้าใช้งานได้ทันที</p><NameCorrection key={user.nameVersion} user={user} reload={onRefresh}/>{error&&<p className="form-error" role="alert">{error}</p>}<div className="name-waiting-actions"><button className="btn primary" disabled={checking} onClick={refresh}><RefreshCw size={16} className={checking?'spin':''}/>{checking?'กำลังตรวจสถานะ':'ตรวจสถานะอนุมัติ'}</button><button className="btn" onClick={onLogout}><LogOut size={16}/> ออกจากระบบ</button></div><small>ระบบตรวจสถานะให้อัตโนมัติทุก 30 วินาทีขณะเปิดหน้านี้</small></section></main>;
}
