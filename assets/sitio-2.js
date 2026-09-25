
(function(){
  document.body.classList.remove('sin-js');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function(id){ return document.getElementById(id); };

  /* =====================================================================
     UN SOLO RELOJ DE SCROLL (12-08)
     Antes cada mecanismo ligado al scroll colgaba su propio listener: uno por
     título partido (seis), el riel, el header. Ocho suscripciones al evento
     más ruidoso del navegador, cada una leyendo medidas por su cuenta y
     ninguna sincronizada con el pintado.

     Ahora hay una sola suscripción y una sola lista. El evento no hace
     trabajo: pide un cuadro. Todo lo que mira el scroll —paralajes, barra de
     lectura, header, riel, títulos— corre junto, una vez por cuadro, en el
     momento en que el navegador iba a pintar igual. Una pista que devuelve
     'fin' se baja de la lista sola (los títulos, cuando ya encendieron su
     última palabra).                                                        */
  var pistas = [], pidiendo = false;

  function cuadro(){
    pidiendo = false;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var h = window.innerHeight || document.documentElement.clientHeight;
    pistas = pistas.filter(function(f){ return f(y, h) !== 'fin'; });
  }
  function pedirCuadro(){
    if (pidiendo) return;
    pidiendo = true;
    (window.requestAnimationFrame || function(f){ setTimeout(f, 16); })(cuadro);
  }
  /* registra una pista y la corre una vez, para que la página abra con el
     estado correcto aunque se haya recargado a mitad del documento */
  function alBajar(fn){
    pistas.push(fn);
    fn(window.pageYOffset || 0, window.innerHeight || 800);
  }
  window.addEventListener('scroll', pedirCuadro, { passive: true });
  window.addEventListener('resize', pedirCuadro, { passive: true });

  /* Dos cuadros de espera antes de encender nada: este script vive al final
     del <body> y corre ANTES del primer pintado. Si le agregamos .vista a algo
     acá mismo, el navegador nunca ve el estado inicial y no hay transición
     que animar — aparece puesto. Con dos requestAnimationFrame de por medio,
     el primer cuadro pinta el estado de partida y el segundo lo suelta. */
  function alPrimerCuadro(fn){
    if (!window.requestAnimationFrame) { setTimeout(fn, 32); return; }
    requestAnimationFrame(function(){ requestAnimationFrame(fn); });
  }

  /* Red de seguridad: si un IntersectionObserver no entrega su callback
     (pasa en algunos visores embebidos y con file:// en ciertos navegadores),
     nada se revelaría nunca. Todo lo que anima se puede forzar a mano, y
     además lo que ya está en pantalla se revela sin esperar al observador. */
  function enPantalla(el){
    var r = el.getBoundingClientRect();
    return r.top < (window.innerHeight || document.documentElement.clientHeight) && r.bottom > 0;
  }
  var revelar = [];   /* funciones que muestran cada cosa, idempotentes */
  function revelarTodo(){ revelar.forEach(function(f){ f(); }); }

  /* --- SplitText a mano: los títulos entran por palabras, con máscara.
     Se corre ANTES del observador general para que los títulos dejen de
     depender de [data-anim] y no se animen dos veces. --- */
  function partir(el){
    var frag = document.createDocumentFragment();
    Array.prototype.slice.call(el.childNodes).forEach(function(n){
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function(t){
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(t)); return; }
          var envoltura = document.createElement('span'); envoltura.className = 'sp-w';
          var palabra = document.createElement('span'); palabra.className = 'sp-i'; palabra.textContent = t;
          envoltura.appendChild(palabra); frag.appendChild(envoltura);
        });
      } else if (n.nodeType === 1) {
        partir(n);
        frag.appendChild(n);
      }
    });
    el.textContent = '';
    el.appendChild(frag);
  }

  /* Enciende una palabra pidiendo la capa de GPU justo para el trayecto y
     devolviéndola al terminar (14-08). Antes el will-change vivía en el CSS y
     no se retiraba nunca: 69 palabras × una capa retenida toda la sesión, en
     un teléfono que es donde menos memoria de video sobra. El transitionend
     puede no llegar si la palabra se revela fuera de pantalla, así que hay un
     plazo de gracia que la limpia igual. */
  function encender(p){
    if (p.classList.contains('on')) return;
    p.style.willChange = 'transform,opacity';
    var soltar = function(){
      p.style.willChange = '';
      p.removeEventListener('transitionend', soltar);
    };
    p.addEventListener('transitionend', soltar);
    setTimeout(soltar, 1400);
    p.classList.add('on');
  }

  if (!reduce && 'IntersectionObserver' in window) {
    document.querySelectorAll('.hero h1, .hero .kick, .hero .lead, .sec h2').forEach(function(t){
      /* El h1 del hero tiene su propio mecanismo (rotador de palabra), no el
         genérico de acá: partirlo en palabras además mancharía los spans que
         arma heroRotador(). data-no-split es la marca de "este título ya
         tiene su propia entrada". */
      if (t.hasAttribute('data-no-split')) return;
      t.removeAttribute('data-anim');
      t.classList.add('vista');
      partir(t);
      var palabras = t.querySelectorAll('.sp-i');
      var ioT = new IntersectionObserver(function(es){
        es.forEach(function(e){ if (e.isIntersecting) ioT.unobserve(e.target); });
      }, { threshold: .1, rootMargin: '0px 0px -80px 0px' });
      ioT.observe(t);

      /* Revelado ligado al scroll: cada palabra se enciende cuando el título
         cruza su propio tramo de la ventana. No es un stagger por tiempo — si
         frenás a mitad de camino, la frase queda a mitad. */
      var tope = 0;
      var enHero = t.closest('.hero');
      if (enHero) {
        /* 300 y no 620: la bajada del hero es la única pieza partida de la
           sección, y con 620 entraba después de los botones y de la cinta,
           fuera de la cascada de apertura (ver heroCascada más abajo). */
        var base = t.matches('.kick') ? 0 : t.matches('h1') ? 240 : 300;
        palabras.forEach(function(p, i){
          p.style.transitionDelay = (base + Math.min(i, 6) * 65) + 'ms';
          requestAnimationFrame(function(){ encender(p); });
        });
        return;
      }
      var porScroll = function(){
        var r = t.getBoundingClientRect();
        var alto = window.innerHeight || document.documentElement.clientHeight;
        /* 0 cuando el título asoma por abajo, 1 cuando llegó al tercio superior */
        var p = (alto - r.top) / (alto * 0.62);
        var n = Math.round(Math.max(0, Math.min(1, p)) * palabras.length);
        if (n <= tope) return;          /* enganchado: al subir no se desarma */
        for (var i = tope; i < n; i++) {
          palabras[i].style.transitionDelay = '0ms';
          encender(palabras[i]);
        }
        tope = n;
        if (tope >= palabras.length) return 'fin';   /* el reloj la da de baja */
      };
      alBajar(porScroll);

      /* Para los títulos partidos la red de seguridad es el propio cálculo de
         scroll, no un "mostrar todo": forzarlos adelantaría títulos que están
         a miles de píxeles del pliegue. */
      revelar.push(porScroll);
    });
  }

  /* --- ESCALONADO POR GRILLA ---
     El retardo de cada pieza deja de depender del orden en que el observador
     entrega su lote —que cambia con la velocidad del scroll, y por eso la
     cascada salía distinta cada vez— y pasa a ser una propiedad del lugar que
     ocupa: --d = su columna × un paso. Las doce celdas de servicios entran en
     diagonal, fila por fila, siempre igual. El módulo es contra la cantidad
     REAL de columnas, leída del grid ya resuelto, así que en celular (una
     columna) el retardo es cero para todas y nadie espera medio segundo para
     ver una tarjeta que ya tiene delante. */
  /* La columna no se deduce del CSS sino de la posición real: los hermanos
     que comparten offsetTop están en la misma fila, y el que abre fila vuelve
     a cero. Parsear grid-template-columns parecía más directo y no lo es —
     depende de que la grilla ya esté maquetada cuando corre el script, y si
     todavía no lo está devuelve una columna y la cascada se pierde entera.
     Esto además no necesita que el contenedor sea grid. */
  /* equipo salió de esta lista: sus tarjetas ya no entran escalonadas una por
     una —entra el carrusel entero— y el escalonado les escribía un --d que
     ahora no gobierna nada.
     servicios salió por lo mismo el 17-08: con la carpeta, la retícula ya no
     entra celda por celda en diagonal. El data-anim="cortina" de las celdas
     sigue en el HTML para celular, sin JS y con motion reducido, pero en esos
     tres casos la grilla es de UNA columna o no anima, o sea que la cuenta de
     columnas daba cero y el escalonado no gobernaba nada tampoco. */
  var ESCALONES = [['.foot__grid', '[data-anim]', 80]];
  var cajasEscalon = [];
  ESCALONES.forEach(function(g){
    document.querySelectorAll(g[0]).forEach(function(caja){
      caja.__esc = g;
      cajasEscalon.push(caja);
      [].slice.call(caja.querySelectorAll(g[1])).forEach(function(el){ el.__caja = caja; });
    });
  });
  function escalonarCaja(caja){
    var g = caja.__esc, fila = null, col = 0;
    [].slice.call(caja.querySelectorAll(g[1])).forEach(function(el){
      var t = el.offsetTop;
      if (fila === null || Math.abs(t - fila) > 2) { fila = t; col = 0; } else { col++; }
      el.style.setProperty('--d', (col * g[2]) + 'ms');
    });
  }
  function medirEscalones(){ cajasEscalon.forEach(escalonarCaja); }
  /* La medición de verdad es la que corre JUSTO ANTES de revelar (ver el
     observador acá abajo): a esa altura la maqueta está armada con las fotos
     ya medidas y la Inter cargada, y si mientras tanto giraron el teléfono,
     la cuenta sale con las columnas que hay en ese momento y no con las que
     había al abrir. Esta primera pasada es sólo para lo que ya está en
     pantalla y no va a pasar nunca por el observador. */
  medirEscalones();
  window.addEventListener('resize', medirEscalones, { passive: true });

  /* =====================================================================
     TELÓN DE APERTURA (2026-08-19) — variante F de design/telon-variantes.html

     Todo lo que abre la home —la foto que aparece, la cascada del hero, el
     verbo que rota— pasa a colgar de acá: no arranca cuando el script está
     listo, arranca cuando la hoja empieza a subir. Si arrancara antes, el
     visitante se perdería la entrada entera detrás del telón y encontraría el
     hero ya puesto, que es exactamente lo contrario de lo que se busca.

     alDestapar(fn) es el único enganche: corre fn cuando el telón se abre, o ya
     mismo si no hay telón. Nada de lo que anima la apertura queda esperando un
     telón que no va a venir.                                                */
  var telonEspera = [], telonAbierto = false;
  function alDestapar(fn){
    if (telonAbierto) { fn(); return; }
    telonEspera.push(fn);
  }
  (function telon(){
    var caja = $('telon'), sim = $('telonSim'), nro = $('telonN');
    var marca = document.querySelector('.head .marca');
    var logo  = marca && marca.querySelector('svg');
    var raiz  = document.documentElement;
    var fuera = false;

    function destapar(){
      if (telonAbierto) return;
      telonAbierto = true;
      var cola = telonEspera; telonEspera = [];
      cola.forEach(function(f){ f(); });
    }
    function sacar(el){ if (el && el.parentNode) el.parentNode.removeChild(el); }

    /* Los casos en que no hay telón. El del scroll es el que importa: si se
       recarga con la página a mitad de camino, el navegador restaura la
       posición y el telón se abriría sobre servicios o sobre el equipo. */
    if (!caja || !sim || !logo || reduce || !window.gsap || (window.pageYOffset || 0) > 4) {
      sacar(caja); sacar(sim);
      document.body.classList.remove('telonando');
      destapar();
      return;
    }

    raiz.style.overflow = 'hidden';          /* mismo recurso que el menú */

    var hoja  = caja.querySelector('.telon__hoja');
    var carga = caja.querySelector('.telon__carga');
    var barra = caja.querySelector('.telon__barra');
    var relleno = caja.querySelector('.telon__barra>i');
    var cuenta = { v: 0 };
    var destino, alto;

    /* El clon se planta ENCIMA del logo del header y de ahí se va a su tamaño
       grande, contra el borde izquierdo — el mismo margen del que cuelga el
       titular del hero. Manda el lado más chico de la ventana, así que en
       celular no se sale por los costados. */
    function medir(){
      var r = logo.getBoundingClientRect();
      alto = window.innerHeight;
      var an = Math.min(alto * 0.68, window.innerWidth * 0.66);
      var m  = Math.max(24, Math.min(80, window.innerWidth * 0.06));
      var S  = an / r.width;
      gsap.set(sim, { left: r.left, top: r.top, width: r.width, height: r.height });
      destino = { x: m - r.left, y: (alto - r.height * S) / 2 - r.top, scale: S };
      gsap.set(sim, { x: destino.x, y: destino.y, scale: destino.scale });
    }

    function pintar(){
      var n = Math.round(cuenta.v);
      nro.textContent = (n < 10 ? '0' : '') + n;
      gsap.set(relleno, { scaleX: n / 100 });
    }

    medir();
    gsap.set(sim, { autoAlpha: 1, clipPath: 'inset(0% 0% 100% 0%)' });
    gsap.set(logo, { autoAlpha: 0 });

    /* el respiro va aparte de la línea de tiempo y en bucle: mientras se espera
       no hay firma que entre ni nada que se mueva, y sin él el símbolo parece
       una imagen pegada. 1,2% de escala es lo máximo que se puede hacer sin que
       se note el truco. */
    var respiro = gsap.to(sim, {
      scale: destino.scale * 1.012, duration: .95, ease: 'sine.inOut',
      yoyo: true, repeat: -1, delay: 1.05
    });
    var entrada = gsap.timeline();
    entrada.to(sim, { clipPath: 'inset(-3% -3% -3% -3%)', duration: 1.1, ease: 'expo.out' }, 0)
           /* hasta 92 con el reloj; el 100 lo pone el load de verdad */
           .to(cuenta, { v: 92, duration: 1.85, ease: 'power2.out', onUpdate: pintar }, .15);

    window.addEventListener('resize', function(){
      if (fuera) return;
      respiro.pause();
      medir();
      respiro.invalidate().play();
    }, { passive: true });

    function salir(){
      if (fuera) return;
      fuera = true;
      entrada.kill();
      respiro.kill();
      gsap.timeline()
        .to(cuenta, { v: 100, duration: .3, ease: 'power2.out', onUpdate: pintar }, 0)
        .addLabel('va', .3)
        /* la cuenta se va antes que la hoja: si se fuera con ella, quedaría un
           cuarto de segundo flotando sobre la foto de Sergio */
        .to([carga, barra], { autoAlpha: 0, y: 12, duration: .3, ease: 'power2.out' }, 'va')
        /* power4.inOut y no expo.out: el símbolo tiene que ARRANCAR despacio
           para que se alcance a leer el tamaño del que viene, y llegar frenando */
        .to(hoja, { y: -alto - 20, duration: 1.05, ease: 'power4.inOut' }, 'va+=0.14')
        .to(sim,  { x: 0, y: 0, scale: 1, duration: 1.15, ease: 'power4.inOut' }, 'va+=0.14')
        .add(destapar, 'va+=0.46')          /* y el hero entra DETRÁS de la hoja */
        .to(sim,  { autoAlpha: 0, duration: .24, ease: 'none' }, 'va+=1.2')
        .to(logo, { autoAlpha: 1, duration: .24, ease: 'none' }, 'va+=1.2')
        .add(function(){
          raiz.style.overflow = '';
          document.body.classList.remove('telonando');
          sacar(caja); sacar(sim);
        }, 'va+=1.55');
    }

    /* El telón tapa una carga real —el retrato del hero pesa y se decodifica acá
       abajo— pero nunca menos de ESPERA (si no, con caché es un parpadeo) ni más
       de TOPE (si no, una imagen que no llega deja la puerta cerrada).
       ESPERA bajó de 1150 a 600 el 2026-09-15: el telón era el techo del LCP
       —la foto del hero no cuenta como pintada hasta que sube la hoja— y con
       600 sigue sin ser un parpadeo cuando la página ya está en caché. */
    var ESPERA = 600, TOPE = 4000, t0 = (new Date()).getTime();
    function cuandoCargue(){
      setTimeout(salir, Math.max(0, ESPERA - ((new Date()).getTime() - t0)));
    }
    if (document.readyState === 'complete') cuandoCargue();
    else window.addEventListener('load', cuandoCargue);
    setTimeout(salir, TOPE);

    /* y si el visitante empuja —rueda, dedo, tecla— no lo hacemos esperar */
    ['wheel','touchstart','keydown','pointerdown'].forEach(function(ev){
      window.addEventListener(ev, salir, { once: true, passive: true });
    });
  })();

  /* La apertura del hero es la única cascada por orden de lectura y no por
     grilla: titular, hairline del área, bajada, botones, invitación a bajar,
     cinta de datos. La bajada no está en esta cuenta porque el partidor de
     títulos ya se la llevó (entra palabra por palabra desde los 300ms). */
  document.querySelectorAll('.hero [data-anim]').forEach(function(el, i){
    el.style.setProperty('--d', (i * 95) + 'ms');
  });

  /* --- entrada: cinco gestos, escalonados, una sola vez --- */
  var heroCaja = document.querySelector('.hero');
  if (!reduce && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if (!e.isIntersecting) return;
        var el = e.target;
        io.unobserve(el);
        /* también acá espera al telón. El observador dispara igual con la hoja
           puesta —el telón es una capa encima, no cambia el layout— y lo que
           revelaba eran justo los bloques del primer pliegue, o sea el hero. */
        alDestapar(function(){
          if (el.__caja) escalonarCaja(el.__caja);   /* columnas de AHORA */
          el.classList.add('vista');
        });
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .1 });
    var alAbrir = [];
    document.querySelectorAll('[data-anim]').forEach(function(el){
      revelar.push(function(){ el.classList.add('vista'); });
      /* lo que ya está en pantalla al abrir no le pide permiso al observador:
         entra en la cascada de apertura */
      if (enPantalla(el)) alAbrir.push(el); else io.observe(el);
    });
    alPrimerCuadro(function(){
      medirEscalones();
      /* la cascada del hero espera al telón: entra detrás de la hoja que sube,
         no antes (ver telon() más arriba) */
      alDestapar(function(){
        if (heroCaja) heroCaja.classList.add('entra');
        alAbrir.forEach(function(el){ el.classList.add('vista'); });
      });
    });
  } else {
    if (heroCaja) heroCaja.classList.add('entra');
    document.querySelectorAll('[data-anim]').forEach(function(el){ el.classList.add('vista'); });
  }
  /* la foto del hero arranca en opacity:0 y sólo la enciende .entra: va
     también en la red de seguridad, o un error posterior la dejaría negra */
  if (heroCaja) revelar.push(function(){ heroCaja.classList.add('entra'); });

  /* =====================================================================
     Hero · el verbo que rota, y el área abajo
     El HTML trae la frase entera (span .sr + el fallback plano dentro de
     .hero__rot): el contenido nunca depende de que el script corra. Dos
     pistas —palabra y área— y un solo reloj, así nunca se desfasan. */
  var HERO_HOLD = 2400;
  (function heroRotador(){
    var zona = document.querySelector('.hero');
    var caja = zona && zona.querySelector('.hero__rot');
    var meta = zona && zona.querySelector('.hero__meta');
    if (!zona || !caja || !meta || reduce) return;

    var pares = (meta.getAttribute('data-rota') || '').split('|').filter(Boolean)
      .map(function(p){ var t = p.split('::'); return { palabra:t[0], area:t[1] || '' }; });
    if (pares.length < 2) return;

    var via = document.createElement('span'); via.className = 'hero__via';
    var areavia = meta.querySelector('.hero__areavia');
    var prog = meta.querySelector('.hero__prog');
    areavia.textContent = '';
    pares.forEach(function(p, k){
      var it = document.createElement('span');
      it.className = k === 0 ? 'hero__pal act' : 'hero__pal';   /* la primera ya visible */
      it.textContent = p.palabra;
      via.appendChild(it);
      var ai = document.createElement('span');
      if (k === 0) ai.className = 'act';
      ai.textContent = p.area;
      areavia.appendChild(ai);
    });
    caja.textContent = '';
    caja.appendChild(via);
    caja.classList.add('on');
    zona.classList.add('on');
    zona.style.setProperty('--hold', HERO_HOLD + 'ms');

    var ALTO = 18;                     /* alto de una fila del área, en px */
    var items = [].slice.call(via.children);
    var aitems = [].slice.call(areavia.children);
    var i = 0, anchos = [], reloj = null, vivo = true;

    function medir(){
      anchos = items.map(function(it){ return Math.ceil(it.getBoundingClientRect().width); });
      caja.style.width = Math.max.apply(null, anchos) + 'px';   /* la más larga manda */
      prog.style.width = anchos[i] + 'px';
    }
    function pintar(){
      items.forEach(function(it, k){ it.classList.toggle('act', k === i); });
      aitems.forEach(function(it, k){ it.classList.toggle('act', k === i); });
      prog.style.width = anchos[i] + 'px';
      via.style.transform = 'translate3d(0,' + (-i * 1.16) + 'em,0)';
      areavia.style.transform = 'translate3d(0,' + (-i * ALTO) + 'px,0)';
      zona.classList.remove('corre');
      void zona.offsetWidth;                       /* reinicia la hairline */
      zona.classList.add('corre');
    }
    function avanzar(){
      i = (i + 1) % items.length;
      pintar();
      reloj = setTimeout(avanzar, HERO_HOLD);
    }
    function arrancar(){
      if (reloj || !vivo) return;
      zona.classList.remove('quieto');
      pintar();
      reloj = setTimeout(avanzar, HERO_HOLD);
    }
    function frenar(){
      clearTimeout(reloj); reloj = null;
      zona.classList.add('quieto');
    }

    medir();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    window.addEventListener('resize', medir, { passive: true });

    var pausa = zona.querySelector('h1');
    pausa.addEventListener('mouseenter', frenar);
    pausa.addEventListener('mouseleave', arrancar);
    zona.addEventListener('focusin', frenar);
    zona.addEventListener('focusout', arrancar);

    var cinta = zona.querySelector('.hero__cinta');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(es){
        es.forEach(function(e){
          vivo = e.isIntersecting;
          if (cinta) cinta.classList.toggle('quieta', !vivo);
          if (vivo) alDestapar(arrancar); else frenar();
        });
      }, { threshold: .15 }).observe(zona);
    } else { arrancar(); }
  })();

  /* --- 05 · el riel dorado se llena atado a la posición de scroll ---
     No es un stagger por tiempo: es la misma regla de los títulos partidos.
     El frente dorado y el encendido de cada paso son EL MISMO evento — un
     punto se prende justo cuando la línea lo alcanza, no antes ni después. */
  (function riel(){
    var caja = $('riel');
    if (!caja) return;
    var via    = caja.querySelector('.riel__via');
    var frente = caja.querySelector('.riel__frente');
    var pasos  = [].slice.call(caja.querySelectorAll('.riel__p'));
    if (!frente || !pasos.length) return;

    var CENTRO = 9.5;              /* top del punto (4) + su mitad (5.5) */
    var arriba = 0, largo = 0, maximo = 0;

    /* La vía va de centro de punto a centro de punto y no de borde a borde de
       la lista: si no, el dorado sobra por abajo del 04. Se recalcula al
       cambiar de tamaño porque los pasos cambian de alto al reflowear. */
    function medir(){
      var r = caja.getBoundingClientRect();
      arriba = pasos[0].getBoundingClientRect().top - r.top + CENTRO;
      largo  = (pasos[pasos.length - 1].getBoundingClientRect().top - r.top + CENTRO) - arriba;
      [via, frente].forEach(function(el){
        el.style.top = arriba + 'px'; el.style.bottom = 'auto'; el.style.height = largo + 'px';
      });
    }
    medir();
    window.addEventListener('resize', medir, { passive: true });
    /* La Inter va con font-display:swap: hasta que carga, los pasos miden
       distinto y la vía queda corrida. Se remide cuando la fuente está. */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    window.addEventListener('load', medir);
    if (reduce) return;            /* el CSS ya lo deja lleno */

    function porScroll(){
      var r = caja.getBoundingClientRect();
      var alto = window.innerHeight || document.documentElement.clientHeight;
      var linea = alto * .62;                       /* la misma cabeza lectora de los títulos */
      var p = (linea - (r.top + arriba)) / (largo || 1);
      p = Math.max(0, Math.min(1, p));
      if (p <= maximo) { p = maximo; } else { maximo = p; }   /* enganchado: no retrocede */
      frente.style.transform = 'scaleY(' + p.toFixed(4) + ')';
      pasos.forEach(function(el){
        if (el.getBoundingClientRect().top + CENTRO <= linea) el.classList.add('on');
      });
    }
    alBajar(porScroll);
    revelar.push(porScroll);
  })();

  /* --- 04bis · servicios en pila apilada al scroll (ScrollStack, a mano) ---
     Traducción del componente ScrollStack de React Bits — mismo criterio que
     el resto del sitio: sin Lenis, sin React. Cada área se ancla arriba de
     la pantalla y la siguiente la reemplaza al llegar, "documento que pasa
     de página" en vez de carrusel. El "pin" lo escribe este bloque con
     translate3d, contra la posición NATURAL de cada tarjeta — medida una
     sola vez, con el transform en 'none': releerla después de aplicar el
     transform del cuadro anterior mete un feedback que hace parpadear la
     pila al pasar las tarjetas (bug real, ya visto y corregido acá). */
  (function pilaServicios(){
    var raiz = $('pilaServicios');
    if (!raiz) return;
    var cards = [].slice.call(raiz.querySelectorAll('.pila__card'));
    var fin = raiz.querySelector('.pila__end');
    var n = cards.length;
    if (!n) return;

    cards.forEach(function(c, i){ if (i < n - 1) c.style.marginBottom = '50px'; });

    if (reduce) { raiz.classList.add('pila--reducida'); return; }

    var hudActual = raiz.querySelector('.pila__hudActual');
    var hudFill = raiz.querySelector('.pila__hudBarra i');
    var hudTotal = raiz.querySelector('.pila__hudTotal');
    function dosCifras(num){ return (num < 10 ? '0' : '') + num; }
    /* La última tarjeta es el CTA "¿Lo tuyo no está en la lista?", no un área
       más — el HUD cuenta sobre las once reales, igual que la copy. */
    var esCTA = cards[n - 1] && cards[n - 1].classList.contains('pilaH__c--cta');
    var nAreas = esCTA ? n - 1 : n;
    if (hudTotal) hudTotal.textContent = dosCifras(nAreas);

    var cardTops = [], finTop = 0;
    function medir(){
      cards.forEach(function(card){ card.style.transform = 'none'; });
      cardTops = cards.map(function(card){ return card.getBoundingClientRect().top + window.scrollY; });
      finTop = fin ? (fin.getBoundingClientRect().top + window.scrollY) : 0;
    }

    /* Chequeo sucio (14-08): el bucle pinta cada cuadro mientras la pila está
       cerca de la ventana, pero antes ESCRIBÍA los doce transforms aunque el
       dedo estuviera quieto — la pila mide varias pantallas de alto, así que
       eso era trabajo sostenido por nada durante buena parte del scroll.
       Guardando el último y/alto, el cuadro en reposo sale en dos
       comparaciones. Se conserva el rAF propio y no se pasa a alBajar()
       porque el pin tiene que seguir al scroll por inercia de iOS, donde el
       evento llega a tirones y el cuadro no. */
    var ultY = -1, ultVh = -1;
    function pintar(forzar){
      var vh = window.innerHeight;
      var scrollTop = window.scrollY;
      if (!forzar && scrollTop === ultY && vh === ultVh) return;
      ultY = scrollTop; ultVh = vh;

      var stackPx = vh * .11;
      var pinEnd = finTop - vh / 2;
      var idxActual = 0;

      cards.forEach(function(card, i){
        var pinStart = cardTops[i] - stackPx;
        var trasY = 0;
        if (scrollTop >= pinStart && scrollTop <= pinEnd) trasY = scrollTop - cardTops[i] + stackPx;
        else if (scrollTop > pinEnd) trasY = pinEnd - cardTops[i] + stackPx;
        card.style.transform = 'translate3d(0,' + trasY.toFixed(1) + 'px,0)';
        if (scrollTop >= pinStart) idxActual = i;
      });

      /* HUD: mismo scrollTop, sin medición propia. El recorrido va del pin de
         la primera tarjeta al pin de salida (pinEnd) — ahí es cero a cien. */
      if (hudActual) {
        var arranque = cardTops[0] - stackPx;
        var progreso = pinEnd > arranque ? (scrollTop - arranque) / (pinEnd - arranque) : 0;
        progreso = Math.min(1, Math.max(0, progreso));
        hudActual.textContent = dosCifras(Math.min(idxActual + 1, nAreas));
        hudFill.style.height = (progreso * 100).toFixed(1) + '%';
      }
    }

    var corriendo = false;
    function cuadroPila(){ pintar(); if (corriendo) requestAnimationFrame(cuadroPila); }

    /* La capa de GPU se pide al entrar y se devuelve al salir: doce tarjetas a
       pantalla completa no tienen por qué estar promovidas cuando la sección
       quedó tres pantallas atrás. */
    function capas(si){
      cards.forEach(function(c){ c.style.willChange = si ? 'transform' : ''; });
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function(es){
        es.forEach(function(e){
          if (e.isIntersecting && !corriendo) { corriendo = true; capas(true); raiz.classList.add('pila--activa'); requestAnimationFrame(cuadroPila); }
          else if (!e.isIntersecting) { corriendo = false; capas(false); raiz.classList.remove('pila--activa'); }
        });
      }, { rootMargin: '300px 0px' }).observe(raiz);
    } else {
      corriendo = true;
      capas(true);
      raiz.classList.add('pila--activa');
      requestAnimationFrame(cuadroPila);
    }

    medir();
    pintar(true);

    /* pintar(true) obligatorio después de medir(): medir() deja los transforms
       en 'none' para leer la posición natural, y un resize que cambie el ancho
       pero no el alto pasaría el chequeo sucio y dejaría la pila desarmada. */
    var temporizadorPila = null;
    window.addEventListener('resize', function(){
      clearTimeout(temporizadorPila);
      temporizadorPila = setTimeout(function(){ medir(); pintar(true); }, 120);
    }, { passive: true });
  })();

  /* --- PARALAJE: dos fotos que se mueven más lento que el texto ---
     Es el único movimiento de la página que no tiene principio ni fin: no
     "entra", acompaña. Las dos fotos grandes —el retrato del hero y la
     fachada— se desplazan contra el scroll dentro de su propio marco, y por
     eso ninguna de las dos se mueve un píxel de más: el sobrante de escala
     que tienen en CSS (8% y 10%) es exactamente el recorrido que se les
     permite acá. Con motion reducido no se registra ninguna pista. */
  (function paralaje(){
    if (reduce) return;

    var foto = document.querySelector('.hero__foto img');
    var caja = document.querySelector('.hero .env');
    var zona = document.querySelector('.hero');
    if (foto && zona) {
      var altoHero = zona.offsetHeight || 1;
      window.addEventListener('resize', function(){ altoHero = zona.offsetHeight || 1; }, { passive: true });
      alBajar(function(y){
        var p = Math.max(0, Math.min(1, y / altoHero));
        foto.style.setProperty('--py', (p * 28).toFixed(1) + 'px');
        if (!caja) return;
        /* El texto del hero se despide: sube un poco más rápido que la página
           y se va apagando, pero recién desde el 40% —antes de eso está
           entero y legible, que es lo que tiene que estar. */
        var s = Math.max(0, Math.min(1, (p - .4) / .55));
        caja.style.transform = s ? 'translate3d(0,' + (-s * 56).toFixed(1) + 'px,0)' : '';
        caja.style.opacity = s ? (1 - s).toFixed(3) : '';
      });
    }

    var fachada = document.querySelector('.nos__foto img');
    var sec = $('nosotros');
    if (fachada && sec) {
      alBajar(function(y, h){
        var r = sec.getBoundingClientRect();
        /* 0 cuando la sección asoma por abajo, 1 cuando terminó de salir por
           arriba: el recorrido completo, no el del viewport */
        var p = (h - r.top) / (h + r.height || 1);
        p = Math.max(0, Math.min(1, p));
        fachada.style.setProperty('--py', ((p - .5) * 40).toFixed(1) + 'px');
      });
    }
  })();

  /* --- barra de lectura --- */
  (function lectura(){
    var barra = document.querySelector('.lectura i');
    if (!barra || reduce) return;
    alBajar(function(y, h){
      var largo = (document.documentElement.scrollHeight || 0) - h;
      barra.style.setProperty('--p', largo > 0 ? Math.min(1, y / largo).toFixed(4) : '1');
    });
  })();

  /* --- header: fondo blanco + hairline dorada a los 40px --- */
  var head = document.querySelector('.head');
  var barra = $('barra');
  var hero = document.querySelector('.hero');
  var formVisible = false;

  var ultimoY = 0;

  function alScroll(y){
    if (typeof y !== 'number') y = window.pageYOffset || 0;
    head.dataset.fijo = y > 40 ? 'si' : 'no';
    var pasoHero = y > hero.offsetHeight * .7;
    barra.dataset.visible = (pasoHero && !formVisible) ? 'si' : 'no';

    /* El header se esconde bajando y vuelve al primer scroll hacia arriba.
       Cuatro frenos, y cualquiera de los cuatro lo deja quieto y visible:
       arriba de todo, con el menú de celular abierto, con un campo del
       formulario enfocado (el teclado ya se comió media pantalla, que encima
       se mueva la barra es mareo puro) y antes de la mitad del hero. El
       umbral de 4px es para que el rebote del scroll táctil no lo haga
       parpadear. */
    var baja = y > ultimoY + 4, sube = y < ultimoY - 4;
    var menu = panel && panel.dataset.abierto === 'si';
    var escribiendo = document.activeElement && document.activeElement.closest
      && document.activeElement.closest('#form');
    if (y < 120 || sube || menu || escribiendo) head.dataset.oculto = 'no';
    else if (baja && y > hero.offsetHeight * .5) head.dataset.oculto = 'si';
    if (baja || sube) ultimoY = y;
  }
  alBajar(alScroll);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function(es){
      formVisible = es[0].isIntersecting;
      alScroll();
    }, { threshold: .18 }).observe($('form'));
  }

  /* --- menú de celular: panel a pantalla completa desde la derecha --- */
  var panel = $('panel'), abrir = $('abrir'), cerrar = $('cerrar');
  function menu(ab){
    panel.dataset.abierto = ab ? 'si' : 'no';
    panel.setAttribute('aria-hidden', !ab);
    abrir.setAttribute('aria-expanded', ab);
    document.documentElement.style.overflow = ab ? 'hidden' : '';
    (ab ? cerrar : abrir).focus();
    alScroll();   /* con el menú abierto el header nunca está escondido */
  }
  abrir.addEventListener('click', function(){ menu(true); });
  cerrar.addEventListener('click', function(){ menu(false); });
  panel.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ menu(false); }); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && panel.dataset.abierto === 'si') menu(false); });

  /* --- equipo: la palabra que se te viene encima (2026-08-18) ---
     Copiado de la sección Team de ario.law. Reemplaza al carrusel de
     profundidad, que mostraba una cara por vez y escondía dos.

     El pin y el scrub los hace ScrollTrigger. Dos decisiones que NO se pueden
     tocar sin romper el gesto:

     1. La palabra crece cambiando el FONT-SIZE, no con transform:scale. Un
        transform en capa promovida se rasteriza una sola vez, al tamaño de
        partida, y después estira el mapa de bits: a 7x se ve una foto de la
        palabra ampliada. Con font-size el texto se vuelve a componer a su
        tamaño real en cada cuadro. Cuesta un relayout por cuadro de UNA
        palabra, y como está fuera de flujo no se propaga al documento.
        (El original de ario usa un SVG y le escribe la matriz al path: ahí
        también cambia la geometría, no un bitmap ya pintado.)
     2. El escalonado de entrada va sobre los <summary>, no sobre los
        <details>: GSAP deja el transform escrito y un transform convierte al
        elemento en bloque contenedor de sus hijos absolutos — con él en el
        <details>, la ficha se mediría contra su banda y no contra la sección.

     El número que hace el efecto es el tope: cuánto tiene que crecer la
     mayúscula para terminar apenas más alta que la ventana. Ese 1,1 es lo que
     te deja adentro del hueco de la letra en vez de mirándola de lejos. Se
     mide la caja de tinta con measureText y no el font-size, que incluye el
     espacio de acentos y descendentes que la palabra no está usando. */
  (function equipoZoom(){
    var sec = document.getElementById('equipo');
    if (!sec || !sec.classList.contains('zm')) return;
    if (!window.gsap || !window.ScrollTrigger) return;   /* sin librería, queda el respaldo del CSS */
    gsap.registerPlugin(ScrollTrigger);
    /* En el celular, mostrar y esconder la barra del navegador dispara un
       resize por cada scroll. Sin esto, ScrollTrigger se recalcula todo el
       tiempo y el pin tiembla. */
    ScrollTrigger.config({ ignoreMobileResize: true });

    /* 🔴 EL SCROLL SUAVE Y EL REFRESH NO PUEDEN CONVIVIR (18-08).
       Es el mismo problema que soltarBanda() ya resuelve más abajo, pero del
       lado de GSAP. Para medir, ScrollTrigger.refresh() lleva el scroll a 0,
       toma las medidas y lo devuelve. Con scroll-behavior:smooth en el <html>
       —que el menú de anclas quiere— esos dos scrolls salen ANIMADOS: la
       librería mide con la página todavía donde estaba, y el arranque del pin
       le queda corrido exactamente el scroll que no se llegó a aplicar.
       Medido: refrescando en y=0 el desfase es 0; en y=1869 es -1869; en
       y=6000 es -6639. Con scroll-behavior:auto es 0 en todos.
       Lo que se veía: el refresh que dispara el observador de abajo cuando
       SERVICIOS reparte dejaba el pin arrancando ~1900px antes de la sección
       —EQUIPO se plantaba encima mientras se leía NOSOTROS— y terminando
       ~2000px antes del final del pin-spacer, que al no tener fondo mostraba
       el hueso del body: la franja en blanco.
       Va por los eventos de la librería y no envolviendo nuestras llamadas,
       para que queden cubiertos también los refresh internos de GSAP (resize
       de ventana, orientación).
       El contador es por si un refresh cae adentro de otro: sin él, el de
       adentro guardaría el 'auto' que puso el de afuera y al salir lo dejaría
       pegado, que es peor que el bug —el menú de anclas se quedaría sin scroll
       suave para toda la sesión—. Sólo el primero en entrar guarda y sólo el
       último en salir devuelve. */
    var raizSb = document.documentElement, sbPrevio = null, sbHondo = 0;
    ScrollTrigger.addEventListener('refreshInit', function(){
      if (!sbHondo++) sbPrevio = raizSb.style.scrollBehavior;
      raizSb.style.scrollBehavior = 'auto';
    });
    ScrollTrigger.addEventListener('refresh', function(){
      if (!sbHondo || --sbHondo) return;
      raizSb.style.scrollBehavior = sbPrevio;
      sbPrevio = null;
    });

    var fijo   = sec.querySelector('.zm__fijo');
    var ante   = sec.querySelector('.zm__ante');
    var pal    = sec.querySelector('.zm__palabra');
    var capa   = sec.querySelector('.zm__cards');
    var caras  = sec.querySelectorAll('.eqn > details > summary');
    var vhSec  = parseFloat(sec.getAttribute('data-recorrido')) || 190;
    var factor = parseFloat(sec.getAttribute('data-tope')) || 1.1;
    var pago   = parseFloat(sec.getAttribute('data-pago')) || .7;

    var lienzo = document.createElement('canvas').getContext('2d');
    var base = 100, tope = 8;

    function medir(){
      pal.style.fontSize = '';                       /* vuelve al clamp del CSS: esa es la medida base */
      var cs = getComputedStyle(pal);
      base = parseFloat(cs.fontSize) || 100;
      /* contra el alto REAL del panel y no contra innerHeight: el panel es
         100svh y en el celular svh es la ventana con la barra puesta */
      var alto = fijo.getBoundingClientRect().height || window.innerHeight;
      var caja = base * .72;                         /* respaldo: la cap-height de Inter */
      try {
        lienzo.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
        var m = lienzo.measureText(pal.textContent.trim());
        var alt = (m.actualBoundingBoxAscent || 0) + (m.actualBoundingBoxDescent || 0);
        if (alt > 4) caja = alt;
      } catch(e){}
      tope = Math.max(2, alto / caja * factor);
    }

    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', function(){
      medir();
      gsap.set(capa, { opacity: 0 });
      gsap.set(caras, { opacity: 0, yPercent: 8 });

      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: sec, start: 'top top', end: '+=' + vhSec + '%',
          pin: true,
          scrub: .6,                    /* con número: la animación persigue al scroll en vez de estar clavada al píxel */
          invalidateOnRefresh: true, onRefreshInit: medir
        }
      });

      /* el timeline dura 1 y las posiciones son fracciones, así que los
         tiempos se leen como progresos del scroll */
      tl.to(pal,   { fontSize: function(){ return base * tope + 'px'; }, ease: 'none', duration: 1 }, 0)
        .to(ante,  { opacity: 0, y: -90, ease: 'none', duration: .3 }, 0)
        .to(pal,   { opacity: 0, ease: 'none', duration: (1 - pago) * .74 }, pago)
        .to(capa,  { opacity: 1, ease: 'none', duration: (1 - pago) * .35 }, pago)
        .to(caras, { opacity: 1, yPercent: 0, ease: 'power2.out',
                     duration: (1 - pago) * .7, stagger: (1 - pago) * .12 }, pago + .02);

      return function(){ gsap.set([pal, ante, capa, caras], { clearProps: 'all' }); };
    });

    gsap.matchMedia().add('(prefers-reduced-motion: reduce)', function(){
      sec.classList.add('zm--quieto');
      return function(){ sec.classList.remove('zm--quieto'); };
    });

    /* la medición depende de la tipografía real: con la fallback, la caja de la
       mayúscula es otra y el tope sale mal */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });

    /* 🔴 Y el refresco que hace falta sí o sí acá (18-08). Los bloques escritos
       a mano de más arriba cambian el alto del documento cuando se los recorre
       por primera vez: SERVICIOS pasa de 1827 a 1444 px —383 menos— cuando la
       carpeta termina de repartir. ScrollTrigger había cacheado el arranque del
       pin contra el alto viejo, así que enganchaba 383 px tarde y sobre el final
       la sección de reseñas se le montaba encima a la palabra. La librería no
       tiene cómo enterarse sola de un layout que mueve otro script: se le avisa
       mirando el alto del documento.
       El candado de "refrescando" está porque el propio refresh() reescribe el
       alto del pin-spacer y volvería a disparar el observador en loop.

       🔴 Pero el candado NO puede tirar el aviso a la basura (18-08). El alto de
       arriba cambia DOS veces y no una: primero cuando la retícula reparte, y un
       rato después cuando soltarBanda() le devuelve al documento los 383 px de
       la banda. Si el segundo cambio caía dentro de la ventana del candado, el
       return lo perdía —y encima altoUlt ya había quedado en el valor nuevo, así
       que el cambio figuraba como visto y no se refrescaba nunca más: el pin
       quedaba 384 px corrido para siempre. Ahora lo que llega con el candado
       puesto queda anotado en "pendiente" y se atiende al salir. */
    if ('ResizeObserver' in window) {
      var altoUlt = document.documentElement.scrollHeight, tim = 0,
          refrescando = false, pendiente = false;
      var revisarAlto = function(){
        if (refrescando) { pendiente = true; return; }
        var alto = document.documentElement.scrollHeight;
        if (Math.abs(alto - altoUlt) < 2) return;
        altoUlt = alto;
        clearTimeout(tim);
        tim = setTimeout(function(){
          refrescando = true;
          ScrollTrigger.refresh();
          altoUlt = document.documentElement.scrollHeight;
          setTimeout(function(){
            refrescando = false;
            if (pendiente) { pendiente = false; revisarAlto(); }
          }, 120);
        }, 140);
      };
      new ResizeObserver(revisarAlto).observe(document.body);
    }

    /* la ficha: el <details> ya abre y cierra solo. Esto agrega el ✕ —hace
       falta porque el panel abierto tapa al <summary> que lo dispara—, devuelve
       el foco al cerrar, y engancha Escape como el resto de los paneles. */
    sec.querySelectorAll('.eqn details').forEach(function(det){
      var cerrar = det.querySelector('.eqn__x');
      var resumen = det.querySelector('summary');
      /* El toggle va antes del return de arriba a propósito: lo escucha CADA
         ficha, tenga ✕ o no. Es el único evento que se entera de las cuatro
         vías de apertura y cierre —el clic en la banda, el ✕, Escape, y el
         cierre automático que hace el name="eq" cuando se abre otra—, así que
         es el lugar donde marcar el body sin que se escape ningún caso.
         Se pregunta por el DOM en vez de llevar la cuenta: al saltar de una
         ficha a otra llegan dos toggles seguidos y un contador se
         desincronizaría. */
      det.addEventListener('toggle', function(){
        document.body.classList.toggle('ficha-abierta', !!sec.querySelector('.eqn details[open]'));
      });
      if (!cerrar) return;
      cerrar.addEventListener('click', function(e){
        e.preventDefault();
        det.open = false;
        if (resumen) resumen.focus();
      });
    });
    document.addEventListener('keydown', function(e){
      if (e.key !== 'Escape') return;
      var abierta = sec.querySelector('.eqn details[open]');
      if (abierta) { abierta.open = false; abierta.querySelector('summary').focus(); }
    });
  })();


  /* Si al segundo largo quedó algo escondido, es que los observadores no
     dispararon: se muestra todo igual. Nunca una página en blanco.
     ⏳ Los 1200ms se cuentan desde que se DESTAPA, no desde que corre el script:
     con el telón puesto esta red llegaba antes que la hoja y revelaba el hero
     por debajo, así que la cascada de apertura pasaba tapada y el visitante
     encontraba la portada ya puesta. Sin telón, alDestapar() corre en el acto y
     esto se comporta igual que siempre. */
  alDestapar(function(){ setTimeout(revelarTodo, 1200); });

  /* =====================================================================
     EL REPARTO DESDE LA CARPETA.

     La diferencia de fondo con la versión pila: ahí el origen era un punto
     calculado adentro de la retícula, fijo. Acá el origen es un ELEMENTO
     REAL que además se mueve —la carpeta va sticky—, así que su boca se mide
     cada cuadro y de ahí sale el vector de cada celda. Es más simple: no hay
     que inventar la pila, se lee dónde está la carpeta.
     ===================================================================== */
  (function reparto(){
    var caja = document.getElementById('cpo');
    var red = document.getElementById('srvCpo');
    if (!caja || !red || reduce) return;
    /* el recorte a [0,1] es propio del motor: la hoja de este archivo no tiene
       un ayudante equivalente y no vale la pena agregarle uno global */
    function tope(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
    var celdas = [].slice.call(red.querySelectorAll('.srv__c'));
    if (!celdas.length) return;
    var folder = caja.querySelector('.cpo__f');

    /* Los tres tiempos, en progreso del bloque. ABRE_* es el plegado de la
       tapa; el reparto arranca cuando la tapa ya está casi abierta. */
    var ABRE_INI = .06, ABRE_FIN = .20;
    /* Salen DE A TRES, que en una grilla de tres columnas es UNA FILA POR
       ANILLO: las tres de la fila vuelan juntas a casillas vecinas, así que no
       se cruzan entre ellas y la retícula se llena fila por fila. Adentro del
       anillo llevan un desfasaje mínimo para que no se muevan calcadas.
       La cuenta cierra en .97: el último anillo sale en .20 + 3×.15 + 2×.03 y
       aterriza un LARGO después, o sea antes de que el bloque se recorra. */
    var TIRA_INI = .20, GRUPO = 3, PASO = .15, PASO_IN = .03, LARGO = .26;
    var ESC_CHICA = .42, ALZA = 90, MARCO = 1;
    var activo = false, terminado = false, ultimo = -1, pMax = 0;

    function limpiar(c){
      c.style.transform = '';
      c.style.zIndex = '';
      c.style.removeProperty('--tinta');
      c.style.removeProperty('--papel');
      c.style.removeProperty('--marco');
      var t = c.querySelector('h3');
      if (t) t.style.height = '';
    }

    function medir(){
      if (terminado) return;
      activo = getComputedStyle(red).gridTemplateColumns.split(/\s+/).filter(Boolean).length > 1;
      if (!activo) {
        caja.classList.remove('cpo--on');
        caja.classList.remove('cpo--banda');
        caja.classList.remove('cpo--suelta');
        red.style.removeProperty('--red');
        celdas.forEach(limpiar);
        return;
      }
      caja.classList.add('cpo--on');
      caja.classList.add('cpo--banda');
      /* El motor toma el control de la entrada, así que le saca a las celdas
         el data-anim="cortina" de la gramática general: son dos entradas para
         la misma pieza y se pisarían — peor todavía, la cortina las deja en
         opacity:0 hasta que el observador las revela, así que sin esto las
         celdas viajarían invisibles. El atributo se conserva en el HTML a
         propósito: es el que sigue gobernando en celular (una columna, sin
         carpeta), sin JS y con motion reducido. */
      celdas.forEach(function(c){
        if (c.hasAttribute('data-anim')) { c.removeAttribute('data-anim'); c.classList.add('vista'); }
      });
      /* el alto del título, clavado en el que mide asentado: la celda viaja
         escalada y el texto entra recién al final, así que nada de esto puede
         mover la maqueta, pero el alto fijo lo garantiza igual */
      celdas.forEach(function(c){
        var t = c.querySelector('h3');
        if (t) t.style.height = '';
      });
      celdas.forEach(function(c){
        var t = c.querySelector('h3');
        if (t) t.style.height = t.offsetHeight + 'px';
      });
    }
    function remedir(){ medir(); ultimo = -1; pedirCuadro(); }
    medir();
    window.addEventListener('resize', remedir, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remedir);

    function suave(q){ return 1 - Math.pow(1 - q, 3); }
    function suaveTarde(q){ return 1 - Math.pow(1 - q, 2); }

    /* 🔴 LA BANDA SALE DEL FLUJO RECIÉN CUANDO NADIE LA MIRA (18-08).

       El reparto está calibrado para terminar CON LA CARPETA TODAVÍA EN
       PANTALLA —es lo que hace que las últimas celdas no aterricen en otra
       sección—, y hasta hoy en ese mismo cuadro se le sacaba el display a la
       banda. Resultado medido a 1440x900: #servicios pasaba de 1827 a 1444 px
       —383 de golpe— y la retícula recién repartida se iba para arriba delante
       del que estaba leyendo.

       Por qué no alcanzaba con dejárselo al navegador, que es lo que uno
       esperaría: Chrome y Firefox tienen ANCLAJE DE SCROLL y efectivamente lo
       tapaban solos —medido: la sección se acortaba 383 px y el navegador se
       descontaba los mismos 383 sin que se moviera nada—. Safari no implementa
       el anclaje: ahí el salto se veía entero. Y en los dos, el anclaje queda
       suspendido cuando el scroll lo pidió un script, o sea justo en el caso
       del menú de anclas: hacer clic en "Contacto" con el bloque de servicios
       sin recorrer dejaba la sección 383 px por encima del borde de arriba
       —medido, y arreglado de yapa por esto mismo—.

       Ahora la banda espera a quedar fuera de la ventana, y ahí se la saca:
       · por ARRIBA (lo normal, se siguió bajando): sacarla sube todo lo de
         abajo, así que se le descuenta al scroll lo mismo que se movió la
         retícula y el ojo no ve absolutamente nada.
       · por ABAJO (volvieron a subir antes de que despejara): lo de abajo se
         acomoda fuera de pantalla, no hay nada que compensar — y compensar ahí
         sería mover la ventana por gusto.

       El descuento se mide mirando cuánto se movió la retícula EN PANTALLA y no
       restando alturas de documento: así sale bien tanto si el navegador ancló
       el scroll por su cuenta (se mueve 0, no se toca nada) como si no, y no
       hay que adivinar cuánto colapsan los márgenes de la banda —el rect dice
       288 px y lo que se va del documento son 383—. */
    function soltarBanda(h){
      var banda = caja.querySelector('.cpo__banda');
      if (!banda) { caja.classList.remove('cpo--banda'); return true; }
      var r = banda.getBoundingClientRect();
      var arriba = r.bottom <= 0;
      if (!arriba && r.top < h) return false;      /* todavía a la vista: no se toca */
      var ref = arriba ? red.getBoundingClientRect().top : 0;
      caja.classList.remove('cpo--banda');
      if (arriba) {
        var d = red.getBoundingClientRect().top - ref;
        /* El descuento tiene que ser INSTANTÁNEO. La hoja le pone
           scroll-behavior:smooth al <html> —lo quiere el menú de anclas— y eso
           gobierna también los scrolls por JS: animado, la compensación llega
           tarde y en vez de tapar el salto lo convierte en un viaje de 383px.
           Se apaga por el estilo inline y se devuelve enseguida, que anda en
           todos lados; behavior:'instant' tira TypeError en navegadores que no
           lo conocen. */
        if (d) {
          var raiz = document.documentElement, previo = raiz.style.scrollBehavior;
          raiz.style.scrollBehavior = 'auto';
          window.scrollTo(0, Math.max(0, (window.pageYOffset || 0) + d));
          raiz.style.scrollBehavior = previo;
        }
      }
      return true;
    }

    alBajar(function(y, h){
      /* repartida y limpia: lo único que queda pendiente es devolverle al
         documento el alto de la banda, sin que se note */
      if (terminado) return soltarBanda(h) ? 'fin' : undefined;
      if (!activo) return;
      var r = caja.getBoundingClientRect();
      /* El progreso se mide contra la BANDA de la carpeta y no contra el
         borde del bloque: la banda es sticky, así que su posición en pantalla
         es la del origen del gesto. Arranca cuando la carpeta entra por abajo
         y termina cuando el bloque ya se recorrió. */
      /* En ALTOS DE PANTALLA y no de retícula: lo que tiene que entrar en la
         pantalla es el tiempo que la carpeta está a la vista, no el largo de
         la grilla. Con .85 el último anillo aterriza con la carpeta todavía
         arriba en pantalla. */
      var p = tope((h * .80 - r.top) / (h * .85));
      if (p < pMax) p = pMax; else pMax = p;      /* pasa una sola vez */
      if (p === ultimo) return;
      ultimo = p;

      caja.classList.toggle('cpo--suelta', p > 0 && p < 1);

      /* 2 · la tapa. Interpolada, no disparada: tiene que poder quedar a
         mitad de camino si el scroll se detiene. */
      var abre = tope((p - ABRE_INI) / (ABRE_FIN - ABRE_INI));
      folder.style.setProperty('--abre', abre.toFixed(3));

      /* el marco de la grilla entra con las primeras celdas */
      red.style.setProperty('--red', tope((p - TIRA_INI) / .30).toFixed(3));

      /* 3 · el reparto. La boca de la carpeta, medida cada cuadro contra la
         retícula: la banda es sticky, o sea que se mueve sola. */
      var rf = folder.getBoundingClientRect(), rr = red.getBoundingClientRect();
      var bocaX = rf.left + rf.width / 2 - rr.left;
      /* La boca va casi en el borde de arriba y no en el medio del cuerpo: la
         tapa cubre el inset:0 de la carpeta, así que una celda centrada en el
         cuerpo queda tapada del todo y la carpeta cerrada se lee VACÍA. Con la
         boca al 10%, media celda asoma por arriba —los papeles guardados— y la
         otra mitad queda detrás de la tapa. */
      var bocaY = rf.top + rf.height * .10 - rr.top;

      var enVuelo = 0;
      celdas.forEach(function(c, i){
        var turno = TIRA_INI + Math.floor(i / GRUPO) * PASO + (i % GRUPO) * PASO_IN;
        var q = tope((p - turno) / LARGO);
        if (q >= 1) {
          c.style.transform = 'none';
          c.style.setProperty('--tinta', '1');
          c.style.setProperty('--papel', '0');
          c.style.setProperty('--marco', '0');
          if (c.style.zIndex) c.style.zIndex = '';
          return;
        }
        enVuelo++;
        var k = 1 - suave(q), kGiro = 1 - suaveTarde(q);
        /* dónde está la celda ahora: de la boca de la carpeta a su casilla.
           El corrimiento por índice es el de una pila de papeles: sin él, las
           doce quietas adentro de la carpeta son un solo rectángulo. */
        var dx = bocaX - (c.offsetLeft + c.offsetWidth / 2) + i * 2;
        var dy = bocaY - (c.offsetTop + c.offsetHeight / 2) + i * 2.5;
        var vuelo = Math.sin(Math.PI * q);
        var esc = ESC_CHICA + (1 - ESC_CHICA) * suave(tope((q - .35) / .65));
        c.style.transform = 'translate3d(' + (dx * k).toFixed(2) + 'px,' +
          (dy * k - vuelo * ALZA).toFixed(2) + 'px,0) rotate(' +
          (((i % 5) - 2) * 1.6 * kGiro).toFixed(2) + 'deg) scale(' + esc.toFixed(4) + ')';
        /* el hueso se drena mientras viaja y el texto entra después, cuando el
           fondo ya es ónix: nunca hay un cuadro con el texto sobre el papel */
        c.style.setProperty('--papel', (1 - tope((q - .75) / .20)).toFixed(3));
        c.style.setProperty('--tinta', tope((q - .85) / .15).toFixed(3));
        c.style.setProperty('--marco', (MARCO * k).toFixed(3));
        /* quieta adentro de la carpeta va debajo de la tapa; en vuelo, arriba */
        c.style.zIndex = q > 0 ? (20 + celdas.length - i) : 2;
      });

      /* la carpeta se cierra y se va cuando ya no le queda nada adentro */
      /* cuando salió el último anillo la carpeta está vacía: se cierra y se va,
         porque una carpeta vacía a la vista es un objeto sin función */
      var salioTodo = TIRA_INI + 3 * PASO + 2 * PASO_IN;
      var vacia = p > salioTodo;
      folder.style.setProperty('--vive', vacia ? '0' : '1');
      if (vacia) folder.style.setProperty('--abre', (1 - tope((p - salioTodo) / .12)).toFixed(3));

      if (p >= 1) {
        terminado = true;
        celdas.forEach(limpiar);
        caja.classList.remove('cpo--on');
        caja.classList.remove('cpo--suelta');
        red.style.removeProperty('--red');
        /* la retícula ya quedó sin una sola propiedad inline; la pista sigue
           viva sólo hasta que la banda despeje (ver soltarBanda) */
        return soltarBanda(h) ? 'fin' : undefined;
      }
    });
  })();

  /* --- servicios: el relleno entra por el borde por donde entró el cursor y se
     retira por donde salió. El JS no anima nada: escribe un atributo y el
     barrido lo hace la transición del CSS. Sin JS el bloque anda igual, subiendo
     siempre desde abajo. --- */
  (function servicios(){
    var celdas = document.querySelectorAll('.srv__c, .hero__cta .btn');
    if (!celdas.length) return;
    function ladoMasCerca(e, el){
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      var d = { top:y, bottom:1-y, left:x, right:1-x }, min = 'top';
      for (var k in d) if (d[k] < d[min]) min = k;
      return min;
    }
    celdas.forEach(function(c){
      ['pointerenter','pointerleave'].forEach(function(ev){
        c.addEventListener(ev, function(e){
          if (e.pointerType === 'touch') return;   /* en táctil no hay borde de entrada */
          /* En el pointerleave la celda ya está llena, así que cambiarle el
             origen no se ve: el salto sería visible sólo a media escala. */
          c.dataset.desde = ladoMasCerca(e, c);
        });
      });
    });
  })();

  /* --- mapa: el iframe de Google entra recién cuando alguien lo pide --- */
  (function mapa(){
    var caja = $('mapa'), boton = $('mapa-load');
    if (!caja || !boton) return;
    boton.addEventListener('click', function(){
      var f = document.createElement('iframe');
      f.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Carlos Pellegrini 1368, San Pedro, Buenos Aires') + '&z=16&output=embed';
      f.title = 'Mapa de Carlos Pellegrini 1368, San Pedro';
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      f.setAttribute('allowfullscreen', '');
      caja.appendChild(f);
      caja.dataset.cargado = 'si';
    });
  })();

  /* --- contacto: legajo (pestañas por expediente) + envío ---
     Reemplaza al asistente de dos pasos (2026-08-09). Elegir la pestaña
     reemplaza al "Seguir →" de antes — no se suma un paso — y actualiza tres
     cosas a la vez: el input oculto que arma el mailto (sin tocar el resto
     del envío), la frase de arriba del panel (palabras del buyer persona del
     BRIEF §1) y el rótulo "Expediente" junto al botón de enviar. */
  var form = $('form'), rail = $('rail'), voz = $('voz'), vozTag = $('voz-tag'), motivoReal = $('motivo-real');

  var EXPEDIENTES = {
    choque:  { voz: 'La primera oferta del seguro no siempre es la que corresponde. La miramos con vos.', tag: 'Tránsito' },
    trabajo: { voz: 'El alta de la ART no es la última palabra. Contanos cómo seguís.', tag: 'Laboral / ART' },
    despido: { voz: 'No firmes la liquidación todavía. La revisamos antes.', tag: 'Despido' },
    otra:    { voz: 'Sucesiones, familia, tributario, penal y el resto — contanos y vemos cómo seguir.', tag: 'Otra consulta' }
  };

  var tabs = [].slice.call(rail.querySelectorAll('.leg__tab'));
  var panel = $('panel-contacto');

  function activarExpediente(motivo, moverFoco){
    var d = EXPEDIENTES[motivo];
    if (!d) return;
    motivoReal.value = motivo;
    var elegida = null;
    tabs.forEach(function(t){
      var sel = t.dataset.motivo === motivo;
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      /* tabindex móvil: el grupo entero es UNA parada de tabulación */
      t.setAttribute('tabindex', sel ? '0' : '-1');
      if (sel) elegida = t;
    });
    if (elegida) panel.setAttribute('aria-labelledby', elegida.id);
    var cambiar = function(){ voz.textContent = d.voz; vozTag.textContent = d.tag; voz.style.opacity = 1; };
    if (reduce) { cambiar(); } else { voz.style.opacity = 0; setTimeout(cambiar, 160); }
    /* El foco va a la PESTAÑA elegida, no al campo de nombre (14-08). Enfocar
       un input de texto en el mismo gesto que dispara el salto a #contacto abre
       el teclado de iOS en pleno scroll suave y la página pelea consigo misma.
       La pestaña además es el aterrizaje correcto: muestra qué se eligió y deja
       cambiarlo con una flecha.
       El setTimeout no es maña: el clic viene de un <a href="#contacto">, y la
       navegación al fragmento corre DESPUÉS del handler y manda el foco al
       body. Enfocando en el turno siguiente, la pestaña se queda con él
       (verificado: sin esto el foco terminaba en BODY). */
    if (moverFoco && elegida) setTimeout(function(){ elegida.focus({ preventScroll: true }); }, 0);
  }

  tabs.forEach(function(t){
    t.addEventListener('click', function(){ activarExpediente(t.dataset.motivo, false); });
  });

  /* Flechas del patrón ARIA: izquierda/derecha y arriba/abajo mueven entre
     pestañas, Inicio/Fin van a los extremos. */
  rail.addEventListener('keydown', function(e){
    var i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var j = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = tabs.length - 1;
    if (j === null) return;
    e.preventDefault();
    activarExpediente(tabs[j].dataset.motivo, true);
  });

  /* Preselección desde servicios: es lo que hace medible el objetivo de 8
     consultas mensuales. CORREGIDO EL 14-08 — el selector apuntaba sólo a
     .srv__c, que vive dentro de .pila__respaldo y está display:none apenas
     hay JS (body pierde .sin-js en la primera línea de este script). O sea:
     con JS el handler quedaba colgado de elementos invisibles y NINGÚN clic
     preseleccionaba nada; el que entraba por una sucesión mandaba el mail
     como "Me chocaron". Ahora toma las dos familias de tarjetas —la pila
     visible y la retícula de respaldo— para que siga funcionando en los dos
     caminos. */
  document.querySelectorAll('.pilaH__c[data-motivo], .srv__c[data-motivo]').forEach(function(a){
    a.addEventListener('click', function(){ activarExpediente(a.dataset.motivo, true); });
  });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var d = new FormData(form), v = function(k){ return (d.get(k) || '').toString().trim(); };
    if (!v('nombre') || !v('tel')) {
      $('aviso').textContent = 'Necesitamos tu nombre y un teléfono para poder contestarte.';
      return;
    }
    var motivos = { choque: 'Me chocaron', trabajo: 'Me lesioné trabajando', despido: 'Me despidieron', otra: 'Otra consulta' };
    var cuerpo = [
      'Qué me pasó: ' + (motivos[v('motivo')] || '—'),
      'Nombre: ' + v('nombre'),
      'Teléfono / WhatsApp: ' + v('tel'),
      'Localidad: ' + (v('localidad') || '—'),
      'Cuándo pasó: ' + (v('cuando') || '—'),
      '',
      v('detalle') || '—'
    ].join('\n');
    window.location.href = 'mailto:matias.estudiorosa@gmail.com'
      + '?subject=' + encodeURIComponent('Consulta desde la web — ' + (motivos[v('motivo')] || 'consulta'))
      + '&body=' + encodeURIComponent(cuerpo);
    /* la confirmación ocupa el lugar del formulario: la página no salta */
    $('aviso').textContent = '';
    form.classList.add('oculto');
    var listo = $('listo');
    listo.classList.remove('oculto');
    listo.setAttribute('tabindex', '-1');
    listo.focus({ preventScroll: true });
  });
})();
