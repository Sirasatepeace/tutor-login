import {db,bucket,identity,courseAccess,fail,error} from '../../../../lib/server';
import {parseRange} from '../../../../lib/policy.mjs';
export async function GET(req:Request,ctx:{params:Promise<{id:string}>}){try{
 const u=await identity();const {id}=await ctx.params;const f=await db().prepare('SELECT f.*,l.course_id FROM files f JOIN lessons l ON f.lesson_id=l.id WHERE f.id=?').bind(id).first<any>();if(!f)fail(404,'ไม่พบไฟล์');if(!await courseAccess(u.userId,f.course_id))fail(403,'ไม่มีสิทธิ์เปิดไฟล์นี้');
 let range;try{range=parseRange(req.headers.get('range'),f.size)}catch{return new Response(null,{status:416,headers:{'Content-Range':`bytes */${f.size}`}})}
 const object=await bucket().get(f.object_key,range?{range}:undefined);if(!object)fail(404,'ไม่พบไฟล์');const headers=new Headers({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Accept-Ranges':'bytes','Content-Type':f.kind==='pdf'?'application/pdf':/\.webm$/i.test(f.name)?'video/webm':'video/mp4','Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cross-Origin-Resource-Policy':'same-origin'});
 headers.set('Content-Length',String(range?range.length:f.size));if(range)headers.set('Content-Range',`bytes ${range.offset}-${range.offset+range.length-1}/${f.size}`);return new Response(object.body,{status:range?206:200,headers});
}catch(e){return error(e)}}
