import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const COURSE_DAYS = [0,0,0,1,1,2,2,2,3,3,4];
const COURSE_NAMES = ['פיתוח שמיעה מתקדמים','קומפוזיציה א׳','מוזיקה ואוכל','מלחין–מבצע','קונטרפונקט א׳','קבוצת ההתמחות עם עודד זהבי','תיאוריה וביקורת באמנויות הבימה','מוזיקה, ביטוי אישי ואותנטיות','הרמוניה למתקדמים א׳','תורת המקאם','ניתוח יצירות א׳'];
const START='2026-10-11', END='2027-02-10';
const formatParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
const iso = date => date.toISOString().slice(0,10);
const plusDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d)};
const sundayOf=day=>{const d=new Date(day+'T12:00:00Z');return plusDays(day,-d.getUTCDay())};
const inSemester = day=>day>=START && day<=END;
const chunks=(arr,n)=>Array.from({length:Math.ceil(arr.length/n)},(_,i)=>arr.slice(i*n,(i+1)*n));

export default async () => {
  const now=formatParts(new Date());
  if (Number(now.hour)!==10) return;
  const today=`${now.year}-${now.month}-${now.day}`;
  const weekday=new Date(today+'T12:00:00Z').getUTCDay();
  const isSummary=weekday===6;
  const target=weekday===5?plusDays(today,2):plusDays(today,1);
  const targetWeek=sundayOf(isSummary?today:target);
  if (!isSummary && (weekday===6 || !inSemester(target))) return;
  if (isSummary && !inSemester(plusDays(targetWeek,0))) return;
  const {SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT}=process.env;
  if (![SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT].every(Boolean)) throw new Error('Missing server env');
  webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
  const db=createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  let offset=0;
  while (true) {
    const {data:subs,error}=await db.from('push_subscriptions').select('user_id,endpoint,subscription').range(offset,offset+499);
    if(error)throw error;
    if(!subs?.length)break;
    const byUser=new Map();for(const s of subs){if(!byUser.has(s.user_id))byUser.set(s.user_id,[]);byUser.get(s.user_id).push(s)}
    for(const [userId,userSubs] of byUser){
      const indices=COURSE_DAYS.map((d,i)=>({d,i})).filter(x=>isSummary?inSemester(plusDays(targetWeek,x.d)):plusDays(targetWeek,x.d)===target).map(x=>x.i);
      const keys=indices.map(i=>`${targetWeek}|${i}`);
      const {data:checks,error:checkError}=await db.from('study_checks').select('task_key,done').eq('user_id',userId).in('task_key',keys);
      if(checkError){console.error('checks failed',checkError);continue}
      const done=new Set((checks||[]).filter(c=>c.done).map(c=>c.task_key));
      const incomplete=indices.filter(i=>!done.has(`${targetWeek}|${i}`));
      if(!isSummary&&!incomplete.length)continue;
      const kind=isSummary?'weekly-summary':'daily-reminder';
      // Idempotency: one message per user per day. Logs persist and old weeks are never revisited.
      const {error:logError}=await db.from('notification_log').insert({user_id:userId,local_date:today,kind});
      if(logError){if(logError.code!=='23505')console.error('log failed',logError);continue}
      const body=isSummary?`השבוע הסתיים: ${indices.length-incomplete.length} מתוך ${indices.length} הושלמו.${incomplete.length?' לא סומנו: '+incomplete.map(i=>COURSE_NAMES[i]).join('، '):' כל הכבוד!'} `:`למועד הלימודים הקרוב לא סומנו: ${incomplete.map(i=>COURSE_NAMES[i]).join('، ')}`;
      const payload=JSON.stringify({title:isSummary?'סיכום שבוע הלימודים':'מטלות למחר',body,tag:`study-${kind}-${today}`,url:'/'});
      for(const s of userSubs){try{await webpush.sendNotification(s.subscription,payload)}catch(err){if([404,410].includes(err.statusCode))await db.from('push_subscriptions').delete().eq('user_id',userId).eq('endpoint',s.endpoint);else console.error('push failed',err.statusCode||err.message)}}
    }
    if(subs.length<500)break;offset+=500;
  }
};
