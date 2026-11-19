(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(value);
  const ounceGrams = 31.1034768;
  const foreign = [['الدولار الأمريكي','USD'],['اليورو الأوروبي','EUR'],['الجنيه الإسترليني','GBP'],['الفرنك السويسري','CHF'],['الدولار الأسترالي','AUD']];
  const arabic = [['الريال السعودي','SAR'],['الدرهم الإماراتي','AED'],['الدينار الكويتي','KWD'],['الدينار البحريني','BHD'],['الريال العماني','OMR'],['الدينار الأردني','JOD'],['الريال القطري','QAR']];
  const allCurrencies = [...foreign,...arabic];
  let egpPerUsd = null, goldUsdPerOunce = null, gold24PerGram = null, goldKaratPrices = {}, goldTimestamp = null, fxDate = null;
  let goldBusy = false, fxBusy = false, goldTimer = null, fxTimer = null, goldSourceTimestamp = null;

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
      const response = await fetch(url, {signal:controller.signal, cache:'no-store', headers:{'Accept':'application/json'}});
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
      // Gold source attribution is managed by loadGold; FX refresh must not overwrite it.
    } catch (error) {
      console.warn('FX update unavailable:', error);
      console.warn('FX prices are temporarily unavailable; existing displayed rates are retained.');
    } finally { fxBusy = false; }
  }
  async function loadGold() {
    if (goldBusy || document.hidden) return;
    goldBusy = true;
    try {
      const data = await fetchJson('https://getdaleelak.com/api/v1/feed.json?category=metals');
      if (!data || !Array.isArray(data.assets) || !data.assets.length) throw new Error('Daleelak feed invalid');
      const findAsset = (...slugs) => data.assets.find(asset => slugs.includes(String(asset.slug || '').toLowerCase()) || slugs.includes(String(asset.id || '').toLowerCase()));
      const pick = asset => {
        const buy = Number(asset?.directions?.buy?.best?.value);
        const sell = Number(asset?.directions?.sell?.best?.value);
        return buy > 0 && sell > 0 ? {buy, sell} : null;
      };
      const a24 = findAsset('gold-24k','gold-24');
      const a21 = findAsset('gold-21k','gold-21');
      const a18 = findAsset('gold-18k','gold-18');
      const coin = findAsset('gold-pound','gold-coin','gold-sovereign');
      const p24 = pick(a24), p21 = pick(a21), p18 = pick(a18), pCoin = pick(coin);
      if (!p24 || !p21 || !p18) throw new Error('Daleelak gold karat prices unavailable');
      const bestSell = p21.sell;
      gold24PerGram = p24.sell;
      goldKaratPrices = {14:p18.sell*14/18,18:p18.sell,21:p21.sell,24:p24.sell};
      goldTimestamp = a21.observedAt || a21.asOf || data.generatedAt || new Date().toISOString();
      goldSourceTimestamp = goldTimestamp;
      const ounce = Number(a24?.global?.value || a24?.benchmark?.global || 0);
      const coinPrices = pCoin || {buy:p21.buy*8, sell:p21.sell*8};
      const cards = [
        ['24','عيار 24',p24,'جنيه / جرام'],
        ['21','عيار 21',p21,'جنيه / جرام'],
        ['18','عيار 18',p18,'جنيه / جرام'],
        ['coin','جنيه الذهب',coinPrices,'جنيه / 8 جرام'],
        ['ounce','الأونصة عالميًا',ounce > 0 ? {buy:ounce,sell:ounce} : null,'دولار أمريكي'],
        ['usd','دولار الصاغة',null,'']
      ];
      $('goldGrid').innerHTML = cards.map(([key,label,prices,unit]) => {
        const value = prices ? '<div class="price-value">'+fmt(prices.sell)+'</div><div class="buy-sell"><span>بيع: <b>'+fmt(prices.sell)+'</b></span><span>شراء: <b>'+fmt(prices.buy)+'</b></span></div>' :
          key === 'usd' ? '<div class="price-value">'+(egpPerUsd > 0 ? fmt(egpPerUsd) : '—')+'</div><div class="price-unit">مرجع البنك المركزي</div>' :
          '<div class="price-value">—</div><div class="price-unit">غير متاح من المصدر</div>';
        return '<article class="price-card '+(key==='21'?'featured ':'')+(key==='usd'?'dollar-card':'')+'"><div class="card-top"><span>'+label+'</span>'+(key==='21'?'<span class="pill">الأكثر تداولًا</span>':'')+'</div>'+value+(unit?'<div class="price-unit">'+unit+'</div>':'')+'</article>';
      }).join('');
      $('lastUpdated').textContent = new Date(goldTimestamp).toLocaleString('ar-EG');
      updateCalculatorAvailability();
      setNote('<span class="status-dot"></span> أسعار الذهب المحلية من <a href="https://getdaleelak.com/ar/api" target="_blank" rel="noopener">دليلك</a> (أفضل سعر شراء وبيع من الجهات المرخصة). <a href="https://market.isagha.com/prices" target="_blank" rel="noopener">افتح أسعار iSagha للمقارنة</a>. الأسعار استرشادية وقد تختلف حسب التاجر.');
    } catch (error) {
      console.warn('Gold update unavailable:', error);
      setNote('<span class="status-dot"></span> تعذر تحديث أسعار الذهب من دليلك حاليًا. لم نعرض أسعارًا قديمة على أنها أسعار جديدة. <a href="https://getdaleelak.com/ar/api" target="_blank" rel="noopener">حالة المصدر</a>.');
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
    const perGram = goldKaratPrices[karat] || (gold24PerGram * karat / 24);
    $('calcTotal').textContent = fmt(weight * (perGram + making)) + ' ج.م';
    $('calcMessage').textContent = 'حساب استرشادي قبل أي رسوم أو دمغة غير مدخلة.';
  }
  $('calculate')?.addEventListener('click', calculate);
  ['weight','making','karat'].forEach(id => $(id)?.addEventListener('keydown', event => { if (event.key === 'Enter') calculate(); }));
  function schedule() {
    clearTimeout(goldTimer); clearTimeout(fxTimer);
    if (document.hidden) return;
    goldTimer = setTimeout(async () => { await loadGold(); schedule(); }, 300000);
    fxTimer = setTimeout(async () => { await loadFx(); schedule(); }, 21600000);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { loadGold(); loadFx(); schedule(); }
    else { clearTimeout(goldTimer); clearTimeout(fxTimer); }
  });
  const refreshButton = $('refreshPrices');
  refreshButton?.addEventListener('click', async () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'جارٍ التحديث…';
    await Promise.allSettled([loadGold(), loadFx()]);
    refreshButton.disabled = false;
    refreshButton.textContent = 'تحديث الأسعار الآن';
  });
  Promise.allSettled([loadFx(),loadGold()]).finally(schedule);
})();