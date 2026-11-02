/**
 * Ana sayfa arama kutusunun canlı önerisi (ana sayfa turu 3) — [data-sb-oneri="<JSON kimliği>"] formu.
 *
 * Veri sayfadaki JSON'dan (sb_anasayfa_arama_json): yayındaki turlar ve WordPress'in arama durdurma sözcükleri; istek
 * atılmaz. En az 2 harfte kutunun altında en çok 6 tur, en altta "“sorgu” için bütün sonuçlar →" (formun kendi arama
 * adresi). Öneri yoksa "Bu aramaya uyan tur önerisi yok" ve arama sayfası bağlantısı ("Programlar dahil bütün turlarda
 * arayın"): öneri verisi turun adı, durakları, temaları ve kategorisidir; arama sayfası program ve açıklamada da arar
 * (vitrin.php sb_vitrin_arama_verisi), "bulamadık" demek yanlış olurdu. Öneri sayısı aria-live ile duyurulur ("N tur
 * bulundu", 6'dan çoksa "N tur bulundu, 6’sı gösteriliyor").
 *
 * Eşleşme sunucu aramasının kuralı (vitrin.php sb_vitrin_arama_sorgusu, WP_Query::parse_search_terms): sorgu boşluk,
 * virgül ve artıdan sözcüklere bölünür, tırnaklı ifade tek sözcüktür; tek harf ve durdurma sözcüğü atlanır (hiç sözcük
 * kalmazsa sorgunun tamamı tek sözcüktür); her sözcük katlanıp turun aranacak metninde (kaynak başına bir satır)
 * geçmeli, "-" önekli sözcük geçmemeli. Katlama
 * sb_vitrin_katla'nın eşi: aksanlar düşer, ı ve İ i olur, harfler küçülür. Adı eşleşen turlar önce gelir (sunucu
 * aramasının sıralaması gibi).
 *
 * WAI-ARIA combobox (liste otomatik tamamlama): kutu role=combobox, aria-expanded, aria-controls,
 * aria-activedescendant; liste role=listbox, öğeler role=option (tur bağlantıları; Tab sırasına girmez, odak kutuda
 * kalır). ↓/↑ gezinir (uçlarda döner; kapalıyken ↓ açar), Enter seçili öneriyi açar (seçili yoksa form gider), Esc
 * kapatır (yazı kalır), dışarı tık ve odağın formdan çıkması kapatır. Liste açılınca ekranın (ekran klavyesi açıksa
 * görünen alanın) altına taşıyorsa sayfa, kutu header'ın altında kalacak kadar kayar.
 *
 * JS yoksa form düz gönderilir; combobox öznitelikleri ve liste yalnız burada kurulur. Metinler textContent ile basılır.
 */
( function () {
	'use strict';

	var ENCOK = 6;

	function katla( metin ) {
		return String( metin ).replace( /[İIı]/g, 'i' ).normalize( 'NFD' ).replace( /[\u0300-\u036f]/g, '' ).toLowerCase();
	}

	function oge( etiket, sinif, metin ) {
		var e = document.createElement( etiket );
		if ( sinif ) {
			e.className = sinif;
		}
		if ( metin ) {
			e.textContent = metin;
		}
		return e;
	}

	function kur( form ) {
		var kaynak = document.getElementById( form.getAttribute( 'data-sb-oneri' ) || '' );
		var kutu = form.querySelector( 'input[name="s"]' );
		var alan = kutu ? kutu.closest( '.sb-bento__alan' ) || kutu : null;
		var veri = null;
		try {
			veri = kaynak ? JSON.parse( kaynak.textContent ) : null;
		} catch ( hata ) {
			veri = null;
		}
		if ( ! kutu || ! veri || ! Array.isArray( veri.turlar ) ) {
			return;
		}
		var turlar = veri.turlar.map( function ( tur ) {
			return { tur: tur, ad: katla( tur.ad || '' ), ara: String( tur.ara || '' ) };
		} );
		var dur = Array.isArray( veri.dur ) ? veri.dur : [];
		var hareketAz = window.matchMedia( '(prefers-reduced-motion: reduce)' );

		var panel = oge( 'div', 'sb-oneri' );
		var bos = oge( 'p', 'sb-oneri__bos', 'Bu aramaya uyan tur önerisi yok' );
		var liste = oge( 'div', 'sb-oneri__liste' );
		var canli = oge( 'span', 'screen-reader-text' );
		panel.hidden = true;
		bos.hidden = true;
		liste.id = 'sb-oneri-liste';
		liste.setAttribute( 'role', 'listbox' );
		liste.setAttribute( 'aria-label', 'Tur önerileri' );
		canli.setAttribute( 'aria-live', 'polite' );
		panel.appendChild( bos );
		panel.appendChild( liste );
		alan.parentNode.insertBefore( panel, alan.nextSibling );
		form.appendChild( canli );

		kutu.setAttribute( 'role', 'combobox' );
		kutu.setAttribute( 'aria-autocomplete', 'list' );
		kutu.setAttribute( 'aria-expanded', 'false' );
		kutu.setAttribute( 'aria-controls', liste.id );

		var secili = -1;

		function secenekler() {
			return liste.querySelectorAll( '[role="option"]' );
		}

		function sec( sira ) {
			var hepsi = secenekler();
			if ( hepsi[ secili ] ) {
				hepsi[ secili ].setAttribute( 'aria-selected', 'false' );
			}
			secili = hepsi[ sira ] ? sira : -1;
			if ( -1 === secili ) {
				kutu.removeAttribute( 'aria-activedescendant' );
				return;
			}
			hepsi[ secili ].setAttribute( 'aria-selected', 'true' );
			kutu.setAttribute( 'aria-activedescendant', hepsi[ secili ].id );
			hepsi[ secili ].scrollIntoView( { block: 'nearest' } );
		}

		function kapat() {
			sec( -1 );
			panel.hidden = true;
			kutu.setAttribute( 'aria-expanded', 'false' );
		}

		// Sunucu aramasının sözcükleri (WP_Query::parse_search ve parse_search_terms): tırnaklı ifade tek sözcüktür, içindeki
		// boşluklar kalır.
		function sozcukler( sorgu ) {
			var bulunan = [];
			( sorgu.match( /"[^"]*(?:"|$)|[^\t ",+]+/g ) || [] ).forEach( function ( s ) {
				s = /^".+"$/.test( s ) ? s.replace( /^["']+|["']+$/g, '' ) : s.replace( /^["' ]+|["' ]+$/g, '' );
				if ( s && ! /^[a-z-]$/i.test( s ) && -1 === dur.indexOf( s.toLowerCase() ) ) {
					bulunan.push( s );
				}
			} );
			return bulunan.length && bulunan.length < 10 ? bulunan : [ sorgu ];
		}

		function eslesir( metin, aranan ) {
			return aranan.every( function ( s ) {
				var haric = s.length > 1 && '-' === s.charAt( 0 );
				return ( -1 !== metin.indexOf( katla( haric ? s.slice( 1 ) : s ) ) ) !== haric;
			} );
		}

		function aramaAdresi( sorgu ) {
			var adres = new URL( form.getAttribute( 'action' ) || '/', window.location.href );
			adres.searchParams.set( 's', sorgu );
			adres.searchParams.set( 'post_type', 'product' );
			return adres.href;
		}

		function secenek( kimlik, sinif, adres ) {
			var a = oge( 'a', sinif );
			a.id = kimlik;
			a.href = adres;
			a.tabIndex = -1;
			a.setAttribute( 'role', 'option' );
			a.setAttribute( 'aria-selected', 'false' );
			return a;
		}

		function turSecenegi( tur, sira ) {
			var a = secenek( 'sb-oneri-' + sira, 'sb-oneri__oge', tur.url );
			var fiyat = tur.fiyat || 'Fiyat için bize yazın';
			var gorsel;
			// Ekran okuyucu satırı virgüllerle okur ("Uzungöl Turu, Günübirlik, Tam gün, 1.200 ₺"); parçalar ayrı öğelerde.
			a.setAttribute( 'aria-label', [ tur.ad, tur.tip_etiket, tur.sure, fiyat ].filter( Boolean ).join( ', ' ) );
			if ( tur.gorsel ) {
				gorsel = oge( 'img', 'sb-oneri__gorsel' );
				gorsel.src = tur.gorsel;
				gorsel.alt = '';
				gorsel.width = 48;
				gorsel.height = 48;
				gorsel.decoding = 'async';
			} else {
				gorsel = oge( 'span', 'sb-oneri__gorsel' );
			}
			var metin = oge( 'span', 'sb-oneri__metin' );
			var alt = oge( 'span', 'sb-oneri__alt' );
			metin.appendChild( oge( 'span', 'sb-oneri__ad', tur.ad ) );
			if ( tur.tip_etiket ) {
				alt.appendChild( oge( 'span', 'sb-rozet sb-rozet--' + tur.tip, tur.tip_etiket ) );
			}
			if ( tur.sure ) {
				alt.appendChild( oge( 'span', 'sb-oneri__sure', tur.sure ) );
			}
			alt.appendChild( oge( 'span', 'sb-oneri__fiyat' + ( tur.fiyat ? '' : ' sb-oneri__fiyat--sor' ), fiyat ) );
			metin.appendChild( alt );
			a.appendChild( gorsel );
			a.appendChild( metin );
			return a;
		}

		// Liste açılınca ekranın görünen altına taşıyorsa sayfa kayar; kutu header'ın altında kalır.
		function gorunurYap() {
			var gorunen = window.visualViewport ? window.visualViewport.offsetTop + window.visualViewport.height : window.innerHeight;
			var header = parseFloat( window.getComputedStyle( document.documentElement ).getPropertyValue( '--sb-header-yuk' ) ) || 0;
			var kayma = Math.min( panel.getBoundingClientRect().bottom + 12 - gorunen, alan.getBoundingClientRect().top - header - 12 );
			if ( kayma > 1 ) {
				window.scrollBy( { top: kayma, behavior: hareketAz.matches ? 'auto' : 'smooth' } );
			}
		}

		function goster() {
			var sorgu = kutu.value.trim();
			if ( sorgu.length < 2 ) {
				kapat();
				return;
			}
			var aranan = sozcukler( sorgu );
			var bulunan = turlar.filter( function ( t ) {
				return eslesir( t.ara, aranan );
			} );
			var adda = bulunan.filter( function ( t ) {
				return eslesir( t.ad, aranan );
			} );
			bulunan = adda.concat( bulunan.filter( function ( t ) {
				return -1 === adda.indexOf( t );
			} ) );

			sec( -1 );
			liste.textContent = '';
			bulunan.slice( 0, ENCOK ).forEach( function ( t, sira ) {
				liste.appendChild( turSecenegi( t.tur, sira ) );
			} );
			var tumu = secenek( 'sb-oneri-tumu', 'sb-oneri__tumu', aramaAdresi( sorgu ) );
			tumu.textContent = bulunan.length ? '“' + sorgu + '” için bütün sonuçlar →' : 'Programlar dahil bütün turlarda arayın →';
			liste.appendChild( tumu );
			bos.hidden = bulunan.length > 0;
			// Duyurulan sayı listeyle tutarlı (final review K-5): 6'dan çoksa kaçının gösterildiği de söylenir ("’sı" eki 6'nın).
			canli.textContent = ! bulunan.length ? 'Tur önerisi yok' : bulunan.length + ' tur bulundu' + ( bulunan.length > ENCOK ? ', ' + ENCOK + '’sı gösteriliyor' : '' );

			var kapaliydi = panel.hidden;
			panel.hidden = false;
			kutu.setAttribute( 'aria-expanded', 'true' );
			if ( kapaliydi ) {
				gorunurYap();
			}
		}

		kutu.addEventListener( 'input', goster );
		kutu.addEventListener( 'click', function () {
			if ( panel.hidden ) {
				goster();
			}
		} );
		kutu.addEventListener( 'keydown', function ( e ) {
			var adet = secenekler().length;
			if ( 'ArrowDown' === e.key || 'ArrowUp' === e.key ) {
				e.preventDefault();
				if ( panel.hidden ) {
					goster();
					sec( panel.hidden ? -1 : 0 );
					return;
				}
				if ( 'ArrowDown' === e.key ) {
					sec( secili + 1 < adet ? secili + 1 : 0 );
				} else {
					sec( secili > 0 ? secili - 1 : adet - 1 );
				}
			} else if ( 'Enter' === e.key && ! panel.hidden && secili > -1 ) {
				e.preventDefault();
				window.location.assign( secenekler()[ secili ].href );
			} else if ( 'Escape' === e.key && ! panel.hidden ) {
				e.preventDefault(); // Arama kutusunun Esc'te yazıyı silmesi yerine liste kapanır.
				kapat();
			}
		} );

		// Öneriye basınca odak kutuda kalır (liste kapanmaz); tık bağlantıya ulaşır.
		panel.addEventListener( 'mousedown', function ( e ) {
			e.preventDefault();
		} );
		form.addEventListener( 'focusout', function ( e ) {
			if ( ! form.contains( e.relatedTarget ) ) {
				kapat();
			}
		} );
		// Dışarı tık (nav.js deseni): capture aşamasında, preventDefault çağrılmadan; tık kendi hedefine ulaşır.
		document.addEventListener( 'pointerdown', function ( e ) {
			if ( ! panel.hidden && e.target instanceof Node && ! form.contains( e.target ) ) {
				kapat();
			}
		}, true );
	}

	Array.prototype.forEach.call( document.querySelectorAll( '[data-sb-oneri]' ), kur );
}() );
