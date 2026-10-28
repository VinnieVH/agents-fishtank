// Points the download button at the installer for this visitor's computer, from the latest GitHub release.
// Without JavaScript, or when GitHub can't be reached, the button simply opens the releases page.
(async () => {
  const repo = 'VinnieVH/agents-fishtank';
  const primary = document.getElementById('primary');
  const version = document.getElementById('version');
  const others = document.getElementById('others');

  let release;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    release = await res.json();
  } catch { return; }

  const find = test => release.assets.find(a => test(a.name));
  const files = [
    { label: 'Mac (Apple Silicon)', asset: find(n => n.endsWith('-arm64.dmg')) },
    { label: 'Mac (Intel)', asset: find(n => n.endsWith('-x64.dmg')) },
    { label: 'Windows', asset: find(n => n.endsWith('.exe')) },
  ].filter(f => f.asset);
  if (!files.length) return;

  // Browsers don't tell Apple Silicon from Intel reliably, so Macs get Apple Silicon (most Macs sold since 2020)
  const ua = navigator.userAgent;
  const mine = /Windows/.test(ua) ? files.find(f => f.label === 'Windows')
    : /Mac/.test(ua) ? files.find(f => f.label === 'Mac (Apple Silicon)')
    : null;

  const v = release.tag_name.replace(/^v/, '');
  if (mine) {
    primary.href = mine.asset.browser_download_url;
    primary.textContent = `Download for ${mine.label}`;
  }
  version.textContent = `Version ${v} · free and open source`;
  others.textContent = mine ? 'Also for: ' : 'Downloads: ';
  files.filter(f => f !== mine).forEach((f, i) => {
    if (i) others.append(' · ');
    const a = document.createElement('a');
    a.href = f.asset.browser_download_url;
    a.textContent = f.label;
    others.append(a);
  });
})();
