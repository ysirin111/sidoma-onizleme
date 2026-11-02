/**
 * Ürün galerisi (spec §4.3): dikey küçük görsel şeridi, oklar, renk seçimiyle eşitleme.
 * Kaynak: nostaljikradyo-child/assets/js/urun-galeri.js — jQuery'den vanilla'ya
 * çevrildi; jQuery yalnız WC'nin varyasyon olaylarını (found_variation, reset_data)
 * dinlemek için, varsa.
 *
 * - Küçük görsel ana görseli değiştirir; oklar listede ileri/geri gider, uçta döner.
 * - Renk seçilince şerit o varyasyonun listesiyle yeniden kurulur; veri
 *   inc/varyasyon-galeri.php'den: variation.sb_galeri = [{ buyuk, srcset, kucuk, alt }].
 *   "Temizle" (reset_data) açılıştaki listeye döner. Liste aynıysa şerit yeniden
 *   kurulmaz: WC sayfa açılışında varsayılan varyasyon için de found_variation
 *   tetikliyor; boşuna kurmak ana görselin sunucu srcset'ini atıp LCP'yi geciktirirdi.
 * - Düğümler DOM API ile kurulur: alt metni yönetimden gelir, HTML dizesi birleştirmek
 *   enjeksiyona açıktı (nostaljikradyo notu).
 * JS yokken küçükler ve ana görsel görünür; oklar sunucudan `hidden` gelir.
 * - Tur sayfası masaüstü mozaiği (≥ 1024 px, owner 2026-10-25): "Tüm Fotoğraflar (N)" ([data-sb-galeri-tum]),
 *   mozaikteki küçük görsel ya da kapak bütün görselleri galeri penceresinde (<dialog>) açar: büyük görsel,
 *   önceki/sonraki (uçta döner; tek görselde yok), sayaç "3 / 7", ←/→ tuşları, Esc; Tab pencerede döner, kapanınca
 *   odak açan öğeye döner. Mobilde küçük görseller yine ana görseli değiştirir. JS'siz hali düğmenin #sb-tur-fotograflar çapası.
 */
( function () {
	'use strict';

	var galeri = document.querySelector( '[data-sb-galeri]' );
	var serit = galeri && galeri.querySelector( '[data-sb-galeri-kucukler]' );
	var ana = galeri && galeri.querySelector( '[data-sb-galeri-ana]' );
	if ( ! serit || ! ana ) {
		return;
	}
	var oklar = Array.prototype.slice.call( galeri.querySelectorAll( '[data-sb-galeri-ok]' ) );
	var urunAdi = galeri.getAttribute( 'data-sb-urun-adi' ) || '';
	var tum = 'function' === typeof window.HTMLDialogElement ? galeri.querySelector( '[data-sb-galeri-tum]' ) : null;
	var genis = window.matchMedia && window.matchMedia( '(min-width: 1024px)' );
	// Galeri penceresi yalnız düğmesi olan (tur) galeride ve masaüstü mozaiğinde.
	function pencereli() {
		return !! tum && !! genis && genis.matches;
	}

	var baslangic = Array.prototype.map.call( serit.querySelectorAll( '[data-sb-galeri-kucuk]' ), function ( dugme ) {
		var img = dugme.querySelector( 'img' );
		return {
			buyuk: dugme.getAttribute( 'data-buyuk' ) || '',
			srcset: dugme.getAttribute( 'data-srcset' ) || '',
			kucuk: img ? img.getAttribute( 'src' ) || '' : '',
			alt: dugme.getAttribute( 'data-alt' ) || '',
		};
	} );
	var liste = baslangic.slice();
	var aktif = 0;

	function gorseliUygula( oge, g ) {
		if ( g.srcset ) {
			oge.setAttribute( 'srcset', g.srcset );
		} else {
			oge.removeAttribute( 'srcset' );
		}
		oge.setAttribute( 'src', g.buyuk );
		oge.setAttribute( 'alt', g.alt || urunAdi );
	}

	// Kayarak geçiş (owner isteği 2026-10-01): yeni görsel ileri giderken sağdan, geri giderken soldan
	// kayarak girer; eskisi ters yöne çekilir. Yeni görsel yüklenmeden kaymaz (boş kare yok); hızlı
	// art arda tıkta önceki geçiş hemen bitirilir, yalnız son görsel kalır. Hareketi azalt açıksa
	// anlık takas; sayfa ilk açılışta animasyon yok. (Önceki kararma denemesi owner'a beğenilmedi.)
	var azalt = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' );
	var geciste = null;

	function gecisiBitir() {
		if ( geciste ) {
			geciste();
			geciste = null;
		}
	}

	function kaydirarakDegistir( g, yon ) {
		gecisiBitir();
		var eski = ana;
		var yeni = eski.cloneNode( false );
		yeni.removeAttribute( 'fetchpriority' );
		yeni.removeAttribute( 'loading' );
		gorseliUygula( yeni, g );
		eski.parentNode.insertBefore( yeni, eski.nextSibling );
		ana = yeni;

		var bitti = false;
		function bitir() {
			if ( bitti ) {
				return;
			}
			bitti = true;
			yeni.style.transform = '';
			if ( eski.parentNode ) {
				eski.parentNode.removeChild( eski );
			}
		}
		geciste = bitir;

		function baslat() {
			if ( bitti || ! yeni.animate ) {
				bitir();
				return;
			}
			var sure = { duration: 450, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'both' };
			yeni.animate( [ { transform: 'translateX(' + ( yon * 100 ) + '%)' }, { transform: 'translateX(0)' } ], sure );
			var cikis = eski.animate( [ { transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(' + ( -yon * 30 ) + '%)', opacity: 0.4 } ], sure );
			cikis.onfinish = bitir;
		}
		// Yüklenene kadar eski görsel yerinde kalır; yüklenmezse 800 ms sonra yine de kayar.
		yeni.style.transform = 'translateX(' + ( yon * 100 ) + '%)';
		var basladi = false;
		function bir() {
			if ( basladi ) {
				return;
			}
			basladi = true;
			baslat();
		}
		if ( yeni.complete && yeni.naturalWidth ) {
			bir();
		} else {
			yeni.addEventListener( 'load', bir, { once: true } );
			yeni.addEventListener( 'error', bir, { once: true } );
			window.setTimeout( bir, 800 );
		}
	}

	// yon: ok tıklamasında okun yönü (+1 sonraki: sağdan; -1 önceki: soldan; uçta başa dönse de aynı);
	// küçük görsel tıklamasında verilmez, indeks karşılaştırılır.
	function goster( sira, yon ) {
		if ( ! liste.length ) {
			return;
		}
		var onceki = aktif;
		aktif = ( sira + liste.length ) % liste.length;
		var g = liste[ aktif ];
		if ( azalt && azalt.matches ) {
			gecisiBitir();
			gorseliUygula( ana, g );
		} else if ( aktif !== onceki || ana.getAttribute( 'src' ) !== g.buyuk ) {
			kaydirarakDegistir( g, yon || ( aktif >= onceki ? 1 : -1 ) );
		}
		Array.prototype.forEach.call( serit.children, function ( dugme, i ) {
			if ( i === aktif ) {
				dugme.setAttribute( 'aria-current', 'true' );
			} else {
				dugme.removeAttribute( 'aria-current' );
			}
		} );
	}

	function oklariAyarla() {
		serit.hidden = liste.length < 2;
		oklar.forEach( function ( ok ) {
			ok.hidden = liste.length < 2;
		} );
	}

	function ayni( a, b ) {
		return a.length === b.length && a.every( function ( g, i ) {
			return g.buyuk === b[ i ].buyuk && g.kucuk === b[ i ].kucuk;
		} );
	}

	function kur( yeni ) {
		if ( ayni( yeni, liste ) ) {
			return;
		}
		liste = yeni.slice();
		serit.textContent = '';
		liste.forEach( function ( g, i ) {
			var dugme = document.createElement( 'button' );
			dugme.type = 'button';
			dugme.className = 'sb-urun__kucuk';
			dugme.setAttribute( 'data-sb-galeri-kucuk', String( i ) );
			dugme.setAttribute( 'data-buyuk', g.buyuk || '' );
			dugme.setAttribute( 'data-srcset', g.srcset || '' );
			dugme.setAttribute( 'data-alt', g.alt || '' );
			dugme.setAttribute( 'aria-label', ( i + 1 ) + '. görsel' );
			var img = document.createElement( 'img' );
			img.src = g.kucuk || '';
			img.alt = '';
			img.width = 200;
			img.height = 240;
			dugme.appendChild( img );
			serit.appendChild( dugme );
		} );
		oklariAyarla();
		goster( 0 );
	}

	serit.addEventListener( 'click', function ( olay ) {
		var dugme = olay.target.closest( '[data-sb-galeri-kucuk]' );
		if ( dugme ) {
			var sira = parseInt( dugme.getAttribute( 'data-sb-galeri-kucuk' ), 10 ) || 0;
			if ( pencereli() ) {
				pencereyiAc( sira, dugme );
			} else {
				goster( sira );
			}
		}
	} );
	oklar.forEach( function ( ok ) {
		ok.addEventListener( 'click', function () {
			var n = parseInt( ok.getAttribute( 'data-sb-galeri-ok' ), 10 ) || 1;
			goster( aktif + n, n > 0 ? 1 : -1 );
		} );
	} );
	oklariAyarla();

	/* ---------- Galeri penceresi (masaüstü) ---------- */
	var pencere = null;
	var pencereGorsel = null;
	var pencereSayac = null;
	var pencereSira = 0;
	var acan = null;

	function pencereDugmesi( sinif, etiket, metin, veri ) {
		var d = document.createElement( 'button' );
		d.type = 'button';
		d.className = sinif;
		d.setAttribute( 'aria-label', etiket );
		d.setAttribute( veri[ 0 ], veri[ 1 ] );
		var s = document.createElement( 'span' );
		s.setAttribute( 'aria-hidden', 'true' );
		s.textContent = metin;
		d.appendChild( s );
		return d;
	}

	function pencereGoster( sira ) {
		pencereSira = ( sira + liste.length ) % liste.length;
		gorseliUygula( pencereGorsel, liste[ pencereSira ] );
		pencereSayac.textContent = ( pencereSira + 1 ) + ' / ' + liste.length;
	}

	function pencereyiKur() {
		pencere = document.createElement( 'dialog' );
		pencere.className = 'sb-galeri-pencere';
		pencere.setAttribute( 'aria-label', urunAdi ? urunAdi + ' — fotoğraflar' : 'Fotoğraflar' );
		pencereSayac = document.createElement( 'p' );
		pencereSayac.className = 'sb-galeri-pencere__sayac';
		pencereSayac.setAttribute( 'data-sb-pencere-sayac', '' );
		pencereSayac.setAttribute( 'aria-live', 'polite' );
		var kapat = pencereDugmesi( 'sb-galeri-pencere__kapat', 'Kapat', '×', [ 'data-sb-pencere-kapat', '' ] );
		var geri = pencereDugmesi( 'sb-galeri-pencere__ok sb-galeri-pencere__ok--geri', 'Önceki fotoğraf', '←', [ 'data-sb-pencere-ok', '-1' ] );
		var ileri = pencereDugmesi( 'sb-galeri-pencere__ok sb-galeri-pencere__ok--ileri', 'Sonraki fotoğraf', '→', [ 'data-sb-pencere-ok', '1' ] );
		pencereGorsel = document.createElement( 'img' );
		pencereGorsel.className = 'sb-galeri-pencere__gorsel';
		pencereGorsel.setAttribute( 'data-sb-pencere-gorsel', '' );
		pencereGorsel.setAttribute( 'sizes', 'calc(100vw - 200px)' );
		pencereGorsel.decoding = 'async';
		geri.hidden = ileri.hidden = liste.length < 2;
		// Sekme sırası: kapat, önceki, sonraki.
		[ pencereSayac, kapat, geri, pencereGorsel, ileri ].forEach( function ( oge ) {
			pencere.appendChild( oge );
		} );

		kapat.addEventListener( 'click', function () {
			pencere.close();
		} );
		geri.addEventListener( 'click', function () {
			pencereGoster( pencereSira - 1 );
		} );
		ileri.addEventListener( 'click', function () {
			pencereGoster( pencereSira + 1 );
		} );
		// Görselin dışındaki koyu zemine tık kapatır.
		pencere.addEventListener( 'click', function ( olay ) {
			if ( olay.target === pencere ) {
				pencere.close();
			}
		} );
		pencere.addEventListener( 'keydown', function ( olay ) {
			if ( 'ArrowRight' === olay.key || 'ArrowLeft' === olay.key ) {
				olay.preventDefault();
				pencereGoster( pencereSira + ( 'ArrowRight' === olay.key ? 1 : -1 ) );
			} else if ( 'Tab' === olay.key ) {
				// Odak pencerede döner (modal diyalog arkayı etkisizleştirir ama Tab tarayıcı arayüzüne çıkabiliyor).
				var odaklar = [ kapat, geri, ileri ].filter( function ( d ) {
					return ! d.hidden;
				} );
				var ilk = odaklar[ 0 ];
				var son = odaklar[ odaklar.length - 1 ];
				if ( olay.shiftKey && ( document.activeElement === ilk || ! pencere.contains( document.activeElement ) ) ) {
					olay.preventDefault();
					son.focus();
				} else if ( ! olay.shiftKey && document.activeElement === son ) {
					olay.preventDefault();
					ilk.focus();
				}
			}
		} );
		pencere.addEventListener( 'close', function () {
			if ( acan && acan.isConnected ) {
				acan.focus();
			}
			acan = null;
		} );
		document.body.appendChild( pencere );
	}

	function pencereyiAc( sira, kaynak ) {
		if ( ! pencere ) {
			pencereyiKur();
		}
		acan = kaynak;
		pencereGoster( sira );
		if ( ! pencere.open ) {
			pencere.showModal();
		}
	}

	if ( tum ) {
		galeri.classList.add( 'sb-tur-galeri--pencereli' );
		tum.setAttribute( 'aria-haspopup', 'dialog' );
		tum.addEventListener( 'click', function ( olay ) {
			olay.preventDefault();
			pencereyiAc( 0, tum );
		} );
		// Kapak (odaklanamaz): galeriyi gösterdiği görselden açar; kapanınca odak "Tüm Fotoğraflar"a.
		ana.parentNode.addEventListener( 'click', function ( olay ) {
			if ( pencereli() && ! olay.target.closest( '[data-sb-galeri-ok]' ) ) {
				pencereyiAc( aktif, tum );
			}
		} );
	}

	var $ = window.jQuery;
	var form = document.querySelector( 'form.variations_form' );
	if ( ! $ || ! form ) {
		return;
	}
	$( form ).on( 'found_variation', function ( olay, varyasyon ) {
		if ( varyasyon && varyasyon.sb_galeri && varyasyon.sb_galeri.length ) {
			kur( varyasyon.sb_galeri );
		}
	} );
	$( form ).on( 'reset_data', function () {
		kur( baslangic );
	} );
	// WC stok/fiyat alanını slideDown/slideUp ile açıyor; 200 ms'lik yükseklik animasyonu
	// sepet satırını itip geri çekiyordu (nostaljikradyo urun-galeri.js:128-136).
	$( form ).on( 'show_variation hide_variation', function () {
		$( form ).find( '.woocommerce-variation' ).stop( true, true );
	} );
}() );
