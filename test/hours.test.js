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

process.exit(failures ? 1 : 0);
