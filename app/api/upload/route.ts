import {db,bucket,admin,origin,str,answer,error,fail} from '../../../lib/server';
import {UPLOAD_CHUNK_BYTES as CHUNK,uploadSizeAllowed,uploadLimitMessage} from '../../../lib/upload-policy.mjs';
export async function POST(req:Request){try{origin(req);await admin();const b=await req.json() as any;
if(b.op==='start'){
 const lessonId=str(b.lessonId);if(!await db().prepare('SELECT id FROM lessons WHERE id=?').bind(lessonId).first())fail(404,'ไม่พบบทเรียน');
 const name=str(b.name,240);const kind=b.kind;const size=Number(b.size);
 if(!uploadSizeAllowed(kind,size))fail(400,uploadLimitMessage(kind));
 if(kind==='video'&&!/\.(mp4|webm)$/i.test(name)||kind==='pdf'&&!/\.pdf$/i.test(name))fail(400,'รองรับ MP4, WebM และ PDF');
 const id=crypto.randomUUID(),key='protected/'+id;const upload=await bucket().createMultipartUpload(key,{httpMetadata:{contentType:kind==='pdf'?'application/pdf':/\.webm$/i.test(name)?'video/webm':'video/mp4'}});
 await db().prepare('INSERT INTO uploads (id,lesson_id,name,kind,size,object_key,upload_id,created) VALUES (?,?,?,?,?,?,?,?)').bind(id,lessonId,name,kind,size,key,upload.uploadId,Date.now()).run();return answer({id,chunkSize:CHUNK});
}
const row=await db().prepare('SELECT * FROM uploads WHERE id=?').bind(str(b.id)).first<any>();if(!row)fail(404,'ไม่พบรายการอัปโหลด');
const upload=bucket().resumeMultipartUpload(row.object_key,row.upload_id);
if(b.op==='cancel'){await upload.abort();await db().prepare('DELETE FROM uploads WHERE id=?').bind(row.id).run();return answer({ok:true})}
if(b.op==='complete'){
 const total=Math.ceil(row.size/CHUNK);if(!Array.isArray(b.parts)||b.parts.length!==total||b.parts.some((p:any,i:number)=>p.partNumber!==i+1||typeof p.etag!=='string'))fail(400,'ส่วนของไฟล์ไม่ครบ');
 const obj=await upload.complete(b.parts);if(obj.size!==row.size){await bucket().delete(row.object_key);fail(400,'ขนาดไฟล์ไม่ตรงกัน กรุณาอัปโหลดใหม่')}
 await db().batch([db().prepare('INSERT INTO files (id,lesson_id,name,kind,size,object_key,created) VALUES (?,?,?,?,?,?,?)').bind(row.id,row.lesson_id,row.name,row.kind,row.size,row.object_key,Date.now()),db().prepare('DELETE FROM uploads WHERE id=?').bind(row.id)]);return answer({ok:true});
}fail(400,'คำสั่งไม่ถูกต้อง');}catch(e){return error(e)}}
export async function PUT(req:Request){try{origin(req);await admin();const url=new URL(req.url);const id=str(url.searchParams.get('id'));const n=Number(url.searchParams.get('part'));const row=await db().prepare('SELECT * FROM uploads WHERE id=?').bind(id).first<any>();if(!row)fail(404,'ไม่พบรายการอัปโหลด');if(!Number.isInteger(n)||n<1||n>Math.ceil(row.size/CHUNK))fail(400,'ลำดับไฟล์ไม่ถูกต้อง');const data=await req.arrayBuffer();const expected=Math.min(CHUNK,row.size-(n-1)*CHUNK);if(data.byteLength!==expected)fail(400,'ขนาดส่วนของไฟล์ไม่ถูกต้อง');const r=await bucket().resumeMultipartUpload(row.object_key,row.upload_id).uploadPart(n,data);return answer(r);}catch(e){return error(e)}}
