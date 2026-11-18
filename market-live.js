(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(value);
  const ounceGrams = 31.1034768;
  const foreign = [['الدولار الأمريكي','USD'],['اليورو الأوروبي','EUR'],['الجنيه الإسترليني','GBP'],['الفرنك السويسري','CHF'],['الدولار الأسترالي','AUD']];
  const arabic = [['الريال السعودي','SAR'],['الدرهم الإماراتي','AED'],['الدينار الكويتي','KWD'],['الدينار البحريني','BHD'],['الريال العماني','OMR'],['الدينار الأردني','JOD'],['الريال القطري','QAR']];
  const currencies = [...foreign,...arabic];
  let egpPerUsd=null, goldUsdPerOunce=null, gold24PerGram=null, goldTimestamp=null, fxDate=null;

  function setNote(message){const note=document.querySelector('.source-note');if(note)note.innerHTML=message;}
  function renderGold(){
    if(!(gold24PerGram>0)||!(goldUsdPerOunce>0)||!(egpPerUsd>0))return;
    const values=[
      ['24','عيار 24',gold24PerGram,'جنيه / جرام'],
      ['21','عيار 21',gold24PerGram*21/24,'جنيه / جرام'],
      ['18','عيار 18',gold24PerGram*18/24,'جنيه / جرام'],
      ['coin','جنيه الذهب',gold24PerGram*21/24*8,'جنيه / 8 جرام'],
      ['ounce','الأونصة عالميًا',goldUsdPerOunce,'دولار أمريكي'],
      ['usd','دولار الصاغة',egpPerUsd,'جنيه / دولار']
    ];
    $('goldGrid').innerHTML=values.map(([key,label,value,unit])=>
      '<article class="price-card '+(key==='21'?'featured':'')+(key==='usd'?' dollar-card':'')+'"><div class="card-top"><span>'+label+'</span>'+(key==='21'?'<span class="pill">الأكثر تداولًا</span>':'')+'</div><div class="price-value">'+fmt(value)+'</div><div class="price-unit">'+unit+'</div></article>'
    ).join('');
    $('lastUpdated').textContent='الذهب: '+(goldTimestamp?new Date(goldTimestamp).toLocaleString('ar-EG'):'—')+' | العملات: '+(fxDate||'—');
  }
  function renderCurrencies(rows){
    const valid=rows.map(row=>{
      const def=currencies.find(item=>item[1]===row.quote);
      if(!def||!(Number(row.rate)>0))return null;
      return {name:def[0],code:def[1],value:(1/Number(row.rate))};
    }).filter(Boolean);
    const draw=(list)=>list.map(c=>
      '<article class="currency-tile"><span class="currency-code">'+c.code+'</span><b>'+c.name+'</b><strong>'+fmt(c.value)+'</strong><small>جنيه مصري</small></article>'
    ).join('');
    $('currencyForeign').innerHTML=draw(valid.filter(c=>foreign.some(x=>x[1]===c.code)))||'<p class="currency-empty">بيانات العملات الأجنبية غير متاحة حاليًا.</p>';
    $('currencyArab').innerHTML=draw(valid.filter(c=>arabic.some(x=>x[1]===c.code)))||'<p class="currency-empty">بيانات العملات العربية غير متاحة حاليًا.</p>';
  }
  async function loadFx(){
    const response=await fetch('https://api.frankfurter.dev/v2/providers/cbe/rates?base=EGP',{cache:'no-store'});
    if(!response.ok)throw new Error('FX HTTP '+response.status);
    const rows=await response.json();
    if(!Array.isArray(rows)||!rows.length)throw new Error('FX feed empty');
    const usd=rows.find(row=>row.quote==='USD'&&Number(row.rate)>0);
    if(!usd)throw new Error('CBE USD/EGP rate unavailable');
    egpPerUsd=1/Number(usd.rate);
    if(goldUsdPerOunce>0)gold24PerGram=goldUsdPerOunce*egpPerUsd/ounceGrams;
    fxDate=rows.reduce((latest,row)=>row.date>latest?row.date:latest,'');
    renderCurrencies(rows);renderGold();
    setNote('<span class="status-dot"></span> الذهب: <a href="https://gold-api.com" target="_blank" rel="noopener">Gold API</a>. العملات: <a href="https://frankfurter.dev/providers/cbe/" target="_blank" rel="noopener">بيانات البنك المركزي المصري عبر Frankfurter</a>؛ أسعار مرجعية وليست أسعار بيع وشراء البنوك. الذهب قيمة استرشادية قبل المصنعية والدمغة.');
  }
  async function loadGold(){
    const response=await fetch('https://api.gold-api.com/price/XAU',{cache:'no-store'});
    if(!response.ok)throw new Error('Gold HTTP '+response.status);
    const data=await response.json();
    if(!(Number(data.price)>0)||!data.updatedAt)throw new Error('Gold feed invalid');
    goldTimestamp=data.updatedAt;goldUsdPerOunce=Number(data.price);
    if(egpPerUsd>0){gold24PerGram=goldUsdPerOunce*egpPerUsd/ounceGrams;renderGold();}
  }
  async function refreshAll(){
    const results=await Promise.allSettled([loadFx(),loadGold()]);
    if(results.some(x=>x.status==='rejected')){
      console.warn('Market source update issue:',results.filter(x=>x.status==='rejected').map(x=>x.reason));
      setNote('<span class="status-dot"></span> تعذر تحديث أحد مصادر الأسعار. ستظل الأسعار غير المتاحة ظاهرة دون أرقام بديلة.');
    }
  }
  $('calculate')?.addEventListener('click',()=>{
    const weight=Number($('weight').value),making=Number($('making').value||0),karat=Number($('karat').value);
    if(!Number.isFinite(weight)||weight<=0||!Number.isFinite(making)||making<0){$('calcMessage').textContent='أدخل وزنًا صحيحًا ومصنعية غير سالبة.';return;}
    if(!(gold24PerGram>0)){$('calcTotal').textContent='—';$('calcMessage').textContent='الحاسبة غير متاحة حتى وصول أسعار المصدر.';return;}
    const perGram=gold24PerGram*karat/24;
    $('calcTotal').textContent=fmt(weight*(perGram+making))+' ج.م';
    $('calcMessage').textContent='حساب استرشادي على سعر مرجعي عالمي وسعر صرف رسمي، قبل أي رسوم إضافية.';
  });
  refreshAll();
  setInterval(loadGold,60000);
  setInterval(loadFx,21600000);
})();