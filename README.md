# hour-angles

earth+sun clock — the liturgical (canonical) hours of the day, computed
from the sun's actual course, rendered as an illuminated-manuscript dial.

## The web UI (GitHub Pages)

`index.html` + `hours.js` + `app.js` + `style.css` form a dependency-light,
vanilla-JS clock (SunCalc and fonts come from CDN):

- enter latitude/longitude (saved in localStorage), or click **Use my place**
  for device geolocation
- a **day picker and year scrubber** — choose any day, or press play and
  watch the sunlit half of the dial breathe through the whole year,
  with a daylight-hours readout
- a **year ring** at the heart of the dial — the wheel of the year:
  Samhain, Yule, Imbolc, Ostara, Beltane, Litha, Lughnasadh and Mabon
  each at their calendar angle, carrying the true daylight of their
  day on a fixed equal-hours mini-dial (daylight-saving jumps included)
- a **ghost trail** of sunrise and sunset positions for the eight
  festival days, drawn where the current basis places them
- on the liturgical basis the ink clock digits are placed at the
  chosen day's wall-clock hours mapped through the temporal dial —
  they slide with the seasons and jump at daylight-saving transitions
- the gilded sun pointer marks the present hour angle (0° = sunrise,
  90° = noon, 180° = sunset, 270° = nadir)
- canonical hours are marked on the dial: **Lauds** (dawn), **Prime**,
  **Terce**, **Sext** (noon), **None**, **Vespers** (dusk), **Compline**,
  **Matins** (the night office)
- two dial modes: **Temporal hours** (the stopwatch basis — each quarter of
  the day holds 90° of dial, six unequal hours per quarter) and **24-hour
  clock** (the chronological basis — clock-hour numerals I–XII with noon at
  the top and 6am/6pm on the horizontal line; the gold daylight arc
  stretches or shrinks with the true day length, so on a 60% day Lauds and
  Vespers sit below the horizontal and on a 40% day above it, while the
  stopwatch hours spread across the arcs with inverse spacing). Labels are
  always set upright.

Live at: <https://darkone23.github.io/hour-angles/>

## The original CLI

`node index.js` prints today's hour angles (nadir / sunrise / solar noon /
sunset) and the current angle for San Diego. See `index.js` for the
original quadrant logic, which the web UI keeps faithful.

## Tests

```
npm install --no-save suncalc
npm test
```
