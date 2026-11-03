// Tells people when a new version of the app is out. On start and every few hours the app asks GitHub for the latest
// release; when it's newer, a dialog offers to download the installer for this computer.
// (Installing it by itself, like electron-updater does, needs a signed app on macOS; the app isn't signed yet.)
import { app, dialog, shell } from 'electron';
import { isNewer, pickAsset, type Release } from './releases.ts';

const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const DOWNLOAD = 0, LATER = 1;

const latestRelease = async (repo: string): Promise<Release> => {
  // only published releases count; drafts and pre-releases never prompt anyone
  const answer = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': `agent-fishtank/${app.getVersion()}` },
    signal: AbortSignal.timeout(5000),
  });
  if (!answer.ok) throw new Error(answer.status === 404 ? 'no release has been published yet' : `GitHub answered ${answer.status}`);
  return await answer.json() as Release;
};

/** The release, or null after telling a `manual` check why it couldn't get one. */
const fetchRelease = async (repo: string, manual: boolean): Promise<Release | null> => {
  try { return await latestRelease(repo); } catch (error) {
    if (manual) await dialog.showMessageBox({ type: 'warning', message: 'Couldn\'t check for updates', detail: (error as Error).message });
    return null;
  }
};

/** Offers to download `latest`; resolves to the button chosen. */
const offerDownload = async (release: Release, latest: string, current: string) => {
  const notes = (release.body ?? '').trim().split('\n').slice(0, 8).join('\n');
  // no parent window: the window is often hidden while sessions run
  const { response } = await dialog.showMessageBox({
    type: 'info', buttons: ['Download', 'Later', 'Skip This Version'], defaultId: DOWNLOAD, cancelId: LATER,
    message: `Agent Fishtank ${latest} is available`,
    detail: [
      `You have ${current}.`,
      notes,
      process.platform === 'darwin'
        ? 'Download it, quit Agent Fishtank, then drag the new version to Applications to replace the old one.'
        : 'Download it, quit Agent Fishtank, then run the installer.',
    ].filter(Boolean).join('\n\n'),
  });
  return response;
};

export interface UpdateOptions {
  repo: string;
  /** The version the user chose to skip, and remembering a new one. */
  skipped(): string | undefined;
  skip(version: string): void;
}

export class Updates {
  private readonly options: UpdateOptions;
  private dismissed = ''; // "Later": not again while the app runs
  private isOpen = false;

  constructor(options: UpdateOptions) { this.options = options; }

  /** Checks now and every few hours, quietly: no network, rate limits and such show nothing. */
  start() {
    void this.check(false);
    setInterval(() => { void this.check(false); }, CHECK_EVERY_MS).unref();
  }

  /** `manual` (the menu item): also say when there's nothing new or the check failed, and ignore earlier answers. */
  async check(manual: boolean) {
    if (this.isOpen) return;
    const release = await fetchRelease(this.options.repo, manual);
    if (!release) return;
    const latest = release.tag_name.replace(/^v/, ''), current = app.getVersion();
    if (!isNewer(latest, current)) {
      if (manual) await dialog.showMessageBox({ type: 'info', message: 'Agent Fishtank is up to date', detail: `You have the latest version, ${current}.` });
      return;
    }
    if (!manual && (latest === this.dismissed || latest === this.options.skipped())) return;

    this.isOpen = true;
    const response = await offerDownload(release, latest, current).finally(() => { this.isOpen = false; });
    if (response === DOWNLOAD) void shell.openExternal(pickAsset(release, process.platform, process.arch));
    else if (response === LATER) this.dismissed = latest;
    else this.options.skip(latest);
  }
}
