import kelp from './assets/scenery/kelp.webp';
import reef from './assets/scenery/reef.webp';
import ruins from './assets/scenery/ruins.webp';
import { FOREGROUNDS, type ForegroundId, type ForegroundInfo, type ForegroundStore } from './foregrounds';

const page = document.getElementById('foreground') as HTMLDialogElement;
const choicesEl = page.querySelector<HTMLElement>('.choices')!;

const element = (tag: string, className: string, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });

// stills of each foreground (the tank at 760 x 380, no season, a little over half full), kept as files so opening the page paints nothing
const PICTURES: Record<ForegroundId, string> = { reef, kelp, ruins };

/** The scenery page, opened from the menu: a picture of every foreground to pick from, the chosen one marked. */
export const startForegroundPage = (options: { store: ForegroundStore; onPick: (id: ForegroundId) => void }) => {
  const { store, onPick } = options;
  const choice = ({ id, title, description }: ForegroundInfo) => {
    const item = element('li', ''), button = element('button', id === store.get() ? 'choice selected' : 'choice') as HTMLButtonElement;
    const picture = element('span', 'picture');
    button.type = 'button';
    button.setAttribute('aria-pressed', String(id === store.get()));
    button.append(picture, element('b', '', title), element('small', '', description));
    button.addEventListener('click', () => {
      page.close();
      if (id === store.get()) return;
      store.set(id);
      onPick(id);
    });
    picture.append(Object.assign(document.createElement('img'), { src: PICTURES[id], alt: '' }));
    item.append(button);
    return item;
  };

  document.getElementById('menu-foreground')!.addEventListener('click', () => {
    choicesEl.replaceChildren(...FOREGROUNDS.map(choice));
    if (!page.open) page.showModal();
  });
  page.querySelector('.close')!.addEventListener('click', () => page.close());
};
