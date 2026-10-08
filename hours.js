/*
 * hours.js — pure hour-angle math, shared by the browser UI and node tests.
 *
 * The day is divided into four quarters, each rendered as a 90-degree
 * quadrant of the dial (one "temporal" sixth-hour per 15 degrees):
 *   0 = sunrise, 90 = solar noon, 180 = sunset, 270 = nadir.
 * Canonical hours sit at fixed angles within their quarter.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('suncalc'));
  } else {
    root.HourAngles = factory(root.SunCalc);
  }
})(typeof self !== 'undefined' ? self : this, function (SunCalc) {
  'use strict';

  var QUADRANTS = {
    morning: { start: 0, end: 90, label: 'Morning' },
    afternoon: { start: 90, end: 180, label: 'Afternoon' },
    evening: { start: 180, end: 270, label: 'Evening' },
    night: { start: 270, end: 360, label: 'Night' }
  };

  function computeDay(date, lat, lon) {
    var today = SunCalc.getTimes(date, lat, lon);
    var tomorrow = SunCalc.getTimes(new Date(date.getTime() + 24 * 3600 * 1000), lat, lon);
    return {
      date: date,
      sunrise: today.sunrise,
      solarNoon: today.solarNoon,
      sunset: today.sunset,
      nadir: today.nadir,
      nadirTomorrow: tomorrow.nadir
    };
  }

  /* Ported from the original index.js quadrant logic. */
  function angleFor(now, day) {
    var sunrise = day.sunrise.getTime();
    var noon = day.solarNoon.getTime();
    var sunset = day.sunset.getTime();
    var nadirTomorrow = day.nadirTomorrow.getTime();

    if (now < sunrise) {
      // nadir (today, already past) -> sunrise
      return ratioAngle(now, day.nadir.getTime(), sunrise, 270);
    } else if (now < noon) {
      return ratioAngle(now, sunrise, noon, 0);
    } else if (now < sunset) {
      return ratioAngle(now, noon, sunset, 90);
    } else if (now < nadirTomorrow) {
      return ratioAngle(now, sunset, nadirTomorrow, 180);
    }
    return null;
  }

  function ratioAngle(now, start, end, offset) {
    var ratio = (now - start) / (end - start);
    if (!isFinite(ratio) || ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    return offset + ratio * 90;
  }

  function quadrantFor(angle) {
    if (angle == null) return null;
    if (angle < 90) return 'morning';
    if (angle < 180) return 'afternoon';
    if (angle < 270) return 'evening';
    if (angle < 360) return 'night';
    return null;
  }

  /*
   * Canonical hours on the temporal clock. Daylight is divided into
   * twelve unequal hours (six per quadrant above), the night likewise.
   */
  function canonicalHours(day) {
    return [
      { name: 'Lauds', angle: 0, at: day.sunrise, note: 'at dawn' },
      { name: 'Prime', angle: 15, at: timeAtAngle(day, 15) },
      { name: 'Terce', angle: 45, at: timeAtAngle(day, 45) },
      { name: 'Sext', angle: 90, at: day.solarNoon, note: 'at noon' },
      { name: 'None', angle: 135, at: timeAtAngle(day, 135) },
      { name: 'Vespers', angle: 180, at: day.sunset, note: 'at dusk' },
      { name: 'Compline', angle: 225, at: timeAtAngle(day, 225) },
      { name: 'Matins', angle: 315, at: timeAtAngle(day, 315), note: 'the night office' }
    ];
  }

  function timeAtAngle(day, angle) {
    var q = Math.floor(angle / 90) % 4;
    var start, end;
    if (q === 0) { start = day.sunrise; end = day.solarNoon; }
    else if (q === 1) { start = day.solarNoon; end = day.sunset; }
    else if (q === 2) { start = day.sunset; end = day.nadirTomorrow; }
    else { start = day.nadir; end = day.sunrise; }
    var t = start.getTime() + ((angle - q * 90) / 90) * (end.getTime() - start.getTime());
    return new Date(t);
  }

  /* Nearest canonical hour at or before `now`, plus the next one. */
  function hourState(now, day) {
    var angle = angleFor(now, day);
    if (angle == null) return null;
    var hours = canonicalHours(day).sort(function (a, b) { return a.angle - b.angle; });
    var prev = null, next = null;
    for (var i = 0; i < hours.length; i++) {
      if (hours[i].angle <= angle) prev = hours[i];
      else { next = hours[i]; break; }
    }
    if (!prev) {
      // before Lauds: wrap to Matins of the previous cycle
      prev = hours[hours.length - 1];
    }
    if (!next) next = Object.assign({}, hours[0], { angle: 360, at: new Date(day.sunrise.getTime() + 24 * 3600 * 1000) });
    return {
      angle: angle,
      quadrant: QUADRANTS[quadrantFor(angle)].label,
      current: prev,
      next: next,
      msIntoHour: now - timeAtAngle(day, prev.angle).getTime(),
      msUntilNext: next.at.getTime() - now
    };
  }

  function fmtClock(d) {
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function fmtDuration(ms) {
    if (ms == null || ms < 0) return '—';
    var m = Math.floor(ms / 60000);
    var h = Math.floor(m / 60);
    m = m % 60;
    if (h >= 48) return Math.round(h / 24) + ' days';
    if (h >= 1) return h + ' h ' + m + ' min';
    return m + ' min';
  }

  return {
    QUADRANTS: QUADRANTS,
    computeDay: computeDay,
    angleFor: angleFor,
    quadrantFor: quadrantFor,
    canonicalHours: canonicalHours,
    timeAtAngle: timeAtAngle,
    hourState: hourState,
    fmtClock: fmtClock,
    fmtDuration: fmtDuration
  };
});
