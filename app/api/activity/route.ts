import {db,identity,ownerId,origin,answer,error,fail} from '../../../lib/server';
import {thaiDay} from '../../../lib/assistant-policy.mjs';
export async function POST(req:Request){try{
 origin(req);const user=await identity();
 if(user.userId===await ownerId())return answer({ok:true,excluded:true});
 const body=await req.json() as {pageView?:boolean};if(!body||typeof body.pageView!=='boolean')fail(400,'ข้อมูลการเข้าชมไม่ถูกต้อง');
 const now=Date.now(),day=thaiDay(now),key='activity:'+user.userId+':'+Math.floor(now/60000);
 const limit=await db().prepare('INSERT INTO login_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,now+120000).first<{count:number}>();
 if((limit?.count||0)>40)return answer({ok:true,limited:true});
 await db().batch([
  db().prepare('INSERT INTO site_daily_activity (day,user_id,page_views,first_seen,last_seen) VALUES (?,?,?,?,?) ON CONFLICT(day,user_id) DO UPDATE SET page_views=page_views+excluded.page_views,last_seen=MAX(last_seen,excluded.last_seen)').bind(day,user.userId,body.pageView?1:0,now,now),
  db().prepare('DELETE FROM site_daily_activity WHERE day<?').bind(thaiDay(now-89*86400000)),
  db().prepare('DELETE FROM login_limits WHERE expires<?').bind(now)
 ]);return answer({ok:true});
}catch(e){return error(e)}}
