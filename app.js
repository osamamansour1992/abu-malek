(() => {
  'use strict';
  const cfg = window.ABU_MALEK_CONFIG || {};
  const $ = id => document.getElementById(id);
  const format = n => new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(n);

  const year = $('year');
  if (year) year.textContent = new Date().getFullYear();
  $('themeToggle')?.addEventListener('click', () => document.body.classList.toggle('light'));

  // GA4 is intentionally dormant until the real Measurement ID is supplied.
  const measurementId = String(cfg.GA4_MEASUREMENT_ID || '').trim();
  if (/^G-[A-Z0-9]+$/.test(measurementId) && !window.__abuMalekGaLoaded) {
    window.__abuMalekGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { anonymize_ip: true });
    const ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(ga);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function bloggerText(entry) {
    const raw = entry.summary?.$t || entry.content?.$t || '';
    const doc = new DOMParser().parseFromString(raw, 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 175);
  }
  function bloggerImage(entry) {
    const media = entry.media$thumbnail?.url;
    if (media) return media.replace(/\/s\d+(-c)?\//, '/s640/');
    const match = (entry.content?.$t || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }
  function loadBlogger() {
    const status = $('bloggerStatus');
    const grid = $('articleGrid');
    if (!status || !grid || !cfg.BLOGGER_FEED_URL) return;
    const callbackName = '__abuMalekBloggerCallback';
    const url = new URL(cfg.BLOGGER_FEED_URL);
    url.searchParams.set('alt', 'json-in-script');
    url.searchParams.set('max-results', '12');
    url.searchParams.set('callback', callbackName);
    const script = document.createElement('script');
    script.id = 'blogger-jsonp';
    script.src = url.toString();
    let done = false;
    const timer = setTimeout(() => finish('انتهت مهلة تحميل المقالات. حاول التحديث لاحقًا.'), 9000);
    function finish(message) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      delete window[callbackName];
      script.remove();
      if (message) status.textContent = message;
    }
    window[callbackName] = feed => {
      if (done) return;
      const entries = feed?.feed?.entry || [];
      if (!entries.length) return finish('لا توجد مقالات منشورة حاليًا.');
      grid.innerHTML = entries.slice(0,4).map(entry => {
        const title = entry.title?.$t || 'مقال جديد';
        const link = (entry.link || []).find(x => x.rel === 'alternate')?.href || 'https://asearaldhahab.blogspot.com/';
        const image = bloggerImage(entry);
        const published = entry.published?.$t ? new Date(entry.published.$t) : null;
        const date = published && !Number.isNaN(published.getTime()) ? published.toLocaleDateString('ar-EG') : '';
        return '<article class="article-placeholder article-live">' +
          (image ? '<a class="article-thumb" href="' + escapeHtml(link) + '" target="_blank" rel="noopener"><img src="' + escapeHtml(image) + '" alt="" loading="lazy" decoding="async"></a>' : '') +
          '<span class="article-kicker">من مدونة أبو مالك ' + (date ? '· ' + date : '') + '</span>' +
          '<h3>' + escapeHtml(title) + '</h3><p>' + escapeHtml(bloggerText(entry) || 'اقرأ المقال كاملًا على مدونة بلوجر.') + '</p>' +
          '<a class="text-link" href="' + escapeHtml(link) + '" target="_blank" rel="noopener">اقرأ المقال ←</a></article>';
      }).join('');
      finish();
      status.textContent = 'أحدث المقالات من مدونة أبو مالك';
    };
    script.onerror = () => finish('تعذر الاتصال بخلاصة بلوجر. يمكنك زيارة المدونة مباشرة.');
    document.head.appendChild(script);
  }
  loadBlogger();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' }).then(registration => registration.update()).catch(() => {}), { once:true });
  }
})();