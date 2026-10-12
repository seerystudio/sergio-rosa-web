/* ══════════════════════════════════════════════════════════════════════════
   Google Analytics 4 + aviso de cookies (2026-10-12).
   Un solo archivo para las trece páginas: se carga con defer en el <head>.

   Cómo funciona:
   · Mientras la persona no elige, NO se carga nada de Google. Analytics entra
     recién cuando toca "Aceptar" (modo de consentimiento básico). Si rechaza,
     el sitio sigue sin pedir un solo recurso externo, como antes.
   · La elección se guarda en localStorage ('sr-cookies' = 'si' | 'no') y el
     aviso no vuelve a salir. El enlace "Configurar cookies" del pie lo reabre.
   · Eventos que mide (sin datos personales: nunca nombre, teléfono ni relato):
       contacto_whatsapp  clic en cualquier botón de WhatsApp
       contacto_llamada   clic en un tel:
       contacto_correo    clic en un mailto:
       generate_lead      formulario enviado con éxito (lleva solo el motivo)
     En GA4 hay que marcar los cuatro como "eventos clave" (conversiones).

   🔴 Esto levanta la regla "cero pedidos externos" del BRIEF §A, pero solo
   con consentimiento. Sin el ID cargado (abajo) el script no hace nada.
   ══════════════════════════════════════════════════════════════════════════ */
(function(){
  var GA_ID = 'G-XXXXXXXXXX';             /* ← ID de medición de GA4 */
  var CLAVE = 'sr-cookies';
  if (!/^G-[A-Z0-9]{6,}$/.test(GA_ID) || GA_ID === 'G-XXXXXXXXXX') return;

  /* Rutas: el script vive en assets/, así que la política queda al lado. */
  var base = (document.currentScript && document.currentScript.src || '').replace(/assets\/medicion\.js.*$/, '');
  var politica = base + 'politica-de-privacidad/index.html';

  function leer(){ try { return localStorage.getItem(CLAVE); } catch(e){ return null; } }
  function guardar(v){ try { localStorage.setItem(CLAVE, v); } catch(e){} }

  /* ── Analytics ─────────────────────────────────────────────────────────── */
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  var cargado = false;

  function cargarGA(){
    if (cargado) return;
    cargado = true;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    /* La librería se pide después del load: un script agregado antes lo
       retrasa, y la cortina de carga espera ese load para llegar al 100. */
    function pedir(){
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
      document.head.appendChild(s);
    }
    if (document.readyState === 'complete') pedir();
    else window.addEventListener('load', pedir);
  }

  function evento(nombre, params){ if (cargado) gtag('event', nombre, params || {}); }

  function borrarCookiesGA(){
    document.cookie.split(';').forEach(function(c){
      var n = c.split('=')[0].trim();
      if (/^_ga/.test(n)) {
        var dom = location.hostname.replace(/^www\./, '');
        document.cookie = n + '=; Max-Age=0; path=/';
        document.cookie = n + '=; Max-Age=0; path=/; domain=' + dom;
        document.cookie = n + '=; Max-Age=0; path=/; domain=.' + dom;
      }
    });
  }

  /* ── Eventos de contacto ───────────────────────────────────────────────── */
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href');
    var donde = a.closest('header') ? 'header' : a.closest('footer') ? 'pie' : a.closest('.barra') ? 'barra' : 'pagina';
    if (/wa\.me|whatsapp/i.test(h)) evento('contacto_whatsapp', { ubicacion: donde });
    else if (/^tel:/i.test(h))      evento('contacto_llamada',  { ubicacion: donde });
    else if (/^mailto:/i.test(h))   evento('contacto_correo',   { ubicacion: donde });
  }, true);

  /* El formulario lo maneja sitio-2.js: si valida, esconde el form (.oculto).
     Miramos eso un instante después del submit para contar solo los envíos
     que salieron. */
  document.addEventListener('submit', function(e){
    var f = e.target;
    if (!f || f.id !== 'form') return;
    var motivo = (f.querySelector('[name="motivo"]:checked') || f.querySelector('[name="motivo"]') || {}).value || 'sin_motivo';
    setTimeout(function(){
      if (f.classList.contains('oculto')) evento('generate_lead', { motivo: motivo, formulario: 'contacto' });
    }, 0);
  }, true);

  /* ── Aviso ─────────────────────────────────────────────────────────────── */
  var css = ''
    + '.ck{position:fixed;left:16px;right:16px;bottom:16px;z-index:200;max-width:560px;margin-left:auto;'
    + 'background:var(--grafito,#1C1C1C);color:#fff;border:1px solid rgba(242,234,219,.22);'
    + 'padding:20px 22px;font:400 14px/1.55 var(--tipo,system-ui,sans-serif);'
    + 'box-shadow:0 12px 40px rgba(0,0,0,.35);transform:translateY(12px);opacity:0;'
    + 'transition:transform .45s var(--salida,ease),opacity .45s var(--salida,ease)}'
    + '.ck[data-visible="si"]{transform:none;opacity:1}'
    + '.ck p{margin:0 0 16px;color:rgba(255,255,255,.86)}'
    + '.ck b{display:block;font-weight:600;font-size:15px;margin-bottom:6px;color:#fff}'
    + '.ck a{color:#fff;text-decoration:underline;text-underline-offset:3px}'
    + '.ck__acc{display:flex;gap:10px;flex-wrap:wrap}'
    + '.ck button{flex:1 1 140px;min-height:44px;padding:0 18px;font:600 14px/1 var(--tipo,system-ui,sans-serif);'
    + 'cursor:pointer;border:1px solid #fff;letter-spacing:-.01em}'
    + '.ck__si{background:#fff;color:var(--grafito,#1C1C1C)}'
    + '.ck__no{background:transparent;color:#fff}'
    + '.ck button:focus-visible{outline:2px solid var(--dorado,#D4AF6A);outline-offset:2px}'
    + '@media (prefers-reduced-motion:reduce){.ck{transition:none}}';

  var caja;
  function mostrar(){
    if (!caja) {
      var st = document.createElement('style');
      st.textContent = css;
      document.head.appendChild(st);
      caja = document.createElement('div');
      caja.className = 'ck';
      caja.setAttribute('role', 'dialog');
      caja.setAttribute('aria-live', 'polite');
      caja.setAttribute('aria-label', 'Aviso de cookies');
      caja.innerHTML = '<p><b>Usamos cookies de medición</b>'
        + 'Con tu permiso usamos Google Analytics para saber cuánta gente visita el sitio y qué páginas sirven más. '
        + 'No guardamos lo que escribís en el formulario. <a href="' + politica + '#cookies">Más información</a></p>'
        + '<div class="ck__acc"><button type="button" class="ck__no">Rechazar</button>'
        + '<button type="button" class="ck__si">Aceptar</button></div>';
      document.body.appendChild(caja);
      caja.querySelector('.ck__si').addEventListener('click', function(){ elegir('si'); });
      caja.querySelector('.ck__no').addEventListener('click', function(){ elegir('no'); });
    }
    caja.hidden = false;
    void caja.offsetWidth;                 /* fuerza el estado inicial para que haya transición */
    caja.dataset.visible = 'si';
  }
  function ocultar(){ if (caja) { caja.dataset.visible = 'no'; setTimeout(function(){ caja.hidden = true; }, 450); } }

  function elegir(v){
    var antes = leer();
    guardar(v);
    ocultar();
    if (v === 'si') cargarGA();
    else if (antes === 'si') {
      /* Primero se le niega el permiso a GA (si no, reescribe su cookie al
         salir de la página), después se borran las cookies y se recarga. */
      if (cargado) gtag('consent', 'update', { analytics_storage: 'denied' });
      window['ga-disable-' + GA_ID] = true;
      borrarCookiesGA();
      setTimeout(function(){ borrarCookiesGA(); location.reload(); }, 300);
    }
  }

  /* "Configurar cookies" en el pie: se agrega al lado de la política. */
  function enlacePie(){
    var legal = document.querySelector('.foot .legal a[href*="politica-de-privacidad"], .foot .legal a[href="index.html"]');
    if (!legal || document.getElementById('ck-config')) return;
    var b = document.createElement('a');
    b.href = '#'; b.id = 'ck-config'; b.textContent = 'Configurar cookies';
    b.addEventListener('click', function(e){ e.preventDefault(); mostrar(); caja.querySelector('.ck__si').focus(); });
    legal.insertAdjacentText('afterend', ' · ');
    legal.nextSibling.after(b);
  }

  var eleccion = leer();
  if (eleccion === 'si') cargarGA();
  /* En la home y las áreas hay una cortina de carga (body.telonando): el aviso
     espera a que termine para no salir encima del contador. Tope de 8 s por
     si la cortina no corre. */
  function cuandoTermineTelon(fn){
    var t0 = Date.now();
    (function mirar(){
      if (!document.body.classList.contains('telonando') || Date.now() - t0 > 8000) setTimeout(fn, 800);
      else setTimeout(mirar, 200);
    })();
  }
  function iniciar(){ enlacePie(); if (!eleccion) cuandoTermineTelon(mostrar); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
