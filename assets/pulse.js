/* pulse.js — Blue Hen live-vitals module. Zero deps, vanilla IIFE. */
(function () {
  'use strict';

  var API = 'https://api-production-3dea.up.railway.app';
  var GH_API = 'https://api.github.com/repos/jcdavis131/bluehen';
  var GH_WEB = 'https://github.com/jcdavis131/bluehen';

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '.pulse-strip{font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink-dim,#9a948a)}' +
      '.pulse-strip b{color:var(--ink,#e8e4dc);font-weight:600}' +
      '.pulse-sep{color:var(--line,#2c2823);margin:0 .5em}' +
      '.today-list{list-style:none;margin:0;padding:0}' +
      '.today-list li{padding:6px 0;border-bottom:1px solid var(--line,#2c2823)}' +
      '.today-list li:last-child{border-bottom:0}' +
      '.today-time{font:12px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--ink-dim,#9a948a);margin-right:.6em}' +
      '.today-tag{color:var(--ink-dim,#9a948a)}' +
      '.today-list a{color:var(--ink,#e8e4dc);text-decoration:none}' +
      '.today-list a:hover{color:var(--accent,#d4a24e)}' +
      '.ledger-head{color:var(--ink,#e8e4dc);font-weight:600}' +
      '.ledger-body{color:var(--ink-dim,#9a948a);margin-top:6px}' +
      '.ledger-link{display:inline-block;margin-top:8px;color:var(--accent,#d4a24e);text-decoration:none}' +
      '.ledger-link:hover{text-decoration:underline}';
    document.head.appendChild(s);
  }

  function relTime(when) {
    var diff = Date.now() - new Date(when).getTime();
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    var day = Math.floor(hr / 24);
    return day + 'd ago';
  }

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('bad status ' + r.status);
      return r.json();
    });
  }

  function stripLinks(text) {
    return text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  }

  function stripConventional(msg) {
    var m = msg.match(/^([a-zA-Z]+(?:\([^)]*\))?!?):\s*(.*)$/);
    if (m) return { tag: m[1] + ':', rest: m[2] };
    return { tag: '', rest: msg };
  }

  function wikiPageCount(data) {
    if (Array.isArray(data)) return data.length;
    if (data && Array.isArray(data.pages)) return data.pages.length;
    if (data && typeof data.count === 'number') return data.count;
    if (data && typeof data.total === 'number') return data.total;
    return null;
  }

  function mountPulse() {
    var el = document.getElementById('bh-pulse');
    if (!el) return;

    var catalog = getJSON(API + '/v1/catalog/stats').catch(function () { return null; });
    var wiki = getJSON(API + '/v1/wiki').catch(function () { return null; });
    var commit = getJSON(GH_API + '/commits?per_page=1').catch(function () { return null; });

    Promise.all([catalog, wiki, commit]).then(function (res) {
      var stats = res[0], wikiData = res[1], commits = res[2];
      var parts = [];

      if (stats && typeof stats.datasets === 'number') {
        parts.push('<b>' + stats.datasets + '</b> datasets');
      }
      if (stats && typeof stats.chunks === 'number') {
        parts.push('<b>' + stats.chunks + '</b> chunks');
      }
      var pages = wikiPageCount(wikiData);
      if (typeof pages === 'number') {
        parts.push('<b>' + pages + '</b> wiki pages');
      }

      var liveSpan = '';
      var lastMoved = commits && commits[0] && commits[0].commit &&
        commits[0].commit.author && commits[0].commit.author.date;
      if (lastMoved) {
        liveSpan = 'engine last moved <b class="pulse-live" data-ts="' + lastMoved + '">' +
          relTime(lastMoved) + '</b>';
        parts.push(liveSpan);
      }

      if (!parts.length) return; // nothing succeeded — render nothing
      el.innerHTML = '<span class="pulse-strip">' +
        parts.join('<span class="pulse-sep">&middot;</span>') + '</span>';

      if (lastMoved) {
        setInterval(function () {
          var span = el.querySelector('.pulse-live');
          if (span) span.textContent = relTime(span.getAttribute('data-ts'));
        }, 60000);
      }
    });
  }

  function mountCommits() {
    var el = document.getElementById('bh-commits');
    if (!el) return;

    getJSON(GH_API + '/commits?per_page=8').then(function (commits) {
      if (!Array.isArray(commits) || !commits.length) throw new Error('empty');
      var items = commits.map(function (c) {
        var msg = ((c.commit && c.commit.message) || '').split('\n')[0];
        var parsed = stripConventional(msg);
        var when = (c.commit && c.commit.author && c.commit.author.date) || c.commit.committer.date;
        var url = c.html_url || (GH_WEB + '/commit/' + c.sha);
        return '<li><a href="' + url + '" target="_blank" rel="noopener">' +
          '<span class="today-time">' + relTime(when) + '</span>' +
          (parsed.tag ? '<span class="today-tag">' + parsed.tag + '</span> ' : '') +
          escapeHtml(parsed.rest) +
          '</a></li>';
      });
      el.innerHTML = '<ul class="today-list">' + items.join('') + '</ul>';
    }).catch(function () {
      el.textContent = 'GitHub feed unreachable.';
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function mountEvidence() {
    var el = document.getElementById('bh-evidence');
    if (!el) return;

    fetch('https://raw.githubusercontent.com/jcdavis131/bluehen/main/EVIDENCE.md')
      .then(function (r) {
        if (!r.ok) throw new Error('bad status ' + r.status);
        return r.text();
      })
      .then(function (text) {
        var lines = text.split('\n');
        var best = null;
        for (var i = 0; i < lines.length; i++) {
          var m = lines[i].match(/^### (\d+)\.(\d+)/);
          if (!m) continue;
          var num = parseFloat(m[1] + '.' + m[2]);
          if (!best || num > best.num) {
            var heading = lines[i].replace(/^###\s*/, '');
            var para = '';
            for (var j = i + 1; j < lines.length; j++) {
              var line = lines[j].trim();
              if (!line) { if (para) break; else continue; }
              if (/^#{1,6}\s/.test(line)) break;
              para += (para ? ' ' : '') + line;
            }
            best = { num: num, heading: heading, para: para };
          }
        }
        if (!best) throw new Error('no entries found');
        el.innerHTML =
          '<div class="ledger-head">' + escapeHtml(best.heading) + '</div>' +
          '<div class="ledger-body">' + escapeHtml(stripLinks(best.para)) + '</div>' +
          '<a class="ledger-link" href="' + GH_WEB + '/blob/main/EVIDENCE.md" target="_blank" rel="noopener">full ledger &rarr;</a>';
      })
      .catch(function () {
        el.textContent = 'ledger unreachable.';
      });
  }

  css();
  mountPulse();
  mountCommits();
  mountEvidence();
})();
