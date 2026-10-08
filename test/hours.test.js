/* test/hours.test.js — smallest real check for the hour-angle math. */
const assert = require('assert');
const HA = require('../hours.js');

// fixed local date in San Diego (repo default): 2026-10-08 ~15:30 local
const LAT = 32.716, LON = -117.161;
const now = new Date('2026-10-08T22:30:00Z');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log('ok   -', name); }
  catch (e) { failures++; console.log('FAIL -', name, '\n      ', e.message); }
}

test('computeDay returns finite times in order', () => {
  const d = HA.computeDay(now, LAT, LON);
  assert(d.sunrise < d.solarNoon && d.solarNoon < d.sunset && d.sunset < d.nadirTomorrow);
  assert(d.nadir < d.sunrise);
});

test('angle is 0 at sunrise, 90 at noon, 180 at sunset', () => {
  const d = HA.computeDay(now, LAT, LON);
  assert.ok(Math.abs(HA.angleFor(d.sunrise.getTime() + 1, d)) < 1);
  assert.ok(Math.abs(HA.angleFor(d.solarNoon.getTime(), d) - 90) < 1);
  assert.ok(Math.abs(HA.angleFor(d.sunset.getTime(), d) - 180) < 1);
});

test('angle runs 270..360 between nadir and sunrise', () => {
  const d = HA.computeDay(now, LAT, LON);
  const mid = (d.nadir.getTime() + d.sunrise.getTime()) / 2;
  const a = HA.angleFor(mid, d);
  assert.ok(a > 270 && a < 360, 'angle=' + a);
});

test('quadrant labels match the original index.js scheme', () => {
  assert.strictEqual(HA.quadrantFor(10), 'morning');
  assert.strictEqual(HA.quadrantFor(100), 'afternoon');
  assert.strictEqual(HA.quadrantFor(200), 'evening');
  assert.strictEqual(HA.quadrantFor(300), 'night');
});

test('canonical hours land at sensible clock times', () => {
  const d = HA.computeDay(now, LAT, LON);
  const hours = HA.canonicalHours(d);
  const byName = Object.fromEntries(hours.map(h => [h.name, h]));
  assert.ok(Math.abs(byName.Sext.at.getTime() - d.solarNoon.getTime()) < 1000);
  assert.ok(Math.abs(byName.Lauds.at.getTime() - d.sunrise.getTime()) < 1000);
  assert.ok(Math.abs(byName.Vespers.at.getTime() - d.sunset.getTime()) < 1000);
  // None must fall between noon and sunset
  assert.ok(byName.None.at > d.solarNoon && byName.None.at < d.sunset);
  // Terce between sunrise and noon
  assert.ok(byName.Terce.at > d.sunrise && byName.Terce.at < d.solarNoon);
  // Compline in the evening quarter (sunset..nadir)
  assert.ok(byName.Compline.at > d.sunset && byName.Compline.at < d.nadirTomorrow);
});

test('hourState reports the current hour and next hour', () => {
  const d = HA.computeDay(now, LAT, LON);
  const st = HA.hourState(now, d);
  assert.ok(st.angle >= 0 && st.angle < 360, 'angle=' + st.angle);
  assert.ok(st.current && st.next && st.current.name !== st.next.name);
  assert.ok(st.msUntilNext >= 0);
  // at exactly sunset the current hour must be Vespers
  const st2 = HA.hourState(d.sunset.getTime(), d);
  assert.strictEqual(st2.current.name, 'Vespers');
  assert.strictEqual(st2.angle, 180);
});

test('near-polar location yields a readable error path (NaN sun times)', () => {
  const d = HA.computeDay(now, 89.9, 0);
  assert.ok(isNaN(d.sunrise.getTime()) || isNaN(d.sunset.getTime()));
});

// ---- 24-hour clock mode ----

test('clock24: dial angle is 0 at solar noon, 270 at sunrise on a 12h day', () => {
  const d = HA.computeDay(now, LAT, LON);
  assert.ok(Math.abs(HA.clockAngleFor(d.solarNoon.getTime(), d)) < 0.001);
  // October in San Diego: day < 12h, so sunrise dial angle must sit past 270
  const sr = HA.clockAngleFor(d.sunrise.getTime(), d);
  assert.ok(sr > 270 || sr < 90, 'sunrise dial angle=' + sr);
  assert.ok(HA.dialAngleFor(d.solarNoon.getTime(), d, 'clock24') < 0.001);
});

test('clock24: exactly 50% day reproduces the temporal layout', () => {
  // synthetic day: sunrise 06:00Z, noon 12:00Z, sunset 18:00Z, nadir 00:00Z(+1)
  const d = {
    sunrise: new Date('2026-10-08T06:00:00Z'),
    solarNoon: new Date('2026-10-08T12:00:00Z'),
    sunset: new Date('2026-10-08T18:00:00Z'),
    nadir: new Date('2026-10-08T00:00:00Z'),
    nadirTomorrow: new Date('2026-10-09T00:00:00Z')
  };
  assert.strictEqual(HA.dayFraction(d), 0.5);
  assert.strictEqual(HA.clockAngleFor(d.sunrise.getTime(), d), 270);
  assert.strictEqual(HA.clockAngleFor(d.sunset.getTime(), d), 90);
  // temporal dial angles must agree at the quarter pivots
  assert.strictEqual(HA.dialAngleFor(d.sunrise.getTime(), d, 'temporal'), 270);
  assert.strictEqual(HA.dialAngleFor(d.solarNoon.getTime(), d, 'temporal'), 0);
  assert.strictEqual(HA.dialAngleFor(d.sunset.getTime(), d, 'temporal'), 90);
  const a2 = HA.dialAngleFor(d.sunset.getTime() + 1000, d, 'clock24');
  assert.ok(Math.abs(a2 - (90 + 1000 / 86400000 * 360)) < 1e-9, 'a2=' + a2);
});

test('clock24: long day stretches past 9 and 3 o clock, night shrinks', () => {
  const d = {
    sunrise: new Date('2026-06-21T04:00:00Z'),
    solarNoon: new Date('2026-06-21T12:00:00Z'),
    sunset: new Date('2026-06-21T20:00:00Z'),
    nadir: new Date('2026-06-21T00:00:00Z'),
    nadirTomorrow: new Date('2026-06-22T00:00:00Z')
  };
  assert.ok(Math.abs(HA.dayFraction(d) - 16 / 24) < 1e-9);
  const b = HA.arcBounds(d, 'clock24');
  assert.ok(Math.abs(b.day.span - 240) < 1e-6, 'day span=' + b.day.span);
  assert.ok(Math.abs(b.night.span - 120) < 1e-6, 'night span=' + b.night.span);
  // sunrise sits at 240 (past the 270 of a 12h day), sunset at 120
  assert.ok(Math.abs(b.day.from - 240) < 1e-6 && Math.abs(b.day.to - 120) < 1e-6);
  // temporal arcs stay fixed at the half-dial
  const bt = HA.arcBounds(d, 'temporal');
  assert.strictEqual(bt.day.span, 180);
  assert.strictEqual(bt.night.span, 180);
});

test('clock24: hourState tracks offices by true clock offset', () => {
  const d = {
    sunrise: new Date('2026-10-08T06:00:00Z'),
    solarNoon: new Date('2026-10-08T12:00:00Z'),
    sunset: new Date('2026-10-08T18:00:00Z'),
    nadir: new Date('2026-10-08T00:00:00Z'),
    nadirTomorrow: new Date('2026-10-09T00:00:00Z')
  };
  // exactly noon -> current office is Sext
  const atNoon = HA.hourState(d.solarNoon.getTime(), d, 'clock24');
  assert.strictEqual(atNoon.current.name, 'Sext');
  assert.strictEqual(atNoon.quadrant, 'Day');
  assert.strictEqual(atNoon.dialAngle, 0);
  // late evening (23:00Z) -> current Compline, next Matins
  const late = HA.hourState(new Date('2026-10-08T23:00:00Z').getTime(), d, 'clock24');
  assert.strictEqual(late.current.name, 'Compline');
  assert.strictEqual(late.next.name, 'Matins');
  assert.strictEqual(late.quadrant, 'Night');
  assert.ok(late.msUntilNext > 0);
  // canonical hours carry clock angles in both modes
  const hours = HA.canonicalHours(d);
  const sext = hours.find(h => h.name === 'Sext');
  assert.strictEqual(sext.clockAngle, 0);
});

process.exit(failures ? 1 : 0);
