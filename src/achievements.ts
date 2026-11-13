import { SEASONS } from './seasons';

export type AchievementGroup = 'fish' | 'subagents' | 'seasons' | 'visitors' | 'crab' | 'tank';

export interface Achievement { id: string; group: AchievementGroup; title: string; description: string }

export const GROUPS: { id: AchievementGroup; title: string }[] = [
  { id: 'fish', title: 'Fish in the tank' },
  { id: 'subagents', title: 'Subagents' },
  { id: 'seasons', title: 'Seasons' },
  { id: 'visitors', title: 'Visitors' },
  { id: 'crab', title: 'Sebastian the crab' },
  { id: 'tank', title: 'Life in the tank' },
];

/** The visitor kinds in src/scene/passersby.ts by name. */
const VISITORS: { name: string; title: string }[] = [
  { name: 'whale', title: 'Whale watcher' },
  { name: 'shark', title: 'Jaws' },
  { name: 'orca', title: 'Killer company' },
  { name: 'manta', title: 'Wings of the deep' },
  { name: 'dolphins', title: 'Flipper’s pod' },
  { name: 'jellyfish', title: 'Jelly bloom' },
  { name: 'santa', title: 'Sleigh bells' },
  { name: 'submarine', title: 'Red October' },
  { name: 'kraken', title: 'Release the kraken' },
];

/** Achievements for reaching a number of something: fish in the tank, subagents, pinches of food, crab visits. */
interface Milestones { group: AchievementGroup; steps: { count: number; title: string; description: string }[] }

const MILESTONES = {
  fish: { group: 'fish', steps: [
    { count: 1, title: 'First fish', description: 'A first session joined the tank.' },
    ...[5, 10, 15, 20, 25].map(count => ({ count, title: `${count} fish`, description: `${count} sessions swam in the tank at once.` })),
  ] },
  subagent: { group: 'subagents', steps: [
    { count: 1, title: 'Little helper', description: 'A subagent swam out next to its session.' },
    { count: 5, title: 'Small school', description: '5 subagents at work at once.' },
    { count: 10, title: 'Swarm', description: '10 subagents at work at once.' },
  ] },
  feed: { group: 'tank', steps: [
    { count: 1, title: 'Dinner time', description: 'You dropped a pinch of food in the water.' },
    { count: 25, title: 'Fish feeder', description: '25 pinches of food dropped.' },
    { count: 100, title: 'All you can eat', description: '100 pinches of food dropped.' },
  ] },
  crab: { group: 'crab', steps: [
    { count: 1, title: 'Hello, Sebastian', description: 'The shy crab came out onto the sand.' },
    { count: 10, title: 'Regular visitor', description: 'Sebastian strolled by 10 times.' },
    { count: 25, title: 'Best friends', description: 'Sebastian strolled by 25 times.' },
  ] },
} satisfies Record<string, Milestones>;

export type MilestoneKind = keyof typeof MILESTONES | `visitor-${string}`;

export const seasonId = (season: string) => `season-${season}`;
export const visitorId = (name: string): `visitor-${string}` => `visitor-${name}`;

/** How often a visitor has to swim past, on top of the first time, for its further achievements. */
const VISITOR_VISITS = [5, 10];

const VISITOR_MILESTONES: Record<string, Milestones> = Object.fromEntries(VISITORS.map(visitor => [visitorId(visitor.name), {
  group: 'visitors',
  steps: VISITOR_VISITS.map(count => ({
    count, title: `${visitor.title} ×${count}`, description: `A ${visitor.name === 'santa' ? 'sleigh' : visitor.name} swam past the tank ${count} times.`,
  })),
}]));
const ALL_MILESTONES: Record<string, Milestones> = { ...MILESTONES, ...VISITOR_MILESTONES };

/** One-off achievements in the crab and tank groups, earned by id. */
export const Moment = {
  CrabDance: 'crab-dance', CrabScare: 'crab-scare', Night: 'tank-night', Dawn: 'tank-dawn', Busy: 'tank-busy', Opened: 'tank-opened',
} as const;

/** Working sessions at the same time for the busy reef. */
export const BUSY_SESSIONS = 3;

const MOMENTS: Achievement[] = [
  { id: Moment.CrabDance, group: 'crab', title: 'Under the sea', description: 'You saw Sebastian dance.' },
  { id: Moment.CrabScare, group: 'crab', title: 'Scaredy crab', description: 'A new fish gave Sebastian a fright.' },
  { id: Moment.Night, group: 'tank', title: 'Night owl', description: 'You watched the tank at night.' },
  { id: Moment.Dawn, group: 'tank', title: 'Early bird', description: 'You watched the sun come up over the tank.' },
  { id: Moment.Busy, group: 'tank', title: 'Busy reef', description: `${BUSY_SESSIONS} sessions working at the same time.` },
  { id: Moment.Opened, group: 'tank', title: 'Gotcha!', description: 'You clicked a fish to open its session.' },
];

const milestoneId = (kind: MilestoneKind, count: number) => `${kind}-${count}`;

const milestoneAchievements = (milestones: Record<string, Milestones>) => Object.entries(milestones).flatMap(([kind, { group, steps }]) =>
  steps.map(step => ({ id: `${kind}-${step.count}`, group, title: step.title, description: step.description })));

export const ACHIEVEMENTS: Achievement[] = [
  ...milestoneAchievements(MILESTONES),
  ...SEASONS.map(season => ({
    id: seasonId(season.id), group: 'seasons' as const, title: season.name,
    description: `You were here for ${season.name}.`,
  })),
  ...VISITORS.map(visitor => ({
    id: visitorId(visitor.name), group: 'visitors' as const, title: visitor.title,
    description: `A ${visitor.name === 'santa' ? 'sleigh' : visitor.name} swam past the tank.`,
  })),
  ...VISITOR_VISITS.flatMap(count => milestoneAchievements(VISITOR_MILESTONES).filter(achievement => achievement.id.endsWith(`-${count}`))),
  ...MOMENTS,
];

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

const readRecord = (storage: KeyValueStorage | null, key: string): Record<string, number> => {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(key) || '{}');
    return saved && typeof saved === 'object' ? Object.fromEntries(Object.entries(saved).filter(([, number]) => typeof number === 'number')) : {};
  } catch { return {}; }
};

/** Which achievements are earned (also across reloads) and when, and the running totals some of them count up to. */
export class AchievementStore {
  private earned: Record<string, number>;
  private totals: Record<string, number>;
  constructor(private storage: KeyValueStorage | null, private key = 'fishtank.achievements') {
    this.earned = readRecord(storage, key);
    this.totals = readRecord(storage, key + '.totals');
  }
  has(id: string) { return id in this.earned; }
  earnedAt(id: string): number | undefined { return this.earned[id]; }
  private save(key: string, record: Record<string, number>) {
    try { this.storage?.setItem(key, JSON.stringify(record)); } catch { /* storage full or blocked */ }
  }
  /** Earns it unless it already is; returns the achievement when it's new. */
  earn(id: string, now = Date.now()): Achievement | null {
    const achievement = ACHIEVEMENTS.find(candidate => candidate.id === id);
    if (!achievement || this.has(id)) return null;
    this.earned[id] = now;
    this.save(this.key, this.earned);
    return achievement;
  }
  /** Earns every milestone of this kind up to `count`, which is how many there are now. */
  earnUpTo(kind: MilestoneKind, count: number, now = Date.now()): Achievement[] {
    return ALL_MILESTONES[kind]?.steps.filter(step => step.count <= count).flatMap(step => this.earn(milestoneId(kind, step.count), now) ?? []) ?? [];
  }
  /** Counts one more of something that adds up over time (food dropped, crab visits) and earns what that reaches. */
  add(kind: MilestoneKind, now = Date.now()): Achievement[] {
    const total = (this.totals[kind] ?? 0) + 1;
    this.totals[kind] = total;
    this.save(this.key + '.totals', this.totals);
    return this.earnUpTo(kind, total, now);
  }
}
