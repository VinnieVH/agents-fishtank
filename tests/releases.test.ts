import { describe, expect, it } from 'vitest';
import { isNewer, pickAsset, repoFrom, type Release } from '../electron/releases.ts';

const release: Release = {
  tag_name: 'v1.2.0', name: 'v1.2.0', body: '## What\'s new\n- Air tanks', html_url: 'https://github.com/VinnieVH/agent-fishtank/releases/tag/v1.2.0',
  assets: ['Agent-Fishtank-1.2.0-arm64.dmg', 'Agent-Fishtank-1.2.0-arm64.dmg.blockmap', 'Agent-Fishtank-1.2.0-x64.dmg', 'Agent-Fishtank-Setup-1.2.0.exe']
    .map(name => ({ name, browser_download_url: `https://github.com/VinnieVH/agent-fishtank/releases/download/v1.2.0/${name}` })),
};

describe('isNewer', () => {
  it('compares versions number by number, with or without a v', () => {
    expect(isNewer('v1.2.0', '1.1.9')).toBe(true);
    expect(isNewer('1.10.0', '1.9.3')).toBe(true);
    expect(isNewer('v2.0.0', '1.99.99')).toBe(true);
    expect(isNewer('v1.2.0', '1.2.0')).toBe(false);
    expect(isNewer('v1.1.0', '1.2.0')).toBe(false);
  });

  it('never prompts for something that isn\'t a version', () => {
    expect(isNewer('nightly', '1.0.0')).toBe(false);
    expect(isNewer('v1.2', '1.0.0')).toBe(false);
  });
});

describe('pickAsset', () => {
  it('picks the installer for this computer', () => {
    expect(pickAsset(release, 'darwin', 'arm64')).toMatch(/-arm64\.dmg$/);
    expect(pickAsset(release, 'darwin', 'x64')).toMatch(/-x64\.dmg$/);
    expect(pickAsset(release, 'win32', 'x64')).toMatch(/Setup-1\.2\.0\.exe$/);
    expect(pickAsset(release, 'win32', 'arm64')).toMatch(/Setup-1\.2\.0\.exe$/); // one installer for both
  });

  it('finds the installers without a version in their name too', () => {
    const plain = { ...release, assets: ['Agent-Fishtank-arm64.dmg', 'Agent-Fishtank-x64.dmg', 'Agent-Fishtank-Setup.exe']
      .map(name => ({ name, browser_download_url: `https://example.com/${name}` })) };
    expect(pickAsset(plain, 'darwin', 'arm64')).toBe('https://example.com/Agent-Fishtank-arm64.dmg');
    expect(pickAsset(plain, 'darwin', 'x64')).toBe('https://example.com/Agent-Fishtank-x64.dmg');
    expect(pickAsset(plain, 'win32', 'x64')).toBe('https://example.com/Agent-Fishtank-Setup.exe');
  });

  it('falls back to the release page', () => {
    expect(pickAsset({ ...release, assets: [] }, 'darwin', 'arm64')).toBe(release.html_url);
    expect(pickAsset(release, 'linux', 'x64')).toBe(release.html_url);
  });
});

describe('repoFrom', () => {
  it('reads owner/name from a repository URL', () => {
    expect(repoFrom('https://github.com/VinnieVH/copilot-fishtank.git')).toBe('VinnieVH/copilot-fishtank');
    expect(repoFrom('git@github.com:VinnieVH/agent-fishtank.git')).toBe('VinnieVH/agent-fishtank');
    expect(repoFrom('https://gitlab.com/x/y')).toBeNull();
  });
});
