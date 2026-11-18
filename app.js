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
      const res = await fetch(cfg.MARKET_API_URL, {
        headers: {'Accept':'application/json', 'X-Contact':'https://osamamansour1992.github.io/abu-malek/'},
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('تعذر جلب الأسعار: HTTP ' + res.status);
      const feed = await res.json();
      if (!Array.isArray(feed.assets)) throw new Error('صيغة بيانات المصدر غير متوقعة');

      const find = slug => feed.assets.find(a => a.slug === slug);
      const quote = (asset, side) => {
        const best = asset?.directions?.[side]?.best;
        if (!best || !Number.isFinite(Number(best.value))) return null;
        return {value:Number(best.value), seller:best.sellerAr || best.seller || 'جهة مرصودة'};
      };
      const makePair = asset => {
        const buy = quote(asset, 'buy');
        const sell = quote(asset, 'sell');
        if (!buy || !sell) return null;
        return {buy:buy.value, sell:sell.value, buySource:buy.seller, sellSource:sell.seller};
      };

      const gold = {};
      for (const [karat,slug] of [['21','gold-21k'],['24','gold-24k'],['18','gold-18k']]) {
        const pair = makePair(find(slug));
        if (pair) gold[karat] = pair;
      }
      if (gold['21']) {
        gold.coin = {
          buy: gold['21'].buy * 8,
          sell: gold['21'].sell * 8,
          buySource: gold['21'].buySource,
          sellSource: gold['21'].sellSource,
          derived: true
        };
      }

      const currencyDefs = [
        ['us-dollar','الدولار الأمريكي','USD'],
        ['euro','اليورو الأوروبي','EUR'],
        ['saudi-riyal','الريال السعودي','SAR'],
        ['uae-dirham','الدرهم الإماراتي','AED'],
        ['kuwaiti-dinar','الدينار الكويتي','KWD']
      ];
      const currencies = currencyDefs.map(([slug,name,code]) => {
        const asset = find(slug);
        const pair = makePair(asset);
        if (!pair) return null;
        return {
          name, code, buy:pair.buy, sell:pair.sell,
          source: pair.buySource === pair.sellSource ? pair.buySource : pair.buySource + ' / ' + pair.sellSource
        };
      }).filter(Boolean);

      if (!Object.keys(gold).length && !currencies.length) throw new Error('المصدر لم يرجع أسعارًا قابلة للعرض');
      const dates = feed.assets.map(a => a.observedAt).filter(Boolean).sort();
      const stale = feed.assets.some(a => a.freshness?.stale === true);
      const data = {
        updatedAt: dates[dates.length - 1] || feed.generatedAt || new Date().toISOString(),
        gold, currencies, status: stale ? 'stale' : 'fresh'
      };
      market = data;
      renderMarket(data);
      const note = document.querySelector('.source-note');
      if (note) note.innerHTML = '<span class="status-dot"></span> مصدر البيانات: <a href="https://getdaleelak.com/ar/api" target="_blank" rel="noopener">دليلك</a>. الأسعار إرشادية من جهات مرصودة ووقت الرصد موضح أعلاه. جنيه الذهب محسوب من 8 جرام عيار 21.';
    } catch (e) {
      console.warn('Market feed unavailable:', e);
      $('lastUpdated').textContent = market
        ? $('lastUpdated').textContent + ' — تعذر التحديث؛ نحتفظ بآخر قراءة'
        : 'تعذر الاتصال بمصدر الأسعار؛ لا توجد أسعار مؤكدة حاليًا';
      const note = document.querySelector('.source-note');
      if (note) note.innerHTML = '<span class="status-dot"></span> تعذر تحديث الأسعار من المصدر الآن؛ لن نعرض أرقامًا تقديرية. <a href="https://getdaleelak.com/ar/api" target="_blank" rel="noopener">مصدر البيانات</a>.';
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
    const status = data.status === 'stale' ? ' — بيانات قديمة؛ آخر تحديث ناجح' : '';
    $('lastUpdated').textContent = (Number.isNaN(date.getTime()) ? 'وقت التحديث غير معروف' : date.toLocaleString('ar-EG')) + status;
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