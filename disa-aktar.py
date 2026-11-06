#!/usr/bin/env python3
"""Sidoma Turizm önizleme kopyası.

Yerel geliştirme sitesini (sidomaturizm-com, http://127.0.0.1:8295) ziyaretçi gözüyle tarar ve statik HTML olarak
docs/ altına yazar; docs/ GitHub Pages proje sitesi olarak https://ysirin111.github.io/sidoma-onizleme/ adresinde
yayınlanır. Bütün site yolları /sidoma-onizleme önekiyle yazılır, böylece aynı çıktı yerelde de o önekle sunulup
denenebilir.

Kopyada çalışmayanlar (sunucu ister): arama, formlar, sepet ve hesap. Her sayfanın üstüne bunu söyleyen bir şerit,
bu bağlantılara ve formlara tıklanınca kısa bir uyarı eklenir. Google'a kapalıdır (noindex). Yerelde görünen yer
tutucu notlar (sb-bilgi) çıkarılır: yayındaki ziyaretçi onları görmez.

Kullanım (dev sitesi açıkken): python3 disa-aktar.py
"""

import html
import re
import shutil
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path

KAYNAK = 'http://127.0.0.1:8295'
KAYNAK_HOST = '127.0.0.1:8295'
TABAN_YOL = '/sidoma-onizleme'
TABAN_URL = 'https://ysirin111.github.io' + TABAN_YOL
KOK = Path(__file__).resolve().parent
CIKTI = KOK / 'docs'
# Kopya önce burada üretilir; yalnız eksiksiz çıkarsa docs/ yerine geçer (yarıda kalan koşu önceki kopyayı silmesin).
YAPIM = KOK / 'docs.yeni'
SITE_DIZINI = Path.home() / 'Desktop/siteler/sidomaturizm-com'

# Blocksy menü, arama penceresi gibi parçaları tıklanınca bu dizinden yükler; HTML'de adı geçmediği için dizin
# dosya sisteminden bütün olarak kopyalanır.
DIZIN_KOPYALARI = ['wp-content/themes/blocksy/static/bundle']

# Önizlemeye alınmayan sayfalar: sunucu isteyenler, içeriği henüz gelmemiş yasal metinler, makineye yönelik adresler,
# blog (owner 2026-11-01: blogda gerçek yazı yok, eski sitedeki yazılar tur denemesi ve tema demosu; sitede bağlantısı
# yok).
DISLANAN_YOL = re.compile(
	r'^/(wp-admin|wp-login\.php|wp-json|xmlrpc\.php|sepet|odeme|hesabim|cart|checkout|my-account|feed|comments'
	r'|cerez-politikasi|kvkk-aydinlatma-metni|blog|category|search|page/\d+|\d{4})(/|$)|/feed/?$|sitemap|\.(xml|php)$'
)
DISLANAN_SORGU = {'s', 'add-to-cart', 'wc-ajax', 'replytocom', 'preview', 'p', 'page_id', 'feed', 'rest_route', 'ver'}
# Tıklanınca gezinmek yerine uyarı gösterilen yollar (öneksiz).
UYARILI_YOLLAR = ['/sepet', '/odeme', '/hesabim', '/cerez-politikasi', '/kvkk-aydinlatma-metni', '/wp-login.php', '/wp-admin']

VARLIK_UZANTILARI = {
	'.css', '.js', '.mjs', '.map', '.json', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg', '.ico',
	'.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.webm', '.pdf',
}

# Kaynak sitenin mutlak adresi: düz, JSON içinde kaçışlı (\/), URL kodlu.
# Rank Math şeması eğik çizgiyi kaçışsız, "·" gibi karakterleri \u00b7 olarak yazar: \uXXXX adresin parçasıdır.
MUTLAK = re.compile(r'(?:https?:)?//127\.0\.0\.1:8295(?P<kalan>/(?:\\u[0-9a-fA-F]{4}|[^\s"\'<>)\\])*)?')
MUTLAK_JSON = re.compile(r'(?:https?:)?\\/\\/127\.0\.0\.1:8295(?P<kalan>(?:\\/|\\u[0-9a-fA-F]{4}|[^\s"\'<>)\\])*)')
MUTLAK_KODLU = re.compile(r'https?%3A%2F%2F127\.0\.0\.1%3A8295', re.I)
# Kök göreli öznitelikler ("/tur/..."), CSS url(), srcset ve @import.
KOK_GORELI = re.compile(r'(?P<on>\b(?:href|src|action|poster|data-[\w-]+)=["\'])/(?!/)')
CSS_KOK_GORELI = re.compile(r'(?P<on>url\(\s*["\']?)/(?!/)')
ADRES_OZNITELIK = re.compile(r'\b(?:href|src|action|poster)=["\']([^"\']+)["\']')
# data-* değerlerinin çoğu adres değil (data-id="4" göreli adres sanılırsa WordPress /vip-transfer/4 gibi sayfaları da
# döndürür, tarama katlanır): yalnız kök göreli olanlar alınır, mutlak olanları MUTLAK zaten yakalar.
VERI_OZNITELIK = re.compile(r'\bdata-[\w-]+=["\'](/(?!/)[^"\']*)["\']')
SRCSET = re.compile(r'\bsrcset=["\']([^"\']+)["\']')
CSS_URL = re.compile(r'url\(\s*["\']?([^"\')]+?)["\']?\s*\)')
CSS_IMPORT = re.compile(r'@import\s+["\']([^"\']+)["\']')

SERIT_CSS = """
<style id="sb-onizleme-stil">
.sb-onizleme-serit{background:#1d1f24;color:#f4f2ee;font-family:inherit;font-size:13px;font-weight:500;line-height:1.4;text-align:center;padding:8px 16px;letter-spacing:.01em}
.sb-onizleme-uyari{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100000;max-width:min(420px,calc(100% - 32px));background:#1d1f24;color:#f4f2ee;font-family:inherit;font-size:14px;font-weight:500;line-height:1.45;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(29,31,36,.25);opacity:0;transition:opacity .2s ease;pointer-events:none}
.sb-onizleme-uyari.acik{opacity:1}
</style>
"""
SERIT_HTML = '<div class="sb-onizleme-serit" role="note">Önizleme sürümü · Arama ve formlar bu kopyada çalışmaz.</div>'
UYARI_JS = """
<script id="sb-onizleme-betik">
(function () {
	var taban = %(taban)s, yollar = %(yollar)s, kutu, zaman;
	function uyar() {
		if (!kutu) { kutu = document.createElement('div'); kutu.className = 'sb-onizleme-uyari'; kutu.setAttribute('role', 'status'); document.body.appendChild(kutu); }
		kutu.textContent = 'Bu bölüm önizleme kopyasında çalışmaz; site yayına çıkınca açılır.';
		kutu.classList.add('acik'); clearTimeout(zaman); zaman = setTimeout(function () { kutu.classList.remove('acik'); }, 3500);
	}
	document.addEventListener('submit', function (e) { e.preventDefault(); e.stopImmediatePropagation(); uyar(); }, true);
	document.addEventListener('click', function (e) {
		var a = e.target.closest && e.target.closest('a[href]');
		if (!a) return;
		var u = new URL(a.href, location.href);
		if (u.origin !== location.origin || u.pathname.indexOf(taban) !== 0) return;
		var yol = u.pathname.slice(taban.length);
		if (yollar.some(function (y) { return yol === y || yol.indexOf(y + '/') === 0; })) { e.preventDefault(); e.stopImmediatePropagation(); uyar(); }
	}, true);
})();
</script>
"""
SAYFA_404 = """<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sayfa önizlemede yok · Sidoma Turizm</title>
<style>
body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f4f2ee;color:#1d1f24;font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px;box-sizing:border-box}
main{max-width:440px;text-align:center}
h1{font-size:24px;line-height:1.25;margin:0 0 8px}
p{margin:0 0 24px;color:#5b5d63}
a{display:inline-block;background:#d71920;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:999px}
a:hover{background:#b8141a}
</style>
</head>
<body>
<main>
<h1>Bu sayfa önizleme kopyasında yok</h1>
<p>Önizleme sitenin statik bir kopyası; bazı bölümler site yayına çıkınca açılacak.</p>
<a href="%(taban)s/">Ana sayfaya dön</a>
</main>
</body>
</html>
"""


def getir(url):
	"""(durum, içerik türü, gövde, son adres); hata durumunda gövde None."""
	# Bağlantılarda kodlanmamış Türkçe karakter olabilir; mevcut %XX kodları korunur.
	url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")
	istek = urllib.request.Request(url, headers={'User-Agent': 'sidoma-onizleme/1.0'})
	try:
		with urllib.request.urlopen(istek, timeout=60) as yanit:
			return yanit.status, yanit.headers.get_content_type(), yanit.read(), yanit.geturl()
	except urllib.error.HTTPError as hata:
		return hata.code, '', None, url


def ic_adres(ham, taban_adres):
	"""Site içi adresse (yol, sorgu) döner; dış adres, data: ve bağlantı parçası için None."""
	ham = html.unescape(ham.strip()).replace('\\/', '/')
	ham = re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), ham)
	if not ham or ham.startswith(('data:', 'mailto:', 'tel:', 'javascript:', '#')):
		return None
	parca = urllib.parse.urlsplit(urllib.parse.urljoin(taban_adres, ham))
	if parca.netloc != KAYNAK_HOST:
		return None
	return parca.path or '/', parca.query


def dizin_adresi_mi(yol):
	"""wp-content altındaki dizin adresi (Blocksy'nin parça dizini gibi): ne sayfa ne dosya."""
	return yol.startswith(('/wp-content/', '/wp-includes/')) and yol.endswith('/')


def varlik_mi(yol):
	uzanti = Path(yol).suffix.lower()
	if uzanti == '.php':
		return False
	return yol.startswith(('/wp-content/', '/wp-includes/')) or uzanti in VARLIK_UZANTILARI


def sorgu_anahtari(sorgu):
	"""Sorguyu karşılaştırılabilir biçime getirir; önizlemeye alınmayacaksa None."""
	ciftler = urllib.parse.parse_qsl(sorgu, keep_blank_values=True)
	if any(ad in DISLANAN_SORGU for ad, _ in ciftler):
		return None
	return urllib.parse.urlencode(ciftler)


SORGU_SAYFASI = re.compile(r'^/page/(\d+)/?$')


def sayfali_sorgu_anahtari(yol, sorgu):
	"""Sorgulu listenin sayfa numarası (`/page/2/?tur_tipi=paket`) anahtara girer: 1. ve 2. sayfa ayrı dosyaya
	yazılır. Sorgusuz kök `/page/N` (blog sayfalaması) DISLANAN_YOL'da kalır."""
	anahtar = sorgu_anahtari(sorgu)
	eslesme = SORGU_SAYFASI.match(yol)
	if anahtar and eslesme:
		anahtar += '&paged=' + eslesme.group(1)
	return anahtar


def sayfa_dosyasi(yol, sorgu):
	if sorgu:
		ad = 'sorgu/' + re.sub(r'[^a-z0-9]+', '-', sorgu.lower()).strip('-')
	else:
		ad = urllib.parse.unquote(yol).strip('/')
	return YAPIM / ad / 'index.html' if ad else YAPIM / 'index.html'


def sorgu_sayfa_yolu(sorgu):
	return TABAN_YOL + '/sorgu/' + re.sub(r'[^a-z0-9]+', '-', sorgu.lower()).strip('-') + '/'


def adresleri_topla(metin, taban_adres, css_mi):
	"""Metindeki site içi adresler."""
	hamlar = [m.group(0) for m in MUTLAK.finditer(metin)]
	hamlar += [m.group(0) for m in MUTLAK_JSON.finditer(metin)]
	hamlar += CSS_URL.findall(metin) + CSS_IMPORT.findall(metin)
	if not css_mi:
		hamlar += ADRES_OZNITELIK.findall(metin) + VERI_OZNITELIK.findall(metin)
		for deger in SRCSET.findall(metin):
			hamlar += [parca.strip().split(' ')[0] for parca in deger.split(',') if parca.strip()]
	return [adres for adres in (ic_adres(ham, taban_adres) for ham in hamlar) if adres]


def yeniden_yaz(metin, sorgu_sayfalari, html_mi):
	"""Kaynak adreslerini önizleme adreslerine çevirir. Kök göreli yollar önce öneklenir; mutlak adresler önekli
	yola dönüşünce ikinci kez öneklenmesin."""
	if html_mi:
		metin = KOK_GORELI.sub(lambda m: m.group('on') + TABAN_YOL + '/', metin)
	metin = CSS_KOK_GORELI.sub(lambda m: m.group('on') + TABAN_YOL + '/', metin)

	def duz(m):
		kalan = m.group('kalan') or '/'
		parca = urllib.parse.urlsplit(html.unescape(kalan))
		if parca.query and not varlik_mi(parca.path or '/'):
			anahtar = sayfali_sorgu_anahtari(parca.path or '/', parca.query)
			if anahtar in sorgu_sayfalari:
				return sorgu_sayfa_yolu(anahtar)
		return TABAN_YOL + kalan

	metin = MUTLAK.sub(duz, metin)
	metin = MUTLAK_JSON.sub(lambda m: TABAN_YOL.replace('/', '\\/') + (m.group('kalan') or '\\/'), metin)
	metin = MUTLAK_KODLU.sub(urllib.parse.quote(TABAN_URL, safe=''), metin)
	return metin


def html_son_islem(metin):
	# Yer tutucu notlar: yalnız nottan ibaret liste öğesi tamamen, diğerlerinde yalnız not çıkar; boş kalan yasal
	# metinler menüsü de kalkar.
	metin = re.sub(r'<li>[^<]*<span class="sb-bilgi"[^>]*>[^<]*</span>\s*</li>', '', metin)
	metin = re.sub(r'\s*<span class="sb-bilgi"[^>]*>[^<]*</span>', '', metin)
	metin = re.sub(r'<nav class="sb-footer__yasal"[^>]*>\s*<ul[^>]*>\s*</ul>\s*</nav>', '', metin)
	# Google'a kapalı; kanonik adres yok.
	metin = re.sub(r'<meta name=["\']robots["\'][^>]*>\s*', '', metin)
	metin = re.sub(r'<link rel=["\']canonical["\'][^>]*>\s*', '', metin)
	metin = re.sub(r'(<head\b[^>]*>)', r'\1\n<meta name="robots" content="noindex, nofollow">', metin, count=1)
	metin = metin.replace('</head>', SERIT_CSS + '</head>', 1)
	metin = re.sub(r'(<body\b[^>]*>)', lambda m: m.group(1) + '\n' + SERIT_HTML, metin, count=1)
	betik = UYARI_JS % {'taban': repr(TABAN_YOL).replace("'", '"'), 'yollar': str(UYARILI_YOLLAR).replace("'", '"')}
	return metin.replace('</body>', betik + '</body>', 1)


def site_haritasi_adresleri():
	"""Rank Math site haritasındaki sayfa yolları."""
	yollar = []
	durum, _, govde, _ = getir(KAYNAK + '/sitemap_index.xml')
	if govde is None:
		return yollar
	for alt in re.findall(r'<loc>([^<]+)</loc>', govde.decode('utf-8')):
		_, _, alt_govde, _ = getir(html.unescape(alt))
		if alt_govde is None:
			continue
		for loc in re.findall(r'<loc>([^<]+)</loc>', alt_govde.decode('utf-8')):
			adres = ic_adres(loc, KAYNAK + '/')
			if adres and not varlik_mi(adres[0]):
				yollar.append(adres)
	return yollar


def main():
	if getir(KAYNAK + '/')[0] != 200:
		sys.exit(f'Dev sitesi yanıt vermiyor: {KAYNAK}')
	if YAPIM.exists():
		shutil.rmtree(YAPIM)
	YAPIM.mkdir(parents=True)

	kuyruk = deque([('/', '')] + site_haritasi_adresleri())
	gorulen_sayfa, sayfalar, varliklar, atlanan = set(), {}, set(), []
	sorgu_sayfalari = set()

	# 1. Sayfalar: site haritası + sayfalardaki bağlantılar.
	while kuyruk:
		yol, sorgu = kuyruk.popleft()
		anahtar = sayfali_sorgu_anahtari(yol, sorgu) if sorgu else ''
		sorgulu_sayfa = bool(anahtar) and SORGU_SAYFASI.match(yol)
		if anahtar is None or (DISLANAN_YOL.search(yol) and not sorgulu_sayfa) or (yol, anahtar) in gorulen_sayfa:
			continue
		gorulen_sayfa.add((yol, anahtar))
		adres = KAYNAK + yol + ('?' + anahtar if anahtar else '')
		durum, tur, govde, son = getir(adres)
		if govde is None or tur != 'text/html' or urllib.parse.urlsplit(son).netloc != KAYNAK_HOST:
			atlanan.append(f'{durum} {yol}{"?" + anahtar if anahtar else ""}')
			continue
		metin = govde.decode('utf-8')
		sayfalar[(yol, anahtar)] = metin
		print(f'sayfa {len(sayfalar)}: {yol}{"?" + anahtar if anahtar else ""}', flush=True)
		if len(sayfalar) > 300:
			sys.exit('300 sayfa aşıldı: tarama katlanıyor olabilir, son sayfalara bakın.')
		if anahtar:
			sorgu_sayfalari.add(anahtar)
		for alt_yol, alt_sorgu in adresleri_topla(metin, adres, css_mi=False):
			if dizin_adresi_mi(alt_yol):
				continue
			if varlik_mi(alt_yol):
				varliklar.add(alt_yol)
			else:
				kuyruk.append((alt_yol, alt_sorgu))

	# 2. Varlıklar: CSS'in içindeki yazı tipi ve görseller de izlenir.
	bekleyen, inen, eksik = deque(sorted(varliklar)), set(), []
	while bekleyen:
		yol = bekleyen.popleft()
		if yol in inen:
			continue
		inen.add(yol)
		durum, tur, govde, _ = getir(KAYNAK + yol)
		if govde is None:
			eksik.append(f'{durum} {yol}')
			continue
		hedef = YAPIM / urllib.parse.unquote(yol).lstrip('/')
		hedef.parent.mkdir(parents=True, exist_ok=True)
		if hedef.suffix.lower() in ('.css', '.js', '.mjs', '.json'):
			metin = govde.decode('utf-8', errors='surrogateescape')
			if hedef.suffix.lower() == '.css':
				altlar = adresleri_topla(metin, KAYNAK + yol, css_mi=True)
			else:
				# Betiklerde yalnız mutlak adresler izlenir; göreli dizgeler çoğu zaman adres değildir.
				eslesmeler = list(MUTLAK.finditer(metin)) + list(MUTLAK_JSON.finditer(metin))
				altlar = [a for a in (ic_adres(m.group(0), KAYNAK + yol) for m in eslesmeler) if a]
			bekleyen.extend(alt_yol for alt_yol, _ in altlar if varlik_mi(alt_yol) and not dizin_adresi_mi(alt_yol))
			hedef.write_text(yeniden_yaz(metin, sorgu_sayfalari, html_mi=False), encoding='utf-8', errors='surrogateescape')
		else:
			hedef.write_bytes(govde)

	for dizin in DIZIN_KOPYALARI:
		shutil.copytree(SITE_DIZINI / dizin, YAPIM / dizin, dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.gz'))

	# 3. Sayfaları yaz.
	for (yol, anahtar), metin in sayfalar.items():
		hedef = sayfa_dosyasi(yol, anahtar)
		hedef.parent.mkdir(parents=True, exist_ok=True)
		hedef.write_text(html_son_islem(yeniden_yaz(metin, sorgu_sayfalari, html_mi=True)), encoding='utf-8')

	(YAPIM / '404.html').write_text(SAYFA_404 % {'taban': TABAN_YOL}, encoding='utf-8')
	(YAPIM / '.nojekyll').write_text('', encoding='utf-8')

	# 4. Denetim: kaynak adresi ve yer tutucu kalmamalı.
	kalan = []
	for dosya in YAPIM.rglob('*'):
		if dosya.suffix.lower() in ('.html', '.css', '.js', '.json') and dosya.is_file():
			icerik = dosya.read_text(encoding='utf-8', errors='ignore')
			if '127.0.0.1' in icerik or (dosya.suffix == '.html' and 'sb-bilgi"' in icerik):
				kalan.append(str(dosya.relative_to(YAPIM)))
	boyut = sum(f.stat().st_size for f in YAPIM.rglob('*') if f.is_file()) / 1e6
	print(f'Sayfa: {len(sayfalar)} (sorgulu {len(sorgu_sayfalari)}), varlık: {len(inen)}, toplam {boyut:.1f} MB')
	print('Atlanan sayfalar:', ', '.join(atlanan) or 'yok')
	print('İnmeyen varlıklar:', ', '.join(eksik) or 'yok')
	print('Kaynak adresi ya da yer tutucu kalan dosyalar:', ', '.join(kalan) or 'yok')
	# Eksik kopya başarı sayılmaz: docs/ olduğu gibi kalır, yeni deneme incelensin diye docs.yeni/ durur.
	if atlanan or eksik or kalan:
		print(f'EKSİK: docs/ değiştirilmedi; deneme {YAPIM.name}/ içinde.')
		return 1
	# Eski kopya önce kenara alınır; yeni kopya yerine geçemezse geri konur.
	eski = KOK / 'docs.eski'
	if not CIKTI.exists() and eski.exists():
		# Önceki koşu iki taşıma arasında kesilmiş: tek yedek silinmeden önce yerine konur.
		eski.rename(CIKTI)
	if eski.exists():
		shutil.rmtree(eski)
	if CIKTI.exists():
		CIKTI.rename(eski)
	try:
		YAPIM.rename(CIKTI)
	except OSError:
		if eski.exists():
			eski.rename(CIKTI)
		raise
	if eski.exists():
		shutil.rmtree(eski)
	print('Tamam: docs/ güncellendi.')
	return 0


if __name__ == '__main__':
	sys.exit(main())
