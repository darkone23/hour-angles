# hour-angles

earth+sun clock — the liturgical (canonical) hours of the day, computed
from the sun's actual course, rendered as an illuminated-manuscript dial.

## The web UI (GitHub Pages)

`index.html` + `hours.js` + `app.js` + `style.css` form a dependency-light,
vanilla-JS clock (SunCalc and fonts come from CDN):

- enter latitude/longitude (saved in localStorage), or click **Use my place**
  for device geolocation
- a dial divided into four quarters — sunrise, solar noon, sunset, nadir —
  each quarter standing for six "temporal" hours of light or dark
- the gilded sun pointer marks the present hour angle (0° = sunrise,
  90° = noon, 180° = sunset, 270° = nadir)
- canonical hours are marked on the dial: **Lauds** (dawn), **Prime**,
  **Terce**, **Sext** (noon), **None**, **Vespers** (dusk), **Compline**,
  **Matins** (the night office)

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
