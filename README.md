# pi-cmux-browser

Browser automation for [Pi](https://github.com/mariozechner/pi-coding-agent) + [cmux](https://cmux.dev). Typed tool, dev-browser scripting, and a web-dev subagent.

## Install

```bash
pi install git:github.com/sanurb/pi-cmux-browser
```

Requires [cmux](https://cmux.dev). For dev-browser scripting (optional):

```bash
npm install -g dev-browser && dev-browser install
```

## What's Included

### `cmux_browser` Tool (typed, agent-facing)

The agent calls structured functions — no bash syntax to get wrong. Surface state is automatic. Every mutating action returns a fresh snapshot with element refs.

```
cmux_browser({ action: "open", url: "http://localhost:3000" })
cmux_browser({ action: "click", ref: "e9" })
cmux_browser({ action: "fill", ref: "e12", text: "user@example.com" })
cmux_browser({ action: "press", text: "Enter" })
cmux_browser({ action: "screenshot", out: "/tmp/page.png" })
```

### `/browse` Command (user-facing)

Quick entry point:

```
/browse http://localhost:3000
/browse --snapshot
/browse --list
/browse --close
```

### `web-dev` Subagent

A spawnable agent for browser-based web dev:

```
Spawn the web-dev agent to test http://localhost:3000
```

### Browser Skill

Progressive disclosure: core patterns in SKILL.md, advanced features and dev-browser scripting in references.

## Two Browser Modes

### cmux In-App Browser (interactive, visual)

The `cmux_browser` tool opens a browser pane inside cmux. It stays open between calls — the agent clicks, fills, and reads element refs from accessibility snapshots.

### dev-browser (scripted, fast)

For multi-step flows via bash. Pages persist between scripts. Incredibly fast.

```bash
dev-browser <<'EOF'
const page = await browser.getPage("app");
await page.goto("https://app.example.com/login");
await page.fill("#email", "user@example.com");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard");
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

## How It Works

1. Agent calls `cmux_browser({ action: "open", url: "..." })`
2. Tool opens browser pane, waits for load, returns snapshot with refs (e9, e12...)
3. Agent calls `cmux_browser({ action: "click", ref: "e9" })`
4. Tool clicks, auto-returns fresh snapshot with updated refs
5. Repeat until done

Surface state persisted to `~/.pi/cmux-browser-session/state.json`. Agent never tracks refs manually.

## License

MIT
