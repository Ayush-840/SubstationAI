/* No-flash theme init: apply the saved theme before first paint. */
(function () {
  try {
    var t = localStorage.getItem('theme');
    var html = document.documentElement;
    if (t === 'dark') {
      html.dataset.theme = 'dark';
    } else if (t === 'outdoor') {
      html.dataset.theme = 'outdoor';
    } else if (!t || t === 'system') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.dataset.theme = 'dark';
      }
    }
  } catch (_) {
    /* localStorage blocked */
  }
})();
