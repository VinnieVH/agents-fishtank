# 🐠 Agent Fishtank

A live aquarium for your [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli)
and [Claude Code](https://code.claude.com/docs) sessions. Use either one, or both side by side.
Every session is a glowing fish: it **races around while the agent is working**, slows down with a `?` when it's
**waiting for you**, and drifts lazily with `zZ` when it's **idle**. Subagents swim alongside as little copies of their parent.

![Agent Fishtank](docs/screenshot.png)
![Agent Fishtank at night](docs/screenshot-night.png)

## Features

- One fish per Copilot CLI or Claude Code session that was active in the last hour, labelled with its session name
  (the name you set with `/rename`, or else the start of your first prompt).
- Cartoon-style fish with ink outlines and big glossy eyes, rendered with WebGL ([PixiJS](https://pixijs.com)); their bodies
  bend as they swim and they glow in their session's neon colour. The seabed (seaweed, anemones, coral, rocks, a stone
  arch and a treasure chest) is drawn in the same cartoon style.
- Each session gets its own species — tropical fish, koi, sturgeon, angelfish or pufferfish. New sessions get the species
  that's least common in the tank so you get a good mix, and a session keeps its species (even across page reloads).
- A small fish of the same species and colours for every running subagent, swimming close to its parent.
- Every few minutes a humpback whale or a great white shark glides by far in the background, never both at once (add `?whale` or `?shark` to the URL to summon one right away).
- When every session is idle (or there are none), a little red crab comes out to stroll along the sand: he looks
  around, snaps his claws or does a little dance. When a new fish appears or a session gets busy, he jumps in fright and
  sprints off the screen.
- Click the water to drop a pinch of fish food: it sinks slowly, and the nearest fish that isn't already eating darts
  over and gobbles it up flake by flake. Uneaten flakes settle on the sand and fade away.
- Day/night cycle that follows the real sun for your PC's clock and timezone: bright water by day, a warm glow at dawn
  and dusk, and moonlit water at night with bioluminescent plankton and extra-glowy fish. The location is estimated
  from your timezone; set it exactly with `?lat=51.05&lon=3.72`. Preview a time with `?time=22:30`, or watch a whole
  day in a minute with `?timelapse`.
- Side panel listing sessions with a 🟢 working / 🔴 idle / blinking 🔴 waiting-for-input dot and a Copilot or Claude
  badge, and their subagents underneath (running, ✓ done, ✗ failed) with agent type and duration. "Waiting" means a
  permission prompt or a question for you (Copilot's `ask_user`, Claude's `AskUserQuestion` or plan approval).
- Your Copilot premium requests, like VS Code's "80% used": a pressure gauge in front of the tank (bottom right) shows
  the credits used from 0 to 100%, with a red zone for the last 20% that pulses once the needle is in it (faster
  under 10% left). A plaque on its pipe shows the credits left and the reset date. The gold in the treasure chest
  shrinks as credits run out (empty at 0%), with one diamond, ruby or sapphire for every 20% left. Read from the
  quota snapshot the CLI writes to its session logs, so no extra login or API call.
- Your Claude Pro/Max plan usage as a diver's two scuba tanks standing in the sand by the rocks: the big yellow one
  for the 5-hour limit, the slim coral one leaning on it for the weekly limit. A sight glass on each shows the air
  left (cyan, amber under 25%, red under 10%), and a dive slate in the sand says how much is left and when it refills.
  An almost empty tank leaks bubbles from its valve. Claude Code only gives this usage to its status line, so the
  installer wraps your status line (see below); it looks exactly as before.
- Starts automatically when you start a `copilot` or `claude` session, and shuts down when the last one closes.
- The server has no runtime dependencies and only listens on `127.0.0.1`. It never steers your agent: it reads
  Copilot's local session logs and receives Claude Code's hook events, always answering with an empty response.

## Requirements

- [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli) and/or
  [Claude Code](https://code.claude.com/docs)
- [Node.js](https://nodejs.org) 22.18 or newer (with npm). The server is TypeScript and runs directly on Node's
  built-in type stripping, with no build step.
- macOS/Linux: `bash` and `curl`

## Install

Clone the repo somewhere permanent (the hooks point to this folder), then run the installer. It installs the npm
dependencies, builds the page into `dist/` and registers the hooks for every CLI it finds (Copilot CLI, Claude Code or
both). To pick one yourself, name it: `./install.sh claude` or `./install.sh copilot`.

**Windows (PowerShell)**

```powershell
git clone https://github.com/VinnieVH/agent-fishtank.git
cd agent-fishtank
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**macOS / Linux**

```bash
git clone https://github.com/VinnieVH/agent-fishtank.git
cd agent-fishtank
./install.sh
```

That's it. Start `copilot` or `claude` and the fishtank opens in your browser at <http://localhost:4321>.

After pulling updates, rebuild with `npm ci && npm run build` (or run the installer again).

> **Upgrading from Copilot Fishtank?** The server is now TypeScript and needs Node.js 22.18 or newer, and the start
> script moved to `server/index.ts`. Update Node if needed and run the installer again; it also adds Claude Code if
> you have it.

## How it works

- **Starting:** on every session start, `start-fishtank.ps1` / `start-fishtank.sh` starts the server in the background
  if it isn't running yet and opens the browser. If the server is already running, it does nothing.
- **Copilot CLI:** the installer adds a user-level [hook](https://docs.github.com/copilot/reference/hooks-configuration)
  at `~/.copilot/hooks/fishtank.json` (respects `COPILOT_HOME`) that runs the start script. The server tails
  `~/.copilot/session-state/<session>/events.jsonl` every second and derives each session's state from the event
  stream (turn start/end, tool calls, permission requests, subagent start/complete). It also forwards the latest
  premium-request quota that the CLI logs with each model call (`quotaSnapshots`), for the credits gauge.
- **Claude Code:** Claude Code's transcript format is internal and changes between versions, so the fishtank uses its
  documented [hooks](https://code.claude.com/docs/en/hooks) instead. The installer adds them to
  `~/.claude/settings.json` (respects `CLAUDE_CONFIG_DIR`). A `SessionStart` hook runs the start script, and `http`
  hooks POST every prompt, tool call, permission prompt, stop and subagent start/stop to
  `http://127.0.0.1:4321/hook/claude`. Your own hooks and settings are left alone. The previous file is kept as
  `settings.json.fishtank-backup`, and the installer stops without changing anything if the file isn't valid JSON.
  Hooks don't fire on everything (not when you press Esc or answer a permission prompt), so the server also reads
  the small file Claude Code keeps per running session (`~/.claude/sessions/<pid>.json`), which says the moment a
  session turns busy, idle or waiting, and the name you gave it. That file isn't documented; if a Claude Code update
  changes it, the fishtank falls back to the hooks alone.
- **Claude plan usage:** the installer sets Claude Code's status line to `scripts/statusline.ts`, which passes the
  `rate_limits` part of its input to the server and then runs your own status line (kept, base64-encoded, at the end
  of the command) with the same input, so you see the same status line as before. Without a status line of your own
  it shows the model and your usage (any status line hides Claude Code's footer hints, so it shows something useful). The last usage is kept in a temp file so the tanks show right away after a restart.
- `server/index.ts` merges both into one live feed, pushes it to the page over Server-Sent Events, and serves the
  built page from `dist/`.
- Long sessions write big logs. The server reads a Copilot log only from its last 8 MB when it first sees it and then
  just the new lines, never reads Claude Code's transcripts, and forgets sessions an hour after they went quiet.
- Every 5 seconds the server checks whether a CLI is still running: Copilot's `inuse.<pid>.lock` files and Claude
  Code's `~/.claude/sessions/<pid>.json` files. Once neither has been running for ~15 seconds it shows an "All sessions
  closed" screen in the page and exits. With several sessions open it keeps running until the last one closes.

## Run manually

```bash
npm run build        # once, and after every change to the page
npm start            # or: node server/index.ts
```

Then open <http://localhost:4321>. When started manually it still exits once no Copilot CLI or Claude Code is running; set
`FISHTANK_KEEP_ALIVE=1` to keep it up.

## Development

The page is a [Vite](https://vite.dev) + TypeScript + PixiJS app in `src/`. The server is plain Node in TypeScript in
`server/`, run straight from source. It may only use TypeScript syntax Node can strip (no enums or parameter
properties), which `npm run typecheck` enforces through `tsconfig.server.json`.

| Path                 | What                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `src/main.ts`        | Sets up the Pixi app, the layers, the session → fish sync and the loop |
| `src/scene/`         | Fish (swim physics, bending body, labels), water, sky overlay, whale and shark passers-by, crab, fish food, credits gauge, air tanks |
| `src/art/`           | Canvas 2D painters for the fish, terrain, whale, shark and crab, used as textures |
| `src/sky.ts`         | Sun position and day/night light                                       |
| `src/species.ts`     | Species table and the least-common species picker                      |
| `src/panel.ts`       | Side panel and the live `/events` connection                           |
| `src/credits.ts`     | Credits used/left, low warning and chest gold level from the quota     |
| `src/limits.ts`      | Claude plan usage → air left in the 5-hour and weekly tanks            |
| `shared/types.ts`    | The live feed's types, shared by the server and the page               |
| `server/index.ts`    | HTTP server: `/events` feed, `/hook/claude`, static page, auto-shutdown |
| `server/copilot.ts`  | Copilot CLI: tails the session logs, quota, process check              |
| `server/claude.ts`   | Claude Code: hook events → session state, process check                |
| `scripts/claude-hooks.ts` | Adds/removes the hooks and status line in Claude Code's `settings.json` (used by the installers) |
| `scripts/statusline.ts` | Claude Code status line: forwards the plan usage, then runs yours |

```bash
npm start            # terminal 1: the data server (set FISHTANK_KEEP_ALIVE=1 to keep it running)
npm run dev          # terminal 2: page with hot reload on http://localhost:5173, proxies /events to the server
npm run typecheck    # TypeScript (page and server)
npm test             # unit tests (Vitest)
npm run build        # production build into dist/
```

## Configuration

| Environment variable   | Default                    | Description                                   |
| ---------------------- | -------------------------- | --------------------------------------------- |
| `FISHTANK_PORT`        | `4321`                     | Port to listen on (localhost only). The Claude Code hooks use the port set at install time, so run the installer again after changing it. |
| `COPILOT_SESSION_DIR`  | `~/.copilot/session-state` | Where Copilot CLI stores its session logs     |
| `CLAUDE_CONFIG_DIR`    | `~/.claude`                | Claude Code's config folder (settings, running sessions) |
| `FISHTANK_KEEP_ALIVE`  | unset                      | Set to `1` to disable auto-shutdown           |

URL parameters for the page (combine them with `&`, e.g. <http://localhost:4321/?time=22:30&shark>):

| Parameter            | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `?lat=51.05&lon=3.72` | Your exact location for the sun position (default: guessed from timezone) |
| `?time=22:30`        | Show the tank at a fixed time of day                                |
| `?timelapse`         | Run a whole day in about a minute                                   |
| `?whale` / `?shark`  | Summon the humpback whale or the great white shark right away         |
| `?crab`              | Keep the crab out on the sand, even while sessions are busy (he still bolts when a new fish arrives) |

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall.ps1   # Windows
```

```bash
./uninstall.sh                                             # macOS / Linux
```

This removes the Copilot hook file and only the fishtank's entries from Claude Code's `settings.json` (your own
status line is put back), then stops the server. Then delete the folder.

## License

[MIT](LICENSE)
