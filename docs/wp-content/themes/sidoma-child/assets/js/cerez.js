// Çerez bilgilendirme bandı (inc/cerez.php; spec §6.8, §11 #23). Bant `hidden` basılır; kapatma
// kaydı yoksa açılır. Kapatma tercihi bu tarayıcıda, localStorage'da; çerez yazılmaz. Depolama
// kapalıysa (gizli pencere, engelli site verisi) bant her sayfada açılır, kapatma o sayfa için
// geçerli olur. Kapatınca odak bantta idiyse içeriğe geçer (<main tabindex="-1">, Blocksy
// inc/components/global-attrs.php:3-8), sayfa kaymadan. Geçiş yok; azaltılacak hareket de yok.
(() => {
  const ANAHTAR = 'sb-cerez-bandi';
  const bant = document.getElementById('sb-cerez');
  const dugme = bant ? bant.querySelector('[data-sb-cerez-kapat]') : null;
  if (!dugme) {
    return;
  }

  try {
    if (window.localStorage.getItem(ANAHTAR) === 'kapatildi') {
      return;
    }
  } catch (e) {
    // Depolama yok: bant gösterilir.
  }

  // Yapışkan bant açıkken odak onun altında kalmasın (WCAG 2.2 2.4.11; W3C F110): tarayıcı
  // odağı görünür kılarken belgenin alt kenarından bant yüksekliği kadar boşluk bırakır.
  const kok = document.documentElement;
  const boslukAyarla = () => {
    kok.style.scrollPaddingBlockEnd = bant.hidden ? '' : `${bant.offsetHeight}px`;
  };

  bant.hidden = false;
  boslukAyarla();
  if ('ResizeObserver' in window) {
    new ResizeObserver(boslukAyarla).observe(bant);
  }

  dugme.addEventListener('click', () => {
    const odakBantta = bant.contains(document.activeElement);
    bant.hidden = true;
    boslukAyarla();
    try {
      window.localStorage.setItem(ANAHTAR, 'kapatildi');
    } catch (e) {
      // Depolama yok: kapatma yalnız bu sayfa için.
    }
    const ana = document.getElementById('main');
    if (odakBantta && ana) {
      ana.focus({ preventScroll: true });
    }
  });
})();
