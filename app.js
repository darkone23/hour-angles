/* app.js — DOM wiring for the Horæ dial. Pure math lives in hours.js. */
(function () {
  'use strict';

  var HA = window.HourAngles;
  var CX = 240, CY = 240, R_TICK_IN = 180, R_TICK_OUT = 168, R_MAJOR_OUT = 158;

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
    nowName: document.getElementById('now-hour-name'),
    nowNote: document.getElementById('now-hour-note'),
    nowRemaining: document.getElementById('now-remaining'),
    tableBody: document.getElementById('hours-table-body')
  };

  /* angle (hour angle 0=sunrise) -> SVG rotation for the pointer. */
  function angleToRotation(angle) {
    return angle - 90; // sunrise at 9 o'clock, noon at 12, sunset at 3
  }

  function polar(r, deg) {
    var rad = (deg - 90) * Math.PI / 180; // 0deg = 12 o'clock, clockwise
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  }

  function arcPath(r, fromDeg, toDeg) {
    var a = polar(r, fromDeg), b = polar(r, toDeg);
    var large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    var sweep = toDeg > fromDeg ? 1 : 0;
    return 'M ' + a[0] + ' ' + a[1] + ' A ' + r + ' ' + r + ' 0 ' + large + ' ' + sweep + ' ' + b[0] + ' ' + b[1];
  }

  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  var CANONICAL = { 0: 'Lauds', 15: 'Prime', 45: 'Terce', 90: 'Sext', 135: 'None', 180: 'Vespers', 225: 'Compline', 315: 'Matins' };

  function buildStatic() {
    var fragT = document.createDocumentFragment();
    var fragL = document.createDocumentFragment();
    for (var a = 0; a < 360; a += 15) {
      var major = a % 45 === 0;
      var canonical = CANONICAL[a];
      var rOut = major ? R_MAJOR_OUT : R_TICK_OUT;
      var p1 = polar(R_TICK_IN, a - 90), p2 = polar(rOut, a - 90);
      fragT.appendChild(svgEl('line', {
        x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1],
        stroke: major ? '#5b3a1e' : '#8a6a35',
        'stroke-width': major ? 2.2 : 1,
        'stroke-dasharray': major ? '' : '3 3'
      }));
      var lp = polar(rOut - 14, a - 90);
      if (canonical) {
        var text = svgEl('text', {
          x: lp[0], y: lp[1],
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-family': 'Cinzel, serif',
          'font-size': a % 90 === 0 ? 17 : 13,
          'font-weight': a % 90 === 0 ? 'bold' : 'normal',
          fill: a % 90 === 0 ? '#9e2b25' : '#5b3a1e',
          transform: 'rotate(' + (a > 180 ? -12 : 12) + ' ' + lp[0] + ' ' + lp[1] + ')'
        });
        text.textContent = canonical;
        fragL.appendChild(text);
      } else {
        var numeral = svgEl('text', {
          x: lp[0], y: lp[1],
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-family': 'Cinzel, serif',
          'font-size': 11,
          fill: '#8a6a35'
        });
        numeral.textContent = ['I', 'II', 'III', 'IV', 'V'][(a / 15) % 6 - 1];
        fragL.appendChild(numeral);
      }
    }
    els.ticks.appendChild(fragT);
    els.labels.appendChild(fragL);
    els.arcDay.setAttribute('d', arcPath(R_TICK_IN + 15, -90 + 0 - 0, 90));  // sunrise..sunset (upper half)
    els.arcNight.setAttribute('d', arcPath(R_TICK_IN + 15, 90, 270));        // sunset..sunrise (lower half)
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

    var day = HA.computeDay(new Date(), loc.lat, loc.lon);
    if (isNaN(day.sunrise.getTime()) || isNaN(day.sunset.getTime())) {
      showError('The sun keeps no hours here — perhaps this latitude lies beyond his realm.');
      return;
    }

    var state = HA.hourState(new Date(), day);
    if (!state) {
      showError('The hour cannot be read — the sun is on the other side of the world.');
      return;
    }

    var rot = angleToRotation(state.angle);
    els.pointer.setAttribute('transform', 'rotate(' + rot + ' ' + CX + ' ' + CY + ')');
    els.quadrantName.textContent = state.quadrant;
    els.nowName.textContent = state.current.name;
    els.nowNote.textContent = state.current.note ? ' — ' + state.current.note : '';
    els.nowRemaining.textContent = 'The ' + state.next.name + ' sounds in ' +
      HA.fmtDuration(state.msUntilNext) + '.';

    var rows = HA.canonicalHours(day).sort(function (a, b) { return a.angle - b.angle; });
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
  }

  function saveLoc() {
    var loc = getLocation();
    if (!isNaN(loc.lat) && !isNaN(loc.lon)) {
      localStorage.setItem('horae.lat', String(loc.lat));
      localStorage.setItem('horae.lon', String(loc.lon));
    }
  }

  function init() {
    buildStatic();

    var savedLat = parseFloat(localStorage.getItem('horae.lat'));
    var savedLon = parseFloat(localStorage.getItem('horae.lon'));
    if (!isNaN(savedLat) && !isNaN(savedLon)) {
      els.lat.value = savedLat; els.lon.value = savedLon;
    } else {
      els.lat.value = 32.716; els.lon.value = -117.161;
    }

    [els.lat, els.lon].forEach(function (el) {
      el.addEventListener('change', function () { saveLoc(); render(); });
    });

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
        render();
      }, function () {
        showError('The place could not be found — enter the latitude and longitude by hand.');
      });
    });

    render();
    setInterval(render, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
