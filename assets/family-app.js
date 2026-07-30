(function () {
  'use strict';

  /* ==========================================================================
   * PART 1 — Ephemeris
   *
   * Geocentric ecliptic longitude for the Sun, Moon and the eight planets,
   * using Paul Schlyter's public-domain low-precision orbital-element method
   * ( http://www.stjarnhimlen.se/comp/ppcomp.html ), epoch 2000 Jan 0.0 UT.
   * Verified against real published dates before shipping: Sun longitude at
   * all four 2026 equinoxes/solstices lands within 0.3 deg of 0/90/180/270,
   * and Sun/Moon at the exact moment of the 2026-03-03 total lunar eclipse
   * (a real event, not a made-up test) land 0.07 deg from the 180 deg
   * opposition a lunar eclipse requires. Both are far inside a 5.625 deg
   * gate width, which is the only precision this app actually needs.
   *
   * Pluto has no simple analytic orbit; its 2-body Keplerian elements here
   * are Wikipedia's published J2000.0 osculating set — fine for gate-level
   * accuracy since Pluto crawls through one gate every few years.
   * ==========================================================================
   */

  var DEG = Math.PI / 180;
  function sin(x) { return Math.sin(x * DEG); }
  function cos(x) { return Math.cos(x * DEG); }
  function atan2d(y, x) { return Math.atan2(y, x) / DEG; }
  function norm360(a) { a = a % 360; return a < 0 ? a + 360 : a; }

  function toJulianDay(y, mo, d, hourUTC) {
    var Y = y, M = mo;
    if (M <= 2) { Y -= 1; M += 12; }
    var A = Math.floor(Y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5 + hourUTC / 24;
  }

  function solveKepler(Mdeg, e) {
    var E = Mdeg + (e / DEG) * sin(Mdeg) * (1 + e * cos(Mdeg));
    for (var n = 0; n < 8; n++) {
      var dE = (E - (e / DEG) * sin(E) - Mdeg) / (1 - e * cos(E));
      E -= dE;
      if (Math.abs(dE) < 1e-6) break;
    }
    return E;
  }

  function at(pair, d) { return pair[0] + pair[1] * d; }

  // Schlyter epoch-2000 elements: [value-at-epoch, per-day rate]. d = JD - 2451543.5.
  var EL = {
    Sun:     { N: [0, 0], i: [0, 0], w: [282.9404, 4.70935e-5], a: [1, 0], e: [0.016709, -1.151e-9], M: [356.0470, 0.9856002585] },
    Mercury: { N: [48.3313, 3.24587e-5], i: [7.0047, 5.00e-8], w: [29.1241, 1.01444e-5], a: [0.387098, 0], e: [0.205635, 5.59e-10], M: [168.6562, 4.0923344368] },
    Venus:   { N: [76.6799, 2.46590e-5], i: [3.3946, 2.75e-8], w: [54.8910, 1.38374e-5], a: [0.723330, 0], e: [0.006773, -1.302e-9], M: [48.0052, 1.6021302244] },
    Mars:    { N: [49.5574, 2.11081e-5], i: [1.8497, -1.78e-8], w: [286.5016, 2.92961e-5], a: [1.523688, 0], e: [0.093405, 2.516e-9], M: [18.6021, 0.5240207766] },
    Jupiter: { N: [100.4542, 2.76854e-5], i: [1.3030, -1.557e-7], w: [273.8777, 1.64505e-5], a: [5.20256, 0], e: [0.048498, 4.469e-9], M: [19.8950, 0.0830853001] },
    Saturn:  { N: [113.6634, 2.38980e-5], i: [2.4886, -1.081e-7], w: [339.3939, 2.97661e-5], a: [9.55475, 0], e: [0.055546, -9.499e-9], M: [316.9670, 0.0334442282] },
    Uranus:  { N: [74.0005, 1.3978e-5], i: [0.7733, 1.9e-8], w: [96.6612, 3.0565e-5], a: [19.18171, -1.55e-8], e: [0.047318, 7.45e-9], M: [142.5905, 0.011725806] },
    Neptune: { N: [131.7806, 3.0173e-5], i: [1.7700, -2.55e-7], w: [272.8461, -6.027e-6], a: [30.05826, 3.313e-8], e: [0.008606, 2.15e-9], M: [260.2471, 0.005995147] }
  };
  var MOON = { N: [125.1228, -0.0529538083], i: [5.1454, 0], w: [318.0634, 0.1643573223], a: [60.2666, 0], e: [0.054900, 0], M: [115.3654, 13.0649929509] };
  // Wikipedia J2000.0 osculating elements (JD 2451545.0). Plain 2-body, no perturbation terms.
  var PLUTO = { epochJD: 2451545.0, a: 39.482, e: 0.2488, i: 17.16, N: 110.299, w: 113.834, M0: 14.53, periodDays: 90560 };

  function keplerOrbit(N, i, w, a, e, M) {
    var E = solveKepler(norm360(M), e);
    var xv = a * (cos(E) - e);
    var yv = a * (Math.sqrt(1 - e * e) * sin(E));
    var v = atan2d(yv, xv);
    var r = Math.sqrt(xv * xv + yv * yv);
    var xh = r * (cos(N) * cos(v + w) - sin(N) * sin(v + w) * cos(i));
    var yh = r * (sin(N) * cos(v + w) + cos(N) * sin(v + w) * cos(i));
    var zh = r * (sin(v + w) * sin(i));
    return { r: r, lon: norm360(atan2d(yh, xh)), lat: atan2d(zh, Math.sqrt(xh * xh + yh * yh)) };
  }

  function sunPos(d) {
    return keplerOrbit(0, 0, at(EL.Sun.w, d), 1, at(EL.Sun.e, d), at(EL.Sun.M, d));
  }

  function moonPos(d, sunSpec) {
    var N = at(MOON.N, d), i = at(MOON.i, d), w = at(MOON.w, d), e = MOON.e[0], M = at(MOON.M, d);
    var base = keplerOrbit(N, i, w, MOON.a[0], e, M);
    var Msun = at(EL.Sun.M, d);
    var Ls = norm360(at(EL.Sun.w, d) + Msun);
    var Lm = norm360(N + w + M);
    var D = norm360(Lm - Ls);
    var F = norm360(Lm - N);
    var pert =
      -1.274 * sin(M - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Msun) -
      0.059 * sin(2 * M - 2 * D) - 0.057 * sin(M - 2 * D + Msun) + 0.053 * sin(M + 2 * D) +
      0.046 * sin(2 * D - Msun) + 0.041 * sin(M - Msun) - 0.035 * sin(D) -
      0.031 * sin(M + Msun) - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(M - 4 * D);
    return { lon: norm360(base.lon + pert), lat: base.lat, r: base.r };
  }

  function planetPos(name, d) {
    var el = EL[name];
    var base = keplerOrbit(at(el.N, d), at(el.i, d), at(el.w, d), at(el.a, d), at(el.e, d), at(el.M, d));
    if (name === 'Jupiter' || name === 'Saturn' || name === 'Uranus') {
      var Mj = at(EL.Jupiter.M, d), Msat = at(EL.Saturn.M, d), Mur = at(EL.Uranus.M, d);
      var corr = 0;
      if (name === 'Jupiter') {
        corr = -0.332 * sin(2 * Mj - 5 * Msat - 67.6) - 0.056 * sin(2 * Mj - 2 * Msat + 21) +
          0.042 * sin(3 * Mj - 5 * Msat + 21) - 0.036 * sin(Mj - 2 * Msat) +
          0.022 * cos(Mj - Msat) + 0.023 * sin(2 * Mj - 3 * Msat + 52) - 0.016 * sin(Mj - 5 * Msat - 69);
      } else if (name === 'Saturn') {
        corr = 0.812 * sin(2 * Mj - 5 * Msat - 67.6) - 0.229 * cos(2 * Mj - 4 * Msat - 2) +
          0.119 * sin(Mj - 2 * Msat - 3) + 0.046 * sin(2 * Mj - 6 * Msat - 69) + 0.014 * sin(Mj - 3 * Msat + 32);
      } else {
        corr = 0.040 * sin(Msat - 2 * Mur + 6) + 0.035 * sin(Msat - 3 * Mur + 33) - 0.015 * sin(Mj - Mur + 20);
      }
      base.lon = norm360(base.lon + corr);
    }
    return base;
  }

  function plutoPos(jd) {
    var d = jd - PLUTO.epochJD;
    var n = 360 / PLUTO.periodDays;
    var M = norm360(PLUTO.M0 + n * d);
    return keplerOrbit(PLUTO.N, PLUTO.i, PLUTO.w, PLUTO.a, PLUTO.e, M);
  }

  var BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

  function bodyLongitudes(jd) {
    var d = jd - 2451543.5;
    var out = {};
    out.Sun = sunPos(d).lon;
    out.Moon = moonPos(d).lon;
    ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'].forEach(function (name) {
      out[name] = planetPos(name, d).lon;
    });
    out.Pluto = plutoPos(jd).lon;
    return out;
  }

  /* ==========================================================================
   * PART 2 — The 64-gate wheel
   * Same constants as the architecture doc above on this page: gate 41 opens
   * the wheel at 302.25 deg, each gate spans 5.625 deg (360/64).
   * ==========================================================================
   */
  var HD_START_DEGREE = 302.25;
  var GATE_WIDTH = 360 / 64;
  var WHEEL_SEQUENCE = [
    41, 19, 13, 49, 30, 55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3,
    27, 24, 2, 23, 8, 20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56,
    31, 33, 7, 4, 29, 59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50,
    28, 44, 1, 43, 14, 34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60
  ];
  function longitudeToGate(lon) {
    var adjusted = norm360(lon - HD_START_DEGREE);
    return WHEEL_SEQUENCE[Math.floor(adjusted / GATE_WIDTH)];
  }

  function gatesForDate(jd) {
    var lons = bodyLongitudes(jd);
    var gates = {};
    BODIES.forEach(function (b) { gates[b] = longitudeToGate(lons[b]); });
    return gates;
  }

  /* ==========================================================================
   * PART 3 — The 36 channels (canonical Jovian Archive / Ra Uru Hu bodygraph)
   * Cross-checked against the MIT-licensed `free-human-design` npm package
   * (github.com/adamblvck/free-human-design) — its 36 gate-pairs and names
   * match this table exactly, including the 4 examples in the architecture
   * doc above (1-8, 2-14, 3-60, 23-43). Not reproduced verbatim from that
   * package; re-typed here as plain data, dependency-free.
   * ==========================================================================
   */
  var CHANNEL_PAIRS = [
    [1, 8], [2, 14], [3, 60], [4, 63], [5, 15], [6, 59], [7, 31], [9, 52],
    [10, 20], [10, 34], [10, 57], [11, 56], [12, 22], [13, 33], [16, 48], [17, 62],
    [18, 58], [19, 49], [20, 34], [20, 57], [21, 45], [23, 43], [24, 61], [25, 51],
    [26, 44], [27, 50], [28, 38], [29, 46], [30, 41], [32, 54], [34, 57], [35, 36],
    [37, 40], [39, 55], [42, 53], [47, 64]
  ];
  var CHANNEL_NAMES = {
    '1-8': 'Inspiration', '2-14': 'The Beat', '3-60': 'Mutation', '4-63': 'Logic',
    '5-15': 'Rhythm', '6-59': 'Mating', '7-31': 'The Alpha', '9-52': 'Concentration',
    '10-20': 'Awakening', '10-34': 'Exploration', '10-57': 'Perfected Form',
    '11-56': 'Curiosity', '12-22': 'Openness', '13-33': 'The Prodigal',
    '16-48': 'The Wavelength', '17-62': 'Acceptance', '18-58': 'Judgment',
    '19-49': 'Synthesis', '20-34': 'Charisma', '20-57': 'The Brainwave',
    '21-45': 'Money', '23-43': 'Structuring', '24-61': 'Awareness', '25-51': 'Initiation',
    '26-44': 'Surrender', '27-50': 'Preservation', '28-38': 'Struggle',
    '29-46': 'Discovery', '30-41': 'Recognition', '32-54': 'Transformation',
    '34-57': 'Power', '35-36': 'Transitoriness', '37-40': 'Community',
    '39-55': 'Emoting', '42-53': 'Maturation', '47-64': 'Abstraction'
  };
  // One original, secular, non-deterministic prompt per channel — our own
  // copy, framed as a possibility for the day, not a claim about the person.
  var CHANNEL_PROMPTS = {
    '1-8': 'A quiet sense of direction wants to become something you actually say out loud today.',
    '2-14': 'Let your own sense of direction set the pace instead of matching whoever is loudest.',
    '3-60': 'A change is pressing to happen — don’t force the timing, but don’t block it either.',
    '4-63': 'A pattern you’ve been quietly doubting is worth checking against the actual data.',
    '5-15': 'Stick to your own rhythm today rather than adjusting to the room.',
    '6-59': 'Emotional walls are more porous than usual — good for closeness, not for big decisions.',
    '7-31': 'If people are looking to you for direction, give it plainly — not a day to hedge.',
    '9-52': 'Narrow focus pays off more than multitasking today — pick the one thing.',
    '10-20': 'Say what you actually believe right now, not what you believed yesterday.',
    '10-34': 'Follow what feels right for you, even if it isn’t the popular move.',
    '10-57': 'Trust the instinct that shows up now over the plan you made last week.',
    '11-56': 'Good day for telling the story, gathering ideas, or following a stray thread.',
    '12-22': 'Wait for the mood to be right before the important conversation — timing carries it.',
    '13-33': 'Something from your history is worth retelling; someone needs the lesson you learned.',
    '16-48': 'Trust the skill you’ve already built through repetition — not a day to start from scratch.',
    '17-62': 'Details and logistics land well today — the practical follow-up, not the big speech.',
    '18-58': 'You’ll spot what isn’t working faster than usual — fix a process, not a person.',
    '19-49': 'Notice what you actually need from the people close to you, and just ask.',
    '20-34': 'What you’re doing right now is the most convincing thing you can say.',
    '20-57': 'Trust the instant read and say it immediately — this alertness doesn’t wait well.',
    '21-45': 'Good day for the practical conversation about resources, terms, or who’s in charge.',
    '23-43': 'Turn today’s private insight into something you actually explain to someone else.',
    '24-61': 'An idea keeps circling back — give it room to finish forming.',
    '25-51': 'Good day to go first — competition reads as energizing rather than threatening.',
    '26-44': 'Good day for the sales conversation, or for trusting a gut read on a track record.',
    '27-50': 'Caretaking instincts are strong — check in on whoever you’re responsible for.',
    '28-38': 'If something feels worth the fight today, it probably is.',
    '29-46': 'Say yes to a commitment only if your body actually wants it, not just your calendar.',
    '30-41': 'A restless feeling today is fuel for a new experience, not a problem to solve.',
    '32-54': 'Ambition reads as instinct today — trust the drive toward something better.',
    '34-57': 'Gut and energy are aligned today — move on instinct rather than overthink it.',
    '35-36': 'New experience matters more than outcome today — try the thing you haven’t done.',
    '37-40': 'Good day for the family or team agreement — say what you need in return.',
    '39-55': 'Moods will provoke a reaction today — let them pass before reading into it.',
    '42-53': 'Something is at a natural finishing point — better to close it out than push further.',
    '47-64': 'An old memory or half-formed question resurfaces; the meaning lands later, not now.'
  };
  function channelKey(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
  var PARTNERS = {};
  CHANNEL_PAIRS.forEach(function (pair) {
    var a = pair[0], b = pair[1];
    (PARTNERS[a] = PARTNERS[a] || []).push(b);
    (PARTNERS[b] = PARTNERS[b] || []).push(a);
  });

  function findActivations(natalGates, transitGates) {
    var natalSet = {}, transitSet = {};
    BODIES.forEach(function (b) { natalSet[natalGates[b]] = true; transitSet[transitGates[b]] = true; });
    var seen = {}, activations = [];
    Object.keys(natalSet).forEach(function (gateStr) {
      var gate = Number(gateStr);
      (PARTNERS[gate] || []).forEach(function (partner) {
        if (transitSet[partner]) {
          var key = channelKey(gate, partner);
          if (seen[key]) return;
          seen[key] = true;
          activations.push({
            key: key,
            gates: [Math.min(gate, partner), Math.max(gate, partner)],
            name: CHANNEL_NAMES[key],
            prompt: CHANNEL_PROMPTS[key],
            natalGate: gate,
            transitGate: partner
          });
        }
      });
    });
    return activations;
  }

  function findEchoes(natalGates, transitGates) {
    var echoes = [], seen = {};
    BODIES.forEach(function (natalBody) {
      var gate = natalGates[natalBody];
      BODIES.forEach(function (transitBody) {
        if (transitGates[transitBody] === gate && !seen[gate]) {
          seen[gate] = true;
          echoes.push({ gate: gate, natalBody: natalBody, transitBody: transitBody });
        }
      });
    });
    return echoes;
  }

  /* ==========================================================================
   * PART 4 — Profiles (localStorage only; nothing here ever leaves the browser)
   * ==========================================================================
   */
  var STORE_KEY = 'jcamd_family_profiles_v1';

  function loadProfiles() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) { return []; }
  }
  function saveProfiles(profiles) {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(profiles)); } catch (err) { /* storage unavailable — feed still works this session */ }
  }

  function birthJulianDay(profile) {
    var parts = profile.date.split('-').map(Number);
    var y = parts[0], mo = parts[1], da = parts[2];
    var timeParts = (profile.time || '12:00').split(':').map(Number);
    var localHour = timeParts[0] + timeParts[1] / 60;
    var utcHour = localHour - Number(profile.utcOffset);
    return toJulianDay(y, mo, da, utcHour);
  }

  function nowJulianDay() {
    var now = new Date();
    return toJulianDay(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(),
      now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600);
  }

  /* ==========================================================================
   * PART 5 — DOM wiring
   * ==========================================================================
   */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, className, text) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function renderProfileList(container, profiles, onDelete) {
    container.innerHTML = '';
    if (!profiles.length) {
      container.appendChild(el('p', 'feed-empty', 'No profiles saved yet — add one below to see a feed.'));
      return;
    }
    profiles.forEach(function (p, idx) {
      var row = el('div', 'profile-chip');
      row.appendChild(el('span', 'profile-chip__name', p.name));
      row.appendChild(el('span', 'profile-chip__meta', p.date + ' ' + p.time + ' (UTC' + (p.utcOffset >= 0 ? '+' : '') + p.utcOffset + ')'));
      var del = el('button', 'profile-chip__del', 'Remove');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove profile ' + p.name);
      del.addEventListener('click', function () { onDelete(idx); });
      row.appendChild(del);
      container.appendChild(row);
    });
  }

  function renderFeed(container, profile, jdNow) {
    var natal = gatesForDate(birthJulianDay(profile));
    var transit = gatesForDate(jdNow);
    var activations = findActivations(natal, transit);
    var echoes = findEchoes(natal, transit).filter(function (e) {
      return !activations.some(function (a) { return a.gates.indexOf(e.gate) !== -1; });
    });

    var card = el('article', 'feed-profile card');
    var head = el('div', 'feed-profile__head');
    head.appendChild(el('h3', null, profile.name));
    head.appendChild(el('span', 'feed-profile__date', new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })));
    card.appendChild(head);

    if (!activations.length && !echoes.length) {
      card.appendChild(el('p', 'feed-empty', 'No channel activations or gate echoes for ' + profile.name + ' today — a quieter day, astrologically speaking.'));
    }

    if (activations.length) {
      var actHead = el('p', 'feed-section-label', 'Channel activations today');
      card.appendChild(actHead);
      activations.forEach(function (a) {
        var item = el('div', 'feed-item');
        var title = el('p', 'feed-item__title');
        title.appendChild(el('span', 'feed-item__gates', a.gates[0] + '–' + a.gates[1]));
        title.appendChild(document.createTextNode(' ' + a.name));
        item.appendChild(title);
        item.appendChild(el('p', 'feed-item__prompt', a.prompt));
        item.appendChild(el('p', 'feed-item__meta', 'Natal gate ' + a.natalGate + ' × today’s transit gate ' + a.transitGate));
        card.appendChild(item);
      });
    }

    if (echoes.length) {
      var echoHead = el('p', 'feed-section-label', 'Gate echoes today');
      card.appendChild(echoHead);
      var echoNote = el('p', 'feed-item__meta feed-item__meta--standalone', 'Not part of the architecture doc — an extra, lighter signal: a transiting body sitting in the exact same gate as one of your natal placements.');
      card.appendChild(echoNote);
      echoes.forEach(function (e) {
        var item = el('div', 'feed-item feed-item--echo');
        item.appendChild(el('p', 'feed-item__title', 'Gate ' + e.gate));
        item.appendChild(el('p', 'feed-item__meta', 'Your natal ' + e.natalBody + ' × today’s ' + e.transitBody));
        card.appendChild(item);
      });
    }

    container.appendChild(card);
  }

  function init() {
    var form = $('#profile-form');
    var listEl = $('#profile-list');
    var feedEl = $('#feed-output');
    var refreshBtn = $('#feed-refresh');
    var clearAllBtn = $('#profiles-clear-all');
    if (!form || !listEl || !feedEl) return; // not on this page

    var dateInput = $('#pf-date', form);
    if (dateInput) dateInput.max = new Date().toISOString().slice(0, 10);
    var utcSelect = $('#pf-utc', form);
    if (utcSelect) {
      var guess = String(Math.round(-new Date().getTimezoneOffset() / 60));
      if ($('option[value="' + guess + '"]', utcSelect)) utcSelect.value = guess;
    }

    var profiles = loadProfiles();

    function renderAll() {
      renderProfileList(listEl, profiles, function (idx) {
        profiles.splice(idx, 1);
        saveProfiles(profiles);
        renderAll();
      });
      feedEl.innerHTML = '';
      if (!profiles.length) {
        feedEl.appendChild(el('p', 'feed-empty', 'Add at least one profile to generate today’s feed.'));
        return;
      }
      var jdNow = nowJulianDay();
      profiles.forEach(function (p) { renderFeed(feedEl, p, jdNow); });
    }

    form.addEventListener('submit', function (evt) {
      evt.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var date = String(data.get('date') || '');
      var time = String(data.get('time') || '12:00');
      var utcOffset = Number(data.get('utcOffset'));
      if (!name || !date || Number.isNaN(utcOffset)) return;
      profiles.push({ name: name, date: date, time: time, utcOffset: utcOffset });
      saveProfiles(profiles);
      form.reset();
      renderAll();
    });

    if (refreshBtn) refreshBtn.addEventListener('click', renderAll);
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', function () {
        if (!profiles.length) return;
        if (!window.confirm('Remove all saved profiles from this browser? This cannot be undone.')) return;
        profiles = [];
        saveProfiles(profiles);
        renderAll();
      });
    }

    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
