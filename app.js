/* app.js — DOM wiring for the Horæ dial. Pure math lives in hours.js. */
(function () {
  'use strict';

  var HA = window.HourAngles;
  var CX = 240, CY = 240, R_TICK_IN = 180, R_TICK_OUT = 168, R_MAJOR_OUT = 158;
  var R_NUMERAL = 140, R_LABEL = 198, R_ARC = 200, R_STOPWATCH_IN = 156, R_STOPWATCH_OUT = 170;
  var R_LITURGICAL = 116;
  var R_YEAR = 100, R_YEAR_W = 9, R_FESTIVAL = 76;
  var R_TRAIL_IN = 188, R_TRAIL_OUT = 212;

  var els = {
    lat: document.getElementById('lat'),
    lon: document.getElementById('lon'),
    geo: document.getElementById('geo'),
    error: document.getElementById('error'),
    ticks: document.getElementById('ticks'),
    labels: document.getElementById('labels'),
    pointer: document.getElementById('pointer'),
    arcDay: document.getElementById('arc-day'),
    arcNight: document.getElementById('arc-night'),
    quadrantName: document.getElementById('quadrant-name'),
    legend: document.getElementById('legend'),
    nowName: document.getElementById('now-hour-name'),
    nowNote: document.getElementById('now-hour-note'),
    nowRemaining: document.getElementById('now-remaining'),
    tableBody: document.getElementById('hours-table-body'),
    modeTemporal: document.getElementById('mode-temporal'),
    modeClock24: document.getElementById('mode-clock24'),
    day: document.getElementById('day'),
    today: document.getElementById('today'),
    play: document.getElementById('play'),
    yearSlider: document.getElementById('year-slider'),
    yearLabel: document.getElementById('year-label'),
    yearRing: document.getElementById('year-ring'),
    yearMarker: document.getElementById('year-marker'),
    festival: document.getElementById('festival')
  };

  var mode = 'temporal';
  var viewDate = new Date();   // the day the dial is drawn for (today by default)
  var playing = false;
  var playTimer = null;

  /* Dial angle (0 = top, clockwise) -> pointer rotation. */
  function dialToRotation(dialAngle) {
    return dialAngle; // pointer drawn pointing up; 0 = top
  }

  function polar(r, dialDeg) {
    var rad = dialDeg * Math.PI / 180; // 0deg = 12 o'clock, clockwise
    return [CX + r * Math.sin(rad), CY - r * Math.cos(rad)];
  }

  function arcPath(r, fromDeg, toDeg) {
    var a = polar(r, fromDeg), b = polar(r, toDeg);
    var span = ((toDeg - fromDeg) % 360 + 360) % 360;
    var large = span > 180 ? 1 : 0;
    return 'M ' + a[0] + ' ' + a[1] + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + b[0] + ' ' + b[1];
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  var CANONICAL = { 'Lauds': 1, 'Prime': 1, 'Terce': 1, 'Sext': 1, 'None': 1, 'Vespers': 1, 'Compline': 1, 'Matins': 1 };
  var ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  /* regular digits for the equal hours of the clock: 24-hour ring,
   * 12 (noon) at the top, 18 (6pm) right, 24 (midnight) bottom, 6 (6am) left */
  function clockDigit(hour24) {
    return hour24 === 0 ? '24' : String(hour24);
  }

  /* All tick/label geometry depends on the mode, so rebuild on toggle. */
  function numeral(fragL, dialAng, label, fill, size) {
    var np = polar(R_NUMERAL, dialAng);
    var el = svgEl('text', {
      x: np[0], y: np[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'Cinzel, serif', 'font-size': size, fill: fill
    });
    el.textContent = label;
    fragL.appendChild(el);
  }

  /* Numbered liturgical hours along an arc: gilt for the day's twelve,
   * blue for the night's twelve. */
  function liturgicalNumerals(fragL, arc, fill) {
    for (var k = 1; k < 12; k++) {
      var ang = arc.from + (k / 12) * arc.span;
      var gp = polar(R_LITURGICAL, ang);
      var lit = svgEl('text', {
        x: gp[0], y: gp[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Cinzel, serif', 'font-size': 12, fill: fill
      });
      lit.textContent = ROMAN[k % 12];
      fragL.appendChild(lit);
    }
  }

  /* ---- The year ring: the wheel of the year ------------------------------
   * An inner annulus where each of the eight festivals sits at its
   * calendar angle, carrying that day's true daylight arc drawn on a
   * fixed mini 24-hour dial (noon at top) — so the DST jump shows as a
   * discontinuity and the seasons breathe even on the liturgical basis.
   */
  function dayOfYearFraction(d) {
    var start = new Date(d.getFullYear(), 0, 1);
    return (new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000 / 365;
  }

  function miniAngle(t) {
    var noon = HA.wallNoon(t).getTime();
    var off = (t - noon) % 86400000;
    if (off < 0) off += 86400000;
    return off / 86400000 * 360;
  }

  function buildYearRing(fragT, fragL) {
    var year = viewDate.getFullYear();
    var wheel = HA.festivalWheel();
    var nearest = null;

    wheel.forEach(function (f) {
      var fdate = HA.festivalDate(f, year);
      var calAng = dayOfYearFraction(fdate) * 360;
      var spoke = polar(R_YEAR - R_YEAR_W / 2, calAng), spoke2 = polar(R_YEAR + R_YEAR_W / 2 + 5, calAng);
      fragT.appendChild(svgEl('line', {
        x1: spoke[0], y1: spoke[1], x2: spoke2[0], y2: spoke2[1],
        stroke: '#a4834a', 'stroke-width': 1
      }));
      var lp = polar(R_FESTIVAL, calAng);
      var label = svgEl('text', {
        x: lp[0], y: lp[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Cinzel, serif', 'font-size': 9,
        fill: '#6b4a1e', 'class': 'festival-label', 'data-name': f.name
      });
      label.textContent = f.name;
      fragL.appendChild(label);

      var day = HA.computeDay(fdate, parseFloat(els.lat.value), parseFloat(els.lon.value));
      if (isNaN(day.sunrise.getTime()) || isNaN(day.sunset.getTime())) return;
      var from = miniAngle(day.sunrise.getTime());
      var to = miniAngle(day.sunset.getTime());
      fragT.appendChild(svgEl('path', {
        d: arcPath(R_YEAR, from, to),
        fill: 'none', stroke: '#e8c96f', 'stroke-width': R_YEAR_W,
        'stroke-opacity': 0.55, 'stroke-linecap': 'round'
      }));
    });
  }

  function buildTrail(fragT) {
    /* the ghost trail: sunrise/sunset marks for the eight festival days,
     * drawn where the current basis places them */
    var year = viewDate.getFullYear();
    HA.festivalWheel().forEach(function (f) {
      var fdate = HA.festivalDate(f, year);
      var day = HA.computeDay(fdate, parseFloat(els.lat.value), parseFloat(els.lon.value));
      if (isNaN(day.sunrise.getTime()) || isNaN(day.sunset.getTime())) return;
      var bounds = HA.arcBounds(day, mode);
      if (!bounds) return;
      [bounds.day.from, bounds.day.to].forEach(function (ang) {
        var t1 = polar(R_TRAIL_IN, ang), t2 = polar(R_TRAIL_OUT, ang);
        fragT.appendChild(svgEl('line', {
          x1: t1[0], y1: t1[1], x2: t2[0], y2: t2[1],
          stroke: '#b8860b', 'stroke-width': 1.6, 'stroke-dasharray': '3 3', 'stroke-opacity': 0.8
        }));
      });
    });
  }

  function buildStatic() {
    els.ticks.innerHTML = '';
    els.labels.innerHTML = '';

    var canonicalAngles = {};
    if (mode === 'clock24') {
      var day = HA.computeDay(viewNow(), parseFloat(els.lat.value), parseFloat(els.lon.value));
      if (day && !isNaN(day.solarNoon.getTime())) {
        HA.canonicalHours(day).forEach(function (h) {
          if (h.clockAngle != null) canonicalAngles[Math.round(h.clockAngle)] = h.name;
        });
      }
    } else {
      // temporal dial angles = hour angle - 90 (0° = top = solar noon):
      // Lauds 270 (left horizontal), Sext 0 (top), Vespers 90 (right
      // horizontal), Matins 225 (bottom-left third of the night quarter)
      canonicalAngles = { 0: 'Sext', 45: 'None', 90: 'Vespers', 135: 'Compline', 225: 'Matins', 270: 'Lauds', 285: 'Prime', 315: 'Terce' };
    }

    var fragT = document.createDocumentFragment();
    var fragL = document.createDocumentFragment();

    // minor ticks in both modes
    for (var a = 0; a < 360; a += 15) {
      var major = a % 90 === 0;
      var p1 = polar(R_TICK_IN, a), p2 = polar(major ? R_MAJOR_OUT : R_TICK_OUT, a);
      fragT.appendChild(svgEl('line', {
        x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
        stroke: major ? '#5b3a1e' : '#8a6a35',
        'stroke-width': major ? 2.2 : 1,
        'stroke-dasharray': major ? '' : '3 3'
      }));
    }

    var loc = getLocation();
    var day = HA.computeDay(viewNow(), loc.lat, loc.lon);
    var valid = day && !isNaN(day.solarNoon.getTime()) && !isNaN(day.sunrise.getTime());
    var bounds = valid ? HA.arcBounds(day, mode) : null;

    if (mode === 'clock24') {
      /* Stopwatch basis: the equal hours of the clock are the fixed scale.
       * 15° of dial = one clock hour, so 6am/6pm sit on the horizontal axis.
       * Lauds/Vespers and the gilt liturgical twelve anchor to true dawn/dusk,
       * so the sunlight area grows or shrinks with the day. */
      for (var c = 0; c < 360; c += 30) {
        numeral(fragL, c, clockDigit(((c / 15) + 12) % 24), '#5b3a1e', 12);
      }
      if (bounds) {
        HA.stopwatchTicks(day, mode).forEach(function (d) {
          var s1 = polar(R_STOPWATCH_IN, d), s2 = polar(R_STOPWATCH_OUT, d);
          fragT.appendChild(svgEl('line', {
            x1: s1[0], y1: s1[1], x2: s2[0], y2: s2[1],
            stroke: '#b8860b', 'stroke-width': 2, 'stroke-dasharray': '2 4'
          }));
        });
        liturgicalNumerals(fragL, bounds.day, '#a07310');
        liturgicalNumerals(fragL, bounds.night, '#5d7db0');
      }
      buildTrail(fragT);
      els.legend.innerHTML = 'Stopwatch basis — the <span class="legend-ink">equal hours of the clock</span> stand fast ' +
        '(6 and 6 on the horizontal); the <span class="legend-gold">gilt liturgical hours</span> anchor to ' +
        'true dawn and dusk, so the sunlight area shrinks and grows.';
    } else {
      /* Liturgical basis: the gilt twelve stand fast (six per quadrant,
       * Lauds at 9 o'clock, Sext at the top, Vespers at 3 o'clock) and the
       * ink clock hours stretch around them, sliding with the season. */
      var fixedBounds = HA.arcBounds(day, 'temporal');
      liturgicalNumerals(fragL, fixedBounds.day, '#a07310');
      liturgicalNumerals(fragL, fixedBounds.night, '#5d7db0');
      if (valid) {
        for (var h = 0; h < 24; h++) {
          var t = new Date(viewDate.getTime());
          t.setHours(h, 0, 0, 0);
          var dial = HA.dialAngleFor(t.getTime(), day, 'temporal');
          if (dial != null) numeral(fragL, dial, clockDigit(h), '#8a6a35', 10);
        }
      }
      els.legend.innerHTML = 'Liturgical basis — the <span class="legend-gold">gilt liturgical hours</span> stand fast ' +
        '(Lauds at dawn\'s place, Sext at the top, Vespers at dusk\'s); the ' +
        '<span class="legend-ink">ink clock hours</span> stretch and slide with the sun, ' +
        'and the inner wheel carries each festival\'s true daylight.';
    }

    buildYearRing(fragT, fragL);

    // canonical hour names, upright, just inside the outer ring, both modes
    Object.keys(canonicalAngles).forEach(function (k) {
      var ang = parseFloat(k), name = canonicalAngles[k];
      var lp = polar(R_LABEL, ang);
      var text = svgEl('text', {
        x: lp[0], y: lp[1], 'text-anchor': 'middle', 'dominant-baseline': 'middle',
        'font-family': 'Cinzel, serif',
        'font-size': ang % 90 === 0 ? 17 : 13,
        'font-weight': ang % 90 === 0 ? 'bold' : 'normal',
        fill: ang % 90 === 0 ? '#9e2b25' : '#5b3a1e',
        'class': 'hour-label'
      });
      text.textContent = name;
      fragL.appendChild(text);
    });

    els.ticks.appendChild(fragT);
    els.labels.appendChild(fragL);
    drawArcs();
  }

  function updateYearRing() {
    var ang = dayOfYearFraction(viewDate) * 360;
    var p = polar(R_YEAR, ang);
    els.yearMarker.setAttribute('cx', p[0]);
    els.yearMarker.setAttribute('cy', p[1]);
    els.yearMarker.setAttribute('visibility', 'visible');
    var fest = HA.nextFestival(viewNow());
    if (fest) {
      var plural = fest.daysUntil === 1 ? 'day' : 'days';
      els.festival.textContent = fest.name + ' kindles in ' + fest.daysUntil + ' ' + plural +
        ' — ' + fest.note + '.';
    }
    var labels = els.labels.querySelectorAll('.festival-label');
    labels.forEach(function (l) {
      l.setAttribute('fill', l.getAttribute('data-name') === (fest && fest.name) ? '#9e2b25' : '#6b4a1e');
      l.setAttribute('font-weight', l.getAttribute('data-name') === (fest && fest.name) ? 'bold' : 'normal');
    });
  }

  /* The effective "now": the chosen day, at the current wall-clock time. */
  function viewNow() {
    var now = new Date();
    var sameDay = viewDate.getFullYear() === now.getFullYear() &&
      viewDate.getMonth() === now.getMonth() &&
      viewDate.getDate() === now.getDate();
    if (sameDay) return now;
    var t = new Date(viewDate.getTime());
    t.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    return t;
  }

  function dayOfYearIndex(d) {
    var start = new Date(d.getFullYear(), 0, 1);
    return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - start) / 86400000);
  }

  function dateFromDayIndex(year, idx) {
    return new Date(year, 0, 1 + idx);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function syncViewUI() {
    var idx = dayOfYearIndex(viewDate);
    els.yearSlider.value = String(idx);
    els.day.value = viewDate.getFullYear() + '-' +
      String(viewDate.getMonth() + 1).padStart(2, '0') + '-' +
      String(viewDate.getDate()).padStart(2, '0');
    els.yearLabel.textContent = MONTHS[viewDate.getMonth()] + ' ' + viewDate.getDate() +
      (idx === dayOfYearIndex(new Date()) ? '' : ' · ' + Math.round(HA.dayFraction(HA.computeDay(viewDate, parseFloat(els.lat.value), parseFloat(els.lon.value))) * 24) + ' h daylight');
  }

  function refresh(animate) {
    if (animate === undefined) animate = true;
    buildStatic();
    render();
    syncViewUI();
  }

  function drawArcs() {
    var day = HA.computeDay(viewNow(), parseFloat(els.lat.value), parseFloat(els.lon.value));
    var bounds = (day && !isNaN(day.sunrise.getTime()) && !isNaN(day.sunset.getTime()))
      ? HA.arcBounds(day, mode) : { day: { from: 270, to: 90 }, night: { from: 90, to: 270 } };
    els.arcDay.setAttribute('d', arcPath(R_ARC, bounds.day.from, bounds.day.to));
    els.arcNight.setAttribute('d', arcPath(R_ARC, bounds.night.from, bounds.night.to));
  }

  function getLocation() {
    return {
      lat: parseFloat(els.lat.value),
      lon: parseFloat(els.lon.value)
    };
  }

  function showError(msg) {
    els.error.hidden = false;
    els.error.textContent = msg;
  }

  function clearError() {
    els.error.hidden = true;
    els.error.textContent = '';
  }

  function render() {
    var loc = getLocation();
    if (isNaN(loc.lat) || isNaN(loc.lon)) return;
    clearError();

    var day = HA.computeDay(viewNow(), loc.lat, loc.lon);
    if (isNaN(day.sunrise.getTime()) || isNaN(day.sunset.getTime()) || isNaN(day.solarNoon.getTime())) {
      showError('The sun keeps no hours here — perhaps this latitude lies beyond his realm.');
      return;
    }

    var state = HA.hourState(viewNow().getTime(), day, mode);
    if (!state) {
      showError('The hour cannot be read — the sun is on the other side of the world.');
      return;
    }

    els.pointer.setAttribute('transform', 'rotate(' + dialToRotation(state.dialAngle) + ' ' + CX + ' ' + CY + ')');
    els.quadrantName.textContent = state.quadrant +
      (mode === 'clock24' ? ' · daylight ' + Math.round(HA.dayFraction(day) * 24) + ' h' : '');
    els.nowName.textContent = state.current.name;
    els.nowNote.textContent = state.current.note ? ' — ' + state.current.note : '';
    els.nowRemaining.textContent = 'The ' + state.next.name + ' sounds in ' +
      HA.fmtDuration(state.msUntilNext) + '.';

    var rows = HA.canonicalHours(day).sort(function (a, b) {
      return (mode === 'clock24' ? a.clockAngle - b.clockAngle : a.angle - b.angle);
    });
    els.tableBody.innerHTML = '';
    rows.forEach(function (h) {
      var tr = document.createElement('tr');
      if (h === state.current) tr.className = 'current-row';
      var tdN = document.createElement('td');
      tdN.className = 'hour-name';
      tdN.textContent = h.name;
      var tdNote = document.createElement('td');
      tdNote.className = 'hour-note';
      tdNote.textContent = h.note || '';
      var tdT = document.createElement('td');
      tdT.textContent = HA.fmtClock(h.at);
      tr.appendChild(tdN); tr.appendChild(tdNote); tr.appendChild(tdT);
      els.tableBody.appendChild(tr);
    });

    updateYearRing();
  }

  function saveLoc() {
    var loc = getLocation();
    if (!isNaN(loc.lat) && !isNaN(loc.lon)) {
      localStorage.setItem('horae.lat', String(loc.lat));
      localStorage.setItem('horae.lon', String(loc.lon));
    }
  }

  function setMode(newMode) {
    if (newMode === mode) return;
    mode = newMode;
    localStorage.setItem('horae.mode', mode);
    els.modeTemporal.classList.toggle('active', mode === 'temporal');
    els.modeClock24.classList.toggle('active', mode === 'clock24');
    buildStatic();
    render();
  }

  function init() {
    var savedLat = parseFloat(localStorage.getItem('horae.lat'));
    var savedLon = parseFloat(localStorage.getItem('horae.lon'));
    if (!isNaN(savedLat) && !isNaN(savedLon)) {
      els.lat.value = savedLat; els.lon.value = savedLon;
    } else {
      els.lat.value = 32.716; els.lon.value = -117.161;
    }

    var savedMode = localStorage.getItem('horae.mode');
    if (savedMode === 'clock24' || savedMode === 'temporal') mode = savedMode;
    els.modeTemporal.classList.toggle('active', mode === 'temporal');
    els.modeClock24.classList.toggle('active', mode === 'clock24');

    buildStatic();

    [els.lat, els.lon].forEach(function (el) {
      el.addEventListener('change', function () { saveLoc(); if (mode === 'clock24') { buildStatic(); } render(); });
    });

    els.modeTemporal.addEventListener('click', function () { setMode('temporal'); });
    els.modeClock24.addEventListener('click', function () { setMode('clock24'); });

    els.day.addEventListener('change', function () {
      if (!els.day.value) return;
      viewDate = new Date(els.day.value + 'T12:00:00');
      if (!isNaN(viewDate.getTime())) refresh();
    });

    els.today.addEventListener('click', function () {
      viewDate = new Date();
      refresh();
    });

    els.yearSlider.addEventListener('input', function () {
      viewDate = dateFromDayIndex(viewDate.getFullYear(), parseInt(els.yearSlider.value, 10));
      refresh();
    });

    els.play.addEventListener('click', function () {
      if (playing) { stopPlaying(); return; }
      playing = true;
      els.play.textContent = '❚❚ Pause the year';
      playTimer = setInterval(function () {
        var idx = dayOfYearIndex(viewDate) + 1;
        if (idx > 364) { stopPlaying(); return; }
        viewDate = dateFromDayIndex(viewDate.getFullYear(), idx);
        refresh();
      }, 90);
    });

    function stopPlaying() {
      playing = false;
      clearInterval(playTimer);
      els.play.textContent = '▶ Scrub the year';
    }

    els.geo.addEventListener('click', function () {
      if (!navigator.geolocation) {
        showError('This device knows not where it stands — enter the latitude and longitude by hand.');
        return;
      }
      navigator.geolocation.getCurrentPosition(function (pos) {
        els.lat.value = pos.coords.latitude.toFixed(3);
        els.lon.value = pos.coords.longitude.toFixed(3);
        saveLoc();
        clearError();
        if (mode === 'clock24') buildStatic();
        render();
      }, function () {
        showError('The place could not be found — enter the latitude and longitude by hand.');
      });
    });

    render();
    syncViewUI();
    setInterval(render, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
