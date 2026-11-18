(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(value);
  const ounceGrams = 31.1034768;
  const foreign = [['الدولار الأمريكي','USD'],['اليورو الأوروبي','EUR'],['الجنيه الإسترليني','GBP'],['الفرنك السويسري','CHF'],['الدولار الأسترالي','AUD']];
  const arabic = [['الريال السعودي','SAR'],['الدرهم الإماراتي','AED'],['الدينار الكويتي','KWD'],['الدينار البحريني','BHD'],['الريال العماني','OMR'],['الدينار الأردني','JOD'],['الريال القطري','QAR']];
  const allCurrencies = [...foreign,...arabic];
  let egpPerUsd = null, goldUsdPerOunce = null, gold24PerGram = null, goldTimestamp = null, fxDate = null;
  let goldBusy = false, fxBusy = false, goldTimer = null, fxTimer = null;

  function setNote(message) { const note = document.querySelector('.source-note'); if (note) note.innerHTML = message; }
  function renderGold() {
    if (!(gold24PerGram > 0) || !(goldUsdPerOunce > 0) || !(egpPerUsd > 0)) return;
    const values = [
      ['24','عيار 24',gold24PerGram,'جنيه / جرام'],
      ['21','عيار 21',gold24PerGram*21/24,'جنيه / جرام'],
      ['18','عيار 18',gold24PerGram*18/24,'جنيه / جرام'],
      ['coin','جنيه الذهب',gold24PerGram*21/24*8,'جنيه / 8 جرام'],
      ['ounce','الأونصة عالميًا',goldUsdPerOunce,'دولار أمريكي'],
      ['usd','دولار الصاغة',egpPerUsd,'جنيه / دولار']
    ];
    $('goldGrid').innerHTML = values.map(([key,label,value,unit]) =>
      '<article class="price-card '+(key==='21'?'featured ':'')+(key==='usd'?'dollar-card':'')+'"><div class="card-top"><span>'+label+'</span>'+(key==='21'?'<span class="pill">الأكثر تداولًا</span>':'')+'</div><div class="price-value">'+fmt(value)+'</div><div class="price-unit">'+unit+'</div></article>'
    ).join('');
    $('lastUpdated').textContent = 'الذهب: '+(goldTimestamp ? new Date(goldTimestamp).toLocaleString('ar-EG') : '—')+' | العملات: '+(fxDate || '—');
    updateCalculatorAvailability();
  }
  function renderCurrencies(rows) {
    const values = new Map(rows.map(row => [row.quote, Number(row.rate)]));
    const draw = list => list.map(([name,code]) => {
      const rate = values.get(code);
      if (!(rate > 0)) return '';
      return '<article class="currency-tile"><span class="currency-code">'+code+'</span><b>'+name+'</b><strong>'+fmt(1/rate)+'</strong><small>جنيه مصري</small></article>';
    }).join('');
    $('currencyForeign').innerHTML = draw(foreign) || '<p class="currency-empty">بيانات العملات الأجنبية غير متاحة حاليًا.</p>';
    $('currencyArab').innerHTML = draw(arabic) || '<p class="currency-empty">بيانات العملات العربية غير متاحة حاليًا.</p>';
  }
  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(url, {signal:controller.signal, cache:'default', headers:{'Accept':'application/json'}});
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
      const usd = rows.find(row => row.quote === 'USD' && Number(row.rate) > 0);
      if (!usd) throw new Error('USD rate unavailable');
      egpPerUsd = 1 / Number(usd.rate);
      fxDate = rows.reduce((latest,row) => row.date > latest ? row.date : latest,'');
      if (goldUsdPerOunce > 0) gold24PerGram = goldUsdPerOunce*egpPerUsd/ounceGrams;
      renderCurrencies(rows); renderGold();
      setNote('<span class="status-dot"></span> الذهب: <a href="https://gold-api.com" target="_blank" rel="noopener">Gold API</a>. العملات: <a href="https://frankfurter.dev/providers/cbe/" target="_blank" rel="noopener">بيانات البنك المركزي المصري عبر Frankfurter</a>؛ أسعار مرجعية وليست أسعار بيع وشراء البنوك. الذهب قيمة استرشادية قبل المصنعية والدمغة.');
    } catch (error) {
      console.warn('FX update unavailable:', error);
      setNote('<span class="status-dot"></span> تعذر تحديث أسعار العملات من المصدر حاليًا؛ لا نعرض أرقامًا بديلة.');
    } finally { fxBusy = false; }
  }
  async function loadGold() {
    if (goldBusy || document.hidden) return;
    goldBusy = true;
    try {
      const data = await fetchJson('https://api.gold-api.com/price/XAU');
      if (!(Number(data.price) > 0) || !data.updatedAt) throw new Error('Gold feed invalid');
      goldTimestamp = data.updatedAt;
      goldUsdPerOunce = Number(data.price);
      if (egpPerUsd > 0) { gold24PerGram = goldUsdPerOunce*egpPerUsd/ounceGrams; renderGold(); }
    } catch (error) {
      console.warn('Gold update unavailable:', error);
      setNote('<span class="status-dot"></span> تعذر تحديث سعر الذهب من المصدر حاليًا؛ لا نعرض أرقامًا بديلة.');
    } finally { goldBusy = false; }
  }
  function updateCalculatorAvailability() {
    const message = $('calcMessage');
    if (message && gold24PerGram > 0) message.textContent = 'السعر المرجعي جاهز. أدخل الوزن والمصنعية واضغط احسب التكلفة.';
  }
  function calculate() {
    const weight = Number($('weight')?.value);
    const makingText = $('making')?.value ?? '';
    const making = makingText.trim() === '' ? 0 : Number(makingText);
    const karat = Number($('karat')?.value);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(making) || making < 0 || ![14,18,21,24].includes(karat)) {
      $('calcTotal').textContent = '—';
      $('calcMessage').textContent = 'أدخل وزنًا أكبر من صفر ومصنعية صفر أو أكثر.';
      return;
    }
    if (!(gold24PerGram > 0)) {
      $('calcTotal').textContent = '—';
      $('calcMessage').textContent = 'بنحمّل سعر الذهب المرجعي الآن؛ جرّب بعد ظهور الأسعار.';
      return;
    }
    const perGram = gold24PerGram * karat / 24;
    $('calcTotal').textContent = fmt(weight * (perGram + making)) + ' ج.م';
    $('calcMessage').textContent = 'حساب استرشادي قبل أي رسوم أو دمغة غير مدخلة.';
  }
  $('calculate')?.addEventListener('click', calculate);
  ['weight','making','karat'].forEach(id => $(id)?.addEventListener('keydown', event => { if (event.key === 'Enter') calculate(); }));
  function schedule() {
    clearTimeout(goldTimer); clearTimeout(fxTimer);
    if (document.hidden) return;
    goldTimer = setTimeout(async () => { await loadGold(); schedule(); }, 60000);
    fxTimer = setTimeout(async () => { await loadFx(); schedule(); }, 21600000);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { loadGold(); loadFx(); schedule(); }
    else { clearTimeout(goldTimer); clearTimeout(fxTimer); }
  });
  Promise.allSettled([loadFx(),loadGold()]).finally(schedule);
})();