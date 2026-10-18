/* Versioned local workspace. Legacy keys remain untouched for rollback. */
(() => {
 const LEGACY='haifa-study-checklist-v1';
 const read=(key,fallback)=>{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw)};
 const scope=localStorage.getItem('study-account-scope')||'local';
 const storageKey='study-workspace-v1:'+scope;
 let workspace=read(storageKey,null);
 if(!workspace){
  const legacy=scope==='local'&&!localStorage.getItem('study-legacy-claimed')&&[LEGACY,LEGACY+'-courses-v1',LEGACY+'-details-v1'].some(k=>localStorage.getItem(k)!==null);
  workspace={version:1,active:null,semesters:[],revision:0,dirty:false};
  if(legacy){workspace.active='legacy';workspace.semesters.push({id:'legacy',year:5787,institution:'אוניברסיטת חיפה',term:'a',start:'2026-10-11',end:'2027-02-10',source:'legacy',courses:read(LEGACY+'-courses-v1',null),checks:read(LEGACY,{}),details:read(LEGACY+'-details-v1',{})})}
 }
 const persist=()=>localStorage.setItem(storageKey,JSON.stringify(workspace));
 const active=()=>workspace.semesters.find(s=>s.id===workspace.active)||null;
 window.StudyState={scope,storageKey,get workspace(){return workspace},active,persist,
  change(){workspace.dirty=true;persist();window.dispatchEvent(new Event('workspace-changed'))},
  replace(next){workspace=next;persist()},
  key:LEGACY,
  dates: {'אוניברסיטת חיפה|5787|a':['2026-10-11','2027-01-10'],'אוניברסיטת חיפה|5787|b':['2027-03-01','2027-06-17'],'אוניברסיטת חיפה|5787|summer':['2027-07-08','2027-08-26']},
  source:'https://mt.haifa.ac.il/wp-content/uploads/2025/12/mat-3-%D7%AA%D7%A9%D7%A4%D7%96.pdf',
  yearLabel(year){let n=year%1000,out='';for(const [v,l] of [[400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],[90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],[30,'ל'],[20,'כ'],[10,'י'],[9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],[4,'ד'],[3,'ג'],[2,'ב'],[1,'א']]){while(n>=v){out+=l;n-=v}}out=out.replace('יה','טו').replace('יו','טז');return out.slice(0,-1)+'״'+out.slice(-1)},
  label(s){return `סמסטר ${{a:'א׳',b:'ב׳',summer:'קיץ'}[s.term]} · ${this.yearLabel(s.year)}`}
 };
 // Establish the first-run route before the page is rendered.
 window.studyRouteGuard=requested=>{
  if(!active())return scope==='local'?'account':requested==='account'?'account':'semester';
  return requested;
 };
 document.documentElement.dataset.onboarding=String(!active());
 persist();
})();
