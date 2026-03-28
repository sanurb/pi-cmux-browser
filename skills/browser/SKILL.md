---
name: browser
description: >
  Control the cmux integrated browser for navigating, inspecting, and interacting
  with web pages. Use when asked to open, test, verify, fill, click, or read a web page.
---

# Browser Automation

You run inside cmux, a terminal with an integrated WebKit browser. Use the `cmux_browser` tool for interactive work (typed, stateful, visual). Use dev-browser via bash for multi-step scripted flows.

## Concepts

- **Surface**: Each browser pane has an ID (`surface:3`). Managed automatically by the tool — you never track it.
- **Ref**: Snapshot elements get refs (`e9`, `e12`). Use refs for click, fill, type — more reliable than CSS selectors.
- **Auto-snapshot**: Every mutating action (click, fill, type, press) auto-returns a fresh snapshot with updated refs.
- **Refs expire**: After navigation or DOM mutations, refs change. The auto-snapshot gives you fresh ones.
- **`type` vs `fill`**: `type` sends keystrokes one by one (triggers events). `fill` sets the value directly (faster, for form fields).

## Step 1 — Open

```
cmux_browser({ action: "open", url: "https://example.com" })
```

Returns: page snapshot with element refs. The surface ref is saved automatically.

## Step 2 — Observe

Read the refs from the snapshot returned by `open`. If you need a fresh snapshot:

```
cmux_browser({ action: "snapshot" })
cmux_browser({ action: "snapshot", selector: "main", max_depth: 4 })
```

## Step 3 — Act

Use **refs from the snapshot**. Every action returns a fresh snapshot:

```
cmux_browser({ action: "click", ref: "e9" })
cmux_browser({ action: "fill", ref: "e12", text: "user@example.com" })
cmux_browser({ action: "type", ref: "e14", text: "search query" })
cmux_browser({ action: "press", text: "Enter" })
cmux_browser({ action: "select", ref: "e7", text: "US" })
cmux_browser({ action: "check", ref: "e5" })
```

CSS selectors work too:

```
cmux_browser({ action: "click", selector: "button#submit" })
cmux_browser({ action: "fill", selector: "#email", text: "user@example.com" })
```

Wait when the page needs time:

```
cmux_browser({ action: "wait", selector: ".results", timeout: 10 })
cmux_browser({ action: "wait", url: "/dashboard", timeout: 10 })
```

Navigate:

```
cmux_browser({ action: "navigate", url: "https://other.com" })
```

Screenshot (use with understand_image for visual verification):

```
cmux_browser({ action: "screenshot", out: "/tmp/page.png" })
```

Repeat Step 2 → Step 3 until done.

## Debug a Failure

```
cmux_browser({ action: "console" })
cmux_browser({ action: "errors" })
cmux_browser({ action: "screenshot", out: "/tmp/debug.png" })
```

## Multi-Step Scripting (dev-browser)

For login flows, scraping, or headless automation, use dev-browser via bash. See [scripting.md](./references/scripting.md).

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

## Non-Negotiable Acceptance Criteria

1. **Open first.** `cmux_browser({ action: "open", url: "..." })` before any other action. It waits for load and returns a snapshot.
2. **Read refs from snapshots.** Use the `ref` parameter for interactions. CSS selectors are fallback only. Refs expire after DOM changes — read the auto-snapshot.
3. **One action per tool call.** Click OR fill OR navigate. The auto-snapshot returns fresh refs after each action.
4. **Scope snapshots.** Use `selector` and `max_depth` for large pages. The tool defaults to `--interactive --compact`.
5. **Wait on dynamic pages.** `cmux_browser({ action: "wait", selector: "...", timeout: 10 })` before interacting with content that hasn't loaded.
6. **Screenshot + understand_image for visual verification.** Snapshots show structure; screenshots show what the user sees.

## Output

After every browser action, report exactly:

```
[action] → [url] — [result]
```

Never show raw snapshot text to the user. Summarize what you observe.

## In This Reference

| File | When to read |
|------|-------------|
| [scripting.md](./references/scripting.md) | Multi-step flows via dev-browser (login, scraping, headless) |
| [advanced.md](./references/advanced.md) | Getters, state checks, locators, cookies, storage, network, frames, eval |
