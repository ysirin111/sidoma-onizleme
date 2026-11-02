/**
 * Ana sayfanın rota haritası — [data-sb-bolum="rota-haritasi"] (ana sayfa turu 4; owner onayı 2026-10-24, taslak
 * .superpowers/tasarim/2026-10-24-hero/rota-haritasi). Bağımlılıksız; yalnız ana sayfada, altbilgide defer.
 *
 * Seçim: haritada durağın üstüne fareyle gelmek, durağa dokunmak/tıklamak, listede satırın üstüne fareyle gelmek ya da
 * satıra klavyeyle odaklanmak o rotayı öne çıkarır (öbürleri soluklaşır), rotada küçük bir nokta yol alır ve kart açılır.
 * Kartın içeriği satırın data-* alanlarından. Masaüstünde (≥ 720) kart haritanın üstünde, seçilen rotayı, durağı ve
 * Rize'yi örtmeyen en yakın yerde; dar ekranda haritanın altında akışa girer. Dar ekranda liste kartı açmaz, yalnız
 * rotayı öne çıkarır: akıştaki kart listeyi aşağı iter, dokunulan satır parmağın altından kayar ve tık kaybolurdu
 * (serit.js'teki ders). Odak yalnız :focus-visible'da seçer (fareyle/dokunmayla gelen odak değil). Esc ve haritada boş
 * yere tık seçimi bırakır.
 *
 * Açılış çizimi: harita görünür alana yaklaşınca (ekran boyunun %15'i kala) rotalar gizlenir, görünür alana girdiği ilk
 * anda Rize'den sırayla çizilir; durak ve etiket rotası varınca belirir. Bitince geçici sınıflar kalkar, durağan hâl düz çizgi. JS
 * yokken, hareket azaltılmışken ve bölüm yaklaşmadan önce hiçbir şey gizli değildir (gizleme yalnız bu betikte).
 */
( function () {
	'use strict';

	var bolum = document.querySelector( '[data-sb-bolum="rota-haritasi"]' );
	var sekil = bolum && bolum.querySelector( '.sb-rota__harita' );
	var svg = sekil && sekil.querySelector( '.sb-rota__svg' );
	var kart = sekil && sekil.querySelector( '.sb-rota__kart' );
	var liste = bolum && bolum.querySelector( '.sb-rota__liste' );
	if ( ! svg || ! kart || ! liste ) {
		return;
	}

	var gezgin = svg.querySelector( '.sb-rota__gezgin' );
	var merkez = svg.querySelector( '.sb-rota__merkez' );
	var linkler = {};
	Array.prototype.forEach.call( liste.querySelectorAll( '.sb-rota__varis' ), function ( a ) {
		linkler[ a.dataset.yer ] = a;
	} );
	var hareket = ! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	var vb = svg.viewBox.baseVal;
	var aktif = null;
	var sabit = false;
	var kare = 0;

	function isaretli( id ) {
		return bolum.querySelectorAll( '[data-yer="' + id + '"]' );
	}

	function konum( el ) {
		var m = el.transform.baseVal.consolidate().matrix;
		return [ m.e, m.f ];
	}

	// Dar ekranda kart haritanın altında akıştadır (CSS position: relative).
	function kartAkista() {
		return 'relative' === getComputedStyle( kart ).position;
	}

	// Kart, seçilen rotayı, varış noktasını ve Rize'yi örtmeyen en yakın yere oturur (hedefin son durağının çevresindeki
	// sekiz adaydan örtüşmesi ve kenara itilmesi en az olan). Durak ve Rize'nin örtülmesi rotanınkinden 25 kat ağır
	// sayılır: haritanın kenarındaki Tiflis'te kenara itilen kart durağın üstüne biniyordu (anasayfa-rota.mjs).
	function kartiYerlestir( id ) {
		if ( kartAkista() ) {
			// Ekran daralınca masaüstü konumu kalmasın: akıştaki (relative) kart onunla kayıp kırpılırdı (Codex incelemesi).
			kart.style.left = '';
			kart.style.top = '';
			return;
		}
		var g = svg.getBoundingClientRect();
		var sx = g.width / vb.width;
		var sy = g.height / vb.height;
		var duraklar = svg.querySelectorAll( '.sb-rota__durak[data-yer="' + id + '"]' );
		var son = konum( duraklar[ duraklar.length - 1 ] );
		var px = son[ 0 ] * sx;
		var py = son[ 1 ] * sy;
		var w = kart.offsetWidth;
		var h = kart.offsetHeight;
		var pay = 14;
		var ara = 20;
		var rize = konum( merkez );
		var engeller = [ [ rize[ 0 ] * sx - 40, rize[ 1 ] * sy - 40, 80, 80, 25 ] ];
		Array.prototype.forEach.call( svg.querySelectorAll( '.sb-rota__yol[data-yer="' + id + '"]' ), function ( yol ) {
			var b = yol.getBBox();
			engeller.push( [ b.x * sx - 6, b.y * sy - 6, b.width * sx + 12, b.height * sy + 12, 1 ] );
		} );
		Array.prototype.forEach.call( duraklar, function ( d ) {
			var p = konum( d );
			engeller.push( [ p[ 0 ] * sx - 16, p[ 1 ] * sy - 16, 32, 32, 25 ] );
		} );
		var ortu = function ( l, t, e ) {
			return e[ 4 ] * Math.max( 0, Math.min( l + w, e[ 0 ] + e[ 2 ] ) - Math.max( l, e[ 0 ] ) ) * Math.max( 0, Math.min( t + h, e[ 1 ] + e[ 3 ] ) - Math.max( t, e[ 1 ] ) );
		};
		var adaylar = [
			[ px + ara, py - h / 2 ], [ px - ara - w, py - h / 2 ],
			[ px - w / 2, py + ara ], [ px - w / 2, py - ara - h ],
			[ px + ara, py + ara ], [ px - ara - w, py + ara ],
			[ px + ara, py - ara - h ], [ px - ara - w, py - ara - h ],
		];
		var iyi = null;
		adaylar.forEach( function ( aday ) {
			var l = Math.max( pay, Math.min( aday[ 0 ], g.width - w - pay ) );
			var t = Math.max( pay, Math.min( aday[ 1 ], g.height - h - pay ) );
			var puan = engeller.reduce( function ( s, e ) {
				return s + ortu( l, t, e );
			}, 0 ) + ( Math.abs( l - aday[ 0 ] ) + Math.abs( t - aday[ 1 ] ) ) * 40;
			if ( ! iyi || puan < iyi[ 2 ] ) {
				iyi = [ l, t, puan ];
			}
		} );
		kart.style.left = Math.round( iyi[ 0 ] ) + 'px';
		kart.style.top = Math.round( iyi[ 1 ] ) + 'px';
	}

	// Seçilen rotada küçük bir nokta Rize'den varışa yol alır (yalnız hareket izni varken).
	function gezdir( id ) {
		cancelAnimationFrame( kare );
		gezgin.classList.remove( 'is-gorunur' );
		if ( ! hareket ) {
			return;
		}
		var yol = svg.querySelector( '.sb-rota__yol[data-yer="' + id + '"]' );
		var uz = yol.getTotalLength();
		var sure = 700 + uz * 2.2;
		var bas = performance.now();
		var adim = function ( t ) {
			var ilerleme = ( ( t - bas ) % ( sure + 500 ) ) / sure;
			if ( ilerleme <= 1 ) {
				var p = yol.getPointAtLength( uz * ( 1 - Math.pow( 1 - ilerleme, 2 ) ) );
				gezgin.setAttribute( 'cx', p.x.toFixed( 1 ) );
				gezgin.setAttribute( 'cy', p.y.toFixed( 1 ) );
				gezgin.classList.add( 'is-gorunur' );
			} else {
				gezgin.classList.remove( 'is-gorunur' );
			}
			kare = requestAnimationFrame( adim );
		};
		kare = requestAnimationFrame( adim );
	}

	// kartAc false: yalnız rota öne çıkar (dar ekranda liste). Aynı yer yeniden seçilince yalnız kapalı kart açılır.
	function sec( id, kartAc ) {
		if ( ! linkler[ id ] || ( aktif === id && ( ! kartAc || kart.classList.contains( 'is-acik' ) ) ) ) {
			return;
		}
		if ( aktif ) {
			Array.prototype.forEach.call( isaretli( aktif ), function ( el ) {
				el.classList.remove( 'is-aktif' );
			} );
		}
		aktif = id;
		bolum.dataset.aktif = id;
		Array.prototype.forEach.call( isaretli( id ), function ( el ) {
			el.classList.add( 'is-aktif' );
		} );
		gezdir( id );
		if ( ! kartAc ) {
			kart.classList.remove( 'is-acik' );
			return;
		}

		var a = linkler[ id ];
		var v = a.dataset;
		var rozet = kart.querySelector( '.sb-rozet' );
		rozet.className = 'sb-rozet' + ( v.tip ? ' sb-rozet--' + v.tip : '' );
		rozet.textContent = v.tipEtiket || '';
		kart.querySelector( '.sb-rota__kart-bolge' ).textContent = v.bolge || '';
		kart.querySelector( '.sb-rota__kart-ad' ).textContent = a.querySelector( '.sb-rota__varis-ad' ).textContent;
		kart.querySelector( '.sb-rota__kart-tur' ).textContent = v.turlar || '';
		kart.querySelector( '.sb-rota__kart-sayi' ).textContent = v.sayi || '';
		var git = kart.querySelector( '.sb-rota__kart-git' );
		git.href = a.getAttribute( 'href' );
		git.querySelector( 'span' ).textContent = v.git || '';

		kart.hidden = false;
		kartiYerlestir( id );
		kart.classList.add( 'is-acik' );
	}

	function birak() {
		if ( ! aktif ) {
			return;
		}
		Array.prototype.forEach.call( isaretli( aktif ), function ( el ) {
			el.classList.remove( 'is-aktif' );
		} );
		aktif = null;
		sabit = false;
		delete bolum.dataset.aktif;
		kart.classList.remove( 'is-acik' );
		cancelAnimationFrame( kare );
		gezgin.classList.remove( 'is-gorunur' );
	}

	// Harita: fareyle üstüne gelince, dokununca ya da tıklayınca seç; boş yere tık bırakır.
	svg.addEventListener( 'pointerover', function ( olay ) {
		var d = olay.target.closest( '.sb-rota__durak' );
		if ( d && 'mouse' === olay.pointerType ) {
			sec( d.dataset.yer, true );
		}
	} );
	svg.addEventListener( 'click', function ( olay ) {
		var d = olay.target.closest( '.sb-rota__durak' );
		if ( d ) {
			sec( d.dataset.yer, true );
			sabit = true;
		} else {
			birak();
		}
	} );
	sekil.addEventListener( 'pointerleave', function ( olay ) {
		if ( 'mouse' === olay.pointerType && ! sabit ) {
			birak();
		}
	} );

	// Liste: fareyle üstüne gelme ve klavye odağı haritayı sürer; dar ekranda kart açılmaz.
	liste.addEventListener( 'pointerover', function ( olay ) {
		var a = olay.target.closest( '.sb-rota__varis' );
		if ( a && 'mouse' === olay.pointerType ) {
			sec( a.dataset.yer, ! kartAkista() );
		}
	} );
	liste.addEventListener( 'pointerleave', function ( olay ) {
		if ( 'mouse' === olay.pointerType && ! sabit ) {
			birak();
		}
	} );
	liste.addEventListener( 'focusin', function ( olay ) {
		var a = olay.target.closest( '.sb-rota__varis' );
		if ( a && olay.target.matches( ':focus-visible' ) ) {
			sec( a.dataset.yer, ! kartAkista() );
		}
	} );
	liste.addEventListener( 'focusout', function ( olay ) {
		if ( ! liste.contains( olay.relatedTarget ) ) {
			birak();
		}
	} );
	document.addEventListener( 'keydown', function ( olay ) {
		if ( 'Escape' === olay.key ) {
			birak();
		}
	} );
	window.addEventListener( 'resize', function () {
		if ( aktif && kart.classList.contains( 'is-acik' ) ) {
			kartiYerlestir( aktif );
		}
	} );

	// Açılış çizimi. Hareket kapalıysa ya da IntersectionObserver yoksa bu blok çalışmaz: her şey baştan görünür.
	if ( ! hareket || ! ( 'IntersectionObserver' in window ) ) {
		return;
	}
	var hazir = false;
	var bitis = 0;
	// Gizli başlangıç hâli: rota boyları ve gecikmeleri, durak ve etiketin belireceği an (rotası varınca).
	function hazirla() {
		if ( hazir ) {
			return;
		}
		hazir = true;
		var zaman = {};
		Array.prototype.forEach.call( svg.querySelectorAll( '.sb-rota__yol' ), function ( yol, i ) {
			var uz = yol.getTotalLength();
			var gec = 250 + i * 130;
			var sure = Math.round( 450 + uz * 1.15 );
			yol.style.setProperty( '--sb-uz', uz.toFixed( 1 ) );
			yol.style.setProperty( '--sb-gec', gec + 'ms' );
			yol.style.setProperty( '--sb-sure', sure + 'ms' );
			zaman[ yol.dataset.yer ] = gec + sure - 120;
			bitis = Math.max( bitis, gec + sure + 480 );
		} );
		Array.prototype.forEach.call( svg.querySelectorAll( '.sb-rota__durak-halka, .sb-rota__etiket[data-yer]' ), function ( el ) {
			var yer = el.dataset.yer || el.parentNode.dataset.yer;
			el.style.setProperty( '--sb-var-gec', zaman[ yer ] + 'ms' );
		} );
		bolum.classList.add( 'sb-rota--ciz' );
	}

	var yakin = new IntersectionObserver( function ( girdiler ) {
		if ( girdiler.some( function ( g ) {
			return g.isIntersecting;
		} ) ) {
			yakin.disconnect();
			hazirla();
		}
	}, { rootMargin: '15% 0px 15% 0px' } );
	var izle = new IntersectionObserver( function ( girdiler ) {
		if ( ! girdiler.some( function ( g ) {
			return g.isIntersecting;
		} ) ) {
			return;
		}
		izle.disconnect();
		yakin.disconnect();
		hazirla();
		// Gizli başlangıç hâli henüz boyanmamış olabilir: iki kare bekle, sonra çiz.
		requestAnimationFrame( function () {
			requestAnimationFrame( function () {
				bolum.classList.add( 'sb-rota--ciziliyor' );
				// Çizim bitince geçici çizgi ayarları kalkar; durağan hâl düz çizgi.
				setTimeout( function () {
					bolum.classList.remove( 'sb-rota--ciz', 'sb-rota--ciziliyor' );
				}, bitis );
			} );
		} );
	}, { threshold: 0 } ); // İlk kesişmede: kısmen görünen harita gizli hâlde boş kalmaz (final review K-3).
	yakin.observe( sekil );
	izle.observe( sekil );
}() );
