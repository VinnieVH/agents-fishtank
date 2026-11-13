export const Season = {
  Lunar: 'lunar', Love: 'love', Spring: 'spring', Midsummer: 'midsummer',
  Brewfest: 'brewfest', Halloween: 'halloween', Thanksgiving: 'thanksgiving', Winter: 'winter',
} as const;
export type SeasonId = (typeof Season)[keyof typeof Season];

/** A festive season: it starts and ends on the same days every year, and `end` may fall in the next year (winter). */
export interface Festival {
  id: SeasonId; name: string; start: [month: number, day: number]; end: [month: number, day: number] }

/** In calendar order. Where two overlap (lunar and love, 8 to 16 February) the one further down wins. */
export const SEASONS: Festival[] = [
  { id: Season.Lunar, name: 'Lunar New Year', start: [2, 2], end: [2, 16] },
  { id: Season.Love, name: 'Valentine’s', start: [2, 8], end: [2, 22] },
  { id: Season.Spring, name: 'Spring egg hunt', start: [3, 29], end: [4, 5] },
  { id: Season.Midsummer, name: 'Midsummer', start: [6, 21], end: [7, 5] },
  { id: Season.Brewfest, name: 'Brewfest', start: [9, 20], end: [10, 6] },
  { id: Season.Halloween, name: 'Halloween', start: [10, 25], end: [11, 2] },
  { id: Season.Thanksgiving, name: 'Thanksgiving', start: [11, 22], end: [11, 29] },
  { id: Season.Winter, name: 'Winter holidays', start: [12, 15], end: [1, 2] },
];

const dayKey = ([month, day]: [number, number]) => month * 100 + day;

const isWithin = ({ start, end }: Festival, date: Date) => {
  const today = dayKey([date.getMonth() + 1, date.getDate()]);
  return dayKey(start) <= dayKey(end)
    ? today >= dayKey(start) && today <= dayKey(end)
    : today >= dayKey(start) || today <= dayKey(end);
};

/** The season going on at `date` (local time), or null in between. */
export const seasonOn = (date: Date): Festival | null => SEASONS.filter(season => isWithin(season, date)).pop() ?? null;

/** The season named in the page's address (?season=winter, for trying one out), else the one going on now. */
export const currentSeason = (params: URLSearchParams, now: Date = new Date()): Festival | null =>
  SEASONS.find(season => season.id === params.get('season')) ?? seasonOn(now);
