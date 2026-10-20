import {buildCalendarPlan,calendarClient,syncCalendar,CalendarError} from './calendar-core.js';
const $=s=>document.querySelector(s),state=window.StudyState;
const PENDING='study-calendar-pending-v1';
const days=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const fingerprint=s=>JSON.stringify([s.id,s.start,s.end,s.courses]);
export function initGoogleCalendar(auth){
 const form=$('#calendarForm'),select=$('#calendarSemester'),button=$('#calendarSubmit');let busy=false,accountReady=false;
 const calendarPicker=window.StudyDropdown(select);
 const mode=()=>form.elements.calendarMode.value;
 const selected=()=>state.workspace.semesters.find(s=>s.id===select.value);
 const status=(text,error=false)=>{const el=$('#calendarStatus');el.textContent=text;el.dataset.error=String(error)};
 function preview(){
  const root=$('#calendarPreview');root.replaceChildren();const s=selected();
  const title=document.createElement('h2');title.textContent='תצוגה מקדימה';root.append(title);
  try{
   const plan=buildCalendarPlan(s,mode(),state.scope,state.label(s));
   const list=document.createElement('ul');for(const row of plan){const li=document.createElement('li'),name=document.createElement('span'),time=document.createElement('time');name.textContent=`${days[row.day]} · ${row.name}`;time.dir='ltr';time.textContent=row.start+'–'+row.end;li.append(name,time);list.append(li)}root.append(list);
   const text=document.createElement('p');text.textContent=plan.length?`${s.start} — ${s.end} · ${plan.reduce((n,r)=>n+r.count,0)} אירועים לאורך הסמסטר · לפי שעון ישראל`:'אין שיעורים לייצוא בטווח התאריכים שנבחר.';root.append(text);
   const meta=s.calendarExport;button.textContent=meta?'עדכון היומן':'חיבור וייצוא ליומן גוגל';
   $('#calendarLastSync').textContent=meta?.updatedAt?'עודכן לאחרונה: '+new Date(meta.updatedAt).toLocaleString('he-IL')+' · '+(meta.mode==='blocks'?'בלוק אוניברסיטה יומי':'כל קורס בנפרד'):'';
   button.disabled=busy||!accountReady||!plan.length;
  }catch(e){const p=document.createElement('p');p.textContent=s?e.message:'יש להגדיר סמסטר וקורסים לפני הייצוא.';root.append(p);button.disabled=true;$('#calendarLastSync').textContent=''}
 }
 function refresh(){
  if(busy)return;
  calendarPicker.close();
  const previous=select.value;select.replaceChildren();for(const s of state.workspace.semesters){const o=document.createElement('option');o.value=s.id;o.textContent=state.label(s);select.append(o)}
  select.value=state.workspace.semesters.some(s=>s.id===previous)?previous:state.workspace.active||'';
  calendarPicker.sync('בחירת סמסטר');
  const meta=selected()?.calendarExport;if(meta&&['courses','blocks'].includes(meta.mode))form.elements.calendarMode.value=meta.mode;
  preview();
 }
 function setBusy(value){busy=value;select.disabled=value;calendarPicker.sync('בחירת סמסטר');if(value)calendarPicker.close();form.querySelectorAll('input').forEach(el=>el.disabled=value);form.setAttribute('aria-busy',String(value));preview()}
 async function authorize(s,chosenMode){
  const pending={owner:state.scope,semester:s.id,mode:chosenMode,fingerprint:fingerprint(s),created:Date.now()};
  sessionStorage.setItem(PENDING,JSON.stringify(pending));
  status('עוברים לגוגל לאישור גישה ליומן. לאחר החזרה הייצוא ימשיך אוטומטית.');
  try{setBusy(false);await auth.connect()}catch(e){sessionStorage.removeItem(PENDING);throw e}
 }
 async function run(resumed=false){
  if(busy)return;
  const semester=selected(),chosenMode=mode();let progress=0;
  try{
   if(typeof coursesDirty!=='undefined'&&coursesDirty)throw Error('יש לשמור תחילה את השינויים במסך עריכת הקורסים.');
   const plan=buildCalendarPlan(semester,chosenMode,state.scope,state.label(semester));
   if(!plan.length)throw Error('אין שיעורים לייצוא בטווח שנבחר.');
   setBusy(true);status('מתחבר ליומן גוגל…');
   await auth.flush();const session=await auth.session();
   if(!session.user||session.user.is_anonymous||session.user.id!==state.scope)throw Error('יש להתחבר לחשבון האישי לפני הייצוא.');
   if(!session.token){if(resumed)throw Error('החיבור לגוגל לא הושלם. יש לנסות שוב ולאשר גישה ליומן.');await authorize(semester,chosenMode);return}
   // Bind Google access to this signed-in app account before any calendar write.
   const response=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+session.token},cache:'no-store'});
   if(response.status===401)throw new CalendarError('יש לחדש את החיבור לגוגל.',401);
   if(!response.ok)throw Error('לא ניתן לאמת את חשבון גוגל כרגע. נסה שוב.');
   const google=await response.json();
   if(!session.user.identities?.some(i=>i.provider==='google'&&(i.identity_data?.sub===google.sub||i.id===google.sub)))throw Error('חשבון גוגל אינו תואם לחשבון באפליקציה. יש להתחבר מחדש לחשבון הנכון.');
   const work=()=>syncCalendar(calendarClient(session.token),plan,session.user.id,semester.id,(done,total)=>{progress=done;status(`מעדכן את היומן… ${done} מתוך ${total}`)});
   const result=navigator.locks?await navigator.locks.request('study-calendar:'+session.user.id+':'+semester.id,{ifAvailable:true},lock=>{if(!lock)throw Error('היומן מתעדכן בחלון אחר. יש להמתין לסיום.');return work()}):await work();
   semester.calendarExport={mode:chosenMode,updatedAt:new Date().toISOString(),series:result.series,events:result.events};
   let metadataSaved=true;try{state.change();await auth.flush()}catch{metadataSaved=false}
   status(`היומן עודכן בהצלחה: ${result.events} אירועים לאורך הסמסטר, ביומן הראשי של ${google.email||'חשבון גוגל שלך'}.`+(metadataSaved?'':' מועד העדכון טרם נשמר בענן.'));
  }catch(e){
   const needsAuth=e.status===401||(e.status===403&&['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(e.reason));
   if(needsAuth&&!resumed){try{await authorize(semester,chosenMode)}catch(error){status(error.message,true)}}
   else if(needsAuth)status('לא התקבלה הרשאה ליומן. יש לנסות שוב ולאשר לגוגל את הגישה ליומן.',true);
   else if(e.status===403&&['accessNotConfigured','SERVICE_DISABLED'].includes(e.reason))status('חיבור היומן עדיין לא הופעל בהגדרות גוגל של האפליקציה. יש לפנות למנהל האפליקציה להפעלת השירות.',true);
   else if(e.status===412)status('האירועים השתנו במקביל במכשיר אחר. יש לנסות לעדכן שוב.',true);
   else if(e.status===429||e.status===403&&/rateLimit/i.test(e.reason))status('גוגל הגביל זמנית את קצב העדכון. יש להמתין מעט ולנסות שוב.',true);
   else status((progress?'העדכון הושלם חלקית. ניתן לנסות שוב בלי ליצור כפילויות. ':'')+(e.status?'העדכון ביומן נכשל. נסה שוב בעוד רגע.':e.message||'העדכון נכשל. בדוק חיבור לאינטרנט.'),true);
  }finally{setBusy(false)}
 }
 async function onReady(){
  accountReady=auth.ready();refresh();
  if(!accountReady){status('יש להתחבר לחשבון ולוודא שהסנכרון לענן הושלם לפני הייצוא.');return}
  status('הייצוא מתבצע בלחיצה. לאחר שינוי במערכת, יש ללחוץ על ״עדכון היומן״.');
  let pending;try{pending=JSON.parse(sessionStorage.getItem(PENDING)||'null')}catch{}sessionStorage.removeItem(PENDING);
  if(!pending)return;
  location.hash='calendar';
  if(pending.owner!==state.scope||Date.now()-pending.created>30*60*1000){status('החיבור השתנה או פג תוקף בקשת הייצוא. יש לבדוק את הסמסטר ולנסות שוב.',true);return}
  select.value=pending.semester;calendarPicker.sync('בחירת סמסטר');form.elements.calendarMode.value=pending.mode;preview();
  if(!selected()||fingerprint(selected())!==pending.fingerprint){status('מערכת השעות השתנתה מאז תחילת החיבור. יש לבדוק את התצוגה המקדימה וללחוץ שוב על ייצוא.',true);return}
  await run(true);
 }
 form.addEventListener('submit',e=>{e.preventDefault();run()});select.addEventListener('change',()=>{const meta=selected()?.calendarExport;if(meta)form.elements.calendarMode.value=meta.mode;preview()});form.querySelectorAll('input').forEach(el=>el.addEventListener('change',preview));
 window.addEventListener('hashchange',()=>{if(location.hash==='#calendar')refresh()});window.addEventListener('workspace-changed',refresh);window.addEventListener('study-account-ready',onReady);
 window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue=''}});
 refresh();
}
