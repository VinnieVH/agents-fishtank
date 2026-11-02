// Loaded before the tank's own code in the demo recording (see record.mjs). It replaces everything that makes the
// tank depend on the real world, so every recording is the same frame for frame:
// - time stands still until the stage calls __advance(ms), which also runs the timers that are due and the queued
//   animation frames, and moves the CSS animations and transitions on;
// - Math.random is seeded;
// - the /events stream is fake: the stage pushes snapshots with __feed(snapshot).
(() => {
  const base = new Date(2026, 9, 28, 14, 20).getTime();
  let now = 0;

  const RealDate = Date;
  window.Date = class extends RealDate {
    constructor(...args) { if (args.length) super(...args); else super(base + now); }
    static now() { return base + now; }
  };
  performance.now = () => now;

  let seed = Number(new URLSearchParams(location.search).get('seed')) || 7; // the stage picks one that frames the story well
  Math.random = () => { // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let queue = [], nextId = 1;
  window.requestAnimationFrame = cb => { queue.push({ id: nextId, cb }); return nextId++; };
  window.cancelAnimationFrame = id => { queue = queue.filter(q => q.id !== id); };

  // timers on the same clock (the resize cover waits for a resize to settle, the terminals blink their cursor)
  let timers = [];
  const later = (fn, ms, args, every) => {
    const id = nextId++;
    timers.push({ id, due: now + Math.max(0, Number(ms) || 0), fn, args, every });
    return id;
  };
  window.setTimeout = (fn, ms, ...args) => later(fn, ms, args, 0);
  window.setInterval = (fn, ms, ...args) => later(fn, ms, args, Math.max(1, Number(ms) || 0));
  window.clearTimeout = window.clearInterval = id => { timers = timers.filter(q => q.id !== id); };
  const runTimers = () => {
    for (let n = 0; n < 1000; n++) { // also the ones they set that are due already, but never forever
      const due = timers.filter(q => q.due <= now).sort((a, b) => a.due - b.due || a.id - b.id)[0];
      if (!due) return;
      if (due.every) due.due += due.every; else timers = timers.filter(q => q !== due);
      if (typeof due.fn === 'function') due.fn(...due.args);
    }
  };

  // CSS animations and transitions would run on real time, which passes much faster per frame: each is moved on
  // from when it was first seen instead
  const born = new WeakMap();
  window.__advance = ms => {
    now = ms;
    runTimers();
    const run = queue; queue = []; // frames requested while these run wait for the next step
    for (const q of run) q.cb(now);
    for (const a of document.getAnimations()) {
      if (!born.has(a)) born.set(a, now);
      a.pause(); a.currentTime = now - born.get(a);
    }
  };

  // the screenshot is taken after __advance returns, so WebGL must keep the frame it drew
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, opts) {
    return getContext.call(this, type, /webgl/.test(type) ? { ...opts, preserveDrawingBuffer: true } : opts);
  };

  let stream = null;
  window.EventSource = class {
    constructor() { stream = this; this.onmessage = null; this.onerror = null; }
    addEventListener() {}
    close() {}
  };
  window.__feed = snapshot => stream?.onmessage?.({ data: JSON.stringify(snapshot) });
})();
