/* ============================================================
   Monochrome portfolio — interactions
   No dependencies. Everything degrades gracefully without JS.
   ============================================================ */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── current year ─────────────────────────────────────────── */
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── scroll progress bar + sticky nav backdrop ────────────── */
  var bar = document.querySelector('.progress i');
  var nav = document.querySelector('.nav');
  var ticking = false;

  function onScroll() {
    if (bar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = pct.toFixed(2) + '%';
    }
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 40);
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ── reveal on scroll ─────────────────────────────────────── */
  var revealables = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduced) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    revealables.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ── count-up stats ───────────────────────────────────────── */
  var counters = document.querySelectorAll('[data-count]');

  function format(el, value) {
    var dec = parseInt(el.dataset.dec || '0', 10);
    return (el.dataset.prefix || '') + value.toFixed(dec) + (el.dataset.suffix || '');
  }

  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    if (isNaN(target)) return;
    if (reduced) { el.textContent = format(el, target); return; }

    var duration = 1400;
    var start = null;

    function step(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      el.textContent = format(el, target * eased);
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = format(el, target);
    }
    requestAnimationFrame(step);
  }

  if (!('IntersectionObserver' in window)) {
    counters.forEach(function (el) { el.textContent = format(el, parseFloat(el.dataset.count)); });
  } else {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        countUp(entry.target);
        countObserver.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { countObserver.observe(el); });
  }

  /* ── work accordion (one open at a time) ──────────────────── */
  var rows = Array.prototype.slice.call(document.querySelectorAll('.work__row'));

  function close(row) {
    var panel = document.getElementById(row.getAttribute('aria-controls'));
    if (!panel) return;
    panel.style.height = panel.scrollHeight + 'px';
    requestAnimationFrame(function () { panel.style.height = '0px'; });
    row.setAttribute('aria-expanded', 'false');
  }

  function open(row) {
    var panel = document.getElementById(row.getAttribute('aria-controls'));
    if (!panel) return;
    panel.style.height = panel.scrollHeight + 'px';
    row.setAttribute('aria-expanded', 'true');
    // Let it settle to auto so the panel reflows correctly on resize.
    panel.addEventListener('transitionend', function once(e) {
      if (e.propertyName !== 'height') return;
      panel.removeEventListener('transitionend', once);
      if (row.getAttribute('aria-expanded') === 'true') panel.style.height = 'auto';
    });
  }

  rows.forEach(function (row) {
    row.addEventListener('click', function () {
      var isOpen = row.getAttribute('aria-expanded') === 'true';
      rows.forEach(function (other) {
        if (other.getAttribute('aria-expanded') === 'true') close(other);
      });
      if (!isOpen) open(row);
    });
  });

  // Keep an open panel correctly sized when the layout reflows.
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      rows.forEach(function (row) {
        if (row.getAttribute('aria-expanded') !== 'true') return;
        var panel = document.getElementById(row.getAttribute('aria-controls'));
        if (panel) panel.style.height = 'auto';
      });
    }, 150);
  });

  /* ── youtube slots ────────────────────────────────────────────
     data-yt="VIDEO_ID" fills one slot. For several clips on the same
     entry, comma-separate them: data-yt="ID1, ID2, ID3". The first is
     the main player, the rest become a thumbnail strip underneath.
     Empty slots keep their placeholder, and nothing is requested from
     YouTube until the visitor clicks play.                             */

  // maxresdefault is 16:9 and matches the slot; it doesn't exist for every
  // upload, so fall back to hqdefault (4:3, cropped by object-fit).
  // No loading="lazy": the panel starts collapsed at height 0, so a lazy
  // image never intersects the viewport and the fetch is deferred forever.
  function thumbFor(id, small) {
    var img = new Image();
    img.alt = '';
    img.addEventListener('error', function onError() {
      img.removeEventListener('error', onError);
      img.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    });
    img.src = 'https://i.ytimg.com/vi/' + id + (small ? '/mqdefault.jpg' : '/maxresdefault.jpg');
    return img;
  }

  document.querySelectorAll('.work__video').forEach(function (box) {
    var ids = (box.dataset.yt || '').split(',').map(function (s) {
      return s.trim();
    }).filter(Boolean);

    if (!ids.length) return;

    var strip = null;
    var active = 0;

    function playing() {
      return !!box.querySelector('.work__iframe');
    }

    function markStrip() {
      if (!strip) return;
      Array.prototype.forEach.call(strip.children, function (btn, i) {
        btn.setAttribute('aria-current', i === active ? 'true' : 'false');
      });
    }

    function showPoster(i) {
      active = i;
      box.textContent = '';

      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'work__play';
      play.setAttribute('aria-label', ids.length > 1
        ? 'Play clip ' + (i + 1) + ' of ' + ids.length
        : 'Play project video');
      play.addEventListener('click', function () { showPlayer(i); });

      box.appendChild(thumbFor(ids[i], false));
      box.appendChild(play);
      markStrip();
    }

    function showPlayer(i) {
      active = i;
      var frame = document.createElement('iframe');
      frame.className = 'work__iframe';
      frame.src = 'https://www.youtube-nocookie.com/embed/' + ids[i] + '?autoplay=1&rel=0';
      frame.title = 'Project video';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      box.textContent = '';
      box.appendChild(frame);
      markStrip();
    }

    showPoster(0);
    if (ids.length < 2) return;

    strip = document.createElement('div');
    strip.className = 'work__reel';
    strip.setAttribute('role', 'group');
    strip.setAttribute('aria-label', 'Clips for this project');

    ids.forEach(function (id, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'work__reelBtn';
      btn.setAttribute('aria-label', 'Clip ' + (i + 1) + ' of ' + ids.length);
      btn.appendChild(thumbFor(id, true));

      // Switching while something is already playing keeps playing.
      // Otherwise it only changes the poster, so audio never starts
      // on its own.
      btn.addEventListener('click', function () {
        if (playing() || i === active) showPlayer(i);
        else showPoster(i);
      });

      strip.appendChild(btn);
    });

    box.insertAdjacentElement('afterend', strip);
    markStrip();
  });

  /* ── copy to clipboard ────────────────────────────────────── */
  var toast = document.querySelector('.toast');
  var toastTimer;

  function say(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-on'); }, 2000);
  }

  // Works on file:// too, and covers the async API rejecting (no focus, no permission).
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  document.querySelectorAll('[data-copy]').forEach(function (el) {
    el.addEventListener('click', function () {
      var text = el.dataset.copy;
      var done = function () { say('Copied — ' + text); };
      var fallback = function () { legacyCopy(text) ? done() : say('Copy failed'); };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else {
        fallback();
      }
    });
  });
})();
