/* GitHub contribution heatmap. Data from /api/contributions (needs GITHUB_TOKEN).
   If the endpoint is unconfigured or upstream fails, the block removes itself. */
(function () {
  'use strict';

  // Sequential single-hue ramp, levels 1-4. Validated light->dark: monotone
  // lightness, adjacent dL >= 0.06, light end 2.18:1 on --surface, 5 deg hue spread.
  var RAMP = ['#9eadb9', '#899aaa', '#73889a', '#3d5a73'];
  var EMPTY = '#e6e2d8'; // level 0 reads as absence, not as a ramp step
  var CELL = 11, GAP = 2, PITCH = CELL + GAP, LABEL_W = 26, MONTH_H = 15;
  var NS = 'http://www.w3.org/2000/svg';
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function render(host, data) {
    var weeks = data.weeks;
    var w = LABEL_W + weeks.length * PITCH;
    var h = MONTH_H + 7 * PITCH;

    var svg = el('svg', {
      viewBox: '0 0 ' + w + ' ' + h,
      width: w, height: h,
      role: 'img',
      'aria-label': data.totalContributions + ' GitHub contributions in the last year',
      class: 'gh-contrib__svg',
    });

    // Weekday labels (Mon/Wed/Fri only, like GitHub) — recessive ink, not series color.
    [[1, 'Mon'], [3, 'Wed'], [5, 'Fri']].forEach(function (p) {
      var t = el('text', { x: 0, y: MONTH_H + p[0] * PITCH + CELL - 1, class: 'gh-contrib__axis' });
      t.textContent = p[1];
      svg.appendChild(t);
    });

    var lastMonth = -1;
    weeks.forEach(function (week, wi) {
      var first = week[0];
      if (first) {
        var m = new Date(first.d + 'T00:00:00Z').getUTCMonth();
        if (m !== lastMonth && wi < weeks.length - 1) {
          var t = el('text', { x: LABEL_W + wi * PITCH, y: 10, class: 'gh-contrib__axis' });
          t.textContent = MONTHS[m];
          svg.appendChild(t);
          lastMonth = m;
        }
      }
      week.forEach(function (day) {
        var dow = new Date(day.d + 'T00:00:00Z').getUTCDay();
        var rect = el('rect', {
          x: LABEL_W + wi * PITCH,
          y: MONTH_H + dow * PITCH,
          width: CELL, height: CELL, rx: 2,
          fill: day.l === 0 ? EMPTY : RAMP[day.l - 1],
        });
        // Native tooltip + accessible name: identity is never colour-alone.
        var title = el('title');
        title.textContent = plural(day.c, 'contribution') + ' on ' + day.d;
        rect.appendChild(title);
        svg.appendChild(rect);
      });
    });

    var legend = document.createElement('div');
    legend.className = 'gh-contrib__legend';
    var swatches = RAMP.map(function (c) {
      return '<span class="gh-contrib__swatch" style="background:' + c + '"></span>';
    }).join('');
    legend.innerHTML =
      '<span>' + data.totalContributions.toLocaleString() + ' contributions in the last year</span>' +
      '<span class="gh-contrib__scale">Less' +
      '<span class="gh-contrib__swatch" style="background:' + EMPTY + '"></span>' +
      swatches + 'More</span>';

    var scroll = document.createElement('div');
    scroll.className = 'gh-contrib__scroll';
    scroll.appendChild(svg);

    host.innerHTML = '';
    host.appendChild(scroll);
    host.appendChild(legend);
  }

  var host = document.getElementById('gh-contrib');
  if (!host) return;

  fetch('/api/contributions')
    .then(function (r) { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .then(function (data) { render(host, data); })
    .catch(function () { host.remove(); });
})();
