# pi-cmux-browser — Browser automation for Pi + cmux

## What this repo is

A browser automation package for Pi that provides a **typed `cmux_browser` tool** (agent calls structured functions, not bash), a **`/browse` slash command** (user convenience), a **web-dev subagent**, and a **browser skill** with dev-browser scripting for multi-step flows.

## Architecture

```
extensions/
  index.ts                ← entrypoint: guards, tool + command registration
  cmux-browser-tool.ts    ← cmux_browser typed tool (surface state, auto-snapshot)
  cmux.ts                 ← cmux CLI wrapper (guards, browse.ts)
  shell.ts                ← shell escaping
  browser.ts              ← helper wrappers (browse.ts uses these)
  debug.ts                ← conditional stderr logging
  workflows/
    browse.ts             ← /browse slash command (user-facing)
agents/
  web-dev.md              ← spawnable web-dev subagent
skills/
  browser/
    SKILL.md              ← harness: tool syntax, non-negotiables, output format
    references/
      advanced.md         ← getters, state checks, locators, cookies, network, frames
      scripting.md        ← dev-browser multi-step scripting
```

## Module boundaries

| Module | Knows about | Does not know about |
|--------|-------------|-------------------|
| cmux-browser-tool | cmux CLI, surface state | workflows, skill |
| cmux | cmux CLI | tools, browser, workflows |
| browser | cmux.exec, dev-browser CLI | tools, workflows |
| browse workflow | browser module, cmux | tool internals |
| index | all modules (wiring only) | — |

## Key patterns

- **Typed tool**: Agent calls `cmux_browser({ action: "click", ref: "e9" })`. No bash syntax to get wrong.
- **Auto surface state**: Tool persists surface ref to `~/.pi/cmux-browser-session/state.json`. Agent never tracks refs.
- **Auto `--snapshot-after`**: Every mutating action returns a fresh accessibility tree with updated element refs.
- **Auto wait on open**: `open` action waits for `load-state complete` and returns an interactive snapshot.
- **Refs first**: Agent uses accessibility tree refs (`e9`, `e12`), not CSS selectors.
- **dev-browser for scripts**: Multi-step flows go through dev-browser via bash.
- **Guards**: PI_CMUX_CHILD=1 → bail; cmux ping → bail if unavailable.

## What the tool provides vs what bash provides

| Need | Use |
|------|-----|
| Any single browser action | `cmux_browser` tool |
| Multi-step login/scraping flow | dev-browser via bash |
| Cookies, storage, network mocking | cmux CLI via bash |
| Headless/CI automation | dev-browser via bash |
| Performance audit, a11y check | dev-browser `page.evaluate()` via bash |

## Non-goals

- Bundling Playwright as a dependency (dev-browser provides it)
- Generic cmux passthrough
- Multiple browser engines
