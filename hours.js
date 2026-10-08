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

  /* ---- 24-hour clock mode -------------------------------------------------
   * Solar noon is pinned to the top of the dial (0°, clockwise). The daylight
   * arc stretches/shrinks symmetrically around it with the true day length:
   * a 12-hour day fills exactly the top half (as in temporal mode), a longer
   * day stretches past 9 and 3 o'clock, a shorter day shrinks inside them.
   * dial angle convention everywhere: 0° = top (solar noon), clockwise.
   */
  function mod360(d) { return ((d % 360) + 360) % 360; }

  function dayFraction(day) {
    return (day.sunset.getTime() - day.sunrise.getTime()) / 86400000;
  }

  function clockAngleFor(now, day) {
    if (isNaN(day.solarNoon.getTime())) return null;
    var off = (now - day.solarNoon.getTime()) % 86400000;
    if (off < 0) off += 86400000;
    return off / 86400000 * 360;
  }

  /* Dial angle (0 = top, clockwise) for the given mode. */
  function dialAngleFor(now, day, mode) {
    if (mode === 'clock24') return clockAngleFor(now, day);
    var a = angleFor(now, day);
    if (a == null) return null;
    return mod360(a - 90);
  }

  /* Day/night arc bounds in dial angles, drawn clockwise from `from`. */
  function arcBounds(day, mode) {
    if (mode === 'clock24') {
      if (isNaN(day.solarNoon.getTime())) return null;
      var sunriseDial = clockAngleFor(day.sunrise.getTime(), day);
      var sunsetDial = clockAngleFor(day.sunset.getTime(), day);
      return {
        day: { from: sunriseDial, to: sunsetDial, span: mod360(sunsetDial - sunriseDial) },
        night: { from: sunsetDial, to: sunriseDial, span: mod360(sunriseDial - sunsetDial) }
      };
    }
    return {
      day: { from: 270, to: 90, span: 180 },
      night: { from: 90, to: 270, span: 180 }
    };
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
    ].map(function (h) {
      h.clockAngle = clockAngleFor(h.at.getTime(), day);
      return h;
    });
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
  function hourState(now, day, mode) {
    if (mode === 'clock24') return hourStateClock24(now, day);
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
      dialAngle: mod360(angle - 90),
      quadrant: QUADRANTS[quadrantFor(angle)].label,
      current: prev,
      next: next,
      msIntoHour: now - timeAtAngle(day, prev.angle).getTime(),
      msUntilNext: next.at.getTime() - now
    };
  }

  /* 24-hour mode: offices ordered by their real offset from solar noon. */
  function hourStateClock24(now, day) {
    if (isNaN(day.solarNoon.getTime()) || isNaN(day.sunrise.getTime()) || isNaN(day.sunset.getTime())) return null;
    var noon = day.solarNoon.getTime();
    var nowOff = (now - noon) % 86400000;
    if (nowOff < 0) nowOff += 86400000;

    var hours = canonicalHours(day).map(function (h) {
      var off = (h.at.getTime() - noon) % 86400000;
      if (off < 0) off += 86400000;
      return { hour: h, off: off };
    }).sort(function (a, b) { return a.off - b.off; });

    var cur = null, nxt = null;
    for (var i = 0; i < hours.length; i++) {
      if (hours[i].off <= nowOff) cur = hours[i];
      else { nxt = hours[i]; break; }
    }
    if (!cur) cur = hours[hours.length - 1];   // wrap: latest office "yesterday"
    if (!nxt) nxt = hours[0];                  // wrap: earliest office "tomorrow"

    var sunriseOff = (day.sunrise.getTime() - noon) % 86400000;
    var sunsetOff = (day.sunset.getTime() - noon) % 86400000;
    if (sunriseOff < 0) sunriseOff += 86400000;
    if (sunsetOff < 0) sunsetOff += 86400000;
    // the day band may wrap midnight in offset space (short nights aside,
    // sunrise and sunset offsets straddle 0 whenever the band crosses 24h)
    var isDay = sunriseOff <= sunsetOff
      ? (nowOff >= sunriseOff && nowOff < sunsetOff)
      : (nowOff >= sunriseOff || nowOff < sunsetOff);

    return {
      angle: null,
      dialAngle: nowOff / 86400000 * 360,
      quadrant: isDay ? 'Day' : 'Night',
      current: cur.hour,
      next: nxt.hour,
      msIntoHour: (nowOff - cur.off + 86400000) % 86400000,
      msUntilNext: (nxt.off - nowOff + 86400000) % 86400000
    };
  }

  /*
   * Stopwatch (temporal) hour tick angles in dial degrees, for the given
   * mode. Temporal mode needs none here (its ticks are fixed 15-degree
   * spacing). Clock24 mode spreads the twelve daylight temporal hours
   * across the stretched day arc and the twelve night temporal hours
   * across the compressed night arc, so the spacing between the
   * stopwatch hours stretches or shrinks inversely with the arc share.
   */
  function stopwatchTicks(day, mode) {
    if (mode !== 'clock24') return [];
    var b = arcBounds(day, mode);
    if (!b) return [];
    var ticks = [];
    for (var k = 1; k < 12; k++) {
      ticks.push(b.day.from + (k / 12) * b.day.span);
      ticks.push(b.night.from + (k / 12) * b.night.span);
    }
    return ticks;
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
    clockAngleFor: clockAngleFor,
    dialAngleFor: dialAngleFor,
    dayFraction: dayFraction,
    arcBounds: arcBounds,
    stopwatchTicks: stopwatchTicks,
    canonicalHours: canonicalHours,
    timeAtAngle: timeAtAngle,
    hourState: hourState,
    fmtClock: fmtClock,
    fmtDuration: fmtDuration
  };
});
