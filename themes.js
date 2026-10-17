(function(){
  'use strict';
  const names={'theme-atelier':'אטלייה','theme-cosmos':'קוסמוס','theme-garden':'גן פרא','theme-pop':'פופ־ארט','theme-notebook':'מחברת',modern:'העיצוב המודרני הקודם',classic:'העיצוב הקלאסי'};
  const colors={'theme-atelier':'#f3efe7','theme-cosmos':'#0d1226','theme-garden':'#edf1e7','theme-pop':'#ffeaf1','theme-notebook':'#eaf4f8',modern:'#192f58',classic:'#8c63ad'};
  const elements=[...document.querySelectorAll('[data-design-choice]')];
  const status=document.getElementById('designStatus');
  function renderSelection(){
    const selected=document.documentElement.dataset.design;
    elements.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.designChoice===selected)));
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',colors[selected]||colors.modern);
  }
  elements.forEach(button=>button.addEventListener('click',function(){
    const selected=this.dataset.designChoice;
    if(!Object.prototype.hasOwnProperty.call(names,selected))return;
    document.documentElement.dataset.design=selected;
    renderSelection();
    try{
      localStorage.setItem('study-design',selected);
      status.textContent='נבחרה ערכת העיצוב ״'+names[selected]+'״. הבחירה נשמרה במכשיר.';
    }catch(e){
      status.textContent='העיצוב הוחל, אך לא ניתן לשמור את הבחירה במכשיר.';
    }
  }));
  renderSelection();
})();