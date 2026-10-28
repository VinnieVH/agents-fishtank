# Agent Fishtank: notes for coding agents

A desktop aquarium (Electron) that shows Claude Code and GitHub Copilot CLI sessions as fish. The README explains
the app for users; its "For developers" sections explain the architecture. This file holds the rules agents must
follow in this repo.

## Checks

Run these before committing or releasing; all must pass:

```bash
npm run typecheck    # page, server and app
npm test             # Vitest
npm run build        # page + Electron bundles
```

To try the packaged app: `npm run dist:dir`, then `release/mac-arm64/Agent Fishtank.app` (macOS).

The project website is `site/` (plain HTML/CSS/JS, no build). `.github/workflows/pages.yml` publishes it to GitHub
Pages (https://vinnievh.github.io/agents-fishtank/) with `docs/screenshot*.png` and `build/icon.png` whenever they
change on `main`. Its download button links to `releases/latest/download/<installer>`, so releases need no website
change.

The demo video on the website (`site/demo.mp4`) is recorded from the real tank by `npm run demo:record` (needs Google
Chrome and ffmpeg; set `CHROME`/`FFMPEG` if they aren't in the usual place). The story (sessions, terminal and
mouse) is in `scripts/demo/stage.html`. Re-record it when the tank's look changes noticeably; check a few frames first
with `node scripts/demo/record.mjs --stills 3,8,11,17,22 <dir>`. Keep the video around 3 MB: each new recording adds
to the repository's size for good.

## Rules

- **Commits:** Conventional Commits, title only (no body, no footer, no `Co-Authored-By`), e.g.
  `feat(tanks): show Claude usage in the side panel`. Mark breaking changes with `!`. Commit only when the user asks.
  The user pushes with GitKraken (agent sessions have no GitHub login), so ask them to push.
- **The server runs straight from source** with Node's type stripping (`node server/index.ts`): in `server/`,
  `shared/` and `electron/` use only erasable TypeScript (no enums, namespaces or parameter properties).
  `npm run typecheck` enforces it.
- **Never touch the user's real agent settings while testing.** Point `CLAUDE_CONFIG_DIR`, `COPILOT_HOME` and
  `FISHTANK_PORT` at a scratch folder and a spare port. The user's own app runs on port 4321.
- **Don't extract files from `app.asar` into the repo** (`asar extract-file` writes into the current folder and can
  overwrite `package.json`). Read packaged files with
  `ELECTRON_RUN_AS_NODE=1 npx electron -p 'require("<path>/app.asar/package.json")'`.
- **Releases only go through the workflow below.** Never create `v*` tags by hand and never edit `version` in
  `package.json` directly: installed apps compare their version with the latest GitHub release, so a tag that doesn't
  match `package.json` makes every app offer the same update forever.

## Releasing a new version

Use this whenever the user asks to release, publish, ship or "push a new version".

1. **Start clean.** On `main`, up to date with GitHub, with nothing uncommitted:
   ```bash
   git checkout main && git pull --ff-only && git status --short   # must print nothing
   ```
2. **Run the checks** above. Stop if anything fails.
3. **Choose the version bump** from the commits since the last release
   (`git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)..HEAD`):
   - any commit with `!` (breaking) → `major`
   - otherwise any `feat` → `minor`
   - otherwise (`fix`, `docs`, `chore`, ...) → `patch`

   Tell the user which bump and the resulting version, and ask them to confirm before going on: publishing is public.
4. **Bump, commit and tag** in one step (this updates `package.json` and `package-lock.json` and creates tag `vX.Y.Z`):
   ```bash
   npm version <major|minor|patch> -m "chore(release): %s"
   ```
5. **Have the user push the commit and the tag.** The user pushes with GitKraken; agent sessions have no GitHub
   login, so don't try `git push`. Ask them to:
   - push `main` as usual, **and**
   - push the tag: in GitKraken's left panel under **Tags**, right-click **vX.Y.Z** → **Push vX.Y.Z to origin**.
     (Pushing the branch alone doesn't send the tag, and without the tag no release is built.)

   From a terminal with a GitHub login, `git push --follow-tags` does both.
6. **Follow the build.** `.github/workflows/release.yml` checks the tag matches `package.json`, builds and
   smoke-tests the app on macOS and Windows, then publishes the GitHub release with the installers and generated
   release notes. It takes about 10–15 minutes. Point the user to
   https://github.com/VinnieVH/copilot-fishtank/actions, or check it with
   `curl -s https://api.github.com/repos/VinnieVH/copilot-fishtank/actions/runs?per_page=1` (`gh run watch` if the
   GitHub CLI is installed).
7. **Check the release** once the run is green: https://github.com/VinnieVH/copilot-fishtank/releases/latest should
   list `Agent-Fishtank-arm64.dmg`, `Agent-Fishtank-x64.dmg` and `Agent-Fishtank-Setup.exe`. (The names have no
   version on purpose: `releases/latest/download/<name>` links, used by the website and README, always give the newest.)
   Installed apps offer the update within six hours, or right away via **Check for Updates…**.

**If the workflow fails,** nothing is published and nobody is prompted. Don't move or reuse the tag: fix the problem
in a normal commit, then release the next patch version with the steps above. (An unused failed tag can be deleted
with `git push origin :refs/tags/vX.Y.Z` and `git tag -d vX.Y.Z`, but only if the user asks.)

**Never** mark a release as draft or pre-release unless the user asks: installed apps only see published releases.
