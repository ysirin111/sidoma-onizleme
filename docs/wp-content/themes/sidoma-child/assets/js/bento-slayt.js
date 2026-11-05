/**
 * Ana sayfa giriş slaytları (owner 2026-10-25) — [data-sb-slayt="<ms>"] kabındaki .sb-bento__slayt öğeleri.
 *
 * Slaytlar kendiliğinden döner, düğme yok. Zamanlama ilerleme çizgisindedir (.sb-bento__ilerleme, slayt başına bir
 * bölme): görünen slaydın bölmesi kabın özniteliğindeki sürede (3000 ms, CSS değişkeni --sb-slayt-sure) dolar, dolum
 * bitince (animationend) sıradaki slayda geçilir. Sıradakinin görseli henüz inmediyse bölme dolu bekler, görsel inince
 * geçilir; inemeyen görselin slaydı atlanır (kapak boş görünmez; Codex review). Görsel inene kadar duraklama başlarsa
 * (üzerinde, odakta, sekme gizli) geçiş duraklama bitene kadar bekler (odaktaki bağlantı inert olmasın). Arama karesinin üzerine gelinince ya da karede odak varken (CSS) ve
 * sekme gizliyken (is-durgun) dolum durur, sonra kaldığı yerden sürer. Görünen slayt is-aktif, ötekiler inert
 * (bağlantılı slaydın bağlantısı Tab sırasına girmez, tıklanmaz). Hareketi azalt açıkken hiç dönmez, çizgi gizli kalır.
 * JS yoksa ilk slayt görünür, ötekiler ve çizgi gizli. İlk slayttan sonrakilerin görselleri (ana görsel ve bulanık zemin)
 * ertelenmiş gelir (data-sb-src/srcset): ikincisi sayfa yüklenince, sonrakiler bir önceki görünürken, ikisi birlikte yüklenir.
 */
( function () {
	'use strict';

	var kap = document.querySelector( '[data-sb-slayt]' );
	if ( ! kap ) {
		return;
	}
	var slaytlar = kap.querySelectorAll( '.sb-bento__slayt' );
	var cizgi = kap.querySelector( '.sb-bento__ilerleme' );
	var dilimler = cizgi ? cizgi.querySelectorAll( '.sb-bento__ilerleme-dilim' ) : [];
	if ( slaytlar.length < 2 || dilimler.length !== slaytlar.length || window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
		return;
	}

	var aralik = parseInt( kap.getAttribute( 'data-sb-slayt' ), 10 ) || 3000;
	var kare = kap.closest( '.sb-bento__arama' ) || kap;
	var sira = 0;
	var bekleyen = null; // Görseli indi, duraklama bitince gösterilecek slayt.

	function isaretle( liste, eski, yeni ) {
		if ( ! liste[ eski ] || ! liste[ yeni ] ) {
			return;
		}
		liste[ eski ].classList.remove( 'is-aktif' );
		liste[ eski ].inert = true;
		liste[ yeni ].classList.add( 'is-aktif' );
		liste[ yeni ].inert = false;
	}

	// Ertelenmiş slayt görsellerini yükler (bir kez): ana görsel ve bulanık zemin birlikte.
	function yukle( i ) {
		var imgler = slaytlar[ i ] ? slaytlar[ i ].querySelectorAll( 'img[data-sb-src]' ) : [];
		for ( var k = 0; k < imgler.length; k++ ) {
			var img = imgler[ k ];
			if ( img.getAttribute( 'data-sb-srcset' ) ) {
				img.setAttribute( 'srcset', img.getAttribute( 'data-sb-srcset' ) );
			}
			img.setAttribute( 'src', img.getAttribute( 'data-sb-src' ) );
			img.removeAttribute( 'data-sb-src' );
			img.removeAttribute( 'data-sb-srcset' );
		}
	}

	// Geçmiş bölmeler dolu, görünenin bölmesi baştan dolmaya başlar, sıradakiler boş.
	function cizgiyiBoya() {
		for ( var i = 0; i < dilimler.length; i++ ) {
			dilimler[ i ].classList.toggle( 'is-dolu', i < sira );
			dilimler[ i ].classList.remove( 'is-akan' );
		}
		void dilimler[ sira ].offsetWidth; // Aynı bölmede animasyon baştan başlasın (tek slayt turu dönünce).
		dilimler[ sira ].classList.add( 'is-akan' );
	}

	function goster( yeni ) {
		yukle( yeni );
		isaretle( slaytlar, sira, yeni );
		sira = yeni;
		cizgiyiBoya();
		yukle( ( sira + 1 ) % slaytlar.length );
	}

	function durgun() {
		return document.hidden || kare.matches( ':hover' ) || kare.contains( document.activeElement );
	}

	// Duraklama yoksa hemen, varsa bitince geçer (CSS duraklatması yalnız dolan bölmeyi durdurur, bekleyen geçişi değil).
	function gec( yeni ) {
		bekleyen = yeni;
		bekleyeniDene();
	}

	function bekleyeniDene() {
		if ( null !== bekleyen && ! durgun() ) {
			var yeni = bekleyen;
			bekleyen = null;
			goster( yeni );
		}
	}

	// Sıradaki slayda geçer; görseli inmediyse inince geçer, inemezse bir sonrakini dener (deneme: atlanan slayt sayısı).
	function ilerle( yeni, deneme ) {
		if ( deneme >= slaytlar.length ) {
			return;
		}
		yukle( yeni );
		var img = slaytlar[ yeni ].querySelector( 'img.sb-bento__gorsel' ); // Beklenen ana görsel; bulanık zemin süs.
		if ( ! img || ( img.complete && img.naturalWidth > 1 ) ) {
			gec( yeni );
			return;
		}
		var atla = function () {
			ilerle( ( yeni + 1 ) % slaytlar.length, deneme + 1 );
		};
		if ( img.complete ) {
			atla(); // İnmeyi bitirmiş ama görüntüsü yok: hatalı görsel.
			return;
		}
		img.addEventListener( 'load', function () {
			gec( yeni );
		}, { once: true } );
		img.addEventListener( 'error', atla, { once: true } );
	}

	cizgi.addEventListener( 'animationend', function ( olay ) {
		if ( 'sb-ilerleme' === olay.animationName ) {
			ilerle( ( sira + 1 ) % slaytlar.length, 0 );
		}
	} );
	document.addEventListener( 'visibilitychange', function () {
		cizgi.classList.toggle( 'is-durgun', document.hidden );
		bekleyeniDene();
	} );
	// Ayrılma anında :hover ve odak henüz güncellenmemiş olabilir; bir tur sonra denenir.
	kare.addEventListener( 'mouseleave', function () {
		setTimeout( bekleyeniDene, 0 );
	} );
	kare.addEventListener( 'focusout', function () {
		setTimeout( bekleyeniDene, 0 );
	} );

	if ( 'complete' === document.readyState ) {
		yukle( 1 );
	} else {
		window.addEventListener( 'load', function () {
			yukle( 1 );
		} );
	}
	kap.style.setProperty( '--sb-slayt-sure', aralik + 'ms' );
	cizgi.classList.toggle( 'is-durgun', document.hidden );
	cizgi.hidden = false;
	cizgiyiBoya();
}() );
