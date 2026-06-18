// Simplified solar system ephemeris.
// Mean orbital elements plus the largest periodic terms (truncated from Meeus,
// "Astronomical Algorithms"). Good to a few arcminutes for the Sun and Moon,
// which is enough to predict real solar eclipse dates.
//
// Conventions: angles in degrees, time t in days since J2000.0 (2000-01-01 12:00 UTC).

export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

const DEG = Math.PI / 180;

export const dayToDate = (t: number): Date => new Date(J2000_MS + t * 86400000);
export const msToDay = (ms: number): number => (ms - J2000_MS) / 86400000;

export const norm360 = (a: number): number => ((a % 360) + 360) % 360;
export const wrap180 = (a: number): number => {
  const x = norm360(a);
  return x > 180 ? x - 360 : x;
};

// Geocentric ecliptic longitude of the Sun (deg).
export function sunLongitude(t: number): number {
  const T = t / 36525;
  const L0 = 280.46646 + 0.98564736 * t; // mean longitude
  const M = 357.52911 + 0.98560028 * t; // mean anomaly
  const C =
    (1.914602 - 0.004817 * T) * Math.sin(M * DEG) +
    0.019993 * Math.sin(2 * M * DEG) +
    0.000289 * Math.sin(3 * M * DEG); // equation of center
  return norm360(L0 + C);
}

// Geocentric ecliptic longitude and latitude of the Moon (deg).
export function moonPosition(t: number): { lon: number; lat: number } {
  const Lp = 218.3164477 + 13.17639648 * t; // mean longitude
  const D = 297.8501921 + 12.19074912 * t; // mean elongation from Sun
  const M = 357.5291092 + 0.98560028 * t; // Sun mean anomaly
  const Mp = 134.9633964 + 13.06499295 * t; // Moon mean anomaly
  const F = 93.272095 + 13.22935024 * t; // argument of latitude

  const lon =
    Lp +
    6.288774 * Math.sin(Mp * DEG) +
    1.274027 * Math.sin((2 * D - Mp) * DEG) +
    0.658314 * Math.sin(2 * D * DEG) +
    0.213618 * Math.sin(2 * Mp * DEG) -
    0.185116 * Math.sin(M * DEG) -
    0.114332 * Math.sin(2 * F * DEG);

  const lat =
    5.128122 * Math.sin(F * DEG) +
    0.280602 * Math.sin((Mp + F) * DEG) +
    0.277693 * Math.sin((Mp - F) * DEG) +
    0.173237 * Math.sin((2 * D - F) * DEG);

  return { lon: norm360(lon), lat };
}

// Longitude of the Moon's ascending node (deg). Regresses over 18.6 years.
export function moonNode(t: number): number {
  return norm360(125.0445479 - 0.05295376 * t);
}

// Angular separation between Sun and Moon as seen from Earth's center (deg).
export function sunMoonSeparation(t: number): number {
  const s = sunLongitude(t);
  const m = moonPosition(t);
  const dl = wrap180(m.lon - s);
  return Math.hypot(dl * Math.cos(m.lat * DEG), m.lat);
}

// Instant of true new moon nearest to the initial estimate (bisection on elongation).
function refineNewMoon(approx: number): number {
  const f = (d: number) => wrap180(moonPosition(d).lon - sunLongitude(d));
  let a = approx - 2.5;
  let b = approx + 2.5;
  // widen if the bracket missed the sign change
  for (let i = 0; i < 4 && !(f(a) < 0 && f(b) > 0); i++) {
    a -= 1;
    b += 1;
  }
  for (let i = 0; i < 50; i++) {
    const mid = (a + b) / 2;
    if (f(mid) > 0) b = mid;
    else a = mid;
  }
  return (a + b) / 2;
}

export type EclipsePrediction = {
  t: number; // days since J2000
  date: Date;
  moonLat: number; // Moon ecliptic latitude at new moon, deg
  central: boolean; // total or annular vs partial
};

const SYNODIC = 29.530588;
const ELONGATION_RATE = 12.190749; // deg/day, Moon relative to Sun

// A solar eclipse happens at a new moon that falls close enough to a lunar
// node, i.e. when the Moon's ecliptic latitude is small. |lat| < ~1.45 deg
// gives some eclipse; |lat| < ~0.95 deg gives a central (total/annular) one.
export function findNextSolarEclipse(fromT: number): EclipsePrediction | null {
  const phase = norm360(moonPosition(fromT).lon - sunLongitude(fromT));
  let est = fromT + ((360 - phase) % 360) / ELONGATION_RATE;
  for (let i = 0; i < 240; i++) {
    const nm = refineNewMoon(est);
    if (nm > fromT + 0.02) {
      const lat = moonPosition(nm).lat;
      if (Math.abs(lat) < 1.45) {
        return { t: nm, date: dayToDate(nm), moonLat: lat, central: Math.abs(lat) < 0.95 };
      }
    }
    est = Math.max(nm, est) + SYNODIC;
  }
  return null;
}

// Mean heliocentric longitude for the planets (circular-orbit approximation).
export function planetLongitude(L0: number, n: number, t: number): number {
  return norm360(L0 + n * t);
}

// Earth's heliocentric longitude is the Sun's geocentric longitude flipped.
export function earthLongitude(t: number): number {
  return norm360(sunLongitude(t) + 180);
}
