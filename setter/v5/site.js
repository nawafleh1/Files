(function () {
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Header height, so the full-bleed hero can slide under it
  var hdrEl = $('.site-header');
  var setHH = function () { if (hdrEl) document.documentElement.style.setProperty('--hh', hdrEl.offsetHeight + 'px'); };
  setHH();
  window.addEventListener('resize', setHH);

  // Mobile menu
  var menuBtn = $('.menu-btn');
  var mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      $('.menu-label', menuBtn).textContent = open ? 'Menu' : 'Close';
      mobileNav.hidden = open;
    });
  }

  // GTM busywork calculator: what manual research, list building and CRM admin costs today
  var calc = $('[data-calc]');
  if (calc) {
    var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    var num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
    var one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
    var get = function (id) { return document.getElementById(id); };
    var people = get('calc-people'), hours = get('calc-hours'), rate = get('calc-rate');
    var update = function () {
      var p = Number(people.value), h = Number(hours.value), r = Number(rate.value);
      get('out-people').textContent = p + (p === 1 ? ' person' : ' people');
      get('out-hours').textContent = h + ' hrs a week';
      get('out-rate').textContent = money.format(r) + ' an hour';
      var weekly = p * h;
      get('res-hours').textContent = num.format(Math.round(weekly * 52 / 12));
      get('res-cost').textContent = money.format(weekly * 52 * r);
      get('res-fte').textContent = one.format(weekly / 40);
    };
    [people, hours, rate].forEach(function (el) { el.addEventListener('input', update); });
    update();
  }

  // Workflow filters: cards fold out, the matching set lands with a stagger
  var filters = $$('.filter');
  var plays = $$('.play[data-cat]');
  var count = document.getElementById('play-count');
  if (filters.length && plays.length) {
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-filter');
        filters.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        var apply = function () {
          var shown = 0;
          plays.forEach(function (p) {
            var show = cat === 'all' || p.getAttribute('data-cat') === cat;
            p.classList.remove('is-out', 'reveal', 'is-in');
            p.hidden = !show;
            if (show) { p.classList.add('is-pop'); p.style.transitionDelay = (shown * 55) + 'ms'; shown += 1; }
          });
          requestAnimationFrame(function () { requestAnimationFrame(function () { plays.forEach(function (p) { p.classList.remove('is-pop'); }); }); });
          setTimeout(function () { plays.forEach(function (p) { p.style.transitionDelay = ''; }); }, 1000);
          if (count) { var noun = count.getAttribute('data-noun') || 'item'; count.textContent = shown + ' ' + noun + (shown === 1 ? '' : 's'); }
        };
        if (reduceMotion) { apply(); return; }
        plays.forEach(function (p) { if (!p.hidden) p.classList.add('is-out'); });
        setTimeout(apply, 260);
      });
    });
  }

  // Short forms (hero, CTA): carry name and email to the booking page
  $$('form[data-quick]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('input[name="name"]', form);
      var email = $('input[name="email"]', form);
      if (!form.reportValidity()) return;
      try {
        sessionStorage.setItem('setter-name', name ? name.value : '');
        sessionStorage.setItem('setter-email', email ? email.value : '');
      } catch (err) { /* storage unavailable: the booking page still works */ }
      window.location.href = 'book.html#details';
    });
  });

  // Booking form: prefill, then show the calendar step
  var book = $('form[data-book]');
  if (book) {
    try {
      var n = sessionStorage.getItem('setter-name');
      var em = sessionStorage.getItem('setter-email');
      if (n) $('#bk-name').value = n;
      if (em) $('#bk-email').value = em;
    } catch (err) { /* ignore */ }
    book.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!book.reportValidity()) return;
      var done = document.getElementById('book-done');
      var first = ($('#bk-name').value || '').trim().split(' ')[0];
      $('#book-done-name').textContent = first ? first + ', one' : 'One';
      book.hidden = true;
      done.hidden = false;
      done.focus();
    });
  }

  /* ---------- motion ---------- */
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;

  // Number count-ups in the dot-matrix face
  var fmtNum = function (el, v) {
    if (el.getAttribute('data-fmt') === 'time') return Math.floor(v / 60) + ':' + ('0' + Math.floor(v % 60)).slice(-2);
    return (el.getAttribute('data-prefix') || '') + Math.round(v).toLocaleString('en-US') + (el.getAttribute('data-suffix') || '');
  };
  var counters = $$('[data-count]');
  if (counters.length && hasIO && !reduceMotion) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        co.unobserve(e.target);
        var el = e.target, to = Number(el.getAttribute('data-count')), t0 = performance.now(), dur = 1400 + Math.min(900, to);
        el.classList.add('is-counting');
        var tick = function (now) {
          var k = Math.min(1, (now - t0) / dur), ease = k === 1 ? 1 : 1 - Math.pow(2, -10 * k);
          el.textContent = fmtNum(el, to * ease);
          if (k < 1) requestAnimationFrame(tick); else el.classList.remove('is-counting');
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    counters.forEach(function (el) { el.textContent = fmtNum(el, 0); co.observe(el); });
  }

  // Headings rise word by word; blocks drift up out of a blur
  if (hasIO && !reduceMotion) {
    $$('.h-hero, .h-page, .h-sec, .quote-band blockquote').forEach(function (h) {
      if (h.closest('.dog-scroll')) return;
      var wi = 0;
      var walk = function (node) {
        [].slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
              var w = document.createElement('span');
              w.className = 'w';
              var inner = document.createElement('span');
              inner.textContent = part;
              inner.style.setProperty('--wi', wi++);
              w.appendChild(inner);
              frag.appendChild(w);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') { walk(n); }
        });
      };
      walk(h);
      h.classList.add('split');
      h.classList.remove('rise', 'rise-2', 'rise-3');
    });
    var sel = ['.hero-meta', '.hero-top > .sub', '.hero-row', '.hero-foot', '.num-item', '.quote-band .br', '.quote-band figcaption', '.pilot-col', '.orb',
      '.signals-head .br', '.signals-head .body-2', '.signal', '.ticker-wrap', '.head-center > .br', '.head-left > .br', '.head-left > .sub', '.head-center > .sub', '.head-left > .body-2',
      '.panel', '.problem', '.e-node', '.table-scroll', '.calc', '.play', '.faq', '.cta', '.outcome', '.principle', '.price', '.svc-detail', '.steps4 > *', '.crew-table',
      '.founder', '.agenda', '.book-card', '.footer-top', '.prose', '.chip-row', '.subnav', '.filters', '.qual'].join(',');
    var seen = new Map();
    $$(sel).forEach(function (el) {
      if (el.closest('.dog-scroll') || el.closest('.reveal')) return;
      var parent = el.parentElement, n = seen.get(parent) || 0;
      seen.set(parent, n + 1);
      el.style.setProperty('--rd', Math.min(n, 8) * 70 + 'ms');
      el.classList.add('reveal');
    });
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        ro.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -5% 0px' });
    $$('.reveal, .split').forEach(function (el) { ro.observe(el); });
    // Once a block has landed, drop the reveal classes so they never fight hover or filter transitions
    document.addEventListener('transitionend', function (e) {
      var el = e.target;
      if (e.propertyName === 'opacity' && el.classList && el.classList.contains('reveal') && el.classList.contains('is-in')) {
        el.classList.remove('reveal', 'is-in');
        el.style.removeProperty('--rd');
      }
    });
  }

  // Aura cards: the bloom follows the cursor. Buttons lean toward it.
  if (fine && !reduceMotion) {
    $$('.aura').forEach(function (el) {
      if (el.closest('.stage')) return;
      var ax = el.style.getPropertyValue('--ax'), ay = el.style.getPropertyValue('--ay');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--ax', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--ay', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
        el.classList.add('is-lit');
      });
      el.addEventListener('pointerleave', function () {
        if (ax) el.style.setProperty('--ax', ax); else el.style.removeProperty('--ax');
        if (ay) el.style.setProperty('--ay', ay); else el.style.removeProperty('--ay');
        el.classList.remove('is-lit');
      });
    });
    $$('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) / r.width, y = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.transform = 'translate(' + (x * 8).toFixed(1) + 'px,' + (y * 6).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  // Find, Point, Hold: the chapter in the middle of the screen sets the dog's mode
  var chDog = $('[data-ch-dog]'), chs = $$('.ch[data-ch]');
  if (chDog && chs.length && hasIO) {
    var setCh = function (k) {
      chDog.setAttribute('data-mode', k);
      chs.forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-ch') === k); });
      $$('[data-ch-label]', chDog).forEach(function (l) { l.classList.toggle('is-on', l.getAttribute('data-ch-label') === k); });
    };
    var cho = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setCh(e.target.getAttribute('data-ch')); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    chs.forEach(function (c) { cho.observe(c); });
  }

  // One signal, start to finish: walk the trace step by step while it is on screen
  var trace = $('[data-trace]');
  if (trace) {
    var tsteps = $$('.ts', trace), ti = -1, ttimer = null;
    trace.setAttribute('data-trace-js', '');
    var setStep = function (i) {
      tsteps.forEach(function (st, n) { st.classList.toggle('is-lit', n <= i); st.classList.toggle('is-now', n === i); });
      trace.style.setProperty('--tp', (i <= 0 ? 0 : i / (tsteps.length - 1) * 100) + '%');
    };
    if (reduceMotion || !hasIO) { setStep(tsteps.length - 1); }
    else {
      setStep(-1);
      var runTrace = function () {
        ti += 1;
        if (ti >= tsteps.length) { ti = -1; setStep(-1); ttimer = setTimeout(runTrace, 800); return; }
        setStep(ti);
        ttimer = setTimeout(runTrace, ti === tsteps.length - 1 ? 3400 : 950);
      };
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { if (!ttimer) runTrace(); }
          else { clearTimeout(ttimer); ttimer = null; }
        });
      }, { threshold: 0.35 }).observe(trace);
    }
  }

  // Plays run when you look at them: hover on desktop, the card in the middle of the screen on touch
  var liveCards = $$('.plays .wf');
  if (liveCards.length && !(window.matchMedia && window.matchMedia('(pointer: fine)').matches) && 'IntersectionObserver' in window) {
    var lo = new IntersectionObserver(function (es) { es.forEach(function (e) { e.target.classList.toggle('is-live', e.isIntersecting); }); }, { rootMargin: '-35% 0px -35% 0px' });
    liveCards.forEach(function (c) { lo.observe(c); });
  }

  // Play builder: pick a problem, watch it analyse, watch the play build itself
  var builder = $('[data-builder]');
  if (builder) {
    var bData = JSON.parse($('[data-builder-data]', builder).textContent);
    var icon = function (n) { var el = $('[data-ico="' + n + '"]', builder); return el ? el.innerHTML : ''; };
    var bIdle = $('.b-idle', builder), bRun = $('.b-run', builder), bStatus = $('.b-status', builder), bPct = $('.b-pct', builder);
    var bBar = $('.b-bar i', builder), bLog = $('.b-log', builder), bFlow = $('.b-flow', builder), bWrap = $('.b-flow-wrap', builder), bRes = $('.b-result', builder);
    var bOut = $('.b-out', builder), bChips = $$('.b-issue', builder), bTimers = [], bRaf = 0;
    var later = function (fn, ms) { bTimers.push(setTimeout(fn, ms)); };
    var stopAll = function () { bTimers.forEach(clearTimeout); bTimers = []; cancelAnimationFrame(bRaf); };
    var fmtB = function (d, v) {
      if (d.fmt === 'time') return Math.floor(v / 60) + ':' + ('0' + Math.floor(v % 60)).slice(-2);
      if (d.fmt === 'pct') return Math.round(v) + '%';
      if (d.fmt === 'money') return '$' + Math.round(v) + 'K';
      return Math.round(v).toLocaleString('en-US');
    };
    var tween = function (dur, step) {
      var t0 = performance.now();
      var f = function (now) { var k = Math.min(1, (now - t0) / dur); step(k); if (k < 1) bRaf = requestAnimationFrame(f); };
      bRaf = requestAnimationFrame(f);
    };
    var show = function (el) { requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-in'); }); }); };
    var build = function (d) {
      stopAll();
      bIdle.hidden = true; bRun.hidden = false; bRes.hidden = true; bRes.classList.remove('is-in');
      builder.classList.remove('is-done'); builder.classList.add('is-busy');
      bStatus.textContent = 'Analyzing'; bPct.textContent = '0%'; bBar.style.width = '0%';
      bLog.innerHTML = ''; bFlow.innerHTML = '';
      bWrap.style.setProperty('--n', d.nodes.length); bWrap.style.setProperty('--tp', '0%');
      var agents = d.nodes.filter(function (n) { return n.kind !== 'human'; }).length;
      var human = d.nodes.some(function (n) { return n.kind === 'human'; });
      var lines = ['Reading the problem: ' + d.label.toLowerCase(), 'Checking signals: ' + d.signals, 'Picking agents for ' + agents + ' steps',
        human ? 'Adding a human check' : 'Setting guardrails and logging', 'Wiring it into ' + d.tools];
      var stepT = reduceMotion ? 0 : 430, nodeT = reduceMotion ? 0 : 380;
      lines.forEach(function (txt, i) {
        later(function () {
          var prev = bLog.lastElementChild;
          if (prev) prev.classList.add('is-done');
          var li = document.createElement('li');
          li.innerHTML = '<span class="lg-ico">' + icon('check') + '</span><span>' + txt + '</span>';
          bLog.appendChild(li);
          show(li);
        }, i * stepT);
      });
      var analyzeMs = reduceMotion ? 0 : lines.length * stepT + 320;
      if (!reduceMotion) tween(analyzeMs, function (k) { var v = Math.round(k * 100); bPct.textContent = v + '%'; bBar.style.width = v + '%'; });
      later(function () {
        var last = bLog.lastElementChild;
        if (last) last.classList.add('is-done');
        bPct.textContent = '100%'; bBar.style.width = '100%';
        bStatus.textContent = 'Building your play';
        d.nodes.forEach(function (n, i) {
          later(function () {
            var el = document.createElement('div');
            el.className = 'bn bn--' + n.kind;
            el.innerHTML = '<span class="bn-ico">' + icon(n.ico) + '</span><b>' + n.label + '</b><small>' + (n.kind === 'human' ? 'A person' : n.kind === 'start' ? 'Trigger' : 'Agent') + '</small>';
            bFlow.appendChild(el);
            show(el);
            bWrap.style.setProperty('--tp', (d.nodes.length > 1 ? i / (d.nodes.length - 1) * 100 : 100) + '%');
          }, i * nodeT);
        });
        later(function () {
          bStatus.textContent = 'Ready';
          builder.classList.remove('is-busy'); builder.classList.add('is-done');
          $('.b-play', bRes).textContent = d.play;
          $('.b-meta', bRes).textContent = d.runs + ' · ' + d.part + ' · moves ' + d.moves;
          $('.b-num-l', bRes).innerHTML = '<span>' + d.numLabel + '</span><em>[Example run]</em>';
          bRes.hidden = false;
          show(bRes);
          var num = $('.b-num', bRes);
          if (reduceMotion) num.textContent = fmtB(d, d.num);
          else tween(1300, function (k) { num.textContent = fmtB(d, d.num * (k === 1 ? 1 : 1 - Math.pow(2, -10 * k))); });
        }, d.nodes.length * nodeT + (reduceMotion ? 0 : 260));
      }, analyzeMs);
    };
    bChips.forEach(function (c) {
      c.addEventListener('click', function () {
        bChips.forEach(function (o) { o.setAttribute('aria-pressed', o === c ? 'true' : 'false'); });
        var d = bData.filter(function (x) { return x.id === c.getAttribute('data-issue'); })[0];
        if (!d) return;
        build(d);
        if (window.innerWidth <= 960 && bOut.scrollIntoView) bOut.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
    $('.b-again', builder).addEventListener('click', function () {
      stopAll();
      bChips.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      bRun.hidden = true; bIdle.hidden = false;
      builder.classList.remove('is-done', 'is-busy');
      if (bChips[0]) bChips[0].focus();
    });
  }

  // Copy buttons
  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-copy'));
      if (!target) return;
      var text = target.textContent.trim();
      var reset = function (label) { btn.textContent = label; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
      var fallback = function () {
        var range = document.createRange();
        range.selectNodeContents(target);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        reset('Selected');
      };
      try { navigator.clipboard.writeText(text).then(function () { reset('Copied'); }, fallback); } catch (err) { fallback(); }
    });
  });
})();
