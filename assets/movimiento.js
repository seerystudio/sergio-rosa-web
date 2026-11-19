/* =====================================================================
   MOVIMIENTO v2 (2026-11-19) — va después de sitio.js y sitio-2.js.
   Ver la cabecera de movimiento.css para qué hace cada parte y de dónde sale.
   No reemplaza nada de sitio-2.js: se cuelga encima. Si este archivo no
   carga, la página es exactamente la de antes.
   ===================================================================== */
(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raiz = document.documentElement;
  function tope(v, a, b){ return v < a ? a : (v > b ? b : v); }
  function ST(){ return window.ScrollTrigger; }

  /* ---------------------------------------------------------------------
     1 · SCROLL CON PESO
     Lo que hace Lenis en las webs de referencia, escrito acá en ochenta
     líneas para no sumar una librería: la rueda no mueve la página de un
     salto, fija un destino y la página va hacia él frenando (expo).
     El scroll sigue siendo el NATIVO de la ventana —no hay contenedor que
     se traslade—, así que window.scrollY, ScrollTrigger, los pin y los
     bucles de la pila y de la carpeta de sitio-2.js siguen leyendo lo de
     siempre. Sólo compu con mouse: en el celular el dedo ya tiene inercia
     propia y meterse ahí empeora todo.
     Lo delicado (ver 🔴 18-08 en sitio-2.js): hay código que mueve el
     scroll por su cuenta —soltarBanda() descuenta la carpeta con un
     scrollTo instantáneo, el refresh de ScrollTrigger va a 0 y vuelve, el
     teclado, la barra—. Cada cuadro se compara dónde quedó la página con
     dónde la dejamos nosotros: si alguien la movió, el destino se corre lo
     mismo y el viaje sigue desde ahí, sin tironeo.
     --------------------------------------------------------------------- */
  var mv = window.SR_MOV = { vel: 0, dir: 1 };
  var suave = !reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (suave) {
    raiz.classList.add('mv-suave');
    var actual = window.scrollY, destino = actual, puesto = actual;
    var viaje = null;           /* ancla: {desde, hasta(), t0, dur} */
    var corriendo = false, tAnt = 0;
    var LAMBDA = 8.5;           /* cuánto tarda en llegar: ~0,55 s a destino */

    function maxY(){ return Math.max(0, raiz.scrollHeight - window.innerHeight); }
    function bloqueado(){
      var b = document.body;
      return getComputedStyle(raiz).overflowY === 'hidden' || getComputedStyle(b).overflowY === 'hidden';
    }
    /* la rueda sobre algo que scrollea solo (la ficha del equipo, un textarea,
       el panel del menú) es de ese algo, no de la página */
    function scrolleaSolo(el, dy){
      for (; el && el !== document.body && el !== raiz; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight + 1) continue;
        var oy = getComputedStyle(el).overflowY;
        if (oy !== 'auto' && oy !== 'scroll') continue;
        if (dy > 0 && el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
        if (dy < 0 && el.scrollTop > 0) return true;
      }
      return false;
    }
    function poner(y){
      window.scrollTo(0, y);
      puesto = window.scrollY;
      var st = ST(); if (st) st.update();
    }
    function arrancar(){
      if (corriendo) return;
      corriendo = true; tAnt = performance.now();
      requestAnimationFrame(cuadro);
    }
    function suaveIO(t){ return t < .5 ? 8*t*t*t*t : 1 - Math.pow(-2*t + 2, 4) / 2; }

    function cuadro(ahora){
      var dt = Math.min(.05, Math.max(.001, (ahora - tAnt) / 1000)); tAnt = ahora;
      var real = window.scrollY;
      /* alguien movió la página por su cuenta: se corre todo junto */
      if (Math.abs(real - puesto) > 1.5) {
        var d = real - puesto;
        actual += d; destino += d;
        if (viaje) viaje.desde += d;
      }
      if (viaje) {
        var p = tope((ahora - viaje.t0) / viaje.dur, 0, 1);
        var hasta = tope(viaje.hasta(), 0, maxY());
        actual = viaje.desde + (hasta - viaje.desde) * suaveIO(p);
        destino = actual;
        poner(actual);
        if (p >= 1) { viaje = null; corriendo = false; return; }
      } else {
        destino = tope(destino, 0, maxY());
        actual += (destino - actual) * (1 - Math.exp(-LAMBDA * dt));
        if (Math.abs(destino - actual) < .4) actual = destino;
        poner(actual);
        if (actual === destino) { corriendo = false; return; }
      }
      requestAnimationFrame(cuadro);
    }

    window.addEventListener('wheel', function(e){
      if (e.ctrlKey || e.defaultPrevented) return;                /* zoom del navegador */
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;        /* gesto horizontal */
      if (bloqueado() || scrolleaSolo(e.target, e.deltaY)) return;
      e.preventDefault();
      var dy = e.deltaY * (e.deltaMode === 1 ? 40 : (e.deltaMode === 2 ? window.innerHeight : 1));
      if (!corriendo) { actual = puesto = window.scrollY; destino = actual; }
      viaje = null;                                               /* la rueda manda sobre el ancla */
      destino = tope(destino + dy, 0, maxY());
      arrancar();
    }, { passive: false });

    /* Anclas: misma curva que todo el sitio, duración según la distancia.
       El destino se vuelve a medir en cada cuadro: si la carpeta de
       servicios se reparte durante el viaje, se llega igual al lugar justo. */
    document.addEventListener('click', function(e){
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href').slice(1);
      var el = id ? document.getElementById(id) : null;
      if (!el && id !== 'inicio') return;
      e.preventDefault();
      function hasta(){
        if (!el || id === 'inicio') return 0;
        var mt = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        return el.getBoundingClientRect().top + window.scrollY - mt;
      }
      var desde = window.scrollY, dist = Math.abs(hasta() - desde);
      actual = puesto = desde;
      viaje = { desde: desde, hasta: hasta, t0: performance.now(), dur: tope(520 + dist * .16, 650, 1500) };
      if (history.pushState) history.pushState(null, '', '#' + id);
      arrancar();
    });

    /* teclado y barra: los maneja el navegador; acá sólo nos enteramos para
       que la próxima ruedita arranque desde donde quedó la página */
    window.addEventListener('scroll', function(){
      if (!corriendo) { actual = destino = puesto = window.scrollY; }
    }, { passive: true });
  }

  /* velocidad del scroll en px/s, suavizada: la usan la cinta y quien quiera.
     Se mide igual con rueda, dedo o teclado. */
  (function velocidad(){
    var yAnt = window.scrollY, tAnt = performance.now(), quieto = 0;
    function medir(t){
      var dt = Math.max(1, t - tAnt), y = window.scrollY, v = (y - yAnt) / dt * 1000;
      mv.vel += (v - mv.vel) * .25;
      if (Math.abs(v) > 2) mv.dir = v > 0 ? 1 : -1;
      yAnt = y; tAnt = t;
      if (Math.abs(mv.vel) < 1) { mv.vel = 0; if (++quieto > 10) { corre = false; return; } } else quieto = 0;
      requestAnimationFrame(medir);
    }
    var corre = false;
    window.addEventListener('scroll', function(){
      if (corre) return; corre = true; quieto = 0; yAnt = window.scrollY; tAnt = performance.now();
      requestAnimationFrame(medir);
    }, { passive: true });
  })();

  /* ---------------------------------------------------------------------
     2 · CINTA DEL HERO QUE RESPONDE AL SCROLL (reactbits · Scroll Velocity)
     Corre a la misma velocidad de antes (media pista cada 38 s). Bajando
     rápido se acelera; subiendo, se da vuelta. Con el mouse encima frena
     despacio en vez de clavarse. Sólo corre mientras se ve.
     --------------------------------------------------------------------- */
  (function cinta(){
    var caja = document.querySelector('.hero__cinta');
    var pista = caja && caja.querySelector('.hero__pista');
    if (!caja || !pista || reduce || !('IntersectionObserver' in window)) return;
    caja.classList.add('mv-cinta');
    var x = 0, mitad = 0, base = 0, rit = 1, empuje = 0, sentido = 1, visible = false, corre = false, tAnt = 0, encima = false;
    function medir(){ mitad = pista.scrollWidth / 2; base = mitad / 38; }
    function cuadro(t){
      if (!visible || document.hidden) { corre = false; return; }
      var dt = Math.min(.05, (t - tAnt) / 1000); tAnt = t;
      var k = 1 - Math.exp(-6 * dt);
      rit += ((encima || caja.classList.contains('quieta') ? 0 : 1) - rit) * k;
      var quiere = Math.min(Math.abs(mv.vel) * .35, base * 7);
      empuje += (quiere - empuje) * k;
      if (mv.vel !== 0) sentido += ((mv.dir) - sentido) * k * 1.5;
      x -= sentido * (base * rit + empuje) * dt;
      if (mitad) { x = x % mitad; if (x > 0) x -= mitad; }
      pista.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(cuadro);
    }
    function arrancar(){ if (corre || !visible) return; corre = true; tAnt = performance.now(); requestAnimationFrame(cuadro); }
    caja.addEventListener('pointerenter', function(){ encima = true; });
    caja.addEventListener('pointerleave', function(){ encima = false; });
    new IntersectionObserver(function(es){ visible = es[0].isIntersecting; arrancar(); }).observe(caja);
    document.addEventListener('visibilitychange', arrancar);
    medir();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    window.addEventListener('resize', medir);
  })();

  /* ---------------------------------------------------------------------
     3 · LA BAJADA DE NOSOTROS SE ENFOCA PALABRA POR PALABRA
     (great-ui · Word Focus Scroll). La frase entra borrosa y apagada, y
     cada palabra se aclara a medida que el párrafo sube por la pantalla.
     Es la única frase del sitio que se lee así: la que dice quiénes son.
     --------------------------------------------------------------------- */
  (function foco(){
    var p = document.querySelector('#nosotros .lead');
    if (!p || reduce || p.children.length || !('IntersectionObserver' in window)) return;
    var texto = p.textContent;
    p.textContent = '';
    var real = document.createElement('span'); real.className = 'sr'; real.textContent = texto;
    var vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    var pals = [];
    texto.split(/(\s+)/).forEach(function(t){
      if (!t) return;
      if (/^\s+$/.test(t)) { vis.appendChild(document.createTextNode(t)); return; }
      var s = document.createElement('span'); s.className = 'mv-p'; s.textContent = t;
      vis.appendChild(s); pals.push(s);
    });
    p.appendChild(real); p.appendChild(vis);
    p.classList.add('mv-foco');
    var ult = [], visible = false, corre = false, celu = window.matchMedia('(max-width: 620px)').matches;
    function bucle(){
      if (!visible) { corre = false; return; }
      pintar();
      requestAnimationFrame(bucle);
    }
    function pintar(){
      var r = p.getBoundingClientRect(), vh = window.innerHeight;
      /* 0 cuando la frase asoma por el 88 % de la pantalla, 1 cuando llegó al 40 % */
      var prog = tope((vh * .88 - r.top) / (vh * .48), 0, 1);
      var frente = prog * (pals.length + 4);
      for (var i = 0; i < pals.length; i++) {
        var q = tope((frente - i) / 4, 0, 1);
        var v = Math.round(q * 20) / 20;
        if (ult[i] === v) continue;
        ult[i] = v;
        pals[i].style.opacity = (.14 + .86 * v).toFixed(2);
        if (!celu) pals[i].style.filter = v >= 1 ? 'none' : 'blur(' + ((1 - v) * 5).toFixed(1) + 'px)';
      }
    }
    new IntersectionObserver(function(es){
      visible = es[0].isIntersecting;
      if (visible && !corre) { corre = true; requestAnimationFrame(bucle); }
    }, { rootMargin: '10% 0px' }).observe(p);
    /* primer pintado ya, para que no se vea la frase entera un cuadro */
    pintar();
  })();

  /* ---------------------------------------------------------------------
     4 · BOTONES: TEXTRISE (great-ui · Animated Link)
     Sólo los botones que tienen texto solo (o el .btn__txt del header). El
     texto real pasa a un .sr; lo visible son dos copias letra a letra.
     --------------------------------------------------------------------- */
  (function botones(){
    if (reduce) return;
    function letras(txt){
      var s = document.createElement('span');
      for (var i = 0; i < txt.length; i++) {
        var l = document.createElement('i'); l.textContent = txt[i]; l.style.setProperty('--i', i);
        s.appendChild(l);
      }
      return s;
    }
    document.querySelectorAll('.btn').forEach(function(b){
      var lugar = b.querySelector('.btn__txt') || b;
      if (lugar.children.length) return;           /* tiene algo más adentro: no se toca */
      var txt = lugar.textContent.trim();
      if (!txt || txt.length > 40) return;
      lugar.textContent = '';
      var real = document.createElement('span'); real.className = 'sr'; real.textContent = txt;
      var tr = document.createElement('span'); tr.className = 'mv-tr'; tr.setAttribute('aria-hidden', 'true');
      var a = letras(txt); a.className = 'mv-tr__a';
      var c = letras(txt); c.className = 'mv-tr__b';
      tr.appendChild(a); tr.appendChild(c);
      lugar.appendChild(real); lugar.appendChild(tr);
    });
  })();

  /* ---------------------------------------------------------------------
     5 · CONTACTO: LA MARCA DE LA PESTAÑA VIAJA
     Escucha el aria-selected que ya escribe sitio-2.js; no cambia nada del
     formulario ni de qué se manda.
     --------------------------------------------------------------------- */
  (function marca(){
    var rail = document.getElementById('rail');
    if (!rail) return;
    var tabs = [].slice.call(rail.querySelectorAll('.leg__tab'));
    if (!tabs.length) return;
    var m = document.createElement('b'); m.className = 'leg__marca'; m.setAttribute('aria-hidden', 'true');
    rail.insertBefore(m, rail.firstChild);
    rail.classList.add('mv-marca');
    function ir(){
      var t = rail.querySelector('.leg__tab[aria-selected="true"]') || tabs[0];
      m.style.width = t.offsetWidth + 'px';
      m.style.height = t.offsetHeight + 'px';
      m.style.transform = 'translate3d(' + t.offsetLeft + 'px,' + t.offsetTop + 'px,0)';
    }
    ir();
    if (!reduce) requestAnimationFrame(function(){ requestAnimationFrame(function(){ m.classList.add('mv-va'); }); });
    new MutationObserver(ir).observe(rail, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    window.addEventListener('resize', function(){ m.classList.remove('mv-va'); ir(); requestAnimationFrame(function(){ if (!reduce) m.classList.add('mv-va'); }); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(ir);
  })();
  /* ---------------------------------------------------------------------
     6 · RESEÑAS: EL MAZO QUE SE REPARTE (great-ui · Scroll Flying Cards)
     En compu las cinco tarjetas arrancan apiladas en el centro de la mesa,
     un poco giradas, y se reparten a su casilla de a una mientras la sección
     sube por la pantalla. Atado al scroll: si subís, se vuelven a juntar.
     Cada una muestra su texto y llena sus estrellas recién al apoyarse.
     En celular (o con pantalla angosta) entran de a una desde abajo.
     --------------------------------------------------------------------- */
  (function mazo(){
    var mesa = document.getElementById('opMesa');
    if (!mesa || reduce || !('IntersectionObserver' in window)) return;
    var cartas = [].slice.call(mesa.querySelectorAll('.op'));
    if (!cartas.length) return;
    mesa.classList.add('op--js');
    var ancho = window.matchMedia('(min-width: 901px)');
    var GIRO = [-5, 4, -3, 6, -2];
    var dx = [], dy = [], vivo = false, corre = false, ult = -1;

    function simple(){
      mesa.classList.remove('op--mazo'); mesa.classList.add('op--simple');
      cartas.forEach(function(c){ c.style.transform = ''; c.style.boxShadow = ''; c.style.zIndex = ''; c.style.removeProperty('--cara'); });
      var io = new IntersectionObserver(function(es){
        es.forEach(function(e){
          if (!e.isIntersecting) return;
          var i = cartas.indexOf(e.target);
          setTimeout(function(){ e.target.classList.add('op--llega'); }, (i % 2) * 90);
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px' });
      cartas.forEach(function(c){ io.observe(c); });
    }
    if (!ancho.matches) { simple(); return; }

    mesa.classList.add('op--mazo');
    function medir(){
      cartas.forEach(function(c){ c.style.transform = 'none'; });
      /* el mazo se arma arriba de la mesa y no en su centro: la mesa mide casi
         una pantalla y, centrado, el reparto arrancaba fuera de la vista */
      var m = mesa.getBoundingClientRect(), cx = m.left + m.width / 2, cy = m.top + Math.min(m.height / 2, window.innerHeight * .26);
      cartas.forEach(function(c, i){
        var r = c.getBoundingClientRect();
        dx[i] = cx - (r.left + r.width / 2);
        dy[i] = cy - (r.top + r.height / 2);
      });
      ult = -1; pintar();
    }
    function suave(t){ return 1 - Math.pow(1 - t, 3); }
    function pintar(){
      var r = mesa.getBoundingClientRect(), vh = window.innerHeight;
      /* 0 cuando la mesa entra al 85 % de la pantalla, 1 cuando llegó al 12 % */
      var p = tope((vh * .85 - r.top) / (vh * .73), 0, 1);
      if (Math.abs(p - ult) < .002) return;
      ult = p;
      var n = cartas.length;
      cartas.forEach(function(c, i){
        var a = i * .13, e = suave(tope((p - a) / .48, 0, 1)), q = 1 - e;
        c.style.transform = 'translate3d(' + (dx[i] * q).toFixed(1) + 'px,' + (dy[i] * q).toFixed(1) + 'px,0) rotate(' + (GIRO[i % 5] * q).toFixed(2) + 'deg) scale(' + (.9 + .1 * e).toFixed(3) + ')';
        /* en vuelo va arriba y con sombra; apoyada, plana */
        var alto = Math.sin(Math.PI * e);
        c.style.boxShadow = alto > .02 ? '0 ' + (18 * alto).toFixed(0) + 'px ' + (44 * alto).toFixed(0) + 'px rgba(0,0,0,' + (.55 * alto).toFixed(2) + ')' : '';
        c.style.zIndex = e > 0 && e < 1 ? 10 + i : (e === 0 ? n - i : '');
        c.style.setProperty('--cara', tope((e - .62) / .38, 0, 1).toFixed(2));
        c.classList.toggle('op--llega', e > .92);
      });
    }
    function bucle(){ if (!vivo) { corre = false; return; } pintar(); requestAnimationFrame(bucle); }
    new IntersectionObserver(function(es){
      vivo = es[0].isIntersecting;
      if (vivo && !corre) { corre = true; requestAnimationFrame(bucle); }
    }, { rootMargin: '15% 0px' }).observe(mesa);
    medir();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    window.addEventListener('resize', function(){
      if (!ancho.matches) { simple(); return; }
      medir();
    });
  })();
})();
