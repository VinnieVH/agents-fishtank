# 🐠 Agent Fishtank

**A little aquarium on your desktop that shows what your AI coding agents are doing.**
· [Website](https://vinnievh.github.io/agents-fishtank/) · [Download](https://github.com/VinnieVH/agents-fishtank/releases/latest)

Every [Claude Code](https://code.claude.com/docs) or
[GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli) session becomes a
glowing fish. It races around while the agent works, waits with a `?` when it needs you, and dozes off (`zZ`) when
it's done. Helpers the agent starts (subagents) swim along as little fish next to it. Glance at the tank and you know
which session needs your attention.

![Agent Fishtank by day](docs/screenshot.png)
![Agent Fishtank at night](docs/screenshot-night.png)

## What you see

| In the tank | What it means |
| --- | --- |
| 🐟 A fish racing around | That session's agent is working |
| ❓ A slow fish with a question mark | It's waiting for you: a permission prompt or a question |
| 💤 A dozing fish | The session is idle |
| 🐠 Little fish next to a big one | Subagents the session started |
| 🤿 Two scuba tanks on the left | **Claude Code:** how much of your Pro/Max plan's 5-hour and weekly limits you have left (bubbles leak when it's nearly empty) |
| 🧭 A pressure gauge on the right | **Copilot:** how much of your premium requests you've used this month; the gold in the treasure chest shrinks along with it |
| 📋 The panel on the right | How many sessions there are and how many need you, then every session (those that need you on top) with its state, a Copilot/Claude badge, its subagents and, for Claude, your usage and when it refills |

Each fish is named after its session: the name you gave it, Claude Code's title for it, or the start of your first
prompt. Sessions get different creatures and glow colours, so no two look alike: a tropical fish, koi, sturgeon,
angelfish, pufferfish, squid, shrimp, lobster, anglerfish, lionfish or octopus
([meet them all](https://vinnievh.github.io/agents-fishtank/creatures.html)). And just for fun: the water follows the real time of day (with glowing plankton at night), a whale or shark
drifts by now and then, a crab comes out when everything is quiet, and you can click the water to feed the fish.

## Install

You need **Claude Code** and/or **GitHub Copilot CLI**. Nothing else; not even Node.js.

### Download it

Get the installer for your computer from the
[latest release](https://github.com/VinnieVH/agents-fishtank/releases/latest):

| Your computer | Download |
| --- | --- |
| Mac with Apple Silicon (M1 or newer) | [Agent-Fishtank-arm64.dmg](https://github.com/VinnieVH/agents-fishtank/releases/latest/download/Agent-Fishtank-arm64.dmg) |
| Mac with Intel | [Agent-Fishtank-x64.dmg](https://github.com/VinnieVH/agents-fishtank/releases/latest/download/Agent-Fishtank-x64.dmg) |
| Windows (x64 or Arm) | [Agent-Fishtank-Setup.exe](https://github.com/VinnieVH/agents-fishtank/releases/latest/download/Agent-Fishtank-Setup.exe) |

**On a Mac**
1. Open the `.dmg` and drag **Agent Fishtank** into **Applications**.
2. Open it from Applications. Because the app isn't signed by Apple yet, macOS blocks it the first time. Go to
   **System Settings → Privacy & Security**, scroll down to the message about Agent Fishtank and click
   **Open Anyway**. (Or run `xattr -dr com.apple.quarantine "/Applications/Agent Fishtank.app"` in Terminal.)

**On Windows**
1. Run the installer. The app isn't signed yet, so Windows SmartScreen may warn you: click **More info → Run anyway**.
2. Agent Fishtank opens when the installer is done.

### Or build it yourself

You need [Git](https://git-scm.com) and [Node.js](https://nodejs.org) 22.18 or newer.

```bash
git clone https://github.com/VinnieVH/agents-fishtank.git
cd agents-fishtank
npm ci
npm run dist
```

This takes a few minutes and puts the installers in the `release` folder: the `.dmg` files on a Mac, the `.exe` on
Windows. Install from there as described above. (On a Mac you can also copy
`release/mac-arm64/Agent Fishtank.app`, or `release/mac/…` on an Intel Mac, straight into Applications.)

### Connect it to your agents

The first time Agent Fishtank starts, it asks to connect to the agents it finds on your computer. Click **Connect**.

That's it. From now on the fishtank **opens by itself when you start a session** and **closes after the last one
ends**. You can close the window any time; it comes back with your next session. Prefer it to stay open, or to start
with your computer? See [Settings](#settings).

To connect or disconnect later, use the menu: **Agent Fishtank** in the menu bar on a Mac, the **File** menu on
Windows (press Alt if you don't see it).

<details>
<summary>What does connecting change?</summary>

- **Claude Code:** adds hooks to `~/.claude/settings.json` that start the app and tell it what your sessions are doing,
  and wraps your status line so the app learns your plan usage. Your own hooks and status line keep working exactly
  as before. A backup of the file is kept as `settings.json.fishtank-backup`, and nothing is changed if the file isn't
  valid JSON.
- **Copilot CLI:** adds one hook file, `~/.copilot/hooks/fishtank.json`, that starts the app.

Disconnecting removes exactly these again and puts your own status line back.

Coming from the older browser version (`install.sh` / `install.ps1`)? Just connect the app: it replaces the old hooks.
</details>

## Updates

Agent Fishtank checks for a new version when it starts and every few hours. When one is out, it asks you:

> **Agent Fishtank 1.2.0 is available.** You have 1.1.0.
> [Download] [Later] [Skip This Version]

**Download** opens the installer for your computer. Quit Agent Fishtank, then install it like the first time: on a
Mac drag it into Applications and replace the old one, on Windows run the installer. Your connection and settings
stay as they are.

You can also check yourself with **Check for Updates…** in the menu. The check is a single request to GitHub's public
release list; to turn it off, set the environment variable `FISHTANK_NO_UPDATE_CHECK=1`.

## Uninstall

**On a Mac:** first choose **Disconnect** in the Agent Fishtank menu (for each agent), then drag the app to the
Trash. If you skip the disconnect, Claude Code keeps calling the removed app and shows hook errors; reinstall and
disconnect, or remove the fishtank entries from `~/.claude/settings.json`.

**On Windows:** uninstall it in **Settings → Apps**. The uninstaller disconnects it for you.

## Troubleshooting

**The air tanks don't show up.**
They need a Claude **Pro or Max** subscription, and appear after your first Claude reply in a terminal session. If
an `ANTHROPIC_API_KEY` is set in your environment, Claude Code uses that instead of your subscription, and there's no
plan usage to show. The Claude desktop app doesn't send usage either, so the tanks keep the last numbers from a
terminal session.

**Claude Code shows "hook error" notices.**
The app isn't running or was removed. Start Agent Fishtank, or disconnect it from the menu (see
[Uninstall](#uninstall)).

**"Port 4321 is already in use."**
Another fishtank is running, often the old browser version. Close it (or restart your computer) and open Agent
Fishtank again.

**macOS says the app can't be opened, or Windows shows a SmartScreen warning.**
The app isn't signed yet; see [Install](#install) for the one-time step.

**A session's fish doesn't show up.**
The tank shows sessions that were active in the last hour. Check that the agent is connected (the menu says
**Disconnect from …** when it is). A new Claude Code session gets its fish with your first message (a session you've
only opened isn't shown yet); a Copilot session as soon as it writes to its log.

## Settings

Click the **gear** at the top of the panel, or choose **Settings…** in the menu (**Agent Fishtank** menu on a Mac,
**File** on Windows; press Alt to show it). Shortcut: ⌘, on a Mac, Ctrl+, on Windows. Changes apply right away and
are remembered.

| Setting | What it does | Default |
| --- | --- | --- |
| **Daylight** | Follow the real sun, or keep the tank always day or always night | Follows the sun |
| **Use my exact location** | Latitude and longitude for sunrise and sunset, instead of a guess from your timezone | Off |
| **Whale or shark** | Lets the occasional whale or shark swim by | On |
| **Keep the crab out** | The crab stays on the sand, not only when every session is idle | Off |
| **Animation** | **Lively**, **Calm** (the water, light and fish move slower) or **Minimal** (barely moving, no visitors). **Automatic** is Lively, or Calm when your system is set to reduce motion | Automatic |
| **Notify when a session needs you** | A notification when a fish gets its `?`: a permission prompt or a question | On |
| **Notify when a session finishes** | A notification when an agent is done and waits for your next message | Off |
| **Only after it has waited for** | 30 seconds, 1 minute or 5 minutes. A session you answer within that time doesn't notify, so you're not told about the one you're working in | 1 minute |
| **Open when a session starts** | Bring up the window when you start a session. Off: the fishtank runs in the background; open it from the Dock (Mac) or by starting Agent Fishtank again | On |
| **Quit after the last session** | Off: the fishtank keeps running after your sessions end; closing the window only hides it. Quit from the menu | On |
| **Start in the background when I log in** | Starts with your computer and keeps running, without opening the window | Off |

Notifications don't appear while the fishtank window is in front either, and clicking one opens the tank. On a Mac, allow
them the first time macOS asks (or later in **System Settings → Notifications → Agent Fishtank**).

<details>
<summary>Environment variables</summary>

| Variable | Default | What it does |
| --- | --- | --- |
| `FISHTANK_PORT` | `4321` | The local port the app listens on. Connect again after changing it. |
| `FISHTANK_NO_UPDATE_CHECK` | not set | Set to `1` to never check for updates |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | Claude Code's settings folder |
| `COPILOT_HOME` | `~/.copilot` | Copilot CLI's folder |
| `COPILOT_SESSION_DIR` | `$COPILOT_HOME/session-state` | Where Copilot CLI keeps its session logs, if somewhere else |
</details>

## Privacy

Everything stays on your computer. The app only listens on `127.0.0.1`, reads your agents' local session files, and
never answers your agents' hooks with anything but an empty "OK", so it can't change what they do. The only thing it
sends over the internet is the update check to GitHub.

---

## For developers

<details>
<summary>How it works</summary>

- **Starting:** connecting adds a session-start hook to each CLI that runs the app's small command line
  (`fishtank start`, shipped inside the app as `bin/fishtank.sh` / `bin/fishtank.cmd`). It starts the app unless it's
  already running. The command line runs on the app's own binary in Node mode, so users don't need Node.js.
- **Copilot CLI:** the app tails `~/.copilot/session-state/<session>/events.jsonl` every second and derives each
  session's state from the events (turn start/end, tool calls, permission requests, subagent start/complete). It also
  reads the premium-request quota that the CLI logs with each model call (`quotaSnapshots`) for the gauge.
- **Claude Code:** its transcript format is internal and changes between versions, so the app relies on the
  documented [hooks](https://code.claude.com/docs/en/hooks): `http` hooks POST every prompt, tool call, permission
  prompt, stop and subagent start/stop to `http://127.0.0.1:4321/hook/claude`. Hooks don't fire on everything (not
  when you press Esc or answer a permission prompt), so the app also reads the small file Claude Code keeps per
  running session (`~/.claude/sessions/<pid>.json`), which says the moment a session turns busy, idle or waiting
  (spare processes Claude Code starts in advance, and its daemons, are skipped). A session gets its fish once it's
  used: a session that's only been opened runs under a temporary id until the first message. For
  the session title it follows the transcript, reading only new lines and picking out just the title records. Those
  two sources aren't documented; if Claude Code changes them, the app falls back to the hooks and the first prompt.
- **Claude plan usage:** Claude Code only gives it to the status line, so connecting sets the status line to
  `fishtank statusline`. That passes the `rate_limits` part of its input to the app and then runs your own status line
  (kept base64-encoded at the end of the command) with the same input. Without one of your own, it shows the model and
  your usage. The last usage is cached in a temp file so the tanks show right away after a restart.
- **Big logs:** a Copilot log is read from its last 8 MB the first time and a Claude transcript from its last 4 MB;
  after that only new lines. Sessions are forgotten an hour after they went quiet.
- **Quitting:** every 5 seconds the app checks whether a CLI still runs (Copilot's `inuse.<pid>.lock` files, Claude
  Code's session files). Once none has for ~15 seconds it quits, unless **Quit after the last session** is off or it
  was started at login. Closing the window while sessions run only hides it, so the hooks keep working. Opened by
  hand, it stays until a session has come and gone.
- **Settings:** the server keeps them in `settings.json` in the app's data folder (`npm start` uses a temp file) and
  sends them to the page with every update; the page's dialog posts changes to `/settings` (JSON from a localhost page
  only). The app itself acts on the notification and launch settings (`electron/main.ts`).
- **Updates:** the app asks GitHub for the latest published release (`electron/updates.ts`). It can't install updates
  by itself yet: on macOS that needs a signed app.
</details>

<details>
<summary>Development</summary>

The page is a [Vite](https://vite.dev) + TypeScript + [PixiJS](https://pixijs.com) app in `src/`. The desktop app is
[Electron](https://www.electronjs.org): `electron/main.ts` runs the server from `server/` and shows the page, and
Vite bundles both into `dist-electron/`. The server can also run on its own straight from source with Node 22.18+
(`node server/index.ts`), so it may only use TypeScript syntax Node can strip (no enums or parameter properties),
which `npm run typecheck` enforces through `tsconfig.server.json`.

```bash
npm ci               # install
npm run app          # build and run the app from source (it can't be connected from source)
npm start            # or run just the server and open http://localhost:4321 (FISHTANK_KEEP_ALIVE=1 keeps it up)
npm run dev          # the page with hot reload on http://localhost:5173 (with npm start running)
npm run typecheck    # TypeScript (page, server and app)
npm test             # unit tests (Vitest)
npm run dist:dir     # package the app for this computer into release/ (unpacked, quick)
npm run dist         # build the installers into release/
```

To work on a creature, run `npm run dev` and open http://localhost:5173/creatures.html?c=octopus: each species large
in its colour variants, and swimming as a working, waiting and idle session (`&night` for the night tank). Its
drawing is in `src/art/fishArt.ts`, its size and speed in `src/species.ts`; the page reloads as you change them.

For screenshots and trying out the scenery, these options override the settings. In a browser (`npm start` /
`npm run dev`) they're URL parameters: `?time=22:30&shark`. The app takes them as arguments:
`open -a "Agent Fishtank" --args --time=22:30 --shark` on a Mac, `"Agent Fishtank.exe" --time=22:30 --shark` on
Windows.

| Option | What it does |
| --- | --- |
| `time=22:30` | Show the tank at a fixed time of day |
| `timelapse` | Run a whole day in about a minute |
| `lat=51.05`, `lon=3.72` | A location for the sun |
| `whale` / `shark` | Summon the whale or the shark right away |
| `crab` | Keep the crab out on the sand |

| Path | What |
| --- | --- |
| `src/main.ts` | Sets up the Pixi app, the layers, the session → fish sync and the loop |
| `src/scene/` | Fish, water, sky, whale and shark, crab, fish food, credits gauge, air tanks |
| `src/art/` | Canvas 2D painters for the fish, terrain, whale, shark and crab |
| `src/panel.ts` | Side panel, Claude usage and the live `/events` connection |
| `src/settings.ts`, `shared/settings.ts` | The settings dialog; the settings, their defaults and validation |
| `src/sky.ts`, `src/species.ts`, `src/credits.ts`, `src/limits.ts` | Sun and light, species and glow colour picker, Copilot credits, Claude usage |
| `creatures.html` | Dev page to look at one creature at a time (`npm run dev`) |
| `shared/types.ts` | The live feed's types, shared by the server and the page |
| `server/server.ts` | HTTP server: `/events` feed, `/hook/claude`, `/statusline/claude`, `/settings`, the page, idle check |
| `server/copilot.ts`, `server/claude.ts` | Session state from Copilot's logs and from Claude Code's hooks and files |
| `server/logtail.ts` | Follows a growing log a few new lines at a time |
| `server/index.ts` | Runs the server on its own, for development |
| `electron/main.ts` | The app: window, menu, connect dialog, notifications, start at login, quitting when idle |
| `electron/connect.ts` | Connects/disconnects Claude Code and Copilot CLI |
| `electron/updates.ts`, `electron/releases.ts` | Update check and prompt |
| `electron/cli.ts`, `electron/bin/` | The app's command line (`start`, `statusline`, `disconnect`) and its launchers |
| `build/` | App icon and the Windows uninstaller hook |
</details>

<details>
<summary>Releasing a new version</summary>

Versions follow [semantic versioning](https://semver.org): `major.minor.patch`. Use a **patch** for fixes, a **minor**
for new features, a **major** for changes that break how people use or connect the app.

1. Make sure everything is committed and `main` is up to date.
2. Bump the version. This updates `package.json`, commits it and tags it (`v1.2.0`):
   ```bash
   npm version minor -m "chore(release): %s"     # or patch / major
   ```
3. Push the commit and the tag:
   ```bash
   git push --follow-tags
   ```

GitHub Actions (`.github/workflows/release.yml`) then builds the app on macOS and Windows, smoke-tests it, and
publishes a GitHub release with the installers and release notes generated from the commits. Within six hours every
installed app offers the update (or right away when someone restarts it or picks **Check for Updates…**).

- If a build or test fails, nothing is published and nobody is prompted. Fix it, then release a new patch version.
- The tag must match `package.json`; the workflow refuses tags that don't (that's why releases go through
  `npm version`).
- Only published releases count. A release you mark as draft or pre-release on GitHub prompts no one.
- The apps aren't signed yet. Signing them later (an Apple Developer ID, a Windows code-signing certificate) only
  needs secrets added to the workflow, and would also allow installing updates automatically.
</details>

## License

[MIT](LICENSE)
