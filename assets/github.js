/* Generic GitHub activity — profile, events, repos. Zero deps. */
(function () {
  'use strict';

  var USER = 'jcdavis131';
  var API = 'https://api.github.com/users/' + USER;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function relTime(when) {
    var diff = Date.now() - new Date(when).getTime();
    var sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    var min = Math.floor(sec / 60);
    if (min < 60) return min + 'm ago';
    var hr = Math.floor(min / 60);
    if (hr < 24) return hr + 'h ago';
    return Math.floor(hr / 24) + 'd ago';
  }

  function getJSON(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('status ' + r.status);
      return r.json();
    });
  }

  function mountProfile(el) {
    if (!el) return;
    getJSON(API).then(function (u) {
      el.innerHTML =
        '<img class="gh-profile__avatar" src="' + esc(u.avatar_url) + '" alt="" width="68" height="68">' +
        '<a class="gh-profile__handle" href="' + esc(u.html_url) + '" target="_blank" rel="noopener">@' + esc(u.login) + '</a>' +
        (u.bio ? '<p class="gh-profile__bio">' + esc(u.bio) + '</p>' : '') +
        '<div class="gh-stats">' +
        '<span><strong>' + (u.public_repos || 0) + '</strong> repos</span>' +
        '<span><strong>' + (u.followers || 0) + '</strong> followers</span>' +
        '</div>';
    }).catch(function () {
      el.innerHTML = '<p class="activity-error">Could not load profile. <a href="https://github.com/' + USER + '">github.com/' + USER + '</a></p>';
    });
  }

  function eventLabel(ev) {
    var t = ev.type;
    var repo = ev.repo && ev.repo.name ? ev.repo.name.replace(USER + '/', '') : 'repo';
    var url = (ev.repo && ev.repo.url) ? ev.repo.url.replace('api.github.com/repos', 'github.com') : '#';

    if (t === 'PushEvent' && ev.payload && ev.payload.commits && ev.payload.commits.length) {
      var msg = ev.payload.commits[0].message.split('\n')[0];
      return { text: 'Pushed to <a href="' + url + '">' + esc(repo) + '</a>', detail: esc(msg) };
    }
    if (t === 'CreateEvent') {
      return { text: 'Created <a href="' + url + '">' + esc(repo) + '</a>', detail: ev.payload.ref_type || '' };
    }
    if (t === 'WatchEvent') {
      return { text: 'Starred <a href="' + url + '">' + esc(repo) + '</a>', detail: '' };
    }
    if (t === 'PullRequestEvent') {
      var action = (ev.payload && ev.payload.action) || 'updated';
      return { text: action + ' PR on <a href="' + url + '">' + esc(repo) + '</a>', detail: '' };
    }
    return { text: t.replace('Event', '') + ' on <a href="' + url + '">' + esc(repo) + '</a>', detail: '' };
  }

  function mountActivity(el) {
    if (!el) return;
    el.classList.add('is-loading');

    getJSON(API + '/events/public?per_page=12').then(function (events) {
      el.classList.remove('is-loading');
      if (!Array.isArray(events) || !events.length) {
        el.innerHTML = '<p class="activity-empty">No recent public activity.</p>';
        return;
      }
      var items = events.slice(0, 8).map(function (ev) {
        var label = eventLabel(ev);
        return '<li>' + label.text +
          (label.detail ? '<span class="activity-meta">' + label.detail + '</span>' : '') +
          '<span class="activity-meta">' + relTime(ev.created_at) + '</span></li>';
      });
      el.innerHTML = '<ul class="activity-list">' + items.join('') + '</ul>';
    }).catch(function () {
      el.classList.remove('is-loading');
      el.innerHTML = '<p class="activity-error">Feed unavailable. <a href="https://github.com/' + USER + '">See GitHub</a>.</p>';
    });
  }

  function mountRepos(el) {
    if (!el) return;
    getJSON(API + '/repos?sort=updated&per_page=6').then(function (repos) {
      if (!Array.isArray(repos) || !repos.length) {
        el.innerHTML = '';
        return;
      }
      var cards = repos.filter(function (r) { return !r.fork; }).slice(0, 6).map(function (r) {
        var lang = r.language ? r.language : '';
        var stars = r.stargazers_count ? '★ ' + r.stargazers_count : '';
        var meta = [lang, stars].filter(Boolean).join(' · ');
        return '<a class="repo-card" href="' + esc(r.html_url) + '" target="_blank" rel="noopener">' +
          '<h3>' + esc(r.name) + '</h3>' +
          (r.description ? '<p>' + esc(r.description) + '</p>' : '') +
          (meta ? '<div class="repo-card__meta">' + esc(meta) + '</div>' : '') +
          '</a>';
      });
      el.innerHTML = cards.join('');
    }).catch(function () {
      el.innerHTML = '';
    });
  }

  mountProfile(document.getElementById('gh-profile'));
  mountActivity(document.getElementById('gh-activity'));
  mountRepos(document.getElementById('gh-repos'));
})();
