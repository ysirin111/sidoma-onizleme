/**
 * VİP Transfer giriş başlığı (owner 2026-11-01): canlı sitedeki gibi dönen sözcükler — "Vip Transfer Güvenli /
 * Konforlu / İkramlı Hizmetleri" sözcük sözcük yazılır, bekler, silinir, sıradakine geçer.
 *
 * İçerikteki başlık sabit ve virgüllü kalır ("Vip Transfer Güvenli, Konforlu, İkramlı Hizmetleri"; eski sitenin
 * metni, test-icerik-aktar md eşitliği): JS yoksa, hareketi azalt açıksa ya da başlık bu biçimde değilse olduğu gibi
 * görünür. Betik başlığı ekran okuyucu için tam metin (screen-reader-text) + görünen, aria-hidden yazı alanı olarak
 * yeniden kurar. Dönen sözcüğün kabı en uzun sözcük genişliğinde sabit (sonek "Hizmetleri" kaymaz); başlığın
 * yüksekliği ilk ölçüde kilitlenir (altındaki paragraf yer değiştirmez). Sekme gizliyken döngü bekler.
 */
( function () {
	'use strict';

	var baslik = document.querySelector( '.sb-sayfa--vip .sb-vip-giris__metin > h3' );
	if ( ! baslik || window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
		return;
	}

	var tam = baslik.textContent.replace( /\s+/g, ' ' ).trim();
	var parca = tam.match( /^(.+?Transfer)\s+(.+?)\s+(Hizmetleri)$/u );
	if ( ! parca ) {
		return;
	}
	var sozcukler = parca[ 2 ].split( /\s*,\s*/ ).filter( Boolean );
	if ( sozcukler.length < 2 ) {
		return;
	}

	var YAZMA = 90;
	var SILME = 45;
	var BEKLE = 1600;
	var ARA = 350;

	function yap() {
		baslik.style.minHeight = baslik.offsetHeight + 'px';

		var okuyucu = document.createElement( 'span' );
		okuyucu.className = 'screen-reader-text';
		okuyucu.textContent = tam;

		var gorunen = document.createElement( 'span' );
		gorunen.setAttribute( 'aria-hidden', 'true' );
		var kap = document.createElement( 'span' );
		kap.className = 'sb-vip-donen';
		var yazi = document.createElement( 'span' );
		yazi.className = 'sb-vip-donen__yazi';
		kap.appendChild( yazi );
		gorunen.append( parca[ 1 ] + ' ', kap, ' ' + parca[ 3 ] );

		baslik.replaceChildren( okuyucu, gorunen );

		// En uzun sözcüğün genişliği: kap o genişlikte sabit, sonek yerinde durur.
		var enGenis = 0;
		sozcukler.forEach( function ( s ) {
			yazi.textContent = s;
			enGenis = Math.max( enGenis, yazi.getBoundingClientRect().width );
		} );
		kap.style.minWidth = Math.ceil( enGenis ) + 'px';
		yazi.textContent = '';

		var sira = 0;
		var harf = 0;
		var siliniyor = false;

		function adim() {
			if ( document.hidden ) {
				document.addEventListener( 'visibilitychange', adim, { once: true } );
				return;
			}
			var sozcuk = sozcukler[ sira ];
			if ( ! siliniyor ) {
				harf++;
				yazi.textContent = sozcuk.slice( 0, harf );
				if ( harf >= sozcuk.length ) {
					siliniyor = true;
					setTimeout( adim, BEKLE );
					return;
				}
				setTimeout( adim, YAZMA );
				return;
			}
			harf--;
			yazi.textContent = sozcuk.slice( 0, harf );
			if ( harf <= 0 ) {
				siliniyor = false;
				sira = ( sira + 1 ) % sozcukler.length;
				setTimeout( adim, ARA );
				return;
			}
			setTimeout( adim, SILME );
		}

		adim();
	}

	if ( document.fonts && document.fonts.ready ) {
		document.fonts.ready.then( yap );
	} else {
		yap();
	}
}() );
