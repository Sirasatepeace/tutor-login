import {scryptSync,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
export const SESSION_COOKIE='__Host-yingyai-session';
export const DEVICE_COOKIE='__Host-yingyai-device';
export const SESSION_SECONDS=7*24*60*60;
export const DEVICE_SECONDS=180*24*60*60;
export function normalizeUsername(value){return typeof value==='string'?value.trim().toLowerCase():''}
export function validUsername(value){return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(value)}
export function validPassword(value){return typeof value==='string'&&value.length>=12&&value.length<=128}
export function hashPassword(password){const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,32,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('hex');return `scrypt$32768$8$3$${salt}$${hash}`}
export function verifyPassword(password,stored){
 const parts=String(stored||'').split('$');
 if(parts.length!==6||parts[0]!=='scrypt'||parts[1]!=='32768'||parts[2]!=='8'||parts[3]!=='3'||!/^[a-f0-9]{32}$/.test(parts[4])||!/^[a-f0-9]{64}$/.test(parts[5]))return false;
 const result=scryptSync(password,parts[4],32,{N:32768,r:8,p:3,maxmem:64*1024*1024});
 return timingSafeEqual(result,Buffer.from(parts[5],'hex'));
}
export function randomSession(){return randomBytes(32).toString('hex')}
export function digest(value){return createHash('sha256').update(value).digest('hex')}
export function sessionCookie(token,maxAge=SESSION_SECONDS){return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`}
export function deviceCookie(token){return `${DEVICE_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${DEVICE_SECONDS}`}
