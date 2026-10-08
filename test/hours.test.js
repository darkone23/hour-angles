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

test('clock24: wall-clock anchoring — 12:00 local at top, 6 and 18 on the horizontal', () => {
  const d = HA.computeDay(now, LAT, LON);
  const atLocal = (h) => { const t = new Date(); t.setHours(h, 0, 0, 0); return t.getTime(); };
  assert.ok(Math.abs(HA.clockAngleFor(atLocal(12), d)) < 0.001, 'wall noon=' + HA.clockAngleFor(atLocal(12), d));
  assert.ok(Math.abs(HA.clockAngleFor(atLocal(18), d) - 90) < 0.001);
  assert.ok(Math.abs(HA.clockAngleFor(atLocal(6), d) - 270) < 0.001);
  assert.ok(Math.abs(HA.clockAngleFor(atLocal(0), d) - 180) < 0.001);
  // sunrise must be placed at its own wall-clock position (not solar-anchored)
  const sr = HA.clockAngleFor(d.sunrise.getTime(), d);
  const srHour = d.sunrise.getHours() + (d.sunrise.getMinutes() + d.sunrise.getSeconds() / 60) / 60;
  const expect = (((srHour - 12) % 24) + 24) % 24 / 24 * 360;
  assert.ok(Math.abs(sr - expect) < 0.01, 'sr=' + sr + ' expect=' + expect);
});

// helper: synthetic day built in local time (TZ-independent)
function localDay(year, month, sunriseH, sunsetH) {
  const noonH = (sunriseH + sunsetH) / 2;
  return {
    sunrise: new Date(year, month, 8, sunriseH),
    solarNoon: new Date(year, month, 8, noonH),
    sunset: new Date(year, month, 8, sunsetH),
    nadir: new Date(year, month, 8, 0),
    nadirTomorrow: new Date(year, month, 9, 0)
  };
}

test('clock24: exactly 50% wall day reproduces the temporal layout', () => {
  const d = localDay(2026, 9, 6, 18); // sunrise 06:00, sunset 18:00 local
  assert.strictEqual(HA.dayFraction(d), 0.5);
  assert.strictEqual(HA.clockAngleFor(d.sunrise.getTime(), d), 270);
  assert.strictEqual(HA.clockAngleFor(d.sunset.getTime(), d), 90);
  assert.strictEqual(HA.dialAngleFor(d.sunrise.getTime(), d, 'temporal'), 270);
  assert.strictEqual(HA.dialAngleFor(d.solarNoon.getTime(), d, 'temporal'), 0);
  assert.strictEqual(HA.dialAngleFor(d.sunset.getTime(), d, 'temporal'), 90);
  const a2 = HA.dialAngleFor(d.sunset.getTime() + 1000, d, 'clock24');
  assert.ok(Math.abs(a2 - (90 + 1000 / 86400000 * 360)) < 1e-6, 'a2=' + a2);
});

test('clock24: long day stretches past the horizontal, night shrinks', () => {
  const d = localDay(2026, 5, 4, 20); // sunrise 04:00, sunset 20:00 local (16h)
  assert.ok(Math.abs(HA.dayFraction(d) - 16 / 24) < 1e-9);
  const b = HA.arcBounds(d, 'clock24');
  assert.ok(Math.abs(b.day.span - 240) < 1e-6, 'day span=' + b.day.span);
  assert.ok(Math.abs(b.night.span - 120) < 1e-6, 'night span=' + b.night.span);
  assert.ok(Math.abs(b.day.from - 240) < 1e-6 && Math.abs(b.day.to - 120) < 1e-6);
  const bt = HA.arcBounds(d, 'temporal');
  assert.strictEqual(bt.day.span, 180);
  assert.strictEqual(bt.night.span, 180);
});

test('clock24: hourState tracks offices by their wall-clock offset', () => {
  const d = localDay(2026, 9, 6, 18);
  // exactly wall noon -> current office is Sext
  const atNoon = HA.hourState(d.solarNoon.getTime(), d, 'clock24');
  assert.strictEqual(atNoon.current.name, 'Sext');
  assert.strictEqual(atNoon.quadrant, 'Day');
  assert.strictEqual(atNoon.dialAngle, 0);
  // late evening (23:00 local) -> current Compline, next Matins
  const late = HA.hourState(new Date(2026, 9, 8, 23).getTime(), d, 'clock24');
  assert.strictEqual(late.current.name, 'Compline');
  assert.strictEqual(late.next.name, 'Matins');
  assert.strictEqual(late.quadrant, 'Night');
  assert.ok(late.msUntilNext > 0);
  // canonical hours carry wall-clock angles
  const sext = HA.canonicalHours(d).find(h => h.name === 'Sext');
  assert.strictEqual(sext.clockAngle, 0);
});

test('festival wheel has eight festivals; nextFestival counts forward', () => {
  const wheel = HA.festivalWheel();
  assert.strictEqual(wheel.length, 8);
  assert.ok(wheel.some(f => f.name === 'Samhain') && wheel.some(f => f.name === 'Yule'));
  // from Oct 8, 2026 the next festival is Samhain (Nov 1)
  const next = HA.nextFestival(new Date('2026-10-08T12:00:00Z'));
  assert.strictEqual(next.name, 'Samhain');
  assert.ok(next.daysUntil >= 23 && next.daysUntil <= 25, 'days=' + next.daysUntil);
  // from Dec 25, the next is Imbolc of the NEXT year
  const next2 = HA.nextFestival(new Date('2026-12-25T12:00:00Z'));
  assert.strictEqual(next2.name, 'Imbolc');
  assert.ok(next2.daysUntil > 30);
});

process.exit(failures ? 1 : 0);
