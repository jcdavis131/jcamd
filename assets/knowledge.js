/* The Knowledge OS — semantic map of the Blue Hen OKF knowledge base.
   Vanilla JS, zero deps. Mounts onto #kmap + #kpanel + #kfilters. */
(function () {
  var RAW = 'https://raw.githubusercontent.com/jcdavis131/bluehen/main/knowledge/personal/';
  var GRAPH_URL = RAW + 'graph.json';
  function noteUrl(kind, slug) { return RAW + kind + '/' + slug + '.md'; }

  var canvas = document.getElementById('kmap');
  var panel = document.getElementById('kpanel');
  var filtersEl = document.getElementById('kfilters');
  var explainEl = document.getElementById('k-explain');
  if (!canvas || !panel || !filtersEl) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  var ctx = canvas.getContext('2d');
  var W = 600, H = 400, PAD = 34;
  var state = {
    nodes: [], byId: {}, edges: [],
    filters: new Set(), search: '',
    hover: null, selected: null,
    cam: { scale: 1, ox: 0, oy: 0 },
    fadeIn: reduceMotion ? 1 : 0, ready: false
  };

  panel.innerHTML = '<p class="k-note-empty">Select a node to read its note.</p>';

  // ---------- data load ----------
  fetch(GRAPH_URL).then(function (r) {
    if (!r.ok) throw new Error('graph');
    return r.json();
  }).then(function (data) {
    if (!data.nodes || !data.nodes.length) throw new Error('empty');
    boot(data);
  }).catch(function () {
    var link = 'https://github.com/jcdavis131/bluehen/tree/main/knowledge/personal';
    var msg = 'The knowledge base is unreachable — it lives at ' +
      '<a href="' + link + '" target="_blank" rel="noopener">' + link + '</a>.';
    if (explainEl) explainEl.innerHTML = msg;
    canvas.style.display = 'none';
    var p = document.createElement('p');
    p.className = 'k-unreachable';
    p.innerHTML = msg;
    canvas.parentNode.appendChild(p);
  });

  function boot(data) {
    state.nodes = data.nodes;
    data.nodes.forEach(function (n) { state.byId[n.slug] = n; });
    state.edges = data.edges || [];
    state.ready = true;

    if (explainEl) {
      var gen = (data.generated || '').slice(0, 10) || 'unknown date';
      explainEl.textContent = 'Every position is real — notes embedded with the ' +
        'MiniLM backbone, PCA to 2D. Distance is meaning. (' +
        (data.model || 'MiniLM') + ', rebuilt ' + gen + ')';
    }
    buildFilters(state.nodes);
    resize();
    fadeInAnim();
    window.addEventListener('resize', resize);
  }

  // ---------- filter chips + search ----------
  function buildFilters(nodes) {
    var tagSet = {};
    nodes.forEach(function (n) { (n.tags || []).forEach(function (t) { tagSet[t] = true; }); });
    var tags = Object.keys(tagSet).sort();

    filtersEl.innerHTML = '';
    var search = document.createElement('input');
    search.type = 'search'; search.className = 'k-search';
    search.placeholder = 'Filter by title…';
    search.setAttribute('aria-label', 'Search notes by title');
    search.addEventListener('input', function () {
      state.search = search.value.trim().toLowerCase();
      draw();
    });
    filtersEl.appendChild(search);

    tags.concat(['concepts']).forEach(function (tag) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'k-chip'; b.textContent = tag;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var active = b.getAttribute('aria-pressed') === 'true';
        if (active) { state.filters.delete(tag); b.setAttribute('aria-pressed', 'false'); }
        else { state.filters.add(tag); b.setAttribute('aria-pressed', 'true'); }
        draw();
      });
      filtersEl.appendChild(b);
    });
  }

  // ---------- layout helpers ----------
  function worldPos(n) {
    return { x: PAD + n.x * (W - 2 * PAD), y: PAD + n.y * (H - 2 * PAD) };
  }
  function screenPos(n) {
    var w = worldPos(n);
    return { x: w.x * state.cam.scale + state.cam.ox, y: w.y * state.cam.scale + state.cam.oy };
  }
  function visible(n) {
    if (state.search && n.title.toLowerCase().indexOf(state.search) === -1) return false;
    if (state.filters.size) {
      var tagMatch = (n.tags || []).some(function (t) { return state.filters.has(t); });
      var conceptMatch = state.filters.has('concepts') && n.kind === 'concepts';
      if (!tagMatch && !conceptMatch) return false;
    }
    return true;
  }

  // ---------- resize (dpr-aware) ----------
  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width || 600; H = rect.height || 400;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // ---------- draw ----------
  function draw() {
    if (!state.ready) return;
    ctx.clearRect(0, 0, W, H);
    var COLOR_ACCENT = css('--accent', '#7d6234');
    var COLOR_INK = css('--ink', '#201a13');
    var COLOR_LINE = css('--line', '#d9cabe');

    var activeNode = state.hover || state.selected;
    var neighborIds = null;
    if (activeNode) {
      neighborIds = {}; neighborIds[activeNode.slug] = true;
      state.edges.forEach(function (e) {
        if (e[0] === activeNode.slug) neighborIds[e[1]] = true;
        if (e[1] === activeNode.slug) neighborIds[e[0]] = true;
      });
    }

    ctx.save();
    ctx.translate(state.cam.ox, state.cam.oy);
    ctx.scale(state.cam.scale, state.cam.scale);
    ctx.lineWidth = 1 / state.cam.scale;
    ctx.strokeStyle = COLOR_LINE;

    state.edges.forEach(function (e) {
      var a = state.byId[e[0]], b = state.byId[e[1]];
      if (!a || !b || !visible(a) || !visible(b)) return;
      var wa = worldPos(a), wb = worldPos(b);
      var dim = activeNode && !(neighborIds[a.slug] && neighborIds[b.slug]);
      ctx.globalAlpha = state.fadeIn * (dim ? 0.12 : 0.5);
      ctx.beginPath(); ctx.moveTo(wa.x, wa.y); ctx.lineTo(wb.x, wb.y); ctx.stroke();
    });

    state.nodes.forEach(function (n) {
      var w = worldPos(n);
      var vis = visible(n);
      var dim = activeNode && neighborIds && !neighborIds[n.slug];
      ctx.globalAlpha = state.fadeIn * (!vis ? 0.15 : (dim ? 0.3 : 1));
      ctx.fillStyle = n.kind === 'concepts' ? COLOR_ACCENT : COLOR_INK;
      if (n.kind === 'concepts') {
        var s = 7;
        ctx.fillRect(w.x - s, w.y - s, s * 2, s * 2);
      } else {
        ctx.beginPath(); ctx.arc(w.x, w.y, 4.5, 0, Math.PI * 2); ctx.fill();
      }
      if (n === state.selected) {
        ctx.strokeStyle = COLOR_ACCENT; ctx.lineWidth = 2 / state.cam.scale;
        ctx.beginPath(); ctx.arc(w.x, w.y, n.kind === 'concepts' ? 12 : 8, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = COLOR_LINE; ctx.lineWidth = 1 / state.cam.scale;
      }
    });
    ctx.restore();
    ctx.globalAlpha = 1;

    // labels in screen space so they stay crisp under zoom
    ctx.font = '11px system-ui, sans-serif';
    state.nodes.forEach(function (n) {
      var showLabel = n.kind === 'concepts' || n === state.hover || n === state.selected;
      if (!showLabel) return;
      var vis = visible(n);
      var sp = screenPos(n);
      ctx.globalAlpha = state.fadeIn * (vis ? 1 : 0.15);
      ctx.fillStyle = n.kind === 'concepts' ? COLOR_ACCENT : COLOR_INK;
      ctx.fillText(n.title, sp.x + 9, sp.y + 4);
    });
    ctx.globalAlpha = 1;
  }

  function fadeInAnim() {
    if (reduceMotion) { state.fadeIn = 1; draw(); return; }
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      state.fadeIn = Math.min(1, (ts - start) / 500);
      draw();
      if (state.fadeIn < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---------- hit testing + pointer interaction (hover, drag pan, click) ----------
  function toLocal(evt) {
    var rect = canvas.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }
  function nodeAtScreen(sx, sy) {
    for (var i = state.nodes.length - 1; i >= 0; i--) {
      var n = state.nodes[i];
      var sp = screenPos(n);
      var base = n.kind === 'concepts' ? 8 : 5;
      var r = Math.max(base * state.cam.scale, 8);
      var dx = sx - sp.x, dy = sy - sp.y;
      if (dx * dx + dy * dy <= r * r) return n;
    }
    return null;
  }

  var dragging = false, dragMoved = 0, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', function (evt) {
    var p = toLocal(evt);
    dragging = true; dragMoved = 0; lastX = p.x; lastY = p.y;
    canvas.setPointerCapture(evt.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', function (evt) {
    var p = toLocal(evt);
    if (dragging) {
      var dx = p.x - lastX, dy = p.y - lastY;
      state.cam.ox += dx; state.cam.oy += dy;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      lastX = p.x; lastY = p.y;
      draw();
    } else {
      var hn = nodeAtScreen(p.x, p.y);
      if (hn !== state.hover) { state.hover = hn; canvas.style.cursor = hn ? 'pointer' : 'grab'; draw(); }
    }
  });
  function endDrag(evt) {
    canvas.style.cursor = 'grab';
    if (dragging && dragMoved < 6) {
      var p = toLocal(evt);
      var hn = nodeAtScreen(p.x, p.y);
      if (hn) selectNode(hn);
    }
    dragging = false;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', function () { dragging = false; });
  canvas.addEventListener('pointerleave', function () { if (!dragging) { state.hover = null; draw(); } });

  canvas.addEventListener('wheel', function (evt) {
    evt.preventDefault();
    var p = toLocal(evt);
    var factor = Math.exp(-evt.deltaY * 0.001);
    var newScale = Math.min(6, Math.max(0.4, state.cam.scale * factor));
    var wx = (p.x - state.cam.ox) / state.cam.scale, wy = (p.y - state.cam.oy) / state.cam.scale;
    state.cam.scale = newScale;
    state.cam.ox = p.x - wx * newScale;
    state.cam.oy = p.y - wy * newScale;
    draw();
  }, { passive: false });

  canvas.addEventListener('dblclick', function () {
    state.cam = { scale: 1, ox: 0, oy: 0 };
    draw();
  });

  // ---------- note fetch + panel render ----------
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slugify(s) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function findNode(ref) {
    return state.byId[ref] || state.byId[slugify(ref)] ||
      state.nodes.find(function (n) { return n.title.toLowerCase() === ref.toLowerCase(); });
  }
  function renderInline(text) {
    var parts = text.split(/\[\[([^\]]+)\]\]/g);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 0) { html += escapeHtml(parts[i]); continue; }
      var ref = parts[i], target = findNode(ref);
      html += target
        ? '<span class="wikilink" data-slug="' + target.slug + '" tabindex="0" role="button">' + escapeHtml(ref) + '</span>'
        : '<span class="wikilink-plain">' + escapeHtml(ref) + '</span>';
    }
    return html;
  }
  function renderBody(md) {
    md = md.replace(/^---[\s\S]*?---\s*/, '').trim();
    return md.split(/\n\s*\n/).filter(function (p) { return p.trim(); })
      .map(function (p) { return '<p>' + renderInline(p.trim()) + '</p>'; }).join('');
  }
  function neighborsOf(node) {
    var out = [];
    state.edges.forEach(function (e) {
      if (e[0] === node.slug && state.byId[e[1]]) out.push(state.byId[e[1]]);
      else if (e[1] === node.slug && state.byId[e[0]]) out.push(state.byId[e[0]]);
    });
    return out;
  }

  function openMobileSheet() { panel.classList.add('open'); }
  function wireWikilinks() {
    Array.prototype.forEach.call(panel.querySelectorAll('.wikilink[data-slug]'), function (el) {
      el.addEventListener('click', function () {
        var t = state.byId[el.dataset.slug]; if (t) selectNode(t);
      });
      el.addEventListener('keydown', function (evt) {
        if (evt.key === 'Enter' || evt.key === ' ') { evt.preventDefault(); el.click(); }
      });
    });
    var closeBtn = panel.querySelector('#k-close');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      panel.classList.remove('open'); state.selected = null; draw();
    });
  }

  function renderPanel(node, md) {
    var tagsHtml = (node.tags || []).map(function (t) { return '<span class="k-tag">' + escapeHtml(t) + '</span>'; }).join('');
    var sourceHtml = node.source && /^https?:\/\//.test(node.source)
      ? '<a class="k-source" href="' + escapeHtml(node.source) + '" target="_blank" rel="noopener">arXiv ↗</a>' : '';
    var concepts = neighborsOf(node).filter(function (n) { return n.kind === 'concepts' && n.slug !== node.slug; });
    var conceptsHtml = concepts.length
      ? '<div class="k-concepts"><h4>Linked concepts</h4>' + concepts.map(function (c) {
          return '<span class="wikilink" data-slug="' + c.slug + '" tabindex="0" role="button">' + escapeHtml(c.title) + '</span>';
        }).join(' &nbsp;') + '</div>'
      : '';
    panel.innerHTML =
      '<button type="button" class="k-close" id="k-close" aria-label="Close">×</button>' +
      '<h3>' + escapeHtml(node.title) + '</h3>' +
      '<div class="k-tags">' + tagsHtml + '</div>' +
      '<div class="k-note-body">' + renderBody(md) + '</div>' +
      sourceHtml + conceptsHtml;
    wireWikilinks();
  }

  function selectNode(node) {
    state.selected = node;
    panel.innerHTML = '<p class="k-note-loading">reading the note…</p>';
    openMobileSheet();
    draw();
    fetch(noteUrl(node.kind, node.slug)).then(function (r) {
      if (!r.ok) throw new Error('note');
      return r.text();
    }).then(function (md) {
      renderPanel(node, md);
    }).catch(function () {
      panel.innerHTML = '<button type="button" class="k-close" id="k-close" aria-label="Close">×</button>' +
        '<h3>' + escapeHtml(node.title) + '</h3><p class="k-note-error">Could not load this note.</p>';
      wireWikilinks();
    });
  }
})();
