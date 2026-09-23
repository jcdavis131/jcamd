/* jcamd.com — shared frame behaviour: theme, menu, reveals, opening card.
 * Every path works without this file; it only adds. */
(function () {
  'use strict';
  var root = document.documentElement;
  var KEY = 'jcamd-theme';
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resolved() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return mq && mq.matches ? 'dark' : 'light';
  }
  function paint() {
    var r = resolved();
    root.setAttribute('data-theme-resolved', r);
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.setAttribute('content', r === 'dark' ? '#0c0b0a' : '#f3f1ec');
    var btn = document.querySelector('.theme-toggle');
    if (btn) btn.setAttribute('aria-label', r === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    try { window.dispatchEvent(new CustomEvent('jcamd:theme', { detail: r })); } catch (e) {}
  }
  paint();
  if (mq && mq.addEventListener) mq.addEventListener('change', paint);

  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = resolved() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      paint();
    });
  }

  /* mobile menu */
  var menu = document.querySelector('.menu-toggle');
  var nav = document.querySelector('.chrome__nav');
  function closeMenu() {
    if (!nav || !menu) return;
    nav.removeAttribute('data-open');
    menu.setAttribute('aria-expanded', 'false');
  }
  if (menu && nav) {
    menu.addEventListener('click', function () {
      var open = !nav.hasAttribute('data-open');
      if (open) nav.setAttribute('data-open', ''); else nav.removeAttribute('data-open');
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var first = nav.querySelector('a'); if (first) first.focus(); }
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeMenu(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.hasAttribute('data-open')) { closeMenu(); menu.focus(); }
    });
  }

  /* opening card: plays once per session, any input finishes it */
  if (root.classList.contains('intro')) {
    var finish = function () {
      root.classList.add('intro-done');
      ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (ev) {
        window.removeEventListener(ev, finish, true);
      });
    };
    ['keydown', 'pointerdown', 'wheel', 'touchstart'].forEach(function (ev) {
      window.addEventListener(ev, finish, { capture: true, passive: true });
    });
    setTimeout(finish, 3200);
  }

  /* reveals */
  var items = document.querySelectorAll('[data-reveal]');
  if (!reduce && items.length && 'IntersectionObserver' in window) {
    root.classList.add('js-motion');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* section spy for in-page chrome links */
  var spy = document.querySelectorAll('.chrome__list a[href^="#"]');
  if (spy.length && 'IntersectionObserver' in window) {
    var map = {};
    spy.forEach(function (a) {
      var el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) map[el.id] = a;
    });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        spy.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = map[en.target.id];
        if (a) a.setAttribute('aria-current', 'location');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(map).forEach(function (id) { so.observe(document.getElementById(id)); });
  }
})();
