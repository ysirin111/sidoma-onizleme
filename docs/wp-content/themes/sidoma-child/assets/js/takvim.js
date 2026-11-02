/**
 * Kalkış takvimi — tur sayfasının seçim kutusu (#sb-tur-secim; Plan 2 Görev 9; spec §4.1–4.2, §8, §10).
 *
 * Veri kutunun data-sb-takvim özniteliğinde (sb_tur_takvim_verisi: id, tarih, saat, etiket, durum, kalan, fiyat,
 * binis) ve data-sb-tur-adi'de (template-parts/tur/secim.php). Kalkışsız turda öznitelik yok, betik bir şey kurmaz.
 * - Kalkış listesi, "Tüm tarihler" bağlantısı, kalkış seçimi ve kişi alanı gizlenir; form alanları yerinde kalır ve
 *   takvimle eşlenir. Yerine ay ızgarası gelir: Pazartesi başlangıçlı, ay ve gün adları Intl tr-TR. İlk satılabilir
 *   kalkışın ayı açılır; önceki/sonraki ay düğmeleri yalnız kalkışı olan aylar arasında gider.
 * - Kalkışlı gün <button>: aria-label "12 Kasım 2026 Perşembe, 09:00 — Son 3 koltuk" (durum metinleri sunucuyla aynı,
 *   inc/urun.php sb_tur_kalkis_durum_metni), seçiliyse aria-pressed="true". Dolu ve satışa kapanmış gün
 *   aria-disabled, seçilmez. Kalkışsız gün düz metin. Hücreler Tab ile gezilir; Enter/Space düğmenin kendisi.
 * - Seçimde özet: kalkışın tarihi ve saati (sunucunun etiketi), kalan koltuk, o kalkışın biniş saatleri (kalkışa
 *   özel saat dahil, K6; saatsiz nokta "Yol üzerinden"), kişi sayısı (− / +, en çok min( kalan, 10 )), toplam
 *   (fiyat × kişi, tr-TR para biçimi).
 * - Açık kip (form): variation_id, quantity (max kalan sınırı) ve sb_binis seçeneklerinin saatleri güncellenir;
 *   tarih seçilmeden form gönderilmez. Kapalı kip (form dışı data-sb-secim denetimleri): aynı eşleme, WhatsApp
 *   bağlantısının yalnız metni yazılır; numara sunucunun bağlantısında kalır (koda gömülmez).
 * - ≤ 1023 px: alt çubuktaki düğme seçim kutusunu <dialog> alt sayfasında açar (kapatma düğmesi, Esc, zemine tık);
 *   kutu kapanınca sayfadaki yerine döner. JS'siz hali çubuğun #sb-tur-secim çapası.
 * Düğümler DOM API ile kurulur, metinler textContent (urun-galeri.js notu: tur alanları yönetimden gelir).
 */
( function () {
	'use strict';

	var kutu = document.getElementById( 'sb-tur-secim' );
	var kalkislar = [];
	try {
		kalkislar = JSON.parse( ( kutu && kutu.getAttribute( 'data-sb-takvim' ) ) || '[]' );
	} catch ( hata ) {
		kalkislar = [];
	}
	var liste = kutu && kutu.querySelector( '.sb-kalkislar' );
	if ( ! Array.isArray( kalkislar ) || ! kalkislar.length || ! liste || ! window.Intl ) {
		return;
	}

	var EN_COK_KISI = 10;
	var form = kutu.querySelector( 'form.sb-tur-form' );
	// Açık kipte formun adlı alanları, kapalı kipte form dışı denetimler (secim.php $sb_alanlar).
	function alan( ad, secim ) {
		return kutu.querySelector( form ? '[name="' + ad + '"]' : '[data-sb-secim="' + secim + '"]' );
	}
	var kalkisAlani = alan( 'variation_id', 'kalkis' );
	var kisiAlani = alan( 'quantity', 'kisi' );
	var binisAlani = alan( 'sb_binis', 'binis' );
	var whatsapp = form ? null : kutu.querySelector( 'a[href^="https://wa.me/"]' );
	var turAdi = kutu.getAttribute( 'data-sb-tur-adi' ) || '';

	function secilebilir( k ) {
		return 'musait' === k.durum || 'son-koltuklar' === k.durum;
	}
	function durumMetni( k ) {
		return { musait: 'Müsait', 'son-koltuklar': 'Son ' + k.kalan + ' koltuk', dolu: 'Dolu' }[ k.durum ] || 'Satışa kapandı';
	}
	function saatMetni( nokta ) {
		return nokta.saat || 'Yol üzerinden';
	}

	var gunler = {};
	var aylar = [];
	kalkislar.forEach( function ( k ) {
		gunler[ k.tarih ] = k;
		if ( aylar.indexOf( k.tarih.slice( 0, 7 ) ) < 0 ) {
			aylar.push( k.tarih.slice( 0, 7 ) );
		}
	} );
	aylar.sort();
	var ilkSatilik = kalkislar.filter( secilebilir )[ 0 ];
	var ay = ( ilkSatilik || kalkislar[ 0 ] ).tarih.slice( 0, 7 );
	var secili = null;
	var kisi = 1;

	// "2027-03" ya da "2027-03-23" → UTC gece yarısı; biçimler de UTC'de (tarih saat diliminden kaymaz).
	function utc( tarih ) {
		var p = tarih.split( '-' );
		return Date.UTC( +p[ 0 ], p[ 1 ] - 1, +( p[ 2 ] || 1 ) );
	}
	function bicim( secenek ) {
		secenek.timeZone = 'UTC';
		return new Intl.DateTimeFormat( 'tr-TR', secenek );
	}
	var ayBicimi = bicim( { month: 'long', year: 'numeric' } );
	var kisaGun = bicim( { weekday: 'short' } );
	var uzunGun = bicim( { weekday: 'long' } );
	// tr-TR para biçimi; simge mağazanın ayarındaki gibi tutarın sağında (WooCommerce right_space,
	// tools/kur/10-woo-temel.php), tam tutarda kuruş yok (inc/magaza.php sb_tur_fiyat_html).
	function para( tutar ) {
		var tam = Math.floor( tutar ) === tutar;
		var sayi = '';
		var simge = '';
		new Intl.NumberFormat( 'tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: tam ? 0 : 2, maximumFractionDigits: 2 } )
			.formatToParts( tutar )
			.forEach( function ( p ) {
				if ( 'currency' === p.type ) {
					simge = p.value;
				} else if ( 'literal' !== p.type ) {
					sayi += p.value;
				}
			} );
		return sayi + '\u00a0' + simge;
	}

	function oge( ad, sinif, metin ) {
		var e = document.createElement( ad );
		if ( sinif ) {
			e.className = sinif;
		}
		if ( undefined !== metin ) {
			e.textContent = metin;
		}
		return e;
	}
	// Simgeli düğme: simge görünür ama okunmaz, adı aria-label.
	function dugme( sinif, etiket, simge ) {
		var d = oge( 'button', sinif );
		d.type = 'button';
		d.setAttribute( 'aria-label', etiket );
		d.appendChild( oge( 'span', '', simge ) ).setAttribute( 'aria-hidden', 'true' );
		return d;
	}

	/* ---------- Ay ızgarası ---------- */
	var kok = oge( 'div', 'sb-takvim' );
	var ayBasligi = oge( 'p', 'sb-takvim__ay' );
	ayBasligi.id = 'sb-takvim-ay';
	ayBasligi.setAttribute( 'aria-live', 'polite' );
	var oklar = [ -1, 1 ].map( function ( yon ) {
		var d = dugme( 'sb-takvim__ok', yon < 0 ? 'Önceki ay' : 'Sonraki ay', yon < 0 ? '←' : '→' );
		d.setAttribute( 'data-sb-takvim-ay', String( yon ) );
		d.hidden = aylar.length < 2;
		d.addEventListener( 'click', function () {
			var i = aylar.indexOf( ay ) + yon;
			if ( i >= 0 && i < aylar.length ) {
				ay = aylar[ i ];
				ciz();
			}
		} );
		return d;
	} );
	var ust = oge( 'div', 'sb-takvim__ust' );
	ust.append( oklar[ 0 ], ayBasligi, oklar[ 1 ] );

	var tablo = oge( 'table', 'sb-takvim__izgara' );
	tablo.setAttribute( 'aria-labelledby', 'sb-takvim-ay' );
	var basSatiri = tablo.createTHead().insertRow();
	for ( var g = 0; g < 7; g++ ) {
		// 1 Ocak 2024 Pazartesi.
		var th = oge( 'th' );
		th.scope = 'col';
		var kisaltma = oge( 'abbr', '', kisaGun.format( Date.UTC( 2024, 0, 1 + g ) ) );
		kisaltma.title = uzunGun.format( Date.UTC( 2024, 0, 1 + g ) );
		th.appendChild( kisaltma );
		basSatiri.appendChild( th );
	}
	var govde = tablo.createTBody();

	function gunDugmesi( k, gun ) {
		var d = oge( 'button', 'sb-takvim__gun sb-takvim__gun--' + k.durum, String( gun ) );
		d.type = 'button';
		d.setAttribute( 'data-tarih', k.tarih );
		d.setAttribute( 'aria-label', k.etiket + ' — ' + durumMetni( k ) );
		d.title = d.getAttribute( 'aria-label' );
		d.setAttribute( 'aria-pressed', secili === k ? 'true' : 'false' );
		if ( ! secilebilir( k ) ) {
			d.setAttribute( 'aria-disabled', 'true' );
		}
		return d;
	}

	function ciz() {
		var i = aylar.indexOf( ay );
		oklar[ 0 ].setAttribute( 'aria-disabled', i <= 0 ? 'true' : 'false' );
		oklar[ 1 ].setAttribute( 'aria-disabled', i >= aylar.length - 1 ? 'true' : 'false' );
		kok.setAttribute( 'data-ay', ay );
		ayBasligi.textContent = ayBicimi.format( utc( ay ) );
		var p = ay.split( '-' );
		var gunSayisi = new Date( Date.UTC( +p[ 0 ], +p[ 1 ], 0 ) ).getUTCDate();
		var bosluk = ( new Date( utc( ay ) ).getUTCDay() + 6 ) % 7;
		var satir = null;
		govde.textContent = '';
		for ( var n = 0; n < Math.ceil( ( bosluk + gunSayisi ) / 7 ) * 7; n++ ) {
			if ( n % 7 === 0 ) {
				satir = govde.insertRow();
			}
			var hucre = satir.insertCell();
			var gun = n - bosluk + 1;
			if ( gun >= 1 && gun <= gunSayisi ) {
				var tarih = ay + '-' + ( gun < 10 ? '0' : '' ) + gun;
				hucre.appendChild( gunler[ tarih ] ? gunDugmesi( gunler[ tarih ], gun ) : oge( 'span', 'sb-takvim__bos', String( gun ) ) );
			}
		}
	}

	govde.addEventListener( 'click', function ( olay ) {
		var d = olay.target.closest( 'button[data-tarih]' );
		var k = d && gunler[ d.getAttribute( 'data-tarih' ) ];
		if ( k && secilebilir( k ) ) {
			sec( k );
		}
	} );

	// Gösterge: yalnız takvimde geçen durumlar. Dolu ve satışa kapanmış gün aynı görünür (ikisi de seçilemez).
	var gosterge = oge( 'ul', 'sb-takvim__gosterge' );
	[ [ 'musait', 'Müsait' ], [ 'son-koltuklar', 'Son koltuklar' ], [ 'dolu', 'Dolu ya da satışa kapandı' ] ].forEach( function ( d ) {
		var geciyor = kalkislar.some( function ( k ) {
			return k.durum === d[ 0 ] || ( 'dolu' === d[ 0 ] && 'kapali' === k.durum );
		} );
		if ( geciyor ) {
			var li = oge( 'li', 'sb-takvim__gosterge-oge' );
			li.appendChild( oge( 'span', 'sb-takvim__ornek sb-takvim__ornek--' + d[ 0 ] ) ).setAttribute( 'aria-hidden', 'true' );
			li.appendChild( document.createTextNode( d[ 1 ] ) );
			gosterge.appendChild( li );
		}
	} );

	/* ---------- Özet ---------- */
	var ipucu = oge( 'p', 'sb-takvim__ipucu', 'Takvimden bir kalkış tarihi seçin.' );
	ipucu.setAttribute( 'aria-live', 'polite' );
	var secim = oge( 'div', 'sb-takvim__secili' );
	var dl = oge( 'dl', 'sb-takvim__secim' );
	function ozetSatiri( etiket, deger ) {
		var s = oge( 'div', 'sb-takvim__satir' );
		s.append( oge( 'dt', '', etiket ), deger );
		dl.appendChild( s );
		return s;
	}
	var ozetKalkis = oge( 'dd' );
	var ozetKalan = oge( 'dd' );
	var binisListe = oge( 'ul', 'sb-takvim__binis' );
	var binisDd = oge( 'dd' );
	binisDd.appendChild( binisListe );
	ozetSatiri( 'Kalkış', ozetKalkis );
	ozetSatiri( 'Kalan koltuk', ozetKalan );
	var binisSatiri = ozetSatiri( 'Biniş saatleri', binisDd );
	binisSatiri.classList.add( 'sb-takvim__satir--binis' );

	var kisiSatiri = oge( 'div', 'sb-takvim__kisi' );
	var kisiEtiketi = oge( 'span', 'sb-takvim__kisi-etiket', 'Kişi sayısı' );
	kisiEtiketi.id = 'sb-takvim-kisi';
	var sayac = oge( 'div', 'sb-takvim__sayac' );
	sayac.setAttribute( 'role', 'group' );
	sayac.setAttribute( 'aria-labelledby', 'sb-takvim-kisi' );
	var sayi = oge( 'output', 'sb-takvim__kisi-sayi', '1' );
	var sayacDugmeleri = [ -1, 1 ].map( function ( yon ) {
		var d = dugme( 'sb-takvim__sayac-dugme', yon < 0 ? 'Bir kişi azalt' : 'Bir kişi artır', yon < 0 ? '−' : '+' );
		d.setAttribute( 'data-sb-takvim-kisi', String( yon ) );
		d.addEventListener( 'click', function () {
			if ( secili && kisi + yon >= 1 && kisi + yon <= enCok() ) {
				kisi += yon;
				guncelle();
			}
		} );
		return d;
	} );
	sayac.append( sayacDugmeleri[ 0 ], sayi, sayacDugmeleri[ 1 ] );
	kisiSatiri.append( kisiEtiketi, sayac );

	var toplamSatiri = oge( 'p', 'sb-takvim__toplam', 'Toplam ' );
	toplamSatiri.setAttribute( 'aria-live', 'polite' );
	var toplamTutar = toplamSatiri.appendChild( oge( 'strong', 'sb-takvim__tutar' ) );
	secim.append( dl, kisiSatiri, toplamSatiri );

	var ozet = oge( 'div', 'sb-takvim__ozet' );
	ozet.append( ipucu, secim );
	kok.append( ust, tablo, gosterge, ozet );

	function enCok() {
		return secili ? Math.max( 1, Math.min( secili.kalan, EN_COK_KISI ) ) : EN_COK_KISI;
	}

	// Kapalı kipte WhatsApp metni (sb_tur_whatsapp_baglantisi'nin rezervasyon kalıbı). Sunucunun bağlantısı yalnız
	// text taşır (vitrin.php sb_whatsapp_baglantisi): numara kısmı aynen kalır, metin yeniden yazılır.
	function whatsappYaz() {
		if ( ! whatsapp || ! secili ) {
			return;
		}
		var binis = binisAlani ? binisAlani.value : '';
		var metin = 'Merhaba, ' + turAdi + ' için ' + secili.etiket + ' tarihli, ' + kisi + ' kişilik' +
			( binis ? ', ' + binis + ' binişli' : '' ) + ' rezervasyon yapmak istiyorum.';
		whatsapp.href = whatsapp.href.split( '?' )[ 0 ] + '?text=' + encodeURIComponent( metin );
	}

	function guncelle() {
		ipucu.hidden = ! ilkSatilik || !! secili;
		secim.hidden = ! secili;
		if ( ! secili ) {
			return;
		}
		ozetKalkis.textContent = secili.etiket;
		ozetKalan.textContent = String( secili.kalan );
		binisListe.textContent = '';
		( secili.binis || [] ).forEach( function ( nokta ) {
			var li = oge( 'li' );
			li.append( oge( 'span', 'sb-takvim__binis-ad', nokta.ad ), ' ', oge( 'span', 'sb-takvim__binis-saat', saatMetni( nokta ) ) );
			binisListe.appendChild( li );
		} );
		binisSatiri.hidden = ! binisListe.children.length;
		sayi.textContent = String( kisi );
		sayacDugmeleri[ 0 ].setAttribute( 'aria-disabled', kisi <= 1 ? 'true' : 'false' );
		sayacDugmeleri[ 1 ].setAttribute( 'aria-disabled', kisi >= enCok() ? 'true' : 'false' );
		var fiyat = parseFloat( secili.fiyat );
		toplamSatiri.hidden = ! ( fiyat > 0 );
		toplamTutar.textContent = fiyat > 0 ? para( Math.round( fiyat * kisi * 100 ) / 100 ) : '';
		if ( kisiAlani ) {
			kisiAlani.max = String( enCok() );
			kisiAlani.value = String( kisi );
		}
		whatsappYaz();
	}

	function sec( k ) {
		secili = k;
		kisi = Math.min( kisi, enCok() );
		Array.prototype.forEach.call( govde.querySelectorAll( 'button[data-tarih]' ), function ( d ) {
			d.setAttribute( 'aria-pressed', d.getAttribute( 'data-tarih' ) === k.tarih ? 'true' : 'false' );
		} );
		if ( kalkisAlani ) {
			kalkisAlani.value = String( k.id );
		}
		// Biniş seçeneklerinde seçilen kalkışın saatleri ("Rize – 08:00"; secim.php ile aynı biçim).
		if ( binisAlani ) {
			Array.prototype.forEach.call( binisAlani.options, function ( secenek ) {
				( k.binis || [] ).forEach( function ( nokta ) {
					if ( nokta.ad === secenek.value ) {
						secenek.textContent = nokta.ad + ' – ' + saatMetni( nokta );
					}
				} );
			} );
		}
		guncelle();
		eylemiGoster();
	}

	// Seçimden sonra çağrı düğmesi (Rezervasyon yap ya da WhatsApp) görünsün: sağ sütun (≥ 1024 px kendi içinde kayar;
	// 2026-10-25 masaüstü tasarımından beri kutuyu taşır) ya da alt sayfa taşıyorsa yalnız o kap gereken
	// kadar kayar; sayfanın kaydırmasına dokunulmaz. 1440×900'de seçimli kutu ~90 px, 390'daki alt sayfa ~140 px
	// taşıyordu (ölçüldü).
	var eylem = form ? form.querySelector( '[type="submit"]' ) : kutu.querySelector( '.sb-tur-secim__dugmeler' );
	var hareketAz = window.matchMedia( '(prefers-reduced-motion: reduce)' );
	var sutun = kutu.closest( '.sb-tur__sag' ) || kutu;
	function eylemiGoster() {
		var kap = sayfa && sayfa.open ? sayfa : sutun;
		if ( ! eylem || kap.scrollHeight <= kap.clientHeight ) {
			return;
		}
		// Kabın görünür altı: yapışkan kutu sayfa en üstteyken ekranın altına taşabiliyor (1440×900'de 17 px).
		var fark = eylem.getBoundingClientRect().bottom + 16 - Math.min( kap.getBoundingClientRect().bottom, window.innerHeight );
		if ( fark > 0 ) {
			kap.scrollBy( { top: fark, behavior: hareketAz.matches ? 'auto' : 'smooth' } );
		}
	}

	/* ---------- Kutuya yerleştirme ---------- */
	liste.parentNode.insertBefore( kok, liste );
	liste.hidden = true;
	Array.prototype.forEach.call( kutu.querySelectorAll( '.sb-tur-secim__tum' ), function ( a ) {
		a.hidden = true;
	} );
	// Seçim takvimden: kalkış ve kişi alanı gizlenir, değerleri takvim yazar. Kalkış seçimi boş başlar (gönderilen
	// tarih her zaman takvimde seçilen olsun); kişi 1.
	if ( kalkisAlani ) {
		kalkisAlani.insertBefore( new Option( '', '' ), kalkisAlani.firstChild );
		kalkisAlani.value = '';
		kalkisAlani.required = false;
		kalkisAlani.closest( '.sb-tur-alan' ).hidden = true;
	}
	if ( kisiAlani ) {
		kisiAlani.value = '1';
		kisiAlani.closest( '.sb-tur-alan' ).hidden = true;
	}
	if ( binisAlani ) {
		binisAlani.addEventListener( 'change', whatsappYaz );
	}
	if ( form ) {
		form.addEventListener( 'submit', function ( olay ) {
			if ( secili && kalkisAlani && kalkisAlani.value === String( secili.id ) ) {
				return;
			}
			olay.preventDefault();
			ipucu.textContent = 'Önce takvimden bir kalkış tarihi seçin.';
			ipucu.hidden = false;
			var ilk = govde.querySelector( 'button[data-tarih]:not([aria-disabled="true"])' );
			if ( ilk ) {
				ilk.focus();
			}
		} );
	}
	ciz();
	guncelle();

	/* ---------- Mobil alt sayfa (≤ 1023 px) ---------- */
	var cubuk = document.querySelector( '.sb-tur-cubuk__dugme[href="#sb-tur-secim"]' );
	if ( ! cubuk || 'function' !== typeof window.HTMLDialogElement ) {
		return;
	}
	var dar = window.matchMedia( '(max-width: 1023px)' );
	var sayfa = null;
	var yer = null;

	function sayfayiKur() {
		sayfa = oge( 'dialog', 'sb-tur-sayfa' );
		sayfa.setAttribute( 'aria-labelledby', 'sb-tur-secim-baslik' );
		var bas = oge( 'div', 'sb-tur-sayfa__bas' );
		var kapat = bas.appendChild( dugme( 'sb-tur-sayfa__kapat', 'Kapat', '×' ) );
		kapat.addEventListener( 'click', function () {
			sayfa.close();
		} );
		sayfa.appendChild( bas );
		// Zemine (::backdrop) tık diyaloğun kendisine düşer; içerikteki tık çocuklarına.
		sayfa.addEventListener( 'click', function ( olay ) {
			if ( olay.target === sayfa ) {
				sayfa.close();
			}
		} );
		// Esc, kapatma düğmesi ve zemin aynı yoldan: kutu sayfadaki yerine döner (seçim korunur).
		sayfa.addEventListener( 'close', function () {
			if ( yer ) {
				yer.parentNode.replaceChild( kutu, yer );
				yer = null;
			}
		} );
		( kutu.closest( 'main' ) || document.body ).appendChild( sayfa );
	}

	cubuk.setAttribute( 'aria-haspopup', 'dialog' );
	cubuk.addEventListener( 'click', function ( olay ) {
		if ( ! dar.matches ) {
			return;
		}
		olay.preventDefault();
		if ( ! sayfa ) {
			sayfayiKur();
		}
		if ( sayfa.open ) {
			return;
		}
		// Kutunun yerinde aynı yükseklikte boşluk: arkadaki sayfa kaymaz, kapanınca kutu oraya döner.
		yer = oge( 'div', 'sb-tur-secim-yer' );
		yer.style.blockSize = kutu.offsetHeight + 'px';
		kutu.parentNode.replaceChild( yer, kutu );
		sayfa.appendChild( kutu );
		sayfa.showModal();
	} );
	dar.addEventListener( 'change', function () {
		if ( ! dar.matches && sayfa && sayfa.open ) {
			sayfa.close();
		}
	} );
}() );
