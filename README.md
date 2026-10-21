# My Pi development configuration

Portable, token-efficient Pi setup with:

- DeepSeek Flash by default and explicit Pro routing when requested;
- Gortex-first code discovery, editing, memory, and repository auto-tracking;
- Codex Browser and Computer Use integration with automatic process cleanup;
- early context compaction, complete usage accounting, output limits, retry guards, and a session cost cap;
- isolated Git worktrees through `pi-worktree`.

## Install

Requirements: macOS, `pi`, Node.js/npm, and `gortex` available through `PATH`. Browser automation additionally requires the ChatGPT desktop app in `/Applications` and its Computer Use runtime.

```sh
git clone https://github.com/antonbelous0v/my-pi-dev-conf.git
cd my-pi-dev-conf
./install.sh
```

To update an existing installation:

```sh
git pull --ff-only
./install.sh
```

The installer backs up every replaced file under `~/.pi/agent/backups/`, installs pinned extension versions through Pi, validates JSON and shell syntax, and checks the Gortex MCP connection. Re-running it skips packages already at the expected version.

## Credentials and private data

This repository intentionally excludes `auth.json`, sessions, memories, trust state, caches, environment files, and API keys. Existing provider credentials are preserved during installation. On a new machine, configure authentication separately through Pi or environment variables; never commit it here.

## Main controls

- `/control` — current profile, route, model, context, cost, and budget.
- `/profile auto|code|browser|desktop|research|full` — capability routing.
- `/route auto|flash|pro` — model routing.
- `/limit <usd>` — per-session cost cap.
- `/goal`, `/checkpoint`, `/queue`, `/steer`, `/review` — durable execution helpers.

See [`config/CONTROL_PLANE.md`](config/CONTROL_PLANE.md) for the complete behavior and [`BENCHMARK.md`](BENCHMARK.md) for the 45-session stress-test results.
