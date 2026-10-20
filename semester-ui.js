(() => {
 const state=window.StudyState, $=s=>document.querySelector(s), form=$('#semesterForm');
 const current=state.active();
 const termNames={a:'א׳',b:'ב׳',summer:'קיץ'};
 $('.brand').textContent=current?'סמסטר '+termNames[current.term]:'';
 $('.sub').textContent=current?state.yearLabel(current.year):'';
 $('.semester-header-link').setAttribute('aria-label',current?'ניהול סמסטרים, '+state.label(current):'ניהול סמסטרים');
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
  function sync(fallback=''){if(!editable){trigger.textContent=field.selectedOptions[0]?.textContent||fallback||'בחירת שנה';trigger.disabled=field.disabled;trigger.setAttribute('aria-disabled',String(field.disabled))}}
  function highlight(index){active=index;[...menu.querySelectorAll('[role=option]')].forEach((node,i)=>{node.classList.toggle('is-active',i===active)});const node=menu.children[active];if(node){trigger.setAttribute('aria-activedescendant',node.id);node.scrollIntoView({block:'nearest'})}}
  function choose(index){const option=options[index];if(!option)return;field.value=option.value;sync();close();field.dispatchEvent(new Event('change',{bubbles:true}));if(editable)trigger.blur();else{ suppressFocus=true;trigger.focus({preventScroll:true});suppressFocus=false }close()}
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
 // Reuse the same field-width dropdown for the Google Calendar semester selector.
 window.StudyDropdown=field=>picker(field);
 const yearPicker=picker($('#academicYear')),termPicker=picker($('#semesterTerm')),institutionPicker=picker($('#institution'),true);
 window.addEventListener('hashchange',()=>controls.forEach(c=>c.close()));
 function reset(s){
  form.dataset.edit=s?.id||'';$('#academicYear').value=s?.year||nowYear;$('#institution').value=s?.institution||'';$('#semesterTerm').value=s?.term||'a';
  yearPicker.sync(s&&(s.year<nowYear-1||s.year>nowYear)?state.yearLabel(s.year)+' · סמסטר שמור':'');termPicker.sync();institutionPicker.close();$('#semesterStatus').textContent='';
  $('#semesterStart').value=s?.start||'';$('#semesterEnd').value=s?.end||'';$('#manualDates').checked=!!s&&s.source!==state.source;
  $('#semesterHeading').textContent=state.workspace.semesters.length?'ניהול סמסטרים':'בוא נבנה את המערכת שלך';
  $('#semesterFormTitle').textContent=s?'עריכת הסמסטר הנבחר':state.workspace.semesters.length?'יצירת סמסטר חדש':'הגדרת הסמסטר הראשון';
  $('#semesterSave').textContent=s?'שמירה והמשך לקורסים':'יצירת סמסטר והמשך לקורסים';update(false);
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
 $('#newSemester').innerHTML='<span class="semester-add-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span><span>הוספת סמסטר</span>';
 $('#newSemester').onclick=()=>{list.querySelectorAll('.semester-list-row').forEach(row=>row.closeRemoval?.());reset(null);$('#semesterFormTitle').scrollIntoView({behavior:'smooth',block:'start'})};
 form.onsubmit=e=>{e.preventDefault();const start=$('#semesterStart').value,end=$('#semesterEnd').value;
  if(!start||!end||start>end||(new Date(end)-new Date(start)>370*86400000)){ $('#semesterStatus').textContent='יש להזין טווח תאריכים תקין של עד שנה.';return}
  const institution=$('#institution').value.trim(),year=Number($('#academicYear').value||(form.dataset.edit===current?.id?current.year:0)),term=$('#semesterTerm').value;
  if(state.workspace.semesters.some(s=>s.id!==form.dataset.edit&&s.year===year&&s.institution===institution&&s.term===term)){$('#semesterStatus').textContent='הסמסטר הזה כבר קיים. אפשר לבחור אותו ברשימה למעלה.';return}
  const existing=state.workspace.semesters.find(s=>s.id===form.dataset.edit);
  const semester={...(existing||{id:crypto.randomUUID(),courses:[],checks:{},details:{}}),year,institution,term,start,end,source:$('#manualDates').checked?'manual':state.source};
  if(!year||!institution||!['a','b','summer'].includes(term))return;
  const before=JSON.stringify(state.workspace);
  if(existing)Object.assign(existing,semester);else state.workspace.semesters.push(semester);
  state.workspace.active=semester.id;
  try{state.change();location.hash='courses';location.reload()}catch{state.replace(JSON.parse(before));$('#semesterStatus').textContent='אין מספיק מקום לשמירה במכשיר. יש לייצא גיבוי ולפנות מקום.'}
 };
 const list=$('#semesterList');
 function confirmSemesterRemoval(semester){
  const dialog=document.createElement('dialog');
  dialog.className='app-dialog semester-delete-dialog';
  dialog.setAttribute('aria-labelledby','semesterDeleteTitle');
  dialog.setAttribute('aria-describedby','semesterDeleteDescription');
  const heading=document.createElement('h2');heading.id='semesterDeleteTitle';heading.textContent='להסיר את הסמסטר?';
  const description=document.createElement('p');description.id='semesterDeleteDescription';
  description.textContent='הסרת '+state.label(semester)+' · '+semester.institution+' תמחק גם את הקורסים, המשימות, ההערות והסימונים של הסמסטר הזה. לא ניתן לבטל את המחיקה ללא גיבוי. האם להמשיך?';
  const actions=document.createElement('div');actions.className='dialog-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='action';cancel.textContent='ביטול';cancel.autofocus=true;cancel.onclick=()=>dialog.close();
  const approve=document.createElement('button');approve.type='button';approve.className='action soft-danger';approve.textContent='מחיקת הסמסטר';
  approve.onclick=()=>{
   const previous=JSON.stringify(state.workspace);
   const index=state.workspace.semesters.findIndex(s=>s.id===semester.id);
   if(index<0){dialog.close();return}
   state.workspace.semesters.splice(index,1);
   if(state.workspace.active===semester.id)state.workspace.active=state.workspace.semesters[Math.min(index,state.workspace.semesters.length-1)]?.id||null;
   try{state.change();dialog.close();location.hash='semester';location.reload()}
   catch{state.replace(JSON.parse(previous));dialog.close();$('#semesterStatus').textContent='המחיקה לא נשמרה. יש לפנות מקום במכשיר ולנסות שוב.'}
  };
  actions.append(cancel,approve);dialog.append(heading,description,actions);
  dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');dialog.remove()},{once:true});
  document.body.append(dialog);document.body.classList.add('modal-open');dialog.showModal();
 }
 function renderSemesters(){
  list.replaceChildren();
  $('#existingSemesters').hidden=!state.workspace.semesters.length;
  for(const semester of state.workspace.semesters){
   const row=document.createElement('div');row.className='semester-list-row';
   const selected=semester.id===state.workspace.active;
   const choose=document.createElement('button');choose.type='button';choose.className='historyitem semester-choice';
   choose.classList.toggle('selected-week',selected);
   choose.textContent=state.label(semester);
   choose.setAttribute('aria-description','החלקה ימינה או חץ ימינה במקלדת חושפים אפשרות הסרה.');
   if(selected)choose.setAttribute('aria-current','true');
   choose.onclick=()=>{
    if(suppressClick)return;
    if(opened){reveal(false);return}
    if(selected){reset(semester);$('#semesterFormTitle').scrollIntoView({behavior:'smooth',block:'start'});return}
    const previous=JSON.stringify(state.workspace);state.workspace.active=semester.id;
    try{state.change();location.hash='home';location.reload()}
    catch{state.replace(JSON.parse(previous));$('#semesterStatus').textContent='בחירת הסמסטר לא נשמרה. יש לפנות מקום במכשיר ולנסות שוב.'}
   };
   const remove=document.createElement('button');remove.type='button';remove.className='semester-remove';
   remove.textContent='הסרה';remove.setAttribute('aria-label','הסרת '+state.label(semester)+' · '+semester.institution);
   remove.onclick=()=>confirmSemesterRemoval(semester);
   let opened=false,suppressClick=false,gesture=null,clickTimer;
   const width=84;
   function reveal(open){
    opened=open;row.classList.toggle('remove-revealed',open);
    row.classList.remove('is-swiping');choose.style.transform=open?'translateX('+width+'px)':'';
    remove.inert=!open;remove.tabIndex=open?0:-1;
    remove.setAttribute('aria-hidden',String(!open));
   }
   function closeOthers(){list.querySelectorAll('.semester-list-row').forEach(other=>{if(other!==row)other.closeRemoval?.()})}
   row.closeRemoval=()=>reveal(false);
   choose.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||e.button!==0)return;
    clearTimeout(clickTimer);suppressClick=false;
    gesture={id:e.pointerId,x:e.clientX,y:e.clientY,start:opened?width:0,horizontal:false};
   });
   choose.addEventListener('pointermove',e=>{
    if(!gesture||gesture.id!==e.pointerId)return;
    const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;
    if(!gesture.horizontal){
     if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){gesture=null;return}
     if(Math.abs(dx)<10||Math.abs(dx)<=Math.abs(dy))return;
     gesture.horizontal=true;suppressClick=true;closeOthers();choose.setPointerCapture(e.pointerId);row.classList.add('is-swiping');
    }
    e.preventDefault();
    gesture.offset=Math.max(0,Math.min(width,gesture.start+dx));
    row.classList.toggle('remove-revealed',gesture.offset>0);
    choose.style.transform='translateX('+gesture.offset+'px)';
   });
   function finish(e,cancelled=false){
    if(!gesture||gesture.id!==e.pointerId)return;
    const moved=gesture.horizontal,offset=gesture.offset??gesture.start;gesture=null;
    if(moved){reveal(cancelled?opened:offset>=width*.4);if(choose.hasPointerCapture(e.pointerId))choose.releasePointerCapture(e.pointerId);clickTimer=setTimeout(()=>{suppressClick=false},300)}
   }
   choose.addEventListener('pointerup',e=>finish(e));
   choose.addEventListener('pointercancel',e=>finish(e,true));
   choose.addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='Delete'){e.preventDefault();closeOthers();reveal(true);remove.focus()}
    if(e.key==='ArrowLeft'||e.key==='Escape'){e.preventDefault();reveal(false)}
   });
   remove.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();reveal(false);choose.focus()}});
   reveal(false);
   row.append(remove,choose);list.append(row);
  }
 }
 renderSemesters();
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
