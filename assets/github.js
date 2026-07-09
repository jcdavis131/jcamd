/* GitHub profile card. Zero deps.
   The activity feed and repo grid were dropped in favour of the contribution
   heatmap (assets/contributions.js), which is served from /api/contributions. */
(function () {
  'use strict';

  var USER = 'jcdavis131';
  var API = 'https://api.github.com/users/' + USER;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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

  mountProfile(document.getElementById('gh-profile'));
})();
