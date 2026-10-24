import {env} from 'cloudflare:workers';
import {cookies} from 'next/headers';
import {SESSION_COOKIE,digest} from './password.mjs';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {hasAccess} from './policy.mjs';
import {nameApprovalRequired} from './name-policy.mjs';
export const db=()=>env.DB!;
export const bucket=()=>env.BUCKET!;
export class ApiError extends Error {constructor(public status:number,message:string){super(message)}}
export function fail(status:number,message:string):never{throw new ApiError(status,message)}
export async function identity(){
 const jar=await cookies();const token=jar.get(SESSION_COOKIE)?.value;
 if(token&&/^[a-f0-9]{64}$/.test(token)){
 const a=await db().prepare('SELECT a.user_id,a.username,a.name,a.email,a.name_status FROM login_sessions s JOIN login_accounts a ON a.user_id=s.user_id WHERE s.token_hash=? AND s.expires>? AND a.disabled=0 AND a.version=s.account_version').bind(digest(token),Date.now()).first<any>();
 if(a)return {userId:a.user_id,email:a.email,displayName:a.name,fullName:a.name,username:a.username,nameStatus:a.name_status,authMethod:'password'};
 }
 // Preserve the platform sign-in solely for the existing owner to set up or recover their account.
 // A signed-out cookie suppresses this fallback until the owner explicitly chooses recovery.
 if(!jar.get('yingyai-owner-signed-out')){const u=await getChatGPTUser();if(u&&await ownerId()===u.userId)return {...u,username:'',nameStatus:'approved',authMethod:'owner-recovery'};}
 fail(401,'กรุณาเข้าสู่ระบบด้วย username และ password');
}
export async function ownerId(){return (await db().prepare("SELECT value FROM settings WHERE key='owner'").first<{value:string}>())?.value;}
export async function admin(){const u=await identity();if(await ownerId()!==u.userId)fail(403,'เฉพาะผู้สอนเท่านั้น');return u;}
export function origin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)fail(403,'คำขอไม่ถูกต้อง กรุณารีเฟรชหน้าเว็บ');}
export function str(v:unknown,max=200){if(typeof v!=='string'||!v.trim()||v.length>max)fail(400,'กรุณากรอกข้อมูลให้ครบและไม่ยาวเกินกำหนด');return v.trim();}
export function email(v:unknown){const s=str(v).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail(400,'อีเมลไม่ถูกต้อง');return s;}
export function answer(x:unknown,status=200){return Response.json(x,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function error(e:unknown){if(e instanceof ApiError)return answer({error:e.message},e.status);console.error('Classroom operation failed',e);return answer({error:'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'},500);}
export async function courseAccess(userId:string,courseId:string){if(await ownerId()===userId)return true;const account=await db().prepare('SELECT disabled,name_status FROM login_accounts WHERE user_id=?').bind(userId).first<{disabled:number;name_status:string}>();if(!account||account.disabled||nameApprovalRequired(account.name_status))return false;const c=await db().prepare('SELECT published,visibility FROM courses WHERE id=?').bind(courseId).first<{published:number;visibility:string}>();if(!c?.published)return false;if(c.visibility==='all')return true;const es=await db().prepare('SELECT * FROM enrollments WHERE user_id=? AND course_id=?').bind(userId,courseId).all();return hasAccess(es.results,userId,courseId);}
