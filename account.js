import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.49.10';
const state=window.StudyState,$=s=>document.querySelector(s);
let db,user,config,ready=false,revision=state.workspace.revision||0,queue=Promise.resolve(),timer;
const accountStatus=s=>$('#accountStatus').textContent=s;
const pushStatus=s=>$('#pushStatus').textContent=s;
const announce=s=>{accountStatus(s);$('#message').textContent=s};
const redirectTo=location.origin+location.pathname;
function showAccount(){
 const permanent=user&&!user.is_anonymous;
 $('#loginOptions').hidden=!!permanent;$('#signOut').hidden=!permanent;
 accountStatus(permanent?`מחובר: ${user.email||'Google'}`:user?'הנתונים נשמרים במכשיר הזה. אפשר לקשר חשבון כדי לחזור גם ממכשיר אחר.':'יש להתחבר כדי ליצור מערכת אישית.');
}
function cloudPayload(){return JSON.parse(JSON.stringify({...state.workspace,revision:undefined,dirty:undefined}))}
async function saveCloud(){
 if(!ready||!user||!state.workspace.dirty)return true;
 const payload=cloudPayload(),next=revision+1;
 let result=revision?await db.from('study_workspaces').update({payload,revision:next,updated_at:new Date().toISOString()}).eq('user_id',user.id).eq('revision',revision).select('revision'):await db.from('study_workspaces').insert({user_id:user.id,payload,revision:next}).select('revision');
 if(result.error||!result.data?.length){ready=false;announce('הנתונים נשמרו במכשיר, אך הסנכרון נעצר. ייתכן שהחשבון השתנה במכשיר אחר. יש לייצא גיבוי לפני רענון.');return false}
 revision=next;state.workspace.revision=revision;
 if(JSON.stringify(payload)===JSON.stringify(cloudPayload()))state.workspace.dirty=false;
 state.persist();return true;
}
function scheduleSave(){clearTimeout(timer);timer=setTimeout(()=>{queue=queue.catch(()=>{}).then(saveCloud)},600)}
window.addEventListener('workspace-changed',scheduleSave);
async function syncReminder(){
 if(!ready||!user)return;
 // All semesters are included so viewing history cannot change the reminder schedule.
 const semesters=state.workspace.semesters.map(s=>({id:s.id,start:s.start,end:s.end,courses:s.courses||[]}));
 const {data:subs,error}=await db.from('push_subscriptions').select('endpoint,subscription').eq('user_id',user.id);if(error)throw error;
 for(const sub of subs||[]){const {error:e}=await db.from('push_subscriptions').update({subscription:{...sub.subscription,semesters}}).eq('user_id',user.id).eq('endpoint',sub.endpoint);if(e)throw e}
}
window.syncCourses=async()=>{scheduleSave();try{await syncReminder();return true}catch{pushStatus('עדכון ההתראות בענן נכשל. יבוצע ניסיון נוסף בפתיחה הבאה.');return false}};
window.syncCheck=()=>scheduleSave();window.syncAllChecks=()=>scheduleSave();
function validateRemote(w){
 if(!w||w.version!==1||!Array.isArray(w.semesters)||w.semesters.length>100)throw Error('Invalid workspace');
 const ids=new Set();for(const s of w.semesters){if(!s||typeof s.id!=='string'||!/^[\w-]+$/.test(s.id)||ids.has(s.id)||!Number.isInteger(s.year)||typeof s.institution!=='string'||!['a','b','summer'].includes(s.term)||!/^\d{4}-\d{2}-\d{2}$/.test(s.start)||!/^\d{4}-\d{2}-\d{2}$/.test(s.end)||s.start>s.end)throw Error('Invalid semester');ids.add(s.id);s.courses=cleanCourses(s.courses);s.details=cleanDetails(s.details);if(!s.checks||Array.isArray(s.checks)||Object.values(s.checks).some(v=>typeof v!=='boolean'))throw Error('Invalid checks')}
 if(w.active!==null&&!ids.has(w.active))throw Error('Invalid active semester');return w;
}
async function init(){
 try{
 const response=await fetch('/.netlify/functions/config',{cache:'no-store'});if(!response.ok)throw Error();config=await response.json();
 if(!config.enabled)throw Error();
 db=createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
 const {data,error}=await db.auth.getSession();if(error)throw error;user=data.session?.user;
 // Existing installations retain their anonymous identity. Fresh installations must sign in.
 if(!user&&state.scope==='local'&&state.active()?.id==='legacy'&&!localStorage.getItem('study-legacy-claimed')){
  const result=await db.auth.signInAnonymously();if(result.error)throw result.error;user=result.data.user;
 }
 if(user&&state.scope!==user.id){
  const target='study-workspace-v1:'+user.id;
  // Only legacy local work is adopted by the initial identity, never by a second account.
  if(state.scope==='local'&&state.active()?.id==='legacy'&&!localStorage.getItem('study-legacy-claimed')&&!localStorage.getItem(target)){
   localStorage.setItem(target,JSON.stringify({...state.workspace,dirty:true}));localStorage.setItem('study-legacy-claimed',user.id);localStorage.removeItem(state.storageKey);
  }
  localStorage.setItem('study-account-scope',user.id);location.reload();return;
 }
 if(!user&&state.scope!=='local'){localStorage.removeItem('study-account-scope');location.hash='account';location.reload();return}
 showAccount();
 if(user){
  const {data:remote,error:e}=await db.from('study_workspaces').select('payload,revision').eq('user_id',user.id).maybeSingle();if(e)throw e;
  if(remote){
   if(state.workspace.dirty&&revision!==remote.revision){announce('יש שינויים מקומיים וגם גרסה אחרת בענן. יש לייצא גיבוי לפני החלפת הנתונים.');return}
   if(!state.workspace.dirty&&revision!==remote.revision){state.replace({...validateRemote(remote.payload),revision:remote.revision,dirty:false});location.reload();return}
   revision=remote.revision;
  }else{revision=0;state.workspace.revision=0;state.workspace.dirty=true;
   // Import existing cloud checkmarks once; the old table remains intact for rollback.
   const legacy=state.workspace.semesters.find(s=>s.id==='legacy');if(legacy){const {data:checks,error:ce}=await db.from('study_checks').select('task_key,done').eq('user_id',user.id);if(ce)throw ce;for(const row of checks||[])if(!(row.task_key in legacy.checks))legacy.checks[row.task_key]=row.done;state.persist()}
  }
  ready=true;await saveCloud();await syncReminder();pushStatus('החשבון מחובר. ניתן להפעיל התראות.');
 }
 const guard=window.studyRouteGuard;
 window.studyRouteGuard=route=>!user&&!['appearance','backup'].includes(route)?'account':guard(route);window.dispatchEvent(new Event('hashchange'));
 try{const settings=await fetch(config.url+'/auth/v1/settings',{headers:{apikey:config.anonKey}}).then(r=>r.json());$('#googleLogin').disabled=!settings.external?.google;$('#googleStatus').textContent=settings.external?.google?'':'כניסה עם Google תהיה זמינה לאחר הפעלתה. אפשר להיכנס באמצעות קישור למייל.'}catch{$('#googleStatus').textContent='לא ניתן לבדוק כרגע את זמינות Google.'}
 db.auth.onAuthStateChange((event,session)=>{if((event==='SIGNED_IN'&&session?.user.id!==user?.id)||event==='SIGNED_OUT')location.reload()});
 }catch(e){console.error(e);accountStatus('לא ניתן להתחבר כרגע. בדוק חיבור לאינטרנט ונסה לרענן.');pushStatus('הענן אינו זמין כרגע. הנתונים הקיימים שמורים במכשיר.');if(!state.active()){location.hash='account'}}
}
$('#googleLogin').onclick=async()=>{if(!db)return;await queue;await saveCloud();const options={provider:'google',options:{redirectTo}};const {error}=user?.is_anonymous?await db.auth.linkIdentity(options):await db.auth.signInWithOAuth(options);if(error)announce('הכניסה לא הושלמה: '+error.message)};
$('#emailLogin').onsubmit=async e=>{e.preventDefault();if(!db){accountStatus('שירות הכניסה אינו זמין כרגע. נסה לרענן.');return}
 const email=$('#loginEmail').value.trim();await queue;await saveCloud();
 const {error}=user?.is_anonymous?await db.auth.updateUser({email},{emailRedirectTo:redirectTo}):await db.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
 accountStatus(error?'לא ניתן לשלוח קישור: '+error.message:'קישור כניסה נשלח למייל. יש לפתוח אותו באותו דפדפן שבו התחלת את הכניסה.');
};
$('#signOut').onclick=async()=>{
 clearTimeout(timer);await queue;if(state.workspace.dirty&&!await saveCloud())return;
 try{const reg=await navigator.serviceWorker?.getRegistration();const sub=await reg?.pushManager.getSubscription();if(sub){const {error}=await db.from('push_subscriptions').delete().eq('user_id',user.id).eq('endpoint',sub.endpoint);if(error)throw error;await sub.unsubscribe()}
 const {error}=await db.auth.signOut({scope:'local'});if(error)throw error;localStorage.removeItem(state.storageKey);localStorage.removeItem('study-account-scope');location.hash='account';location.reload()}catch{announce('לא ניתן להשלים התנתקות. נסה שוב עם חיבור לרשת.')}
};
$('#enablePush').onclick=async()=>{try{
 if(!ready||!user||!config?.vapidPublicKey)throw Error('יש להתחבר תחילה ולהגדיר את שירות ההתראות.');
 if(!('Notification'in window)||!('PushManager'in window)||!('serviceWorker'in navigator))throw Error('באייפון יש לפתוח את האפליקציה ממסך הבית כדי להפעיל התראות.');
 if(await Notification.requestPermission()!=='granted')throw Error('הרשאת ההתראות לא אושרה.');
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(!sub){const raw=atob(config.vapidPublicKey.replace(/-/g,'+').replace(/_/g,'/'));sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:Uint8Array.from(raw,c=>c.charCodeAt(0))})}
 const semesters=state.workspace.semesters.map(s=>({id:s.id,start:s.start,end:s.end,courses:s.courses||[]}));
 const {error}=await db.from('push_subscriptions').upsert({user_id:user.id,endpoint:sub.endpoint,subscription:{...sub.toJSON(),semesters}});if(error)throw error;pushStatus('התראות הופעלו במכשיר הזה.');
 }catch(e){pushStatus(e.message||'הפעלת ההתראות נכשלה.')}
};
$('#testPush').onclick=async()=>{if(!('Notification'in window)||Notification.permission!=='granted'){pushStatus('יש להפעיל התראות תחילה.');return}const reg=await navigator.serviceWorker.ready;await reg.showNotification('בדיקת התראות — לימודים',{body:'זו בדיקה מקומית של ההתראות במכשיר.',icon:'./icon.svg'})};
window.addEventListener('online',()=>{if(ready)scheduleSave()});
init();
