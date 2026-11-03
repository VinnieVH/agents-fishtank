import { smooth, TAU } from './util';

export interface Location { lat: number; lon: number }
export type Phase = 'Day' | 'Dawn' | 'Dusk' | 'Night';
export interface Light { day: number; night: number; warm: number; hourAngle: number; phase: Phase }

const SOUTH = /^(Australia|Antarctica)\/|^America\/(Argentina|Santiago|Sao_Paulo|Montevideo|Asuncion|Lima|La_Paz)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek)|^Pacific\/(Auckland|Fiji)/;
const REGION_LAT: Record<string, number> = { Europe: 50, America: 40, Asia: 30, Africa: 10, Atlantic: 40, Indian: -10, Pacific: 20 };

/**
 * Rough location from the IANA timezone and the standard (non-DST) UTC offset in minutes east.
 * Longitude comes from the offset (15° per hour), latitude from the region.
 */
export const guessLocation = (timeZone: string, stdOffsetMin: number): Location => {
  const lat = SOUTH.test(timeZone) ? -33 : REGION_LAT[timeZone.split('/')[0]] ?? 45;
  return { lat, lon: stdOffsetMin / 4 };
};

export const wrapAngle = (angle: number) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;

/** NOAA approximation. Returns solar elevation in degrees and hour angle in radians (0 = solar noon). */
export const sunPosition = (date: Date, location: Location): { elevation: number; hourAngle: number } => {
  const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5;
  const yearAngle = TAU / 365 * (dayOfYear - 1 + (date.getUTCHours() - 12) / 24);
  const equationOfTime = 229.18 * (.000075 + .001868 * Math.cos(yearAngle) - .032077 * Math.sin(yearAngle)
    - .014615 * Math.cos(2 * yearAngle) - .040849 * Math.sin(2 * yearAngle));
  const declination = .006918 - .399912 * Math.cos(yearAngle) + .070257 * Math.sin(yearAngle)
    - .006758 * Math.cos(2 * yearAngle) + .000907 * Math.sin(2 * yearAngle)
    - .002697 * Math.cos(3 * yearAngle) + .00148 * Math.sin(3 * yearAngle);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const hourAngle = wrapAngle(((utcMinutes + equationOfTime + 4 * location.lon) / 4 - 180) * Math.PI / 180);
  const lat = location.lat * Math.PI / 180;
  const elevation = Math.asin(Math.sin(lat) * Math.sin(declination)
    + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle)) * 180 / Math.PI;
  return { elevation, hourAngle };
};

const phaseFor = (elevation: number, hourAngle: number): Phase => {
  if (elevation > 8) return 'Day';
  if (elevation < -12) return 'Night';
  return hourAngle < 0 ? 'Dawn' : 'Dusk';
};

/** Full daylight above 8° elevation, full night below nautical twilight (-12°), warm light near the horizon. */
export const lightFor = (elevation: number, hourAngle: number): Light => {
  const day = smooth(-12, 8, elevation);
  const warm = Math.max(0, 1 - Math.abs(elevation - 1) / 9);
  return { day, night: 1 - day, warm, hourAngle, phase: phaseFor(elevation, hourAngle) };
};

/** Clock for the sky; supports ?time=HH:MM (fixed) and ?timelapse (a day per minute). */
export const makeClock = (params: URLSearchParams, now: () => number = Date.now): () => Date => {
  const fixed = /^(\d{1,2}):(\d{2})$/.exec(params.get('time') || '');
  const startedAt = now();
  if (fixed) {
    return () => {
      const date = new Date(now());
      date.setHours(+fixed[1], +fixed[2], 0, 0);
      return date;
    };
  }
  if (params.has('timelapse')) return () => new Date(startedAt + (now() - startedAt) * 1440);
  return () => new Date(now());
};

const numberParam = (params: URLSearchParams, name: string, fallback: number) => {
  const text = params.get(name);
  return text === null ? fallback : +text;
};

export const locationFromParams = (params: URLSearchParams): Location => {
  const year = new Date().getFullYear();
  const standardOffset = Math.min(-new Date(year, 0, 1).getTimezoneOffset(), -new Date(year, 6, 1).getTimezoneOffset());
  const guess = guessLocation(Intl.DateTimeFormat().resolvedOptions().timeZone || '', standardOffset);
  return { lat: numberParam(params, 'lat', guess.lat), lon: numberParam(params, 'lon', guess.lon) };
};
