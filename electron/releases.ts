// GitHub releases: which version is newer and which installer fits this computer (used by updates.ts).

export interface Release {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
}

const parse = (v: string) => /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim())?.slice(1, 4).map(Number) ?? null;

/** Whether version `latest` (e.g. "v1.2.0") is newer than `current` ("1.1.0"). */
export function isNewer(latest: string, current: string): boolean {
  const a = parse(latest), b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

/** The installer for this computer, or the release page if there's none. */
export function pickAsset(r: Release, platform: string, arch: string): string {
  const asset = r.assets.find(a => platform === 'darwin' ? a.name.endsWith(`-${arch}.dmg`) : platform === 'win32' && a.name.endsWith('.exe'));
  return asset?.browser_download_url ?? r.html_url;
}

/** "VinnieVH/agent-fishtank" from a package.json repository URL. */
export function repoFrom(url: string): string | null {
  return /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(url.trim())?.[1] ?? null;
}
