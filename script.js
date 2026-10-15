(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();

  /* ── reveal on scroll ─────────────────────────────────────────
     Blocks marked .reveal fade up the first time they scroll into
     view. Anything already on screen when this runs is left alone,
     so nothing visible blinks out and back, and if the script never
     runs the page is simply static.                                 */

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!reduced && 'IntersectionObserver' in window) {
    var revealer = new IntersectionObserver(function (entries) {
      var shown = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        // Blocks that arrive together, like a row of two, come in one after the other.
        entry.target.style.setProperty('--d', Math.min(shown, 3) * 90 + 'ms');
        entry.target.classList.remove('is-pending');
        revealer.unobserve(entry.target);
        shown++;
      });
    }, { rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('.reveal').forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('is-pending');
      revealer.observe(el);
    });
  }

  // Posters fade in as they finish downloading instead of popping in.
  // The frame's background stands in until then.
  document.querySelectorAll('.media > img, .shot img').forEach(function (img) {
    if (img.complete) return;
    img.classList.add('is-loading');
    var done = function () { img.classList.remove('is-loading'); };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  });

  /* ── youtube: click to load ───────────────────────────────────
     The poster and the play link are plain HTML, so without JS the
     link just opens the video on YouTube. With JS, the click swaps the
     poster for an embed, and nothing is requested from YouTube before
     that click.                                                     */

  document.querySelectorAll('.media[data-yt]').forEach(function (box) {
    var id = box.dataset.yt;
    var play = box.querySelector('.media__play');
    if (!id || !play) return;

    var title = box.dataset.title || 'Project video';
    var length = play.querySelector('span');
    play.setAttribute('aria-label', 'Play video: ' + title + (length ? ' (' + length.textContent + ')' : ''));

    play.addEventListener('click', function (e) {
      // Let modified clicks open YouTube in a new tab as usual.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();

      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0';
      frame.title = title;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;

      box.textContent = '';
      box.appendChild(frame);
      frame.focus();
    });
  });

  /* ── screenshots: lightbox ───────────────────────────────────── */

  var viewer = document.querySelector('.lightbox');
  if (viewer && typeof viewer.showModal === 'function') {
    var viewerImg = document.createElement('img');
    var viewerCap = viewer.querySelector('.lightbox__cap');
    viewer.insertBefore(viewerImg, viewerCap);

    document.querySelectorAll('a.shot').forEach(function (link) {
      link.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();

        var img = link.querySelector('img');
        var caption = link.closest('figure') && link.closest('figure').querySelector('figcaption');
        viewerImg.src = link.href;
        viewerImg.alt = img ? img.alt : '';
        viewerCap.textContent = caption ? caption.textContent : '';
        viewerCap.hidden = !caption;
        viewer.showModal();
      });
    });

    // A click on the backdrop lands on the dialog element itself.
    viewer.addEventListener('click', function (e) {
      if (e.target === viewer) viewer.close();
    });
  }

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
      var done = function () { say('Copied ' + text); };
      var fallback = function () { legacyCopy(text) ? done() : say('Copy failed'); };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(fallback);
      } else {
        fallback();
      }
    });
  });
})();
