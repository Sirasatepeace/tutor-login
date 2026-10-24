'use client';
import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {LoaderCircle,Search} from 'lucide-react';
import {buildSchoolIndex,schoolSearchKey,suggestSchools,schoolInputValue} from '../lib/school-search.mjs';

type School={id:string;name:string;province:string;district:string;key:string;location:string};
let directoryRequest:Promise<School[]>|null=null;
function loadDirectory(){
 if(!directoryRequest)directoryRequest=fetch('/data/thai-schools-20261021.json').then(async response=>{
  if(!response.ok)throw Error('Directory unavailable');
  const data=await response.json();
  if(!data||typeof data!=='object'||!('schema' in data)||data.schema!==1||!('schools' in data))throw Error('Invalid school directory');
  return buildSchoolIndex(data.schools) as School[];
 }).catch(error=>{directoryRequest=null;throw error});
 return directoryRequest;
}

export default function SchoolAutocomplete({required=true}:{required?:boolean}){
 const id=useId(),listId=id+'-list',helpId=id+'-help';
 const container=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const [value,setValue]=useState(''),[schools,setSchools]=useState<School[]|null>(null),[attempt,setAttempt]=useState(0);
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 const matches=useMemo(()=>schools?suggestSchools(schools,value,10) as School[]:[],[schools,value]);
 const searching=!!schoolSearchKey(value),show=open&&searching;
 useEffect(()=>{
  if(!attempt)return;let current=true;setLoading(true);setFailed(false);
  loadDirectory().then(rows=>{if(current)setSchools(rows)}).catch(()=>{if(current)setFailed(true)}).finally(()=>{if(current)setLoading(false)});
  return()=>{current=false};
 },[attempt]);
 useEffect(()=>{
  if(active>=0)document.getElementById(listId+'-'+active)?.scrollIntoView({block:'nearest'});
 },[active,listId]);
 function requestDirectory(){if(!schools&&!loading&&(attempt===0||failed))setAttempt(n=>n+1)}
 function choose(school:School){input.current?.focus();setValue(schoolInputValue(school));setOpen(false);setActive(-1)}
 return <div className="school-field" ref={container} onBlur={event=>{if(!container.current?.contains(event.relatedTarget as Node|null))setOpen(false)}}>
  <label htmlFor={id}>โรงเรียน{!required&&' (ไม่บังคับ)'}</label>
  <div className="school-input-wrap">
   <input ref={input} id={id} name="school" required={required} maxLength={200} value={value} autoComplete="off" placeholder="พิมพ์ชื่อโรงเรียนเพื่อค้นหา" role="combobox" aria-autocomplete="list" aria-expanded={show&&matches.length>0} aria-controls={listId} aria-describedby={helpId} aria-activedescendant={show&&active>=0&&matches[active]?listId+'-'+active:undefined}
    onFocus={()=>{setOpen(true);requestDirectory()}}
    onChange={event=>{setValue(event.target.value);setOpen(true);setActive(-1);requestDirectory()}}
    onKeyDown={event=>{
     if(event.nativeEvent.isComposing)return;
     if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);setActive(-1);return}
     if(!matches.length)return;
     if(event.key==='ArrowDown'){event.preventDefault();setOpen(true);setActive(i=>Math.min(matches.length-1,i+1))}
     if(event.key==='ArrowUp'){event.preventDefault();setOpen(true);setActive(i=>i<=0?matches.length-1:i-1)}
     if(event.key==='Enter'&&show&&active>=0){event.preventDefault();choose(matches[active])}
    }}/>
   <span className="school-input-icon" aria-hidden="true">{loading?<LoaderCircle size={16} className="spin"/>:<Search size={16}/>}</span>
   {show&&<div className="school-suggestions">
   {loading?<p className="school-search-message" role="status">กำลังโหลดรายชื่อโรงเรียน…</p>:failed?<p className="school-search-message" role="status">โหลดรายชื่อไม่สำเร็จ คุณยังพิมพ์ชื่อโรงเรียนเองได้</p>:matches.length>0?<>
    <div className="school-options" id={listId} role="listbox" aria-label="โรงเรียนที่ตรงกับข้อความ">
     {matches.map((school,i)=><button type="button" tabIndex={-1} role="option" aria-selected={i===active} id={listId+'-'+i} key={school.id} className={'school-option '+(i===active?'selected':'')} onMouseDown={event=>event.preventDefault()} onMouseMove={()=>setActive(i)} onClick={()=>choose(school)}>
      <span>{school.name}</span><small>{[school.district,school.province].filter(Boolean).join(' · ')}</small>
     </button>)}
    </div>
    <p className="school-search-message school-search-tip">พิมพ์ชื่อเพิ่มเพื่อค้นหาให้เจาะจง หรือเติมจังหวัดเพื่อแยกโรงเรียนชื่อซ้ำ</p>
   </>:schools&&<p className="school-search-message" role="status">ไม่พบชื่อที่ตรงกัน คุณสามารถกรอกชื่อโรงเรียนเองได้</p>}
   </div>}
  </div>
  <small className="school-help" id={helpId}>เลือกชื่อที่แนะนำ หรือกรอกเองหากไม่พบหรือโรงเรียนเปลี่ยนชื่อ</small>
  <span className="sr-only" role="status">{show&&!loading&&!failed&&matches.length?`มีชื่อโรงเรียนแนะนำ ${matches.length} รายการ ใช้ลูกศรขึ้นลงและ Enter เพื่อเลือก`:''}</span>
 </div>
}
