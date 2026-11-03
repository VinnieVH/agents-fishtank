// GitHub releases: which version is newer and which installer fits this computer (used by updates.ts).

export interface Release {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  html_url: string;
  assets: { name: string; browser_download_url: string }[];
}

const parse = (version: string) => /^v?(\d+)\.(\d+)\.(\d+)/.exec(version.trim())?.slice(1, 4).map(Number) ?? null;

/** Whether version `latest` (e.g. "v1.2.0") is newer than `current` ("1.1.0"). */
export const isNewer = (latest: string, current: string): boolean => {
  const latestParts = parse(latest), currentParts = parse(current);
  if (!latestParts || !currentParts) return false;
  for (let index = 0; index < 3; index++) {
    if (latestParts[index] !== currentParts[index]) return latestParts[index] > currentParts[index];
  }
  return false;
};

/** The installer for this computer, or the release page if there's none. */
export const pickAsset = (release: Release, platform: string, arch: string): string => {
  const asset = release.assets.find(candidate =>
    platform === 'darwin' ? candidate.name.endsWith(`-${arch}.dmg`) : platform === 'win32' && candidate.name.endsWith('.exe'));
  return asset?.browser_download_url ?? release.html_url;
};

/** "VinnieVH/agent-fishtank" from a package.json repository URL. */
export const repoFrom = (url: string): string | null =>
  /github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(url.trim())?.[1] ?? null;
