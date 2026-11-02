/**
 * Sekmeler — [data-sb-sekmeler] kabı: bağlantı listesini WAI-ARIA tablist'e çevirir.
 *
 * JS yokken (ya da tek sekme varken) sunucunun bastığı düz yapı kalır: sekmeler
 * panellere giden sayfa içi bağlantılar, bütün paneller alt alta ve okunur.
 * Klavye: ←/→ (uçlarda başa/sona döner), Home, End, Boşluk; odakla birlikte seçim
 * değişir. Kap özniteliğinin değeri tablist'i adlandıran başlığın kimliğidir.
 *
 * İlk seçim: sunucu bir sekmeye data-sb-sekme-secili koyduysa o (adresteki hedeften önce
 * gelir), yoksa adresteki hedefi içeren panel, yoksa ilk sekme (Hesabım, Görev 10:
 * başarısız üye olma denemesinden sonra kart Üye Ol'la açılır).
 *
 * Mobil akordiyon (ürün sayfası, Görev 9): kap data-sb-sekmeler-genis="<medya sorgusu>"
 * taşıyorsa tablist yalnız sorgu eşleşirken kurulur. Eşleşmezken paneller sunucunun
 * bastığı <details> öğeleridir; aç/kapa, klavye (Enter/Boşluk) ve ekran okuyucu durumu
 * tarayıcının kendi davranışı. Akordiyona geçişte yalnız seçili bölüm açık kalır;
 * akordiyonda açılan bölüm, sekme düzenine dönünce seçili gelir. Özniteliği olmayan
 * kap (ana sayfa, Görev 7) her genişlikte tablist'tir.
 *
 * Adresteki hedef (#…) bir panelin içindeyse o panel seçili ya da açık gelir ve hedef
 * gösterilir (yorum gönderimi ve yorum sayfalaması yorumlara bağlantıyla döner).
 */
( function () {
	'use strict';

	var SEKME_OZNITELIKLERI = [ 'role', 'aria-controls', 'aria-selected', 'tabindex' ];

	function kur( kap ) {
		var liste = kap.querySelector( '[data-sb-sekme-listesi]' );
		var sekmeler = Array.prototype.slice.call( kap.querySelectorAll( '[data-sb-sekme]' ) );
		if ( ! liste || sekmeler.length < 2 ) {
			return;
		}
		var paneller = sekmeler.map( function ( sekme ) {
			return document.getElementById( ( sekme.getAttribute( 'href' ) || '' ).slice( 1 ) );
		} );
		if ( paneller.some( function ( panel ) { return ! panel; } ) ) {
			return;
		}
		var kutular = paneller.map( function ( panel ) {
			return panel.closest( 'details' );
		} );
		var sorgu = kap.getAttribute( 'data-sb-sekmeler-genis' );
		var genis = sorgu && window.matchMedia ? window.matchMedia( sorgu ) : null;
		var etkin = false;
		var secili = 0;

		// Bağlantı hedefi: yorum gönderimi #comment-N'e, yorum sayfalaması #comments'e döner
		// (wp-comments-post.php:57). Hedefi içeren panel seçili (sekme) ya da açık (akordiyon) gelir.
		var hedef = null;
		if ( window.location.hash.length > 1 ) {
			try {
				hedef = document.getElementById( decodeURIComponent( window.location.hash.slice( 1 ) ) );
			} catch ( hata ) {
				hedef = null; // Bozuk % kodlaması: hedef yok sayılır.
			}
		}
		paneller.forEach( function ( panel, i ) {
			if ( hedef && panel.contains( hedef ) ) {
				secili = i;
			}
		} );

		// Sunucunun işaretlediği sekme (Hesabım: başarısız üye olma denemesi) adresteki hedeften
		// önce gelir: işaret bu isteğin durumu, adres önceki gezinmeden kalmış olabilir.
		sekmeler.forEach( function ( sekme, i ) {
			if ( sekme.hasAttribute( 'data-sb-sekme-secili' ) ) {
				secili = i;
			}
		} );

		function sec( sira, odakla ) {
			secili = sira;
			sekmeler.forEach( function ( sekme, i ) {
				var bu = i === sira;
				sekme.setAttribute( 'aria-selected', bu ? 'true' : 'false' );
				sekme.setAttribute( 'tabindex', bu ? '0' : '-1' );
				paneller[ i ].hidden = ! bu;
			} );
			if ( odakla ) {
				sekmeler[ sira ].focus();
			}
		}

		function tus( olay ) {
			if ( ! etkin ) {
				return;
			}
			var i = sekmeler.indexOf( olay.currentTarget );
			var son = sekmeler.length - 1;
			var hedef;
			switch ( olay.key ) {
				case 'ArrowRight':
					hedef = i === son ? 0 : i + 1;
					break;
				case 'ArrowLeft':
					hedef = i === 0 ? son : i - 1;
					break;
				case 'Home':
					hedef = 0;
					break;
				case 'End':
					hedef = son;
					break;
				case ' ':
					hedef = i;
					break;
				default:
					return;
			}
			olay.preventDefault();
			sec( hedef, true );
		}

		function sekmeDuzeni() {
			etkin = true;
			liste.setAttribute( 'role', 'tablist' );
			if ( kap.getAttribute( 'data-sb-sekmeler' ) ) {
				liste.setAttribute( 'aria-labelledby', kap.getAttribute( 'data-sb-sekmeler' ) );
			}
			sekmeler.forEach( function ( sekme, i ) {
				sekme.setAttribute( 'role', 'tab' );
				sekme.setAttribute( 'aria-controls', paneller[ i ].id );
				paneller[ i ].setAttribute( 'role', 'tabpanel' );
				paneller[ i ].setAttribute( 'tabindex', '0' );
				if ( sekme.id ) {
					paneller[ i ].setAttribute( 'aria-labelledby', sekme.id );
				}
				if ( kutular[ i ] ) {
					kutular[ i ].open = true;
				}
			} );
			kap.classList.add( 'sb-sekmeler--etkin' );
			sec( secili, false );
		}

		function akordiyonDuzeni() {
			etkin = false;
			liste.removeAttribute( 'role' );
			liste.removeAttribute( 'aria-labelledby' );
			sekmeler.forEach( function ( sekme, i ) {
				SEKME_OZNITELIKLERI.forEach( function ( ad ) {
					sekme.removeAttribute( ad );
				} );
				paneller[ i ].removeAttribute( 'role' );
				paneller[ i ].removeAttribute( 'tabindex' );
				paneller[ i ].removeAttribute( 'aria-labelledby' );
				paneller[ i ].hidden = false;
				if ( kutular[ i ] ) {
					kutular[ i ].open = i === secili;
				}
			} );
			kap.classList.remove( 'sb-sekmeler--etkin' );
		}

		sekmeler.forEach( function ( sekme, i ) {
			sekme.addEventListener( 'click', function ( olay ) {
				if ( ! etkin ) {
					return;
				}
				olay.preventDefault();
				sec( i, false );
			} );
			sekme.addEventListener( 'keydown', tus );
		} );

		kutular.forEach( function ( kutu, i ) {
			if ( kutu ) {
				kutu.addEventListener( 'toggle', function () {
					if ( ! etkin && kutu.open ) {
						secili = i;
					}
				} );
			}
		} );

		function uygula() {
			if ( ! genis || genis.matches ) {
				sekmeDuzeni();
			} else {
				akordiyonDuzeni();
			}
		}

		if ( genis ) {
			genis.addEventListener( 'change', uygula );
		}
		uygula();

		// Tarayıcı hedefe paneller gizlenmeden önce kaydırmış olabilir; düzen kurulduktan sonra
		// hedef yeniden gösterilir.
		if ( hedef && paneller[ secili ].contains( hedef ) ) {
			hedef.scrollIntoView();
		}
	}

	Array.prototype.forEach.call( document.querySelectorAll( '[data-sb-sekmeler]' ), kur );
}() );
