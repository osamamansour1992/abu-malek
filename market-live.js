(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(Number(value)) : '—';
  const dateFmt = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'medium',hour12:true}).format(d);
  };
  const ounceGrams = 31.1034768;
  const foreign = [['الدولار الأمريكي','USD'],['اليورو الأوروبي','EUR'],['الجنيه الإسترليني','GBP'],['الفرنك السويسري','CHF'],['الدولار الأسترالي','AUD']];
  const arabic = [['الريال السعودي','SAR'],['الدرهم الإماراتي','AED'],['الدينار الكويتي','KWD'],['الدينار البحريني','BHD'],['الريال العماني','OMR'],['الدينار الأردني','JOD'],['الريال القطري','QAR']];
  let egpPerUsd = null, gold24PerGram = null, goldKaratPrices = {}, goldTimestamp = null;
  let goldBusy = false, fxBusy = false, goldTimer = null, fxTimer = null;
  function setNote(message) { const note = document.querySelector('.source-note'); if (note) note.innerHTML = message; }
  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(url,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}});
      if (!response.ok) throw new Error('HTTP '+response.status);
      return await response.json();
    } finally { clearTimeout(timeout); }
  }
  async function loadFx() {
    if (fxBusy || document.hidden) return;
    fxBusy = true;
    try {
      const rows = await fetchJson('https://api.frankfurter.dev/v2/providers/cbe/rates?base=EGP');
      if (!Array.isArray(rows) || !rows.length) throw new Error('FX feed empty');
      const usd = rows.find(row => row.quote === 'USD' && Number(row.rate)>0);
      if (!usd) throw new Error('USD reference unavailable');
      egpPerUsd = 1/Number(usd.rate);
      const values = new Map(rows.map(row => [row.quote,Number(row.rate)]));
      const draw = list => list.map(([name,code]) => {
        const rate=values.get(code);
        if (!(rate>0)) return '';
        return '<article class="currency-tile"><span class="currency-code">'+code+'</span><b>'+name+'</b><strong>'+fmt(1/rate)+'</strong><small>جنيه مصري</small></article>';
      }).join('');
      $('currencyForeign').innerHTML=draw(foreign)||'<p class="currency-empty">بيانات العملات الأجنبية غير متاحة حاليًا.</p>';
      $('currencyArab').innerHTML=draw(arabic)||'<p class="currency-empty">بيانات العملات العربية غير متاحة حاليًا.</p>';
    } catch(error) { console.warn('FX update unavailable:',error); }
    finally { fxBusy=false; }
  }
  function updateCalculatorAvailability() {
    const message=$('calcMessage');
    if(message && gold24PerGram>0) message.textContent='السعر المرجعي جاهز. أدخل الوزن والمصنعية واضغط احسب التكلفة.';
  }
  function renderGold(data,global) {
    const payload=data?.data&&typeof data.data==='object'?data.data:data;
    const assets=Array.isArray(payload.assets)?payload.assets:Array.isArray(payload.data)?payload.data:[];
    const find=(...slugs)=>assets.find(a=>slugs.includes(String(a.slug||'').toLowerCase())||slugs.includes(String(a.id||'').toLowerCase()));
    const read=a=>{
      // In Daleelak: directions.buy = price paid by customer to buy; directions.sell = price paid to customer when selling.
      const customerBuys=Number(a?.directions?.buy?.best?.value);
      const customerSells=Number(a?.directions?.sell?.best?.value);
      return customerBuys>0&&customerSells>0?{sell:customerBuys,buy:customerSells,observedAt:a.observedAt,stale:!!a.freshness?.stale}:null;
    };
    const a24=find('gold-24k','gold-24'),a22=find('gold-22k','gold-22'),a21=find('gold-21k','gold-21'),a18=find('gold-18k','gold-18'),a14=find('gold-14k','gold-14'),a12=find('gold-12k','gold-12'),aCoin=find('gold-pound','gold-coin','gold-sovereign'),usd=find('us-dollar','USD-EGP');
    let p24=read(a24),p22=read(a22),p21=read(a21),p18=read(a18),p14=read(a14),p12=read(a12);
    const base=p24?{price:p24,karat:24}:p21?{price:p21,karat:21}:p18?{price:p18,karat:18}:p22?{price:p22,karat:22}:p14?{price:p14,karat:14}:p12?{price:p12,karat:12}:null;
    if(!base) throw new Error('Daleelak feed returned no usable gold-karat prices');
    const scaled=(source,fromKarat,toKarat)=>({buy:source.buy*toKarat/fromKarat,sell:source.sell*toKarat/fromKarat,observedAt:source.observedAt,stale:source.stale,estimated:true});
    p24=p24||scaled(base.price,base.karat,24);
    p22=p22||scaled(base.price,base.karat,22);
    p21=p21||scaled(base.price,base.karat,21);
    p18=p18||scaled(base.price,base.karat,18);
    p14=p14||scaled(base.price,base.karat,14);
    p12=p12||scaled(base.price,base.karat,12);
    const coin=read(aCoin)||{buy:p21.buy*8,sell:p21.sell*8,estimated:true,observedAt:p21.observedAt,stale:p21.stale};
    gold24PerGram=p24.sell;
    goldKaratPrices={24:p24.sell,22:p22.sell,21:p21.sell,18:p18.sell,14:p14.sell,12:p12.sell};
    const cards=[
      ['24','عيار 24',p24],['22','عيار 22',p22],['21','عيار 21',p21],['18','عيار 18',p18],
      ['14','عيار 14',p14],['12','عيار 12',p12],['coin','الجنيه ذهب',coin]
    ];
    $('goldGrid').innerHTML=cards.map(([key,label,p])=>{
      const estimated=p.estimated?'<small class="derived-note">محسوب حسب النقاء</small>':'';
      return '<article class="price-card '+(key==='21'?'featured':'')+'"><div class="card-top"><span>'+label+'</span>'+(key==='21'?'<span class="pill">الأكثر تداولًا</span>':'')+'</div><div class="buy-sell"><span>البيع لك <b>'+fmt(p.sell)+'</b></span><span>الشراء منك <b>'+fmt(p.buy)+'</b></span></div><div class="price-unit">'+(key==='coin'?'جنيه / 8 جرام':'جنيه / جرام')+'</div>'+estimated+'</article>';
    }).join('');
    const globalPrice=Number(global?.price||global?.last||global?.value);
    let globalTime=null;
    if(globalPrice>0){
      const changePct=Number.isFinite(Number(global.chp))?Number(global.chp):Number.isFinite(Number(global.changePercent))?Number(global.changePercent):null;
      const change=Number.isFinite(changePct)?(changePct>0?'+':'')+fmt(changePct)+'%':'التغير غير متاح';
      $('globalGoldPrice').textContent='$'+fmt(globalPrice);
      $('globalGoldChange').textContent=change;
      $('globalGoldChange').className='global-change'+(changePct>0?' up':changePct<0?' down':'');
      globalTime=global.updatedAt||(global.timestamp?Number(global.timestamp)*1000:null);
      $('globalGoldUpdated').textContent=dateFmt(globalTime);
      $('globalGoldStatus').textContent='LIVE';
    } else {
      $('globalGoldPrice').textContent='—';
      $('globalGoldChange').textContent='غير متاح حاليًا';
      $('globalGoldUpdated').textContent='—';
      $('globalGoldStatus').textContent='GLOBAL FEED UNAVAILABLE';
    }
    const usdRead=read(usd),benchmark=usd?.benchmark;
    const bankBuy=Number(benchmark?.buy),bankSell=Number(benchmark?.sell);
    const dealerBuy=usdRead?.buy,dealerSell=usdRead?.sell;
    const dollarCards=[
      ['دولار البنك',bankSell>0&&bankBuy>0?{sell:bankSell,buy:bankBuy}:null,'سعر مرجعي للبنك المركزي'],
      ['أفضل سعر دولار مرخص',dealerSell>0&&dealerBuy>0?{sell:dealerSell,buy:dealerBuy}:null,'أفضل جهة مرخصة حسب دليلك']
    ];
    $('dollarGrid').innerHTML=dollarCards.map(([label,p,desc])=>'<article class="price-card dollar-card"><div class="card-top"><span>'+label+'</span></div>'+(p?'<div class="buy-sell"><span>البيع لك <b>'+fmt(p.sell)+'</b></span><span>الشراء منك <b>'+fmt(p.buy)+'</b></span></div>':'<div class="price-value">—</div>')+'<div class="price-unit">'+desc+' · جنيه / دولار</div></article>').join('');
    const times=[p24.observedAt,p21.observedAt,p18.observedAt,globalTime].filter(Boolean).map(v=>new Date(v).getTime()).filter(Number.isFinite);
    goldTimestamp=times.length?new Date(Math.min(...times)).toISOString():data.generatedAt;
    const stale=[p24,p21,p18,p22,p14,p12,coin].some(p=>p.stale);
    $('lastUpdated').textContent=dateFmt(goldTimestamp)+(stale?' · بعض الأسعار من آخر تحديث سابق':'');
    updateCalculatorAvailability();
    setNote('<span class="status-dot"></span> الذهب المحلي: <a href="https://getdaleelak.com/ar/api" target="_blank" rel="noopener">دليلك</a> (أفضل أسعار الجهات المرخصة). الأونصة العالمية: <a href="https://gold-api.com/docs" target="_blank" rel="noopener">Gold API</a>. العيارات غير المتاحة منفصلة بالمصدر محسوبة حسب النقاء. <a href="https://market.isagha.com/prices" target="_blank" rel="noopener">مقارنة iSagha</a>. الأسعار استرشادية وليست عرض بيع ملزمًا.');
  }
  async function loadGold() {
    if(goldBusy||document.hidden)return;
    goldBusy=true;
    try {
      const results=await Promise.allSettled([
        fetchJson('https://getdaleelak.com/api/v1/feed.json?category=metals,currencies'),
        fetchJson('https://api.gold-api.com/price/XAU')
      ]);
      const local=results[0].status==='fulfilled'?results[0].value:null;
      const global=results[1].status==='fulfilled'?results[1].value:null;
      const payload=local?.data&&typeof local.data==='object'?local.data:local;
      const assets=Array.isArray(payload?.assets)?payload.assets:Array.isArray(payload?.data)?payload.data:[];
      if(!assets.length)throw new Error('Daleelak feed unavailable or has no assets');
      renderGold(local,global);
    } catch(error) {
      console.warn('Gold market update unavailable:',error);
      setNote('<span class="status-dot"></span> تعذر تحديث أحد مصادر الأسعار. تم الاحتفاظ بالبيانات الظاهرة مع عدم اعتبارها تحديثًا جديدًا. <a href="https://getdaleelak.com/ar/api" target="_blank" rel="noopener">دليلك</a> · <a href="https://gold-api.com/docs" target="_blank" rel="noopener">Gold API</a>.');
      $('globalGoldStatus').textContent='UPDATE UNAVAILABLE';
    } finally {goldBusy=false;}
  }
  function calculate() {
    const weight=Number($('weight')?.value),makingText=$('making')?.value??'',making=makingText.trim()===''?0:Number(makingText),karat=Number($('karat')?.value);
    if(!Number.isFinite(weight)||weight<=0||!Number.isFinite(making)||making<0||![12,14,18,21,22,24].includes(karat)){
      $('calcTotal').textContent='—';$('calcMessage').textContent='أدخل وزنًا أكبر من صفر ومصنعية صفر أو أكثر.';return;
    }
    if(!(gold24PerGram>0)){ $('calcTotal').textContent='—';$('calcMessage').textContent='بنحمّل سعر الذهب المرجعي الآن؛ جرّب بعد ظهور الأسعار.';return;}
    const perGram=goldKaratPrices[karat]||gold24PerGram*karat/24;
    $('calcTotal').textContent=fmt(weight*(perGram+making))+' ج.م';
    $('calcMessage').textContent='حساب استرشادي قبل أي رسوم أو دمغة غير مدخلة.';
  }
  $('calculate')?.addEventListener('click',calculate);
  ['weight','making','karat'].forEach(id=>$(id)?.addEventListener('keydown',event=>{if(event.key==='Enter')calculate();}));
  function schedule(){
    clearTimeout(goldTimer);clearTimeout(fxTimer);if(document.hidden)return;
    goldTimer=setTimeout(async()=>{await loadGold();schedule();},300000);
    fxTimer=setTimeout(async()=>{await loadFx();schedule();},21600000);
  }
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadGold();loadFx();schedule();}else{clearTimeout(goldTimer);clearTimeout(fxTimer);}});
  window.addEventListener('focus',()=>{if(!document.hidden){loadGold();loadFx();}});
  window.addEventListener('pageshow',event=>{if(event.persisted&&!document.hidden){loadGold();loadFx();}});
  const refreshButton=$('refreshPrices');
  refreshButton?.addEventListener('click',async()=>{refreshButton.disabled=true;refreshButton.textContent='جارٍ التحديث…';await Promise.allSettled([loadGold(),loadFx()]);refreshButton.disabled=false;refreshButton.textContent='تحديث الأسعار الآن';});
  Promise.allSettled([loadGold(),loadFx()]).finally(schedule);
})();
