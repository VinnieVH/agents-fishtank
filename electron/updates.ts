// Tells people when a new version of the app is out. On start and every few hours the app asks GitHub for the latest
// release; when it's newer, a dialog offers to download the installer for this computer.
// (Installing it by itself, like electron-updater does, needs a signed app on macOS; the app isn't signed yet.)
import { app, dialog, shell } from 'electron';
import { isNewer, pickAsset, type Release } from './releases.ts';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

async function latestRelease(repo: string): Promise<Release> {
  // only published releases count; drafts and pre-releases never prompt anyone
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `agent-fishtank/${app.getVersion()}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(res.status === 404 ? 'no release has been published yet' : `GitHub answered ${res.status}`);
  return await res.json() as Release;
}

export interface UpdateOptions {
  repo: string;
  /** The version the user chose to skip, and remembering a new one. */
  skipped(): string | undefined;
  skip(version: string): void;
}

export class Updates {
  private readonly o: UpdateOptions;
  private dismissed = ''; // "Later": not again while the app runs
  private open = false;

  constructor(o: UpdateOptions) { this.o = o; }

  /** Checks now and every few hours, quietly: no network, rate limits and such show nothing. */
  start() {
    void this.check(false);
    setInterval(() => { void this.check(false); }, CHECK_EVERY_MS).unref();
  }

  /** `manual` (the menu item): also say when there's nothing new or the check failed, and ignore earlier answers. */
  async check(manual: boolean) {
    if (this.open) return;
    let release: Release;
    try { release = await latestRelease(this.o.repo); } catch (e) {
      if (manual) await dialog.showMessageBox({ type: 'warning', message: 'Couldn\'t check for updates', detail: (e as Error).message });
      return;
    }
    const latest = release.tag_name.replace(/^v/, ''), current = app.getVersion();
    if (!isNewer(latest, current)) {
      if (manual) await dialog.showMessageBox({ type: 'info', message: 'Agent Fishtank is up to date', detail: `You have the latest version, ${current}.` });
      return;
    }
    if (!manual && (latest === this.dismissed || latest === this.o.skipped())) return;

    const notes = (release.body ?? '').trim().split('\n').slice(0, 8).join('\n');
    this.open = true;
    // no parent window: the window is often hidden while sessions run
    const { response } = await dialog.showMessageBox({
      type: 'info', buttons: ['Download', 'Later', 'Skip This Version'], defaultId: 0, cancelId: 1,
      message: `Agent Fishtank ${latest} is available`,
      detail: [
        `You have ${current}.`,
        notes,
        process.platform === 'darwin'
          ? 'Download it, quit Agent Fishtank, then drag the new version to Applications to replace the old one.'
          : 'Download it, quit Agent Fishtank, then run the installer.',
      ].filter(Boolean).join('\n\n'),
    }).finally(() => { this.open = false; });
    if (response === 0) void shell.openExternal(pickAsset(release, process.platform, process.arch));
    else if (response === 1) this.dismissed = latest;
    else this.o.skip(latest);
  }
}
