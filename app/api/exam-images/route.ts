import {db,bucket,admin,origin,str,answer,error,fail} from '../../../lib/server';
import {MAX_EXAM_IMAGE_BYTES,examImageType} from '../../../lib/exam-policy.mjs';

export async function POST(req:Request){try{
 origin(req);await admin();const url=new URL(req.url),courseId=str(url.searchParams.get('courseId')),name=str(url.searchParams.get('name'),200);
 if(!await db().prepare('SELECT id FROM courses WHERE id=?').bind(courseId).first())fail(404,'ไม่พบคอร์ส');
 if(!req.body||Number(req.headers.get('content-length'))>MAX_EXAM_IMAGE_BYTES)fail(413,'รูปภาพต้องมีขนาดไม่เกิน 5 MB');
 const reader=req.body.getReader(),chunks:Uint8Array[]=[];let length=0;
 while(true){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.byteLength;if(length>MAX_EXAM_IMAGE_BYTES){await reader.cancel();fail(413,'รูปภาพต้องมีขนาดไม่เกิน 5 MB')}chunks.push(chunk.value);}
 if(!length)fail(400,'ไฟล์รูปภาพว่างเปล่า');
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 const contentType=examImageType(bytes);if(!contentType)fail(400,'รองรับเฉพาะรูป PNG, JPG และ WebP');
 const id=crypto.randomUUID(),key='exam-images/'+id;
 await bucket().put(key,bytes,{httpMetadata:{contentType}});
 try{await db().prepare('INSERT INTO exam_images (id,course_id,name,content_type,size,object_key,created) VALUES (?,?,?,?,?,?,?)').bind(id,courseId,name,contentType,length,key,Date.now()).run();}catch(e){await bucket().delete(key);throw e}
 return answer({id});
}catch(e){return error(e)}}
