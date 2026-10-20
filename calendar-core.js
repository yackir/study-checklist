// Google Calendar series are anchored in Jerusalem wall time, never device time.
export const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.events.owned';
export const APP_TAG='study-checklist-v1';
const DAY=86400000;
const dateValue=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('תאריכי הסמסטר אינם תקינים.');const n=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error('תאריכי הסמסטר אינם תקינים.');return n};
export function buildCalendarPlan(semester,mode,owner,label=''){
 if(!semester||!['courses','blocks'].includes(mode)||!owner)throw Error('יש לבחור סמסטר ואופן הצגה.');
 const start=dateValue(semester.start),end=dateValue(semester.end);
 if(end<start||end-start>730*DAY)throw Error('יש לבדוק את טווח התאריכים של הסמסטר (עד שנתיים).');
 if(!Array.isArray(semester.courses)||semester.courses.length>200)throw Error('רשימת הקורסים אינה תקינה.');
 const ids=new Set();let rows=semester.courses.map(c=>{
  if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||!Number.isInteger(c.day)||c.day<0||c.day>6||!/^([01]\d|2[0-3]):[0-5]\d–([01]\d|2[0-3]):[0-5]\d$/.test(c.time)||c.time.slice(0,5)>=c.time.slice(6))throw Error('יש לתקן את פרטי הקורסים לפני הייצוא.');
  ids.add(c.id);return {key:'course:'+c.id,day:c.day,name:c.name,start:c.time.slice(0,5),end:c.time.slice(6)};
 });
 if(mode==='blocks')rows=[...new Set(rows.map(r=>r.day))].map(day=>{const courses=rows.filter(r=>r.day===day);return {key:'day:'+day,day,name:'אוניברסיטה',start:courses.map(c=>c.start).sort()[0],end:courses.map(c=>c.end).sort().at(-1)}});
 return rows.sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)).flatMap(row=>{
  const first=start+((row.day-new Date(start).getUTCDay()+7)%7)*DAY;
  if(first>end)return [];
  const date=new Date(first).toISOString().slice(0,10),count=Math.floor((end-first)/(7*DAY))+1;
  const key=mode+':'+row.key;
  return [{...row,key,count,body:{summary:row.name,description:`מערכת הלימודים · ${label}\nנוצר באפליקציית הלימודים. עדכון מהאפליקציה יעדכן את הסדרה.`,
   start:{dateTime:date+'T'+row.start+':00',timeZone:'Asia/Jerusalem'},end:{dateTime:date+'T'+row.end+':00',timeZone:'Asia/Jerusalem'},
   recurrence:[`RRULE:FREQ=WEEKLY;COUNT=${count}`],
   extendedProperties:{private:{studyApp:APP_TAG,studyOwner:owner,studySemester:semester.id,studyKey:key}},
   ...(mode==='blocks'?{colorId:'3'}:{})}}];
 });
}
export async function eventId(owner,semester,key,generation=0){
 const bytes=new TextEncoder().encode(JSON.stringify([APP_TAG,owner,semester,key,generation]));
 return 'sc'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
}
export class CalendarError extends Error {constructor(message,status=0,reason=''){super(message);this.status=status;this.reason=reason}}
export function calendarClient(token,fetcher=fetch){
 return async function request(path='',method='GET',body,etag){
  const response=await fetcher('https://www.googleapis.com/calendar/v3/calendars/primary/events'+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{}),...(etag?{'If-Match':etag}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
  const data=response.status===204?{}:await response.json().catch(()=>({}));
  if(!response.ok){const reason=data.error?.errors?.[0]?.reason||data.error?.status||'';throw new CalendarError(data.error?.message||'התקשורת עם יומן גוגל נכשלה.',response.status,reason)}return data;
 };
}
export async function syncCalendar(request,plan,owner,semesterId,onProgress=()=>{}){
 const query=new URLSearchParams({singleEvents:'false',showDeleted:'false',maxResults:'2500'});
 for(const v of ['studyApp='+APP_TAG,'studyOwner='+owner,'studySemester='+semesterId])query.append('privateExtendedProperty',v);
 const existing=[];let page;
 do{if(page)query.set('pageToken',page);const result=await request('?'+query);existing.push(...(result.items||[]));page=result.nextPageToken}while(page);
 const owned=e=>{const p=e.extendedProperties?.private;return p?.studyApp===APP_TAG&&p?.studyOwner===owner&&p?.studySemester===semesterId};
 const managed=existing.filter(e=>owned(e)&&!e.recurringEventId&&e.status!=='cancelled'),keep=new Set();let done=0;
 for(const row of plan){
  const old=managed.find(e=>e.extendedProperties.private.studyKey===row.key);
  let saved;
  if(old)saved=await request('/'+encodeURIComponent(old.id)+'?sendUpdates=none','PATCH',row.body,old.etag);
  else{
   // Deterministic IDs make retries safe after a lost response or parallel insert.
   // Deleted Google IDs are tombstones, so use the next deterministic generation.
   for(let generation=0;generation<100;generation++){
    const id=await eventId(owner,semesterId,row.key,generation);
    try{saved=await request('?sendUpdates=none','POST',{id,...row.body});break}
    catch(error){if(error.status!==409)throw error;
     let found;try{found=await request('/'+id)}catch(e){if(e.status===410)continue;throw e}
     if(found.status==='cancelled')continue;
     if(!owned(found)||found.extendedProperties.private.studyKey!==row.key)throw Error('נמצאה התנגשות באירוע. הייצוא נעצר.');
     saved=await request('/'+id+'?sendUpdates=none','PATCH',row.body,found.etag);break;
    }
   }
  }
  if(!saved?.id)throw Error('לא ניתן היה ליצור את האירוע. נסה שוב.');
  keep.add(saved.id);onProgress(++done,plan.length);
 }
 // Do not remove the old mode/course set unless every new series was saved.
 for(const old of managed.filter(e=>!keep.has(e.id))){try{await request('/'+encodeURIComponent(old.id)+'?sendUpdates=none','DELETE',undefined,old.etag)}catch(e){if(![404,410].includes(e.status))throw e}}
 return {series:plan.length,events:plan.reduce((sum,row)=>sum+row.count,0)};
}
