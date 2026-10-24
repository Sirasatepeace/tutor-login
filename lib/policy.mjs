export function hasAccess(enrollments,userId,courseId,now=Date.now()) {
 return enrollments.some(e=>e.user_id===userId && e.course_id===courseId && e.status==='active' && (!e.expires || e.expires>now));
}
export function parseRange(value,size) {
 if(!value)return null;
 const m=/^bytes=(\d*)-(\d*)$/.exec(value);
 if(!m || (!m[1]&&!m[2]))throw Error('range');
 let start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
 let end=m[1]?(m[2]?Math.min(Number(m[2]),size-1):size-1):size-1;
 if(start<0 || start>=size || end<start)throw Error('range');
 return {offset:start,length:end-start+1};
}
