# Agent Fishtank: notes for coding agents

A desktop aquarium (Electron) that shows Claude Code and GitHub Copilot CLI sessions as fish. The README explains
the app for users; its "For developers" sections explain the architecture. This file holds the rules agents (and
humans) must follow in this repo: how to check, test and release, and how code here should be written.

## What this project is

Three parts in TypeScript, no UI framework:

- **The page** (`src/`): a Vite + PixiJS app that draws the tank and the side panel with plain DOM. It runs in the
  app's window and in a browser (`npm start`), where there are no terminals.
- **The server** (`server/`): a Node HTTP server on `127.0.0.1` that follows the CLIs' session logs and hooks and
  streams a snapshot to the page. It runs from source without a build (`node server/index.ts`).
- **The desktop app** (`electron/`): starts the server, shows the page, connects the CLIs, runs the built-in
  terminals and checks for updates.

```
src/main.ts         Pixi app, layers, session → fish sync, the frame loop
src/scene/          things that move in the tank (Pixi display objects)
src/art/            Canvas 2D painters: fish, terrain, reef, visitors
src/*.ts            panel, settings dialog, terminals UI, sky, species, small helpers (util.ts)
shared/             types and pure logic used by more than one part (feed, settings, terminals)
server/             HTTP server, Copilot and Claude session parsers, log tailing, terminal focus
electron/           app main process, preload (IPC bridge), connecting CLIs, terminals, updates, command line
tests/              Vitest, one file per module (tests/<module>.test.ts)
site/               the project website (plain HTML/CSS/JS, no build)
scripts/demo/       demo video and creature picture recorders
```

## Checks

Run these before committing or releasing; all must pass:

```bash
npm run typecheck    # page, server and app
npm run lint         # oxlint with the rules below (.oxlintrc.json)
npm test             # Vitest
npm run build        # page + Electron bundles
```

To try the packaged app: `npm run dist:dir`, then `release/mac-arm64/Agent Fishtank.app` (macOS) or
`release\win-unpacked\Agent Fishtank.exe` (Windows). For anything visible, look at it running: `npm run dev` with
`npm start`, or the app.

The project website is `site/` (plain HTML/CSS/JS, no build). `.github/workflows/pages.yml` publishes it to GitHub
Pages (https://vinnievh.github.io/agents-fishtank/) with `docs/screenshot*.png` and `build/icon.png` whenever they
change on `main`. Its download button links to `releases/latest/download/<installer>`, so releases need no website
change.

The demo video on the website (`site/demo.mp4`) is recorded from the real tank by `npm run demo:record` (needs Google
Chrome and ffmpeg; set `CHROME`/`FFMPEG` if they aren't in the usual place). The story (sessions, terminal and
mouse) is in `scripts/demo/stage.html`. Re-record it when the tank's look changes noticeably; check a few frames first
with `node scripts/demo/record.mjs --stills 3,8,11,17,22 <dir>`. The website's creatures page (`site/creatures.html`)
shows pictures made by `node scripts/demo/creatures.mjs` (writes `site/creatures/*.png`); run it again after adding
or changing a creature, and add a card for a new one. Keep the video around 3 MB: each new recording adds
to the repository's size for good.

## Non-negotiables

1. **Behaviour must not change by accident.** Refactors keep what the user sees and what the CLIs see identical,
   and the tests keep passing. If behaviour changes on purpose, say so.
2. **Everything stays on the user's computer** (README "Privacy"). The server listens only on `127.0.0.1`, hooks are
   answered with an empty "OK" so the app can't change what an agent does, and the only request to the internet is
   the update check. Don't add telemetry or other network calls. The one exception is sharing on the network, which
   the user turns on: a separate watch-only server (`server/share.ts`) that serves the page and, with its secret key,
   the feed, and nothing else. Never add routes to it.
3. **The app only reads the CLIs' own files.** It never writes into `~/.copilot` or `~/.claude`, except the hook and
   status line entries `electron/connect.ts` adds and removes, and the repair of files only an administrator may open
   (`electron/access.ts`), which the user confirms first. Session logs can be huge: read their tail, then only new lines
   (`server/logtail.ts`).
4. **Electron stays locked down.** The window keeps `contextIsolation`, `sandbox` and no `nodeIntegration`. The page
   reaches the app only through the small API in `electron/preload.ts`, and every IPC handler checks that the call
   comes from the tank page (`allowed()` in `electron/terminals.ts`). Never expose terminals or files over the local
   HTTP server: any web page can send requests to localhost.
5. **Session data is text.** Names, prompts and subagent descriptions come from the CLIs. Set them with
   `textContent`, or pass them through `escapeHtml()` (`src/util.ts`) when building HTML strings. Never put them into HTML
   or a shell command unescaped.
6. **Windows and macOS both work.** Build paths with `path.join`, look up per-user folders through `places()`
   (`electron/connect.ts`), and keep platform-specific code behind a `process.platform` check, with the other
   platform's path still working.

## Principles

### KISS: keep it simple

- Write the most direct code that solves today's problem. No speculative options, generic frameworks or
  abstractions "for later".
- Prefer plain functions and plain data. Classes are for things with a lifetime of their own: Pixi display objects
  (`src/scene/`), a log being followed, a running terminal, a session parser holding its sessions.
- If a reviewer needs a comment to follow the control flow, simplify the control flow first.

### DRY: don't repeat yourself (sensibly)

- Before writing a helper, look in `src/util.ts` (`rng`, `hash`, `shade`, `escapeHtml`, `formatDuration`, `smooth`),
  `src/art/canvas.ts` (`makeCanvas`, `paintTexture`), `server/session.ts` (`toSession`, `pidAlive`, `titleFrom`,
  `isRecord`, `parseJson`) and `shared/`.
- When the same logic appears a **third** time, extract it. Two similar snippets are often fine; a premature
  abstraction is harder to undo than duplication.
- Shared means shared: code used by one module lives in that module. Move it to `src/util.ts` or a `shared/` module
  when a second one needs it. Anything both the page and the server or app need goes in `shared/`.
- The feed's shape is defined once, in `shared/types.ts`; settings and their defaults once, in `shared/settings.ts`.

### SOLID, applied here

- **Single responsibility.** Parsing, state and maths are pure functions in a `.ts` module with their own tests;
  drawing (`src/art/`), animating (`src/scene/`) and wiring (`src/main.ts`, `electron/main.ts`) call them. A painter
  paints, a parser parses.
- **Open/closed.** Extend through data tables and lookups (species in `src/species.ts`, visitors, the `COMMANDS` of
  the terminals) rather than growing `if`/`switch` chains.
- **Liskov substitution.** A subclass of a Pixi `Container` or `Sprite` behaves like one (adding, removing and
  destroying it works as usual). Types narrow honestly: no `as` casts or `!` to silence the compiler where a check
  belongs.
- **Interface segregation.** Functions ask for what they use: a session's `id`, not the whole snapshot; `Pick<>` for
  data shapes. Option objects list only what's needed (see `TerminalsOptions`).
- **Dependency inversion.** Logic takes its inputs (folders, the time, the environment) as parameters with the real
  thing as default, like `places(env, home)` and `copilot.list(now)`, so tests can pass their own. Don't reach for
  `Date.now()`, `os.homedir()` or `process.env` deep inside logic.

## Readability

These apply to code you write or change. Don't restyle untouched code as a side task; that's a separate change.

### Names

- Use descriptive, full-word names: `session`, `fish`, `event`, `folder`, `index`, `total`. No single letters or
  vowel-dropped abbreviations (`s`, `e`, `p`, `cnt`, `sess`). The only short names allowed are `x`/`y`/`z` for
  coordinates, `w`/`h` for sizes and `g` for a canvas 2D context in painters, `t` for animation time, and `_` for
  unused values. Type parameters may be a single capital letter (`T`, `K`).
- Name for the domain, not the type: `waitingSessions`, not `list`; `lockFile`, not `str2`.
- Booleans read as yes/no questions: `isWorking`, `hasLock`, `canRepair`.
- Functions are verbs (`readTail`, `paintCoral`); classes and types are nouns in PascalCase; module constants are
  UPPER_SNAKE_CASE.
- Avoid filler names: `data`, `info`, `item`, `temp`, `result`, `value`, `handleStuff`. If you can't name it, the
  function probably does too much.

### Size and complexity

| Limit                              | Value                          |
| ---------------------------------- | ------------------------------ |
| Cyclomatic complexity per function | 10                             |
| Block nesting depth                | 3                              |
| Parameters per function            | 3 (pass an object beyond that) |
| Nested callbacks                   | 3                              |
| Lines per function                 | 80                             |
| Lines per file                     | 300                            |

`npm run lint` (oxlint, `.oxlintrc.json`) enforces these, the short-name rule, arrow functions, `import type` and no
`any`; CI fails on any problem. The lint config is the standard: change the code, not the rules. When you hit a limit,
split by responsibility: extract a pure helper, a lookup table or a smaller painter. Prefer early returns over nested
`if`s, and lookups over nested ternaries. The one exception is the parameter limit in code that runs many times every
frame: an options object there allocates each call, so keep the positional parameters, say why in a comment and add
`// oxlint-disable-next-line max-params`. No other disable comments.

### Comments

Keep comments rare. Code says **what** it does through its names; a comment is only for what the code can't say:

- **TODOs**, with enough context to act on them: `// TODO: drop once Copilot CLI logs the session name`.
- **Why** something is done in a way that isn't obvious: a CLI's undocumented format, a platform quirk (the Windows
  foreground lock), a security constraint, a workaround and its reason, two places that must change together.

Everything else goes: no comments that restate the code, no JSDoc that repeats the function's name, no section
banners, no commented-out code. If a comment seems needed to explain what code does, rename or split the code.

## Code conventions

- **Functions:** arrow functions for new code (`const readTail = (file: string) => …`). Classes as described under
  KISS.
- **Imports:** Node built-ins (`node:fs`), then packages, then project code, each group alphabetised. Types use
  `import type`. `server/`, `shared/` and `electron/` import with the `.ts` extension (Node runs them from source).
- **TypeScript:** strict. No `any`; use `unknown` and narrow anything read from a CLI's files, a hook or IPC. Type
  what you parse with only the fields used.
- **The page:** plain DOM and PixiJS. Static styles go in `src/style.css`, inline `style` only for values computed at
  runtime. It must work without `window.fishtankTerminals` (the browser version). Destroy Pixi objects and textures
  you no longer need.
- **The server and app:** no blocking work in a timer that runs every second beyond small reads; spawn processes with
  `execFile` and an argument list, never a shell string built from data.
- **Accessibility:** interactive things are `<button>`s or `<a>`s, never clickable `<div>`s; form controls have
  labels.
- **Tests:** Vitest in `tests/<module>.test.ts`. Pure logic gets unit tests; test behaviour (what a session's state
  becomes, what a user sees), not implementation details. Use temp folders for files, never the user's real ones.

## Rules

- **Commits:** Conventional Commits, title only (no body, no footer, no `Co-Authored-By`), e.g.
  `feat(tanks): show Claude usage in the side panel`. Mark breaking changes with `!`. Commit only when the user asks.
  The user pushes with GitKraken (agent sessions have no GitHub login), so ask them to push.
- **The server runs straight from source** with Node's type stripping (`node server/index.ts`): in `server/`,
  `shared/` and `electron/` use only erasable TypeScript (no enums, namespaces or parameter properties).
  `npm run typecheck` enforces it.
- **Never touch the user's real agent settings while testing.** Point `CLAUDE_CONFIG_DIR`, `COPILOT_HOME` and
  `FISHTANK_PORT` at a scratch folder and a spare port. The user's own app runs on port 4321.
- **A packaged test build (`npm run dist:dir`) shares the installed app's data folder** (settings, `state.json`), and
  turning on "Start in the background when I log in" there registers a real login item. Tell the user before testing
  with it, and switch that setting back off afterwards. `npx electron . --user-data-dir=<scratch dir>` keeps a source
  run apart.
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
   https://github.com/VinnieVH/agents-fishtank/actions, or check it with
   `curl -s https://api.github.com/repos/VinnieVH/agents-fishtank/actions/runs?per_page=1` (`gh run watch` if the
   GitHub CLI is installed).
7. **Check the release** once the run is green: https://github.com/VinnieVH/agents-fishtank/releases/latest should
   list `Agent-Fishtank-arm64.dmg`, `Agent-Fishtank-x64.dmg` and `Agent-Fishtank-Setup.exe`. (The names have no
   version on purpose: `releases/latest/download/<name>` links, used by the website and README, always give the newest.)
   Installed apps offer the update within six hours, or right away via **Check for Updates…**.

**If the workflow fails,** nothing is published and nobody is prompted. Don't move or reuse the tag: fix the problem
in a normal commit, then release the next patch version with the steps above. (An unused failed tag can be deleted
with `git push origin :refs/tags/vX.Y.Z` and `git tag -d vX.Y.Z`, but only if the user asks.)

**Never** mark a release as draft or pre-release unless the user asks: installed apps only see published releases.

## Definition of done

- `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass, with no new disable comments.
- New logic has tests; existing tests still pass.
- Visible changes have been looked at in the tank, and terminal or connect changes tried in the app (on a scratch
  user data folder, see the rules above).
- The diff contains only what the task needed, and the README is updated when behaviour or architecture changes.
