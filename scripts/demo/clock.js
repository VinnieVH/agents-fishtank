// Loaded before the tank's own code in the demo recording (see record.mjs). It replaces everything that makes the
// tank depend on the real world, so every recording is the same frame for frame:
// - time stands still until the stage calls __advance(ms), which also runs the queued animation frames;
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

  let seed = 7;
  Math.random = () => { // mulberry32
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let queue = [], nextId = 1;
  window.requestAnimationFrame = cb => { queue.push({ id: nextId, cb }); return nextId++; };
  window.cancelAnimationFrame = id => { queue = queue.filter(q => q.id !== id); };
  window.__advance = ms => {
    now = ms;
    const run = queue; queue = []; // frames requested while these run wait for the next step
    for (const q of run) q.cb(now);
    // CSS animations (the panel's pulsing dots) would run on real time, which passes much faster per frame
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = now; }
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
