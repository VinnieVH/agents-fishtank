// The cover over the tank while it's resized: the tank is repainted once the resizing stops.
export const cover = document.getElementById('resizing')!;

const COVER_BUBBLES = 36;
for (let index = 0; index < COVER_BUBBLES; index++) { // its bubbles, already on their way up when it shows
  const bubble = document.createElement('i'), rise = 3 + Math.random() * 4;
  bubble.style.cssText = `--x:${(index + Math.random()) / COVER_BUBBLES * 100}%;--s:${5 + Math.random() ** 2 * 28}px;--t:${rise}s;--d:${-Math.random() * rise}s;--w:${(Math.random() - .5) * 28}px`;
  cover.append(bubble);
}
