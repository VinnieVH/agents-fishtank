import { smooth, TAU } from './util';

export interface Location { lat: number; lon: number }
export type Phase = 'Day' | 'Dawn' | 'Dusk' | 'Night';
export interface Light { day: number; night: number; warm: number; ha: number; phase: Phase }

const SOUTH = /^(Australia|Antarctica)\/|^America\/(Argentina|Santiago|Sao_Paulo|Montevideo|Asuncion|Lima|La_Paz)|^Africa\/(Johannesburg|Maputo|Harare|Windhoek)|^Pacific\/(Auckland|Fiji)/;
const REGION_LAT: Record<string, number> = { Europe: 50, America: 40, Asia: 30, Africa: 10, Atlantic: 40, Indian: -10, Pacific: 20 };

/**
 * Rough location from the IANA timezone and the standard (non-DST) UTC offset in minutes east.
 * Longitude comes from the offset (15° per hour), latitude from the region.
 */
export function guessLocation(timeZone: string, stdOffsetMin: number): Location {
  const lat = SOUTH.test(timeZone) ? -33 : REGION_LAT[timeZone.split('/')[0]] ?? 45;
  return { lat, lon: stdOffsetMin / 4 };
}

export const wrapAngle = (a: number) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

/** NOAA approximation. Returns solar elevation in degrees and hour angle in radians (0 = solar noon). */
export function sunPosition(d: Date, loc: Location): { el: number; ha: number } {
  const doy = (Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / 864e5;
  const g = TAU / 365 * (doy - 1 + (d.getUTCHours() - 12) / 24);
  const eqt = 229.18 * (.000075 + .001868 * Math.cos(g) - .032077 * Math.sin(g) - .014615 * Math.cos(2 * g) - .040849 * Math.sin(2 * g));
  const decl = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g) - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g)
    - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  const ha = wrapAngle(((utcMin + eqt + 4 * loc.lon) / 4 - 180) * Math.PI / 180);
  const lat = loc.lat * Math.PI / 180;
  const el = Math.asin(Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha)) * 180 / Math.PI;
  return { el, ha };
}

/** Full daylight above 8° elevation, full night below nautical twilight (-12°), warm light near the horizon. */
export function lightFor(el: number, ha: number): Light {
  const day = smooth(-12, 8, el);
  const phase: Phase = el > 8 ? 'Day' : el < -12 ? 'Night' : ha < 0 ? 'Dawn' : 'Dusk';
  return { day, night: 1 - day, warm: Math.max(0, 1 - Math.abs(el - 1) / 9), ha, phase };
}

/** Clock for the sky; supports ?time=HH:MM (fixed) and ?timelapse (a day per minute). */
export function makeClock(params: URLSearchParams, now: () => number = Date.now): () => Date {
  const fixed = /^(\d{1,2}):(\d{2})$/.exec(params.get('time') || '');
  const t0 = now();
  if (fixed) return () => { const d = new Date(now()); d.setHours(+fixed[1], +fixed[2], 0, 0); return d; };
  if (params.has('timelapse')) return () => new Date(t0 + (now() - t0) * 1440);
  return () => new Date(now());
}

export function locationFromParams(params: URLSearchParams): Location {
  const y = new Date().getFullYear();
  const std = Math.min(-new Date(y, 0, 1).getTimezoneOffset(), -new Date(y, 6, 1).getTimezoneOffset());
  const guess = guessLocation(Intl.DateTimeFormat().resolvedOptions().timeZone || '', std);
  return {
    lat: params.has('lat') ? +params.get('lat')! : guess.lat,
    lon: params.has('lon') ? +params.get('lon')! : guess.lon,
  };
}
