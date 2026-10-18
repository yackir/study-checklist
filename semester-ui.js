(() => {
 const state=window.StudyState, $=s=>document.querySelector(s), form=$('#semesterForm');
 const current=state.active();
 $('.sub').textContent=current?state.label(current):'בונים מערכת שמתאימה לך';
 $('.tag').textContent=current?.institution||'הלימודים שלי';
 const nowYear=Number(new Intl.DateTimeFormat('en-u-ca-hebrew',{year:'numeric',timeZone:'Asia/Jerusalem'}).format(new Date()));
 for(let year=nowYear;year>=nowYear-1;year--){const o=new Option(`${state.yearLabel(year)} · ${year-3761}–${year-3760}`,year);$('#academicYear').add(o)}

 // Keep the native selects as the form's data model; all visible menus share one anchored UI.
 const normalize=text=>text.normalize('NFKD').replace(/[\u0591-\u05BD\u05BF-\u05C2\u05C4-\u05C5\u05C7"'׳״]/g,'').replace(/[-־–—]/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase();
 const controls=[];
 function picker(field,editable=false){
  const shell=document.createElement('div');shell.className='semester-picker';field.before(shell);shell.append(field);
  const trigger=editable?field:document.createElement('button');
  if(!editable){field.hidden=true;field.required=false;trigger.type='button';trigger.id=field.id+'Control';trigger.className='semester-select';shell.append(trigger);document.querySelector('label[for="'+field.id+'"]').htmlFor=trigger.id}
  const label=document.querySelector('label[for="'+trigger.id+'"]');label.id=field.id+'Label';
  trigger.setAttribute('role','combobox');trigger.setAttribute('aria-labelledby',label.id);trigger.setAttribute('aria-haspopup','listbox');trigger.setAttribute('aria-expanded','false');
  if(editable)trigger.setAttribute('aria-autocomplete','list');
  const menu=document.createElement('div');menu.className='semester-options';menu.id=field.id+'Options';menu.setAttribute('role','listbox');menu.setAttribute('aria-labelledby',label.id);menu.hidden=true;trigger.setAttribute('aria-controls',menu.id);shell.append(menu);
  let options=[],active=-1,suppressFocus=false;
  function close(){menu.hidden=true;trigger.setAttribute('aria-expanded','false');trigger.removeAttribute('aria-activedescendant');active=-1;shell.classList.remove('is-open')}
  function sync(fallback=''){if(!editable)trigger.textContent=field.selectedOptions[0]?.textContent||fallback||'בחירת שנה'}
  function highlight(index){active=index;[...menu.querySelectorAll('[role=option]')].forEach((node,i)=>{node.classList.toggle('is-active',i===active)});const node=menu.children[active];if(node){trigger.setAttribute('aria-activedescendant',node.id);node.scrollIntoView({block:'nearest'})}}
  function choose(index){const option=options[index];if(!option)return;field.value=option.value;sync();close();field.dispatchEvent(new Event('change',{bubbles:true}));suppressFocus=true;trigger.focus({preventScroll:true});suppressFocus=false;close()}
  function open(){
   controls.forEach(c=>c.close());menu.replaceChildren();
   if(editable){const query=normalize(field.value);options=(window.StudyInstitutions||[]).filter(item=>normalize(item.name+' '+(item.aliases||'')).includes(query)).map(item=>({value:item.name,text:item.name}))}
   else options=[...field.options].map(o=>({value:o.value,text:o.textContent}));
   options.forEach((option,i)=>{const node=document.createElement('div');node.id=menu.id+'-'+i;node.className='semester-option';node.setAttribute('role','option');node.setAttribute('aria-selected',String(option.value===field.value));node.textContent=option.text;node.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')e.preventDefault()});node.onclick=()=>choose(i);menu.append(node)});
   if(!options.length){const empty=document.createElement('div');empty.className='semester-no-results';empty.setAttribute('role','status');empty.textContent='לא נמצאה התאמה. אפשר להמשיך עם השם שהקלדת.';menu.append(empty)}
   menu.hidden=false;trigger.setAttribute('aria-expanded','true');shell.classList.add('is-open');
  }
  trigger.addEventListener('click',()=>menu.hidden?open():!editable&&close());
  if(editable){trigger.addEventListener('focus',()=>{if(!suppressFocus)open()});trigger.addEventListener('input',()=>{open();update()})}
  trigger.addEventListener('keydown',e=>{
   if(e.isComposing)return;
   if(e.key==='Escape'){if(!menu.hidden){e.preventDefault();e.stopPropagation();close()}return}
   if(e.key==='Tab'){close();return}
   if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();if(menu.hidden)open();if(options.length)highlight(active<0?(e.key==='ArrowDown'?0:options.length-1):(active+(e.key==='ArrowDown'?1:-1)+options.length)%options.length);return}
   if(e.key==='Enter'&&!menu.hidden){e.preventDefault();if(active>=0)choose(active);else close()}
  });
  shell.addEventListener('focusout',e=>{if(e.relatedTarget&&!shell.contains(e.relatedTarget))close()});
  document.addEventListener('pointerdown',e=>{if(!shell.contains(e.target))close()});
  const control={sync,close};controls.push(control);sync();return control;
 }
 const yearPicker=picker($('#academicYear')),termPicker=picker($('#semesterTerm')),institutionPicker=picker($('#institution'),true);
 window.addEventListener('hashchange',()=>controls.forEach(c=>c.close()));
 function reset(s){
  form.dataset.edit=s?.id||'';$('#academicYear').value=s?.year||nowYear;$('#institution').value=s?.institution||'';$('#semesterTerm').value=s?.term||'a';
  yearPicker.sync(s&&(s.year<nowYear-1||s.year>nowYear)?state.yearLabel(s.year)+' · סמסטר שמור':'');termPicker.sync();institutionPicker.close();$('#semesterStatus').textContent='';
  $('#semesterStart').value=s?.start||'';$('#semesterEnd').value=s?.end||'';$('#manualDates').checked=!!s&&s.source!==state.source;
  $('#semesterHeading').textContent=s?'מסגרת הלימודים':'בוא נבנה את המערכת שלך';$('#semesterSave').textContent=s?'שמירה והמשך לקורסים':'יצירת סמסטר והמשך לקורסים';update(false);
 }
 function update(changed=true){
  const institution=$('#institution').value.trim(),year=$('#academicYear').value||(form.dataset.edit===current?.id?current.year:''),term=$('#semesterTerm').value;
  const match=state.dates[`${institution}|${year}|${term}`],ready=!!(institution&&year&&term);
  $('#semesterDates').hidden=!ready;
  if(changed){$('#manualDates').checked=!match;$('#semesterStart').value=match?.[0]||'';$('#semesterEnd').value=match?.[1]||''}
  const custom=$('#manualDates').checked;
  $('#semesterStart').readOnly=!!match&&!custom;$('#semesterEnd').readOnly=!!match&&!custom;
  $('#calendarSource').hidden=!match;$('#calendarSource').href=state.source;
  $('#dateExplanation').textContent=match?(custom?'תאריכים מותאמים אישית. אפשר להחיל מחדש את הלוח הרשמי.':'התאריכים לפי לוח השנה הרשמי. סוף הסמסטר הוא סיום ההוראה, ללא תקופת הבחינות.'):'עדיין אין במערכת לוח מאומת לבחירה הזו. יש להזין את תאריכי ההוראה של המוסד.';
  $('#useOfficialDates').hidden=!match||!custom;
 }
 ['academicYear','institution','semesterTerm'].forEach(id=>$('#'+id).addEventListener('change',()=>update()));
 $('#manualDates').onchange=()=>update(false);$('#useOfficialDates').onclick=()=>update(true);
 $('#newSemester').onclick=()=>reset(null);
 form.onsubmit=e=>{e.preventDefault();const start=$('#semesterStart').value,end=$('#semesterEnd').value;
  if(!start||!end||start>end||(new Date(end)-new Date(start)>370*86400000)){ $('#semesterStatus').textContent='יש להזין טווח תאריכים תקין של עד שנה.';return}
  const institution=$('#institution').value.trim(),year=Number($('#academicYear').value||(form.dataset.edit===current?.id?current.year:0)),term=$('#semesterTerm').value;
  if(state.workspace.semesters.some(s=>s.id!==form.dataset.edit&&s.year===year&&s.institution===institution&&s.term===term)){$('#semesterStatus').textContent='הסמסטר הזה כבר קיים. אפשר לבחור אותו ברשימה למטה.';return}
  const existing=state.workspace.semesters.find(s=>s.id===form.dataset.edit);
  const semester={...(existing||{id:crypto.randomUUID(),courses:[],checks:{},details:{}}),year,institution,term,start,end,source:$('#manualDates').checked?'manual':state.source};
  if(!year||!institution||!['a','b','summer'].includes(term))return;
  const before=JSON.stringify(state.workspace);
  if(existing)Object.assign(existing,semester);else state.workspace.semesters.push(semester);
  state.workspace.active=semester.id;
  try{state.change();location.hash='courses';location.reload()}catch{state.replace(JSON.parse(before));$('#semesterStatus').textContent='אין מספיק מקום לשמירה במכשיר. יש לייצא גיבוי ולפנות מקום.'}
 };
 const list=$('#semesterList');
 state.workspace.semesters.forEach(s=>{const row=document.createElement('button');row.type='button';row.className='historyitem';row.classList.toggle('selected-week',s.id===state.workspace.active);row.textContent=state.label(s)+' · '+s.institution+(s.id===state.workspace.active?' · נבחר':'');row.onclick=()=>{if(s.id===state.workspace.active){reset(s);return}state.workspace.active=s.id;state.change();location.hash='home';location.reload()};list.append(row)});
 $('#newSemester').hidden=!state.workspace.semesters.length;
 reset(current);

 window.dispatchEvent(new Event('hashchange'));
 $('#coursesForm').addEventListener('submit',()=>{if(!coursesDirty)location.hash='home'});
 // Backup includes every semester, not only the currently selected one.
 $('#export').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state.workspace,null,2)],{type:'application/json'}));a.download='study-workspace-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
 const oldImport=$('#file').onchange;
 $('#file').onchange=async e=>{const file=e.target.files[0];if(!file)return;let obj;try{obj=JSON.parse(await file.text())}catch{return oldImport(e)}
  if(!Array.isArray(obj.semesters))return oldImport(e);
  try{if(obj.version!==1||obj.semesters.length>100||!obj.semesters.every(s=>s&&typeof s.id==='string'&&/^[a-zA-Z0-9-]+$/.test(s.id)&&Number.isInteger(s.year)&&s.year>=5700&&s.year<5900&&typeof s.institution==='string'&&s.institution.length<=200&&['a','b','summer'].includes(s.term)&&/^\d{4}-\d{2}-\d{2}$/.test(s.start)&&/^\d{4}-\d{2}-\d{2}$/.test(s.end)&&s.start<=s.end))throw Error();
   const ids=new Set();for(const s of obj.semesters){if(ids.has(s.id))throw Error();ids.add(s.id);s.courses=cleanCourses(s.courses);s.details=cleanDetails(s.details);if(!s.checks||Array.isArray(s.checks)||Object.entries(s.checks).some(([k,v])=>!/^\d{4}-\d{2}-\d{2}\|(?:[0-9]+|c_[a-zA-Z0-9-]+)$/.test(k)||typeof v!=='boolean'))throw Error()}
   if(obj.active!==null&&!ids.has(obj.active))throw Error();
   if(!confirm('לשחזר את כל הסמסטרים מהגיבוי? הנתונים המקומיים הנוכחיים יוחלפו.'))return;
   state.replace({...obj,revision:state.workspace.revision,dirty:true});location.reload();
  }catch{$('#message').textContent='קובץ הגיבוי אינו תקין.'}finally{e.target.value=''}
 };
})();
