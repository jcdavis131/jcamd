/* Blue Hen living wiki — knowledge world graph.
   Mounts onto #bh-graph. Vanilla JS, no deps. */
(function () {
  var API = 'https://api-production-3dea.up.railway.app';
  var mount = document.getElementById('bh-graph');
  if (!mount) return;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  mount.textContent = 'listening to the engine…';

  function css(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  Promise.all([
    fetch(API + '/v1/wiki').then(function (r) { if (!r.ok) throw new Error('wiki'); return r.json(); }),
    fetch(API + '/v1/wiki/link-map').then(function (r) { if (!r.ok) throw new Error('link-map'); return r.json(); })
  ]).then(function (res) {
    var pages = (res[0] && res[0].pages) || [];
    var bodyMd = (res[1] && res[1].bodyMd) || '';
    if (!pages.length) throw new Error('empty');
    boot(pages, bodyMd);
  }).catch(function () {
    mount.textContent = 'The knowledge world is unreachable right now — the engine may be redeploying.';
  });

  function boot(pages, bodyMd) {
    var COLOR_ACCENT = css('--accent', '#d4a24e');
    var COLOR_INK = css('--ink', '#e8e4dc');
    var COLOR_DIM = css('--ink-dim', '#9a948a');
    var COLOR_LINE = css('--line', '#2c2823');

    var byId = {};
    var nodes = pages.map(function (p) {
      var kind = p.kind || 'dataset';
      var r = kind === 'index' ? 20 : kind === 'topic' ? 13 : 8;
      var n = {
        id: p.slug, title: p.title || p.slug, kind: kind, r: r,
        x: Math.random() * 400, y: Math.random() * 400, vx: 0, vy: 0
      };
      byId[p.slug] = n;
      return n;
    });

    var edges = [];
    var seen = {};
    function addEdge(a, b) {
      if (!byId[a] || !byId[b] || a === b) return;
      var key = a < b ? a + '|' + b : b + '|' + a;
      if (seen[key]) return;
      seen[key] = true;
      edges.push({ a: a, b: b });
    }

    // Dataset <-> dataset edges parsed from the link-map markdown.
    var linkRe = /\[[^\]]+\]\(\/datasets\/([a-z0-9-]+)\)/g;
    bodyMd.split('\n').forEach(function (line) {
      var slugs = [], m;
      linkRe.lastIndex = 0;
      while ((m = linkRe.exec(line))) slugs.push('dataset-' + m[1]);
      if (slugs.length >= 2) addEdge(slugs[0], slugs[1]);
    });

    // Structural edges: every topic-* page connects to index.
    nodes.forEach(function (n) {
      if (n.id.indexOf('topic-') === 0) addEdge(n.id, 'index');
    });

    // --- layout: simple force-directed (repulsion + springs) ---
    var W = 600, H = 400;
    function step() {
      var k = Math.sqrt((W * H) / Math.max(nodes.length, 1));
      nodes.forEach(function (a) {
        var fx = 0, fy = 0;
        nodes.forEach(function (b) {
          if (a === b) return;
          var dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          var f = (k * k) / d;
          fx += (dx / d) * f; fy += (dy / d) * f;
        });
        // gravity toward center
        fx += (W / 2 - a.x) * 0.01;
        fy += (H / 2 - a.y) * 0.01;
        a.vx = (a.vx + fx * 0.01) * 0.85;
        a.vy = (a.vy + fy * 0.01) * 0.85;
      });
      edges.forEach(function (e) {
        var a = byId[e.a], b = byId[e.b];
        var dx = b.x - a.x, dy = b.y - a.y;
        var d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        var f = (d - k) * 0.02;
        var fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      });
      var moved = 0;
      nodes.forEach(function (a) {
        a.x += a.vx; a.y += a.vy;
        a.x = Math.max(a.r, Math.min(W - a.r, a.x));
        a.y = Math.max(a.r, Math.min(H - a.r, a.y));
        moved += Math.abs(a.vx) + Math.abs(a.vy);
      });
      return moved;
    }

    // --- DOM: canvas + legend ---
    mount.innerHTML = '';
    mount.style.position = 'relative';
    var canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '420px';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    mount.appendChild(canvas);
    var legend = document.createElement('div');
    legend.style.cssText = 'position:absolute;top:8px;right:8px;font:12px system-ui,sans-serif;' +
      'color:' + COLOR_DIM + ';display:flex;gap:10px;pointer-events:none;';
    legend.innerHTML =
      '<span><i style="background:' + COLOR_ACCENT + '"></i> index</span>' +
      '<span><i style="background:' + COLOR_INK + '"></i> topic</span>' +
      '<span><i style="background:' + COLOR_DIM + '"></i> dataset</span>';
    Array.prototype.forEach.call(legend.querySelectorAll('i'), function (i) {
      i.style.cssText += 'display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;';
    });
    mount.appendChild(legend);

    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = rect.width || 600; H = rect.height || 420;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    }

    function colorFor(kind) {
      return kind === 'index' ? COLOR_ACCENT : kind === 'topic' ? COLOR_INK : COLOR_DIM;
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = COLOR_LINE;
      ctx.lineWidth = 1;
      edges.forEach(function (e) {
        var a = byId[e.a], b = byId[e.b];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
      nodes.forEach(function (n) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = colorFor(n.kind);
        ctx.fill();
        var alwaysLabel = n.kind === 'index' || n.kind === 'topic';
        if (alwaysLabel || n === hoverNode) {
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillStyle = COLOR_INK;
          ctx.fillText(n.title, n.x + n.r + 4, n.y + 4);
        }
      });
    }

    // --- simulation driver ---
    var iterations = 0, settled = false, hoverNode = null;
    function tick() {
      if (settled) return;
      var moved = step();
      iterations++;
      draw();
      if (iterations >= 60 || moved < 0.05) { settled = true; return; }
      requestAnimationFrame(tick);
    }

    if (reduceMotion) {
      for (var i = 0; i < 60 && step() >= 0.05; i++) {}
      settled = true;
    } else {
      requestAnimationFrame(tick);
    }

    // --- interaction: hover, drag, click ---
    var dragNode = null, dragMoved = 0, lastX = 0, lastY = 0;
    function nodeAt(x, y) {
      for (var i = nodes.length - 1; i >= 0; i--) {
        var n = nodes[i];
        var dx = x - n.x, dy = y - n.y;
        if (dx * dx + dy * dy <= (n.r + 4) * (n.r + 4)) return n;
      }
      return null;
    }
    function toLocal(evt) {
      var rect = canvas.getBoundingClientRect();
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', function (evt) {
      var p = toLocal(evt);
      dragNode = nodeAt(p.x, p.y);
      dragMoved = 0; lastX = p.x; lastY = p.y;
      if (dragNode) canvas.setPointerCapture(evt.pointerId);
    });
    canvas.addEventListener('pointermove', function (evt) {
      var p = toLocal(evt);
      if (dragNode) {
        dragNode.x = Math.max(dragNode.r, Math.min(W - dragNode.r, p.x));
        dragNode.y = Math.max(dragNode.r, Math.min(H - dragNode.r, p.y));
        dragMoved += Math.abs(p.x - lastX) + Math.abs(p.y - lastY);
        lastX = p.x; lastY = p.y;
        draw();
      } else {
        var hn = nodeAt(p.x, p.y);
        if (hn !== hoverNode) { hoverNode = hn; canvas.style.cursor = hn ? 'pointer' : 'default'; draw(); }
      }
    });
    function endDrag(evt) {
      if (dragNode && dragMoved < 4) {
        window.open('https://data.bhenre.com/wiki/' + dragNode.id, '_blank');
      }
      dragNode = null;
    }
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', function () { dragNode = null; });

    window.addEventListener('resize', resize);
    resize();
  }
})();
