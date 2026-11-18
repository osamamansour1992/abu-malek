(() => {
  const cfg = window.ABU_MALEK_CONFIG || {};
  const $ = id => document.getElementById(id);
  const format = n => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(n);
  let market = null;

  $('year').textContent = new Date().getFullYear();
  $('themeToggle').addEventListener('click', () => document.body.classList.toggle('light'));

  async function loadMarket() {
    if (!cfg.MARKET_API_URL) return;
    try {
      const res = await fetch(cfg.MARKET_API_URL, {headers:{'Accept':'application/json'}, cache:'no-store'});
      if (!res.ok) throw new Error('تعذر جلب الأسعار');
      const data = await res.json();
      if (!data || !data.updatedAt || !data.gold || !Array.isArray(data.currencies)) throw new Error('بنية بيانات غير صحيحة');
      market = data;
      renderMarket(data);
    } catch (e) {
      console.warn('Market feed unavailable:', e);
      $('lastUpdated').textContent = 'تعذر التحديث؛ تحقق من المصدر';
    }
  }

  function renderMarket(data) {
    const goldOrder = ['21','24','18','coin'];
    const labels = {'21':'عيار 21','24':'عيار 24','18':'عيار 18','coin':'جنيه الذهب'};
    $('goldGrid').innerHTML = goldOrder.map((key,i) => {
      const item = data.gold[key];
      if (!item || !Number.isFinite(Number(item.buy)) || !Number.isFinite(Number(item.sell))) return '';
      return `<article class="price-card ${i===0?'featured':''}"><div class="card-top"><span>${labels[key]}</span><span class="tiny-gold">${key==='coin'?'8 GRAM':key+'K'}</span></div><div class="price-value">${format(item.sell)}</div><div class="price-unit">جنيه مصري ${key==='coin'?'':'/ جرام'}</div><div class="buy-sell"><span>شراء <b>${format(item.buy)}</b></span><span>بيع <b>${format(item.sell)}</b></span></div></article>`;
    }).join('');
    $('currencyRows').innerHTML = data.currencies.map(c => `<tr><td><b>${escapeHtml(c.name)}</b><small>${escapeHtml(c.code||'')}</small></td><td>${format(c.buy)}</td><td>${format(c.sell)}</td><td><span class="table-status">${escapeHtml(c.source||'مصدر البيانات')}</span></td></tr>`).join('');
    const date = new Date(data.updatedAt);
    $('lastUpdated').textContent = Number.isNaN(date.getTime()) ? 'وقت التحديث غير معروف' : date.toLocaleString('ar-EG');
  }

  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  $('calculate').addEventListener('click', () => {
    const weight = Number($('weight').value), making = Number($('making').value || 0), karat = $('karat').value;
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(making) || making < 0) {
      $('calcMessage').textContent = 'أدخل وزنًا صحيحًا ومصنعية غير سالبة.'; return;
    }
    if (!market?.gold?.[karat] || !Number.isFinite(Number(market.gold[karat].sell))) {
      $('calcTotal').textContent = '—'; $('calcMessage').textContent = 'الحاسبة غير مفعلة: لا يوجد سعر موثوق لهذا العيار حاليًا.'; return;
    }
    const total = weight * (Number(market.gold[karat].sell) + making);
    $('calcTotal').textContent = format(total) + ' ج.م';
    $('calcMessage').textContent = `على أساس سعر بيع ${format(market.gold[karat].sell)} جنيه للجرام، ومصنعية ${format(making)} جنيه للجرام.`;
  });

  async function loadBlogger() {
    if (!cfg.BLOGGER_FEED_URL) return;
    try {
      const response = await fetch(cfg.BLOGGER_FEED_URL);
      if (!response.ok) throw new Error('Feed unavailable');
      const feed = await response.json();
      const entries = feed.feed?.entry || [];
      const cards = entries.slice(0,4).map(entry => {
        const title = entry.title?.$t || 'مقال جديد';
        const link = (entry.link||[]).find(x=>x.rel==='alternate')?.href || '#';
        const content = (entry.summary?.$t || '').replace(/<[^>]*>/g,'').slice(0,150);
        return `<article class="article-placeholder"><span class="article-kicker">من المدونة</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(content)}</p><a class="text-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">اقرأ المقال ←</a></article>`;
      });
      if (cards.length) $('articleGrid').innerHTML = cards.join('');
    } catch(e) { console.warn('Blogger feed unavailable:', e); }
  }

  loadMarket();
  loadBlogger();
  if (cfg.REFRESH_INTERVAL_MS > 0) setInterval(loadMarket, cfg.REFRESH_INTERVAL_MS);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }
})();