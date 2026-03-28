# dev-browser — Multi-Step Scripting

Use dev-browser when you need multiple actions in one atomic script: login flows, scraping pipelines, headless CI, or connecting to the user's Chrome.

## When to Use

| Situation | Engine |
|-----------|--------|
| Single click/fill/navigate | `cmux browser` (default) |
| Login flow (fill + click + wait) | `dev-browser` |
| Headless automation | `dev-browser --headless` |
| Connect to user's Chrome | `dev-browser --connect` |
| Persistent named pages across runs | `dev-browser` |

## Prerequisites

```bash
npm install -g dev-browser
dev-browser install
```

## Execution Pattern

Scripts run in a QuickJS WASM sandbox. NOT Node.js — no `require`, `fs`, `fetch`, or `process`.

```bash
dev-browser [--headless] [--connect] [--timeout 30] <<'EOF'
const page = await browser.getPage("descriptive-name");
await page.goto("https://example.com");
// ... interact ...
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

Named pages persist between script runs. Use descriptive names: `"login"`, `"dashboard"`, `"checkout"`.

## Sandbox Globals

```
browser.getPage(name)         → persistent named page (Playwright Page object)
browser.newPage()             → anonymous page (cleaned up after script)
browser.listPages()           → [{id, url, title, name}]
browser.closePage(name)       → close named page
saveScreenshot(buf, name)     → save to ~/.dev-browser/tmp/, returns path
writeFile(name, data)         → write to ~/.dev-browser/tmp/, returns path
readFile(name)                → read from ~/.dev-browser/tmp/
console.log(JSON.stringify()) → structured output to stdout
```

## Login Flow Example

```bash
dev-browser <<'EOF'
const page = await browser.getPage("app");
await page.goto("https://app.example.com/login");
await page.fill("#email", "user@example.com");
await page.fill("#password", "secret");
await page.click("button[type=submit]");
await page.waitForURL("**/dashboard");
console.log(JSON.stringify({ url: page.url(), title: await page.title() }));
EOF
```

## Snapshot for Discovery

```bash
dev-browser <<'EOF'
const page = await browser.getPage("main");
await page.goto("https://example.com");
const snap = await page.snapshotForAI({ depth: 4 });
console.log(snap.full);
EOF
```

Options: `{ track?: string, depth?: number, timeout?: number }`
Returns: `{ full: string, incremental?: string }`

Use `track` for incremental updates after interactions:

```bash
dev-browser <<'EOF'
const page = await browser.getPage("main");
const snap = await page.snapshotForAI({ track: "main" });
console.log(snap.incremental || snap.full);
EOF
```

## Error Recovery

Pages persist after script failure. Reconnect and inspect:

```bash
dev-browser <<'EOF'
const page = await browser.getPage("main");
const path = await saveScreenshot(await page.screenshot(), "debug.png");
console.log(JSON.stringify({ screenshot: path, url: page.url(), title: await page.title() }));
EOF
```

## Non-Negotiables

1. **Always `console.log(JSON.stringify(...))`** — structured output only.
2. **End every script with url + title** — the next script needs to know where the page is.
3. **Plain JavaScript inside `page.evaluate()`** — no TypeScript syntax in browser context.
4. **Use `--timeout 10`** for scripts that might hang on missing elements.
5. **One script, one purpose** — navigate OR interact OR extract. Keep scripts short and focused.
