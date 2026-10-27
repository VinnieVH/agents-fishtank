# 🐠 Copilot Fishtank

A live aquarium for your [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli) sessions.
Every session is a glowing fish: it **races around while the agent is working**, slows down with a `?` when it's
**waiting for you**, and drifts lazily with `zZ` when it's **idle**. Subagents swim alongside as little copies of their parent.

![Copilot Fishtank](docs/screenshot.png)
![Copilot Fishtank at night](docs/screenshot-night.png)

## Features

- One fish per Copilot CLI session that was active in the last hour, labelled with its session name (set with `/rename`).
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
- Day/night cycle that follows the real sun for your PC's clock and timezone: bright water by day, a warm glow at dawn
  and dusk, and moonlit water at night with bioluminescent plankton and extra-glowy fish. The location is estimated
  from your timezone; set it exactly with `?lat=51.05&lon=3.72`. Preview a time with `?time=22:30`, or watch a whole
  day in a minute with `?timelapse`.
- Side panel listing sessions with a 🟢 working / 🔴 idle / blinking 🔴 waiting-for-input dot, and their subagents
  underneath (running, ✓ done, ✗ failed) with agent type and duration.
- Your Copilot premium requests, like VS Code's "80% used": a pressure gauge in front of the tank (bottom right) shows
  the credits used from 0 to 100%, with a red zone for the last 20% that pulses once the needle is in it (faster
  under 10% left). A plaque on its pipe shows the credits left and the reset date. The gold in the treasure chest
  shrinks as credits run out (empty at 0%), with one diamond, ruby or sapphire for every 20% left. Read from the
  quota snapshot the CLI writes to its session logs, so no extra login or API call.
- Starts automatically when you launch `copilot`, and shuts down when the last Copilot CLI closes.
- The server has no runtime dependencies. Read-only: it only reads Copilot's local session logs and listens on `127.0.0.1`.

## Requirements

- [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli)
- [Node.js](https://nodejs.org) 20.19 or newer (with npm)
- macOS/Linux: `bash` and `curl`

## Install

Clone the repo somewhere permanent (the hook points to this folder), then run the installer. It installs the npm
dependencies, builds the page into `dist/` and registers the hook.

**Windows (PowerShell)**

```powershell
git clone https://github.com/VinnieVH/copilot-fishtank.git
cd copilot-fishtank
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

**macOS / Linux**

```bash
git clone https://github.com/VinnieVH/copilot-fishtank.git
cd copilot-fishtank
./install.sh
```

That's it. Start `copilot` and the fishtank opens in your browser at <http://localhost:4321>.

After pulling updates, rebuild with `npm ci && npm run build` (or run the installer again).

## How it works

- The installer adds a user-level Copilot CLI [hook](https://docs.github.com/copilot/reference/hooks-configuration)
  at `~/.copilot/hooks/fishtank.json` (respects `COPILOT_HOME`). On every `sessionStart` it runs
  `start-fishtank.ps1` / `start-fishtank.sh`, which starts the server in the background if it isn't running yet
  and opens the browser. If the server is already running, it does nothing.
- `server.js` tails `~/.copilot/session-state/<session>/events.jsonl` every second and derives each session's state
  from the event stream (turn start/end, tool calls, permission requests, subagent start/complete). It pushes
  updates to the page over Server-Sent Events, and serves the built page from `dist/`. It also forwards the latest
  premium-request quota that the CLI logs with each model call (`quotaSnapshots`), for the credits gauge.
- Every 5 seconds the server checks the `inuse.<pid>.lock` files of the sessions. Once no Copilot CLI process has
  been running for ~15 seconds it shows a "Copilot closed" screen in the page and exits. With multiple Copilot
  windows open it keeps running until the last one closes.

## Run manually

```bash
npm run build        # once, and after every change to the page
npm start            # or: node server.js
```

Then open <http://localhost:4321>. When started manually it still exits once no Copilot CLI is running; set
`FISHTANK_KEEP_ALIVE=1` to keep it up.

## Development

The page is a [Vite](https://vite.dev) + TypeScript + PixiJS app in `src/`:

| Path                 | What                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `src/main.ts`        | Sets up the Pixi app, the layers, the session → fish sync and the loop |
| `src/scene/`         | Fish (swim physics, bending body, labels), water, sky overlay, whale and shark passers-by, crab, credits gauge |
| `src/art/`           | Canvas 2D painters for the fish, terrain, whale, shark and crab, used as textures |
| `src/sky.ts`         | Sun position and day/night light                                       |
| `src/species.ts`     | Species table and the least-common species picker                      |
| `src/panel.ts`       | Side panel and the live `/events` connection                           |
| `src/credits.ts`     | Credits used/left, low warning and chest gold level from the quota     |

```bash
npm start            # terminal 1: the data server (set FISHTANK_KEEP_ALIVE=1 to keep it running)
npm run dev          # terminal 2: page with hot reload on http://localhost:5173, proxies /events to the server
npm run typecheck    # TypeScript
npm test             # unit tests (Vitest)
npm run build        # production build into dist/
```

## Configuration

| Environment variable   | Default                    | Description                                   |
| ---------------------- | -------------------------- | --------------------------------------------- |
| `FISHTANK_PORT`        | `4321`                     | Port to listen on (localhost only)            |
| `COPILOT_SESSION_DIR`  | `~/.copilot/session-state` | Where Copilot CLI stores its session logs     |
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

This removes the hook and stops the server. Then delete the folder.

## License

[MIT](LICENSE)
