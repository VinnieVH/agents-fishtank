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

  // The version number is a nice extra: GitHub's API can be rate-limited, and then it's simply left out
  fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } })
    .then(res => res.ok ? res.json() : null)
    .then(r => { if (r?.tag_name) version.textContent = `Version ${r.tag_name.replace(/^v/, '')} · free and open source`; })
    .catch(() => {});
})();
