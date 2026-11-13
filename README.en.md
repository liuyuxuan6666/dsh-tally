<div align="center">

<img src="icon.svg" width="72" alt="dsh-tally" />

# dsh-tally

**A minimal personal todo list that lives inside DeepSeek Harness.**

One sidebar glyph, one single-column panel, eleven tools. State is a single JSON file: no network, no sync, no noise.

[![License](https://img.shields.io/github/license/liuyuxuan6666/dsh-tally?color=blue)](LICENSE)
[![DSH](https://img.shields.io/badge/DSH-0.2.x-1c5a40)](https://github.com/deepseek-ai/deepseek-harness)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.19-339933)](https://nodejs.org)
[![Dependencies](https://img.shields.io/badge/runtime%20deps-0-brightgreen)](#)

[中文](README.md)

</div>

---

## Why

The task-shaped plugins in this ecosystem solve a different problem: **hand work to an agent, then accept it** — status machines, claims, `in_review`, human acceptance.

What I needed was: **write it down, then cross it out.**

So this plugin does three things — add, check, edit. No acceptance, no draft confirmation, no AI execution, no kanban.

| | Task / issue board | dsh-tally |
|---|---|---|
| Who executes | an agent | **you** |
| Core actions | claim → submit → accept | add, check, edit |
| States | 7 | open / done / archived |
| Needs | audit, versions, acceptance | jotting, reminding, opening on a phone |

## Features

- **In-place editing** — click the title to rename, the date chip to pick a day, the details chip to write a note. No modals.
- **Grouping** — Overdue / Today / This week / Later / No date, placed automatically.
- **Overdue in red** — the date only, nothing louder.
- **Archive** — completed items older than 90 days are archived, never dropped.
- **Two ways in** — the sidebar glyph, and a small chip under the composer.
- **Agent-accessible** — eleven `todo_*` tools; ask in chat and it writes.
- **Zero runtime dependencies** in both halves.

## Install

Requires DeepSeek Harness **0.2.x** (uses the official `sidebar.panellist` + `main` slots).

```bash
git clone https://github.com/liuyuxuan6666/dsh-tally.git
cd dsh-tally
npm pack
dsh plugin --profile <profile> add file:$PWD/dsh-tally-0.3.0.tgz
```

Then restart DSH: client bundles are only scanned at boot.

For development, mirror the repo to a Windows-local directory and install that directory as the bundle:

```bash
DSH_TALLY_DEPLOY='D:/path/to/dsh-tally' ./scripts/sync.sh
```

## Layout

Single column, one layout for phone and desktop.

```
┌──────────────────────────────────────────────┐
│  ▣  Todo                        [ Done 2 ]   │
│     3 open · 1 overdue                       │
│                                              │
│  [ Add a todo, press Enter        ] [ Add ]  │
│                                              │
│  Overdue  1                                  │
│  ☐  Revise the proposal draft                │
│      10-28   ＋ Details                      │
│  ─────────────────────────────────────────   │
│  Today  2                                    │
│  ☐  Read the MEC queueing chapter            │
│      11-18   ＋ Details                      │
└──────────────────────────────────────────────┘
```

## Tools

`todo_add` · `todo_list` · `todo_update` · `todo_done` · `todo_undo` · `todo_archive` · `todo_unarchive` · `todo_hide` · `todo_unhide` · `todo_remove` · `todo_export`

There is no acceptance concept, because nothing here needs accepting.

## Data

```
$DSH_HOME/todo/todo.json
```

Atomic writes (temp file → `fsync` → `rename`), one serialized writer, a corrupt file preserved as `todo.json.corrupt-<timestamp>` instead of crashing. A year of entries is ~400 KB — no index, no sharding, no database.

## Design notes

- The sidebar entry is a **bare 20×20 SVG** with `stroke: currentColor`. The host owns the button, hover and active state; wrapping it in your own `<button>` makes it look like a raised tile.
- Only theme tokens (`--dsw-alias-*`). One accent color, one type scale, one spacing scale, two radii.
- A slot component that throws is silently removed by the host, so every entry is wrapped in an error guard that reports to `/api/todo/clientlog`.

Two traps worth repeating: **a `webServer` route must be a `handler`, not a `resource`** (resources answer `GET`/`HEAD` only and 405 everything else), and **`exports` must include `"./package.json"`** or the client-module scanner never sees your `dsh.client` declaration.

## License

[MIT](LICENSE)
