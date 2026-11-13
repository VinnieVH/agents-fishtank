// Points the download button at the installer for this visitor's computer. The installers have fixed names, so
// GitHub's .../releases/latest/download/<name> links always give the newest version: no API call needed.
// Without JavaScript the button opens the releases page.
(() => {
  const repo = 'VinnieVH/agents-fishtank';
  const latest = name => `https://github.com/${repo}/releases/latest/download/${name}`;
  const files = {
    macArm: { label: 'Mac (Apple Silicon)', url: latest('Agent-Fishtank-arm64.dmg') },
    macIntel: { label: 'Mac (Intel)', url: latest('Agent-Fishtank-x64.dmg') },
    windows: { label: 'Windows', url: latest('Agent-Fishtank-Setup.exe') },
  };
  const primary = document.getElementById('primary');
  const version = document.getElementById('version');
  const others = document.getElementById('others');

  function show(mine) {
    if (mine) {
      primary.href = mine.url;
      primary.textContent = `Download for ${mine.label}`;
    }
    others.textContent = mine ? 'Also for: ' : 'Downloads: ';
    Object.values(files).filter(f => f !== mine).forEach((f, i) => {
      if (i) others.append(' · ');
      const a = document.createElement('a');
      a.href = f.url;
      a.textContent = f.label;
      others.append(a);
    });
  }

  const ua = navigator.userAgent;
  const isWindows = /Windows/.test(ua), isMac = /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua);
  // Macs get Apple Silicon (every Mac sold since 2020); Safari can't tell, Chrome and Edge can spot an Intel Mac
  show(isWindows ? files.windows : isMac ? files.macArm : null);
  if (isMac && navigator.userAgentData?.getHighEntropyValues) {
    navigator.userAgentData.getHighEntropyValues(['architecture'])
      .then(v => { if (v.architecture === 'x86') show(files.macIntel); })
      .catch(() => {});
  }

  // With reduced motion the demo waits for a click on play instead of starting by itself
  const demo = document.getElementById('demo');
  if (demo && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    demo.removeAttribute('autoplay');
    demo.pause();
    demo.controls = true;
  }

  // The demo has music: it plays muted (browsers only start it that way, and nobody likes a page that starts
  // playing sound), and the button turns the sound on and off. With the controls showing, those do it instead.
  const sound = document.getElementById('sound');
  if (demo && sound && !demo.controls) {
    const set = on => {
      demo.muted = !on;
      sound.setAttribute('aria-pressed', String(on));
      sound.title = on ? 'Turn the sound off' : 'Turn the sound on';
      sound.setAttribute('aria-label', sound.title);
    };
    sound.hidden = false;
    sound.addEventListener('click', () => {
      set(demo.muted);
      if (!demo.muted && demo.paused) demo.play().catch(() => {});
    });
  }

  // The page follows the same calendar as the tank (src/seasons.ts; tests/seasons.test.ts checks the two agree).
  // ?season=<id> tries one out. Only the winter holidays have a look so far: [data-season="winter"] in style.css.
  const SEASONS = [
    ['lunar', [2, 2], [2, 16]], ['love', [2, 8], [2, 22]], ['spring', [3, 29], [4, 5]], ['children', [5, 3], [5, 10]],
    ['midsummer', [6, 21], [7, 5]], ['harvest', [9, 11], [9, 18]], ['brewfest', [9, 20], [10, 6]],
    ['halloween', [10, 19], [11, 2]], ['thanksgiving', [11, 22], [11, 29]], ['winter', [12, 15], [1, 2]],
  ];
  const now = new Date(), today = (now.getMonth() + 1) * 100 + now.getDate(), key = ([month, day]) => month * 100 + day;
  const going = SEASONS.filter(([, start, end]) => key(start) <= key(end)
    ? today >= key(start) && today <= key(end) : today >= key(start) || today <= key(end)).pop();
  const named = SEASONS.find(([id]) => id === new URLSearchParams(location.search).get('season'));
  const season = (named ?? going)?.[0];
  if (season) document.documentElement.dataset.season = season;
  if (season === 'winter') {
    const wrap = (cls, count, make) => {
      const el = document.createElement('div');
      el.className = cls; el.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < count; i++) el.append(make(i));
      document.body.prepend(el);
    };
    wrap('snow', 36, i => {
      const flake = document.createElement('i');
      flake.style.cssText = `left:${(i * 37) % 100}%;--size:${3 + (i * 7) % 5}px;--drift:${(i % 5) * 14 - 28}px;` +
        `animation-duration:${9 + (i * 5) % 9}s;animation-delay:-${(i * 3) % 14}s`;
      return flake;
    });
    wrap('lights', 1, () => lights());
  }

  // Swags of lights like the tank's: bulbs hang from a wire that sags between pegs
  function lights() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const colours = ['#ff3b5c', '#39ff88', '#ffc94d', '#6fe3ff'];
    const draw = () => {
      const width = innerWidth, swag = Math.max(260, width / 4), sag = 30, top = 4, bulbs = 7;
      let wire = '', glass = '';
      for (let x = 0, n = 0; x < width; x += swag) {
        const mid = x + swag / 2;
        wire += `M${x} ${top}Q${mid} ${top + sag * 2} ${x + swag} ${top}`;
        for (let i = 1; i <= bulbs; i++, n++) {
          const t = i / (bulbs + 1), px = x + swag * t, py = top + sag * 4 * t * (1 - t), colour = colours[n % colours.length];
          glass += `<line x1="${px}" y1="${py}" x2="${px}" y2="${py + 5}" stroke="#7a4a1a" stroke-width="2"/>` +
            `<circle cx="${px}" cy="${py + 11}" r="9" fill="${colour}" opacity=".28"/>` +
            `<circle cx="${px}" cy="${py + 11}" r="4.4" fill="${colour}" stroke="#0a1a26" stroke-width="1.4"/>`;
        }
      }
      svg.setAttribute('viewBox', `0 0 ${width} 60`); svg.setAttribute('width', width); svg.setAttribute('height', 60);
      svg.innerHTML = `<path d="${wire}" fill="none" stroke="#0a1a26" stroke-width="1.6" opacity=".85"/>${glass}`;
    };
    draw(); addEventListener('resize', draw);
    return svg;
  }

  // The version number is a nice extra: GitHub's API can be rate-limited, and then it's simply left out
  fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then(res => res.ok ? res.json() : null)
    .then(r => { if (r?.tag_name) version.textContent = `Version ${r.tag_name.replace(/^v/, '')} · free and open source`; })
    .catch(() => {});
})();
