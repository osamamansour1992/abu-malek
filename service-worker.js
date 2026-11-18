
function loadBlogger() {
  const status = $('bloggerStatus');
  const callbackName = '__abuMalekBloggerCallback';

  if (!cfg.BLOGGER_FEED_URL) {
    status.textContent = 'رابط مدونة بلوجر غير مضبوط.';
    return;
  }

  const oldScript = document.getElementById('blogger-jsonp');
  if (oldScript) oldScript.remove();

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
      status.textContent = 'لا توجد مقالات منشورة في المدونة.';
      return;
    }

    const cards = entries.slice(0, 4).map(entry => {
      const title = entry.title?.$t || 'مقال جديد';

      const link = (entry.link || [])
        .find(item => item.rel === 'alternate')?.href
        || 'https://asearaldhahab.blogspot.com/';

      const summary = bloggerText(entry);
      const image = bloggerImage(entry);

      const date = entry.published?.$t
        ? new Date(entry.published.$t).toLocaleDateString('ar-EG')
        : '';

      return `
        <article class="article-placeholder article-live">
          ${image ? `
            <a class="article-thumb" href="${escapeHtml(link)}"
               target="_blank" rel="noopener">
              <img src="${escapeHtml(image)}" alt="" loading="lazy">
            </a>` : ''}
          <span class="article-kicker">
            مدونة أبو مالك ${date ? '· ' + date : ''}
          </span>
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(summary || 'اقرأ المقال كاملًا على المدونة.')}</p>
          <a class="text-link" href="${escapeHtml(link)}"
             target="_blank" rel="noopener">اقرأ المقال ←</a>
        </article>`;
    });

    $('articleGrid').innerHTML = cards.join('');
    status.textContent = `تم تحميل ${entries.length} مقالًا من بلوجر.`;
    cleanup();
  };

  script.onerror = () => {
    if (finished) return;
    cleanup();
    status.textContent = 'تعذر الاتصال بخلاصة بلوجر.';
  };

  const timer = setTimeout(() => {
    if (finished) return;
    cleanup();
    status.textContent = 'انتهت مهلة تحميل المقالات. حاول التحديث لاحقًا.';
  }, 12000);

  document.head.appendChild(script);
}
