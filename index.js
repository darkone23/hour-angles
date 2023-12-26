const SunCalc = require('suncalc');

const dayjs = require('dayjs')
const duration = require('dayjs/plugin/duration')
const utc = require('dayjs/plugin/utc')
const timezone = require('dayjs/plugin/timezone') // dependent on utc plugin
const localizedFormat = require('dayjs/plugin/localizedFormat')

dayjs.extend(duration)
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(localizedFormat)

dayjs.tz.setDefault('America/Los_Angeles')

SAN_DIEGO = {
  "lat": 32.716,
  "lon": -117.161
}

function getTimes(day) {
  return SunCalc.getTimes(day.toDate(), SAN_DIEGO["lat"], SAN_DIEGO["lon"]);
}

now = dayjs()

times = getTimes(now)
tomorrowTimes = getTimes(now.add(1, 'day'))

nadirTime = dayjs(times["nadir"])
sunriseTime = dayjs(times["sunrise"])
solarNoonTime = dayjs(times["solarNoon"])
sunsetTime = dayjs(times["sunset"])
nadirTomorrowTime = dayjs(tomorrowTimes["nadir"])

// console.log(times);
// console.log(tomorrowTimes);

console.log("12AM", nadirTime.format('L LT')) // 12 AM
console.log("6AM", sunriseTime.format('L LT')) // 6 AM
console.log("12PM", solarNoonTime.format('L LT')) // 12 PM
console.log("6PM", sunsetTime.format('L LT')) // 6 PM
console.log("12AM", nadirTomorrowTime.format('L LT')) // 6 PM

// dayDuration = dayjs.duration(sunsetTime.diff(sunriseTime))
// nightDuration = dayjs.duration(sunriseTimeTomorrow.diff(sunsetTime))

// console.log(dayDuration)
// console.log(nightDuration)

// now for angle calculations...

// 0-180 = day
// 180-360 = night

// figure out which quadrant of the clock face we are on
// early-morning (night), morning (day)
// early-evening (day), evening (night)

function getDurationAngle(start, end, quadrantOffset) {
  const quadrantPortion = 90;
  const quadrant = dayjs.duration(end.diff(start))
  const elapsed = dayjs.duration(now.diff(start))
  const ratio = elapsed.as('milliseconds') / quadrant.as('milliseconds')
  return quadrantOffset + ratio * quadrantPortion 
}

sixHoursMillis = dayjs.duration(6, 'hours').as('milliseconds');

function getQuadrant(angle) {
  if (0 <= angle && angle < 90) {
    return "morning"
  } else if (angle < 180) {
    return "early-evening"
  } else if (angle < 270) {
    return "evening"
  } else if (angle < 360){
    return "early-morning"
  } else {
    return "unknown"
  }
}

function calculateTime(angle, quadrantOffset) {
  let quadrant = getQuadrant(angle);
  console.log(quadrant)
  let ratio = (angle - quadrantOffset) / 90
  let elapsed = dayjs.duration(sixHoursMillis * ratio)
  console.log(dayjs.duration(sixHoursMillis).subtract(elapsed).format('HH:mm:ss') + ' remaining')
  if (quadrant == "early-morning") {
    let suffix = "AM"
    return elapsed.format('HH:mm:ss') + ' ' + suffix
  } else if (quadrant == "morning") { 
    let suffix = "AM"
    return elapsed.add(sixHoursMillis).format('HH:mm:ss') + ' ' + suffix
  } else if (quadrant == "early-evening") { 
    let suffix = "PM"
    return elapsed.format('HH:mm:ss') + ' ' + suffix
  } else if (quadrant == "evening") { 
    let suffix = "PM"
    return elapsed.add(sixHoursMillis).format('HH:mm:ss') + ' ' + suffix
  } else {
    let suffix = "Unknown"
    return elapsed.format('HH:mm:ss') + ' ' + suffix
  }
}

if (now.isBefore(sunriseTime)) {
  // returning 270-360
  angle = getDurationAngle(nadirTime, sunriseTime, 270)
  time = calculateTime(angle, 270)
  console.log(time)
  // num seconds between yesterdays nadir and sunrise
} else if (now.isBefore(solarNoonTime)) {
  // returning 0-90
  angle = getDurationAngle(sunriseTime, solarNoonTime, 0)
  time = calculateTime(angle, 0)
  console.log(time)
} else if (now.isBefore(sunsetTime)) {
  // returning 90-180
  angle = getDurationAngle(solarNoonTime, sunsetTime, 90)
  time = calculateTime(angle, 90)
  console.log(time)
} else if (now.isBefore(nadirTomorrowTime)) {
  // returning 180-270
  angle = getDurationAngle(sunsetTime, nadirTomorrowTime, 180)
  time = calculateTime(angle, 180)
  console.log(time)
} else {
  // returning -1
  console.log("unexpected now")
  angle = -1
  console.log(angle)
}
