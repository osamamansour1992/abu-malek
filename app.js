(() => {
  const cfg = window.ABU_MALEK_CONFIG || {};
  const $ = id => document.getElementById(id);
  const format = n => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(n);
  let market = null;

  $('year').textContent = new Date().getFullYear();
  $('themeToggle').addEventListener('click', () => document.body.classList.toggle('light'));

  async function loadMarket() {
    if (!cfg.MARKET_API_URL) {
      $('lastUpdated').textContent = 'مصدر الأسعار لم يُعتمد بعد';
      const note = document.querySelector('.source-note');
      if (note) note.textContent = 'الأسعار متوقفة مؤقتًا حتى اعتماد مزوّد يسمح بإعادة النشر التجاري. لن نعرض أسعارًا تقديرية أو قديمة.';
      renderUnavailableCurrencies();
      return;
    }
    try {
      const res = await fetch(cfg.MARKET_API_URL, {
        headers: {'Accept':'application/json'},
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const feed = await res.json();
      if (!feed || typeof feed !== 'object' || !feed.gold || !Array.isArray(feed.currencies)) {
        throw new Error('صيغة البيانات غير مطابقة للعقد المطلوب');
      }
      const validPair = pair => pair &&
        Number.isFinite(Number(pair.buy)) && Number(pair.buy) > 0 &&
        Number.isFinite(Number(pair.sell)) && Number(pair.sell) > 0;
      const gold = {};
      for (const karat of ['18','21','24','14','coin']) {
        if (validPair(feed.gold[karat])) gold[karat] = {
          buy:Number(feed.gold[karat].buy),
          sell:Number(feed.gold[karat].sell),
          source:String(feed.gold[karat].source || feed.gold[karat].buySource || 'مصدر الأسعار')
        };
      }
      const currencies = feed.currencies
        .filter(c => c && c.code && validPair(c))
        .map(c => ({
          name:String(c.name || c.code),
          code:String(c.code),
          buy:Number(c.buy),
          sell:Number(c.sell),
          source:String(c.source || 'مصدر الأسعار')
        }));
      const updatedAt = feed.updatedAt || feed.rateDate || '';
      if (!updatedAt || Number.isNaN(new Date(updatedAt).getTime())) {
        throw new Error('المصدر لم يرسل تاريخ تحديث صالحًا');
      }
      if (!Object.keys(gold).length && !currencies.length) {
        throw new Error('لا توجد أسعار صالحة للعرض');
      }
      market = {updatedAt, gold, currencies, status:feed.status === 'stale' ? 'stale' : 'fresh'};
      renderMarket(market);
      const note = document.querySelector('.source-note');
      if (note) {
        const sourceName = escapeHtml(feed.sourceName || 'مصدر البيانات المعتمد');
        const sourceUrl = feed.sourceUrl ? String(feed.sourceUrl) : '';
        note.innerHTML = '<span class="status-dot"></span> مصدر البيانات: ' +
          (sourceUrl.startsWith('https://') ? '<a href="' + escapeHtml(sourceUrl) + '" target="_blank" rel="noopener">' + sourceName + '</a>' : sourceName) +
          '. تاريخ الرصد المعروض هو التاريخ الوارد من المصدر نفسه.';
      }
    } catch (e) {
      console.warn('Market feed unavailable:', e);
      $('lastUpdated').textContent = market
        ? $('lastUpdated').textContent + ' — تعذر التحديث؛ آخر قراءة محفوظة'
        : 'تعذر جلب أسعار موثوقة حاليًا';
      const note = document.querySelector('.source-note');
      if (note) note.textContent = 'تعذر جلب بيانات موثوقة. لن نستبدلها بأرقام تقديرية أو بتاريخ تحديث غير حقيقي.';
    }
  }

  function renderUnavailableCurrencies() {
    const defs = [
      ['الدولار الأمريكي','USD'],['اليورو الأوروبي','EUR'],['الجنيه الإسترليني','GBP'],
      ['الفرنك السويسري','CHF'],['الين الياباني (100)','JPY'],['اليوان الصيني','CNY'],
      ['الدولار الكندي','CAD'],['الدولار الأسترالي','AUD'],['الريال السعودي','SAR'],
      ['الدرهم الإماراتي','AED'],['الدينار الكويتي','KWD'],['الدينار البحريني','BHD'],
      ['الريال القطري','QAR'],['الريال العماني','OMR'],['الدينار الأردني','JOD'],
      ['الكرونة الدنماركية','DKK'],['الكرونة النرويجية','NOK'],['الكرونة السويدية','SEK']
    ];
    $('currencyRows').innerHTML = defs.map(([name,code]) =>
      '<tr><td><b>' + escapeHtml(name) + '</b><small>' + code + ' / EGP</small></td><td>غير متاح</td><td>غير متاح</td><td><span class="table-status">بانتظار مصدر معتمد</span></td></tr>'
    ).join('');
  }

  function renderMarket(data) {
    const goldOrder = ['21','24','18','coin'];
    const labels = {'21':'عيار 21','24':'عيار 24','18':'عيار 18','coin':'جنيه الذهب'};
    $('goldGrid').innerHTML = goldOrder.map((key,i) => {
      const item = data.gold[key];
      if (!item) return '';
      return '<article class="price-card ' + (i===0?'featured':'') + '"><div class="card-top"><span>' + labels[key] + '</span><span class="tiny-gold">' + (key==='coin'?'8 GRAM':key+'K') + '</span></div><div class="price-value">' + format(item.sell) + '</div><div class="price-unit">جنيه مصري ' + (key==='coin'?'':'/ جرام') + '</div><div class="buy-sell"><span>شراء <b>' + format(item.buy) + '</b></span><span>بيع <b>' + format(item.sell) + '</b></span></div></article>';
    }).join('') || '<p class="source-note">أسعار الذهب غير متاحة من مصدر معتمد حاليًا.</p>';
    $('currencyRows').innerHTML = data.currencies.map(c =>
      '<tr><td><b>' + escapeHtml(c.name) + '</b><small>' + escapeHtml(c.code) + ' / EGP</small></td><td>' + format(c.buy) + '</td><td>' + format(c.sell) + '</td><td><span class="table-status">' + escapeHtml(c.source) + '</span></td></tr>'
    ).join('') || '<tr><td colspan="4">أسعار العملات غير متاحة حاليًا.</td></tr>';
    const date = new Date(data.updatedAt);
    const status = data.status === 'stale' ? ' — بيانات قديمة؛ آخر تحديث ناجح' : '';
    $('lastUpdated').textContent = date.toLocaleString('ar-EG') + status;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

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

  function bloggerText(entry) {
    const raw = entry.summary?.$t || entry.content?.$t || '';
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 175);
  }

  function bloggerImage(entry) {
    const media = entry.media$thumbnail?.url;
    if (media) return media.replace(/\/s\d+(-c)?\//, '/s640/');
    const html = entry.content?.$t || '';
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }

  function loadBlogger() {
    const status = $('bloggerStatus');
    const callbackName = '__abuMalekBloggerCallback';

    if (!cfg.BLOGGER_FEED_URL) {
      status.textContent = 'لم يتم ضبط رابط مدونة بلوجر بعد.';
      return;
    }

    const previous = document.getElementById('blogger-jsonp');
    if (previous) previous.remove();

    const url = new URL(cfg.BLOGGER_FEED_URL);
    url.searchParams.set('alt', 'json-in-script');
    url.searchParams.set('max-results', '20');
    url.searchParams.set('callback', callbackName);

    const script = document.createElement('script');
    script.id = 'blogger-jsonp';
    script.src = url.toString();
    let finished = false;

    function cleanup() {
      finished = true;
      delete window[callbackName];
      script.remove();
      clearTimeout(timer);
    }

    window[callbackName] = feed => {
      if (finished) return;
      const entries = feed?.feed?.entry || [];
      if (!entries.length) {
        cleanup();
        status.textContent = 'لا توجد مقالات منشورة في خلاصة بلوجر.';
        return;
      }

      const cards = entries.slice(0, 4).map(entry => {
        const title = entry.title?.$t || 'مقال جديد';
        const link = (entry.link || []).find(x => x.rel === 'alternate')?.href
          || 'https://asearaldhahab.blogspot.com/';
        const summary = bloggerText(entry);
        const image = bloggerImage(entry);
        const published = entry.published?.$t ? new Date(entry.published.$t) : null;
        const date = published && !Number.isNaN(published.getTime())
          ? published.toLocaleDateString('ar-EG') : '';

        return `<article class="article-placeholder article-live">
          ${image ? `<a class="article-thumb" href="${escapeHtml(link)}" target="_blank" rel="noopener"><img src="${escapeHtml(image)}" alt="" loading="lazy"></a>` : ''}
          <span class="article-kicker">من مدونة أبو مالك ${date ? '· ' + date : ''}</span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(summary || 'اقرأ المقال كاملًا على مدونة بلوجر.')}</p>
          <a class="text-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">اقرأ المقال ←</a>
        </article>`;
      });

      $('articleGrid').innerHTML = cards.join('');
      status.textContent = `تم تحميل ${entries.length} مقالًا من مدونة بلوجر.`;
      cleanup();
    };

    script.onerror = () => {
      if (finished) return;
      cleanup();
      status.textContent = 'تعذر الاتصال بخلاصة بلوجر. يمكنك زيارة المدونة مباشرة.';
    };

    const timer = setTimeout(() => {
      if (finished) return;
      cleanup();
      status.textContent = 'انتهت مهلة تحميل المقالات. حاول التحديث لاحقًا.';
    }, 12000);

    document.head.appendChild(script);
  }

  loadMarket();
  loadBlogger();
  if (cfg.REFRESH_INTERVAL_MS > 0) setInterval(loadMarket, cfg.REFRESH_INTERVAL_MS);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.warn));
  }
})();