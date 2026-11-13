export type SeasonId = 'lunar' | 'love' | 'spring' | 'children' | 'midsummer' | 'harvest' | 'brewfest' | 'halloween' | 'thanksgiving' | 'winter';

/** A festive season: it starts and ends on the same days every year, and `end` may fall in the next year (winter). */
export interface Season { id: SeasonId; name: string; start: [month: number, day: number]; end: [month: number, day: number] }

/** In calendar order. Where two overlap (lunar and love, 8 to 16 February) the one further down wins. */
export const SEASONS: Season[] = [
  { id: 'lunar', name: 'Lunar New Year', start: [2, 2], end: [2, 16] },
  { id: 'love', name: 'Valentine’s', start: [2, 8], end: [2, 22] },
  { id: 'spring', name: 'Spring egg hunt', start: [3, 29], end: [4, 5] },
  { id: 'children', name: 'Children’s Week', start: [5, 3], end: [5, 10] },
  { id: 'midsummer', name: 'Midsummer bonfires', start: [6, 21], end: [7, 5] },
  { id: 'harvest', name: 'Harvest festival', start: [9, 11], end: [9, 18] },
  { id: 'brewfest', name: 'Brewfest', start: [9, 20], end: [10, 6] },
  { id: 'halloween', name: 'Halloween', start: [10, 19], end: [11, 2] },
  { id: 'thanksgiving', name: 'Thanksgiving', start: [11, 22], end: [11, 29] },
  { id: 'winter', name: 'Winter holidays', start: [12, 15], end: [1, 2] },
];

const dayKey = ([month, day]: [number, number]) => month * 100 + day;

const isWithin = ({ start, end }: Season, date: Date) => {
  const today = dayKey([date.getMonth() + 1, date.getDate()]);
  return dayKey(start) <= dayKey(end)
    ? today >= dayKey(start) && today <= dayKey(end)
    : today >= dayKey(start) || today <= dayKey(end);
};

/** The season going on at `date` (local time), or null in between. */
export const seasonOn = (date: Date): Season | null => SEASONS.filter(season => isWithin(season, date)).pop() ?? null;

/** The season named in the page's address (?season=winter, for trying one out), else the one going on now. */
export const currentSeason = (params: URLSearchParams, now: Date = new Date()): Season | null =>
  SEASONS.find(season => season.id === params.get('season')) ?? seasonOn(now);
