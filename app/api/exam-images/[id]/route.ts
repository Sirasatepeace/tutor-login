import {db,bucket,identity,ownerId,courseAccess,error,fail} from '../../../../lib/server';

export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const user=await identity(),{id}=await ctx.params;
 const image=await db().prepare('SELECT * FROM exam_images WHERE id=?').bind(id).first<any>();
 if(!image||!await courseAccess(user.userId,image.course_id))fail(403,'ไม่มีสิทธิ์เปิดรูปภาพนี้');
 if(await ownerId()!==user.userId){
  const linked=await db().prepare("SELECT e.id FROM exams e, json_each(e.questions) q WHERE e.course_id=? AND e.published=1 AND json_extract(q.value,'$.imageId')=? LIMIT 1").bind(image.course_id,id).first();
  if(!linked)fail(403,'รูปภาพนี้ยังไม่เปิดให้ผู้เรียน');
 }
 const object=await bucket().get(image.object_key);if(!object)fail(404,'ไม่พบรูปภาพ');
 return new Response(object.body,{headers:{'Content-Type':image.content_type,'Content-Length':String(image.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(e){return error(e)}}
