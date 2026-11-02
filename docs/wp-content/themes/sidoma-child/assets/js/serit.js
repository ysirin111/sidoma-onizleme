/**
 * Kaydırmalı ürün şeridi — [data-sb-serit] kabı (spec §4.2).
 *
 * Kaydırmayı tarayıcı yapar (overflow-x + scroll-snap); JS yalnız okları açar ve
 * durumlarını günceller. Otomatik oynatma YOK. Oklar aria-disabled ile pasifleşir
 * (disabled odağı düşürür). Ok tıkı kartı yumuşak kaydırır (hareketi azalt açıksa anlık).
 * Ürün sayfasının ilgili ürünler şeridi (Görev 9) aynı işaretlemeyi kullanır. Okları olmayan kap (ana sayfa bento'sunun
 * tema halkaları) yalnız klavye odağı düzeltmesini alır.
 */
( function () {
	'use strict';

	function kur( kap ) {
		var liste = kap.querySelector( '[data-sb-serit-liste]' );
		var oklar = kap.querySelector( '[data-sb-serit-oklar]' );
		if ( ! liste ) {
			return;
		}

		// Klavye odağı şeritteki bir karta girince kart tamamen görünür (Görev 12 odak taraması).
		// Chromium kısmen görünen öğeye odaklanınca kabı kaydırmıyordu: 390 px'de ikinci kartın yalnız
		// 48 px'i görünürken odak ona gidiyor, sonraki Tab bir kartı atlıyordu (WCAG 2.4.11). Yalnız
		// :focus-visible: fare ya da dokunmayla odaklanan kart basma anında kayarsa bırakma başka karta
		// düşer ve tık kaybolur (Görev 12 incelemesi; tik-kaybi.mjs 3. bölüm).
		liste.addEventListener( 'focusin', function ( olay ) {
			if ( ! olay.target.matches( ':focus-visible' ) ) {
				return;
			}
			var kart = olay.target.closest( 'li' );
			if ( kart && kart.parentNode === liste ) {
				kart.scrollIntoView( { block: 'nearest', inline: 'nearest', behavior: 'auto' } );
			}
		} );

		if ( ! oklar ) {
			return;
		}
		var onceki = oklar.querySelector( '[data-sb-serit-onceki]' );
		var sonraki = oklar.querySelector( '[data-sb-serit-sonraki]' );
		var bekliyor = false;

		function guncelle() {
			var enCok = liste.scrollWidth - liste.clientWidth;
			oklar.hidden = enCok <= 1;
			onceki.setAttribute( 'aria-disabled', liste.scrollLeft <= 1 ? 'true' : 'false' );
			sonraki.setAttribute( 'aria-disabled', liste.scrollLeft >= enCok - 1 ? 'true' : 'false' );
		}

		// Bir adım = bir kart: iki komşu kartın sol kenarları arası (kart genişliği + boşluk).
		// scroll-snap adımı kart başına oturtur. Tek kart varsa kabın genişliği.
		function adim() {
			var kartlar = liste.children;
			if ( kartlar.length > 1 ) {
				return Math.max( kartlar[ 1 ].offsetLeft - kartlar[ 0 ].offsetLeft, 1 );
			}
			return Math.max( liste.clientWidth, 1 );
		}

		// Yumuşak kaydırma (owner kararı 2026-10-01; spec §4.4 anlık diyordu). Hareketi azalt
		// ayarı açıksa anlık kalır. Kayarken yapılan tık, o anki konumdan değil devam eden
		// hedeften bir kart ilerler (hızlı iki tık iki kart gider, ortada takılmaz).
		var hedef = null;
		var hedefZamani = 0;

		function kaydir( yon, dugme ) {
			return function () {
				if ( 'true' === dugme.getAttribute( 'aria-disabled' ) ) {
					return;
				}
				var enCok = liste.scrollWidth - liste.clientWidth;
				var azalt = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
				var taban = null !== hedef && Date.now() - hedefZamani < 700 ? hedef : liste.scrollLeft;
				hedef = Math.min( Math.max( taban + yon * adim(), 0 ), enCok );
				hedefZamani = Date.now();
				liste.scrollTo( { left: hedef, behavior: azalt ? 'auto' : 'smooth' } );
			};
		}

		onceki.addEventListener( 'click', kaydir( -1, onceki ) );
		sonraki.addEventListener( 'click', kaydir( 1, sonraki ) );
		liste.addEventListener( 'scroll', function () {
			if ( bekliyor ) {
				return;
			}
			bekliyor = true;
			window.requestAnimationFrame( function () {
				bekliyor = false;
				guncelle();
			} );
		}, { passive: true } );
		window.addEventListener( 'resize', guncelle );
		guncelle();
	}

	Array.prototype.forEach.call( document.querySelectorAll( '[data-sb-serit]' ), kur );
}() );
