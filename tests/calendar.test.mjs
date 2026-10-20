import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCalendarPlan,syncCalendar,eventId,CalendarError,calendarClient} from '../calendar-core.js';
const owner='test-user';
const semester={id:'semester-1',start:'2026-10-21',end:'2026-11-01',courses:[{id:'a',name:'הרמוניה',day:0,time:'09:00–10:30'},{id:'b',name:'תולדות המוזיקה',day:0,time:'14:00–16:00'},{id:'c',name:'קומפוזיציה',day:3,time:'08:00–09:00'}]};
const plan=mode=>buildCalendarPlan(semester,mode,owner,'סמסטר א׳');
function fakeCalendar(){
 const events=new Map(),writes=[];let failPost=false;
 const request=async(path='',method='GET',body,etag)=>{
  const id=path.startsWith('/')?path.slice(1).split('?')[0]:null;
  if(method==='GET'&&!id)return {items:[...events.values()].filter(e=>e.status!=='cancelled')};
  if(method==='GET'){const old=events.get(id);if(!old)throw new CalendarError('',404);return structuredClone(old)}
  writes.push({method,id,body});
  if(method==='POST'){if(failPost)throw new CalendarError('',503);if(events.has(body.id))throw new CalendarError('',409);events.set(body.id,{...structuredClone(body),etag:'1'});return {id:body.id}}
  const old=events.get(id);if(!old)throw new CalendarError('',404);
  if(etag&&old.etag!==etag)throw new CalendarError('',412);
  if(method==='PATCH'){events.set(id,{...old,...structuredClone(body)});return {id}}
  if(method==='DELETE'){events.set(id,{...old,status:'cancelled'});return {}}
 };
 return {events,writes,request,fail(){failPost=true}};
}
test('bounds, Wednesday start, Sunday inclusive end, Jerusalem DST wall time',()=>{
 const p=plan('courses');assert.equal(p.length,3);
 assert.equal(p[0].body.start.dateTime,'2026-10-25T09:00:00');
 assert.equal(p[0].body.start.timeZone,'Asia/Jerusalem');assert.deepEqual(p[0].body.recurrence,['RRULE:FREQ=WEEKLY;COUNT=2']);
 assert.equal(p[2].body.start.dateTime,'2026-10-21T08:00:00');assert.equal(p.reduce((n,r)=>n+r.count,0),6);
});
test('daily blocks include gaps, first start and last finish, Wisteria',()=>{
 const p=plan('blocks');assert.equal(p.length,2);assert.equal(p[0].name,'אוניברסיטה');assert.equal(p[0].start,'09:00');assert.equal(p[0].end,'16:00');assert.equal(p[0].body.colorId,'3');
});
test('empty range/day and invalid schedules are safe',()=>{
 assert.deepEqual(buildCalendarPlan({...semester,end:'2026-10-21',courses:[semester.courses[0]]},'courses',owner),[]);
 assert.throws(()=>buildCalendarPlan({...semester,start:'2026-02-30'},'courses',owner));
 assert.throws(()=>buildCalendarPlan({...semester,end:'2020-01-01'},'courses',owner));
 assert.throws(()=>buildCalendarPlan({...semester,courses:[{...semester.courses[0],time:'13:00–09:00'}]},'courses',owner));
});
test('repeat export is idempotent, rename patches same series',async()=>{
 const c=fakeCalendar();await syncCalendar(c.request,plan('courses'),owner,semester.id);await syncCalendar(c.request,plan('courses'),owner,semester.id);
 assert.equal(c.events.size,3);assert.equal(c.writes.filter(w=>w.method==='POST').length,3);
 const p=plan('courses');p[0].body.summary='שם חדש';await syncCalendar(c.request,p,owner,semester.id);
 assert.ok([...c.events.values()].some(e=>e.summary==='שם חדש'));assert.equal(c.events.size,3);
});
test('mode switch deletes only owned semester series; switch back handles tombstones',async()=>{
 const c=fakeCalendar();c.events.set('unrelated',{id:'unrelated',summary:'פגישה אישית'});c.events.set('other',{id:'other',extendedProperties:{private:{studyApp:'study-checklist-v1',studyOwner:'someone-else',studySemester:semester.id}}});
 await syncCalendar(c.request,plan('courses'),owner,semester.id);await syncCalendar(c.request,plan('blocks'),owner,semester.id);await syncCalendar(c.request,plan('courses'),owner,semester.id);
 const active=[...c.events.values()].filter(e=>e.status!=='cancelled');assert.equal(active.length,5);assert.equal(c.events.get('unrelated').status,undefined);assert.equal(c.events.get('other').status,undefined);
});
test('failed creation does not delete previous mode',async()=>{
 const c=fakeCalendar();await syncCalendar(c.request,plan('courses'),owner,semester.id);c.fail();
 await assert.rejects(syncCalendar(c.request,plan('blocks'),owner,semester.id));assert.equal(c.writes.filter(w=>w.method==='DELETE').length,0);
});
test('lost insert response retries without duplicates',async()=>{
 const c=fakeCalendar();let lost=true;
 const request=async(...args)=>{const result=await c.request(...args);if(lost&&args[1]==='POST'){lost=false;throw Error('network dropped')}return result};
 await assert.rejects(syncCalendar(request,plan('courses'),owner,semester.id));await syncCalendar(c.request,plan('courses'),owner,semester.id);assert.equal(c.events.size,3);
});
test('IDs separate accounts, semesters and modes',async()=>{
 const ids=await Promise.all([eventId('u','s','courses:a'),eventId('u2','s','courses:a'),eventId('u','s2','courses:a'),eventId('u','s','blocks:0')]);assert.equal(new Set(ids).size,4);assert.ok(ids.every(id=>/^[a-v0-9]{5,1024}$/.test(id)));
});
test('pagination and ETag protection',async()=>{
 const c=fakeCalendar();await syncCalendar(c.request,plan('courses'),owner,semester.id);const all=[...c.events.values()];let pages=0;
 const request=async(path,method,...args)=>{if(!method){pages++;return path.includes('pageToken=next')?{items:all.slice(1)}:{items:all.slice(0,1),nextPageToken:'next'}}return c.request(path,method,...args)};
 await syncCalendar(request,plan('courses'),owner,semester.id);assert.equal(pages,2);assert.equal(c.events.size,3);
 const concurrent=async(path,method,body,etag)=>{if(method==='PATCH')throw new CalendarError('',412);return c.request(path,method,body,etag)};
 await assert.rejects(syncCalendar(concurrent,plan('courses'),owner,semester.id),e=>e.status===412);
});
test('API request does not send notifications or expose bearer in URL',async()=>{
 let seen;const request=calendarClient('secret',async(url,options)=>{seen={url,options};return {status:200,ok:true,json:async()=>({id:'x'})}});
 await request('/x?sendUpdates=none','PATCH',{summary:'test'},'etag');assert.ok(!seen.url.includes('secret'));assert.equal(seen.options.headers.Authorization,'Bearer secret');assert.equal(seen.options.headers['If-Match'],'etag');
});
