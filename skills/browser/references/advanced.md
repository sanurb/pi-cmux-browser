# Advanced cmux_browser Actions

Load this when you need features beyond the open → snapshot → click/fill/press cycle.

## Getters

```
cmux_browser({ action: "get_url" })
cmux_browser({ action: "get_title" })
cmux_browser({ action: "get_text", selector: "h1" })
cmux_browser({ action: "get_html", selector: "#content" })
cmux_browser({ action: "get_attr", selector: "img", attr: "src" })
```

## State Checks

```
cmux_browser({ action: "is_visible", selector: ".modal" })
cmux_browser({ action: "is_enabled", selector: "button#submit" })
cmux_browser({ action: "is_checked", selector: "input#terms" })
```

## Locators

```
cmux_browser({ action: "find_role", role: "button", name: "Submit" })
cmux_browser({ action: "find_text", text: "Click here" })
```

## JavaScript Evaluation

```
cmux_browser({ action: "eval", code: "document.title" })
cmux_browser({ action: "eval", code: "Array.from(document.querySelectorAll('a')).map(a=>a.href)" })
```

## Scrolling

```
cmux_browser({ action: "scroll", dy: 500 })
cmux_browser({ action: "scroll", selector: ".list", dy: 200 })
cmux_browser({ action: "scroll_into_view", ref: "e15" })
```

## Highlight (visual debug)

```
cmux_browser({ action: "highlight", selector: ".submit-button" })
```

## Advanced cmux browser CLI (via bash)

For features not exposed by the tool, use the cmux CLI directly:

```bash
# Cookies
cmux browser surface:N cookies get --all
cmux browser surface:N cookies set session abc123 --domain example.com
cmux browser surface:N cookies clear --name session

# Storage
cmux browser surface:N storage local get myKey
cmux browser surface:N storage local set myKey myValue

# Network mocking
cmux browser surface:N network route "**/api/**" --body '{"mocked":true}'
cmux browser surface:N network route "**/analytics/**" --abort

# Frames
cmux browser surface:N frame "iframe#content"
cmux browser surface:N frame main

# Dialogs
cmux browser surface:N dialog accept "input text"
cmux browser surface:N dialog dismiss

# Downloads
cmux browser surface:N click "a#download-link"
cmux browser surface:N download --path /tmp/file.csv --timeout-ms 30000

# Tabs
cmux browser surface:N tab list
cmux browser surface:N tab new <url>

# Session state
cmux browser surface:N state save /tmp/session.json
cmux browser surface:N state load /tmp/session.json

# Viewport
cmux browser surface:N viewport 1920 1080

# Webview focus
cmux browser surface:N focus-webview

# Console / errors
cmux browser surface:N console list
cmux browser surface:N errors list
```

Get the current surface ref from `~/.pi/cmux-browser-session/state.json` or run `cmux browser identify`.
