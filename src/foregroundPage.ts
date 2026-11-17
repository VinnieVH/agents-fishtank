import type { Renderer } from 'pixi.js';
import { renderPreview } from './foregroundPreview';
import { FOREGROUNDS, type ForegroundId, type ForegroundInfo, type ForegroundStore } from './foregrounds';

const page = document.getElementById('foreground') as HTMLDialogElement;
const choicesEl = page.querySelector<HTMLElement>('.choices')!;

const element = (tag: string, className: string, text = '') => Object.assign(document.createElement(tag), { className, textContent: text });

/** The scenery page, opened from the menu: a picture of every foreground to pick from, the chosen one marked. */
export const startForegroundPage = (options: { store: ForegroundStore; renderer: Renderer; onPick: (id: ForegroundId) => void }) => {
  const { store, renderer, onPick } = options;
  const pictures = new Map<ForegroundId, Promise<string>>();
  const pictureOf = (id: ForegroundId) => {
    if (!pictures.has(id)) pictures.set(id, renderPreview(renderer, id));
    return pictures.get(id)!;
  };

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
    void pictureOf(id).then(source => picture.append(Object.assign(document.createElement('img'), { src: source, alt: '' })));
    item.append(button);
    return item;
  };

  document.getElementById('menu-foreground')!.addEventListener('click', () => {
    choicesEl.replaceChildren(...FOREGROUNDS.map(choice));
    if (!page.open) page.showModal();
  });
  page.querySelector('.close')!.addEventListener('click', () => page.close());
};
