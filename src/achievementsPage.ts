import { achievementIcon } from './art/achievementIcons';
import { ACHIEVEMENTS, type Achievement, type AchievementStore, GROUPS, type MilestoneKind } from './achievements';

const TOAST_MILLISECONDS = 5000;
const CARD_ICON_SIZE = 72, TOAST_ICON_SIZE = 60;

const page = document.getElementById('achievements') as HTMLDialogElement;
const groupsEl = page.querySelector<HTMLElement>('.groups')!;
const summaryEl = page.querySelector<HTMLElement>('.summary')!;
const toastEl = document.getElementById('toast')!;

const element = (tag: string, className: string, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });

const icon = (achievement: Achievement, size: number) => {
  const holder = element('span', 'icon');
  holder.append(achievementIcon(achievement.id, size));
  return holder;
};

/** An earned achievement shows its picture and name; a hidden one shows nothing of either. */
const card = (achievement: Achievement, earnedAt: number | undefined) => {
  const item = element('li', earnedAt === undefined ? 'locked' : 'earned');
  if (earnedAt === undefined) {
    item.append(element('span', 'icon', '?'), element('b', '', 'Hidden'), element('small', '', 'Keep the tank running to find it.'));
    return item;
  }
  item.append(icon(achievement, CARD_ICON_SIZE), element('b', '', achievement.title), element('small', '', achievement.description),
    element('small', 'when', new Date(earnedAt).toLocaleDateString()));
  return item;
};

const renderPage = (store: AchievementStore) => {
  const earned = ACHIEVEMENTS.filter(achievement => store.has(achievement.id)).length;
  summaryEl.textContent = `${earned} of ${ACHIEVEMENTS.length} earned`;
  groupsEl.replaceChildren(...GROUPS.map(group => {
    const section = element('section', 'group');
    const list = element('ul', 'cards');
    list.append(...ACHIEVEMENTS.filter(achievement => achievement.group === group.id).map(achievement => card(achievement, store.earnedAt(achievement.id))));
    section.append(element('h3', '', group.title), list);
    return section;
  }));
};

const queue: Achievement[] = [];
let isShowing = false;

const showNext = () => {
  const achievement = queue.shift();
  if (!achievement) { isShowing = false; toastEl.hidePopover(); return; }
  isShowing = true;
  const text = element('div', 'text');
  text.append(element('b', '', 'Achievement unlocked'), element('span', '', achievement.title), element('small', '', achievement.description));
  toastEl.replaceChildren(icon(achievement, TOAST_ICON_SIZE), text);
  if (!toastEl.matches(':popover-open')) toastEl.showPopover();
  window.setTimeout(showNext, TOAST_MILLISECONDS);
};

/** Shows a card at the top of the app for each newly earned achievement, one after the other. */
export const announce = (earned: Achievement[]) => {
  queue.push(...earned);
  if (!isShowing) showNext();
};

/** Wires the page (opened from the menu in the panel, closed with Escape or its button); returns what the tank earns achievements with. */
export const startAchievementsPage = (store: AchievementStore) => {
  const open = () => { renderPage(store); if (!page.open) page.showModal(); };
  document.getElementById('menu-achievements')!.addEventListener('click', open);
  page.querySelector('.close')!.addEventListener('click', () => page.close());
  const show = (earned: Achievement[]) => {
    if (!earned.length) return;
    announce(earned);
    if (page.open) renderPage(store);
  };
  return {
    earn: (id: string) => { const earned = store.earn(id); show(earned ? [earned] : []); },
    earnUpTo: (kind: MilestoneKind, count: number) => show(store.earnUpTo(kind, count)),
    add: (kind: MilestoneKind) => show(store.add(kind)),
  };
};