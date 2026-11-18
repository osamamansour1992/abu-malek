(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const fmt = value => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(value);
  const ounceGrams = 31.1034768;
  const currencies = [
    ['الدولار الأمريكي','USD',1],['اليورو الأوروبي','EUR',1],['الجنيه الإسترليني','GBP',1],
    ['الفرنك السويسري','CHF',1],['الين الياباني (100)','JPY',100],['اليوان الصيني','CNY',1],
    ['الدولار الكندي','CAD',1],['الدولار الأسترالي','AUD',1],['الريال السعودي','SAR',1],
    ['الدرهم الإماراتي','AED',1],['الدينار الكويتي','KWD',1],['الدينار البحريني','BHD',1],
    ['الريال القطري','QAR',1],['الريال العماني','OMR',1],['الدينار الأردني','JOD',1],
    ['الكرونة الدنماركية','DKK',1],['الكرونة النرويجية','NOK',1],['الكرونة السويدية','SEK',1]
  ];

  let egpPerUsd = null;
  let gold24PerGram = null;
  let goldTimestamp = null;
  let fxDate = null;

  function setNote(message) {
    const note = document.querySelector('.source-note');
    if (note) note.innerHTML = message;
  }

  function renderGold() {
    if (!(gold24PerGram > 0)) return;
    const prices = {
      '21': gold24PerGram * 21 / 24,
      '24': gold24PerGram,
      '18': gold24PerGram * 18 / 24,
      'coin': gold24PerGram * 21 / 24 * 8
    };
    const cards = [
      ['21','عيار 21','21K'],['24','عيار 24','24K'],
      ['18','عيار 18','18K'],['coin','جنيه الذهب','8 جرام']
    ];
    $('goldGrid').innerHTML = cards.map(([key,label,sub], index) =>
      '<article class="price-card ' + (index === 0 ? 'featured' : '') + '">' +
      '<div class="card-top"><span>' + label + '</span><span class="tiny-gold">' + sub + '</span></div>' +
      '<div class="price-value">' + fmt(prices[key]) + '</div>' +
      '<div class="price-unit">جنيه مصري ' + (key === 'coin' ? '' : '/ جرام') + '</div>' +
      '<div class="buy-sell"><span>قيمة استرشادية</span><span>قبل المصنعية</span></div></article>'
    ).join('');

    const stamp = goldTimestamp ? new Date(goldTimestamp).toLocaleString('ar-EG') : 'وقت المصدر غير متاح';
    $('lastUpdated').textContent = 'الذهب: ' + stamp + (fxDate ? ' | الصرف: ' + fxDate : '');
  }

  function renderCurrencies(rows) {
    const data = rows.map(row => {
      const found = currencies.find(item => item[1] === row.quote);
      if (!found || !(Number(row.rate) > 0)) return '';
      const egp = (1 / Number(row.rate)) * found[2];
      return '<tr><td><b>' + found[0] + '</b><small>' + found[1] + ' / EGP</small></td>' +
        '<td>' + fmt(egp) + ' ج.م</td><td><span class="table-status">مرجعي يومي</span></td></tr>';
    }).filter(Boolean).join('');
    $('currencyRows').innerHTML = data || '<tr><td colspan="3">لم تتوفر أسعار العملات من المصدر حتى الآن.</td></tr>';
  }

  async function loadFx() {
    const url = 'https://api.frankfurter.dev/v2/rates?base=EGP&providers=CBE';
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error('FX HTTP ' + response.status);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) throw new Error('FX feed empty');
    const usd = rows.find(row => row.quote === 'USD' && Number(row.rate) > 0);
    if (!usd) throw new Error('CBE USD/EGP rate unavailable');
    egpPerUsd = 1 / Number(usd.rate);
    fxDate = rows.reduce((latest, row) => row.date > latest ? row.date : latest, '');
    renderCurrencies(rows);
    if (gold24PerGram) {
      const goldUsdPerOunce = gold24PerGram * ounceGrams / egpPerUsd;
      gold24PerGram = goldUsdPerOunce * egpPerUsd / ounceGrams;
      renderGold();
    }
    setNote('<span class="status-dot"></span> الذهب: <a href="https://gold-api.com" target="_blank" rel="noopener">Gold API</a> (سعر فوري عالمي). العملات: <a href="https://frankfurter.dev/providers/cbe/" target="_blank" rel="noopener">البنك المركزي المصري عبر Frankfurter</a> (أسعار مرجعية يومية، وليست أسعار شراء وبيع البنوك). سعر الذهب المحلي قيمة حسابية استرشادية قبل المصنعية والدمغة.');
  }

  async function loadGold() {
    const response = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store' });
    if (!response.ok) throw new Error('Gold HTTP ' + response.status);
    const data = await response.json();
    if (!(Number(data.price) > 0) || !data.updatedAt) throw new Error('Gold feed invalid');
    goldTimestamp = data.updatedAt;
    if (egpPerUsd > 0) {
      gold24PerGram = Number(data.price) * egpPerUsd / ounceGrams;
      renderGold();
    }
  }

  async function refreshAll() {
    try {
      await Promise.all([loadFx(), loadGold()]);
      if (egpPerUsd && gold24PerGram) {
        $('lastUpdated').textContent = 'الذهب: ' +
          new Date(goldTimestamp).toLocaleString('ar-EG') + ' | العملات: ' + fxDate;
      }
    } catch (error) {
      console.warn('Market sources unavailable:', error);
      setNote('<span class="status-dot"></span> تعذر تحديث أحد مصادر الأسعار. لن نعرض أرقامًا بديلة أو أسعار شراء وبيع غير موثقة.');
    }
  }

  $('calculate')?.addEventListener('click', () => {
    const weight = Number($('weight').value);
    const making = Number($('making').value || 0);
    const karat = Number($('karat').value);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(making) || making < 0) {
      $('calcMessage').textContent = 'أدخل وزنًا صحيحًا ومصنعية غير سالبة.';
      return;
    }
    if (!(gold24PerGram > 0)) {
      $('calcTotal').textContent = '—';
      $('calcMessage').textContent = 'الحاسبة غير متاحة حتى وصول أسعار المصدر.';
      return;
    }
    const perGram = gold24PerGram * karat / 24;
    $('calcTotal').textContent = fmt(weight * (perGram + making)) + ' ج.م';
    $('calcMessage').textContent = 'حساب استرشادي على سعر مرجعي عالمي وسعر صرف رسمي، قبل أي رسوم إضافية.';
  });

  refreshAll();
  // الذهب يتحدث دوريًا، أما أسعار البنك المركزي فتكفي مراجعتها كل 6 ساعات.
  setInterval(loadGold, 60000);
  setInterval(loadFx, 21600000);
})();