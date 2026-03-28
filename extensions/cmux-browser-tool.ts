/**
 * cmux_browser — typed Pi tool for browser automation.
 *
 * The agent calls cmux_browser({ action: "click", ref: "e9" }) and this tool
 * translates it into cmux CLI calls, manages surface state, and auto-appends
 * --snapshot-after to all mutating actions.
 *
 * Surface ref is persisted to disk so the agent never tracks it manually.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Surface state ──────────────────────────────────────

const STATE_DIR = join(process.env.HOME || "/tmp", ".pi", "cmux-browser-session");
const STATE_FILE = join(STATE_DIR, "state.json");
mkdirSync(STATE_DIR, { recursive: true });

function loadState(): Record<string, string> {
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")); } catch { return {}; }
  }
  return {};
}

function saveState(state: Record<string, string>) {
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

function getSurface(): string | null {
  return loadState().surface || process.env.CMUX_BROWSER_SURFACE || null;
}

function setSurface(id: string) {
  saveState({ surface: id, at: new Date().toISOString() });
}

// ── cmux CLI ───────────────────────────────────────────

function cmux(...args: string[]): string {
  try {
    return execFileSync("cmux", ["browser", ...args], {
      encoding: "utf-8",
      timeout: 30_000,
    }).trim();
  } catch (err: any) {
    const msg = err.stderr?.toString().trim() || err.stdout?.toString().trim() || err.message;
    throw new Error(msg);
  }
}

function surf(): string {
  const s = getSurface();
  if (!s) throw new Error('No browser open. Use action "open" first.');
  return s;
}

function tgt(params: { ref?: string; selector?: string }): string {
  const t = params.ref || params.selector;
  if (!t) throw new Error("ref or selector is required");
  return t;
}

// ── Tool registration ──────────────────────────────────

export function registerBrowserTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "cmux_browser",
    label: "Browser",
    description:
      "Control the cmux in-app browser. Open pages, navigate, click, fill forms, take screenshots, read accessibility trees, and execute JavaScript.",
    promptSnippet:
      "cmux_browser — open, inspect, and interact with web pages in a cmux browser pane",
    promptGuidelines: [
      'Use action "open" first. It opens a browser pane, waits for load, and returns an interactive snapshot.',
      "Read the element refs (e9, e12) from snapshots. Use them with the ref parameter for interactions.",
      "Mutating actions (click, fill, type, press) auto-return a fresh snapshot with updated refs.",
      'Use "ref" for elements from snapshots. Use "selector" for known CSS selectors.',
      "For multi-step scripts (login flows, scraping), use dev-browser via bash instead.",
    ],
    parameters: Type.Object({
      action: StringEnum([
        "open", "navigate", "back", "forward", "reload",
        "snapshot", "screenshot", "eval",
        "click", "dblclick", "hover", "focus",
        "fill", "type", "press", "select", "check", "uncheck",
        "scroll", "scroll_into_view", "wait",
        "get_url", "get_title", "get_text", "get_html", "get_attr",
        "is_visible", "is_enabled", "is_checked",
        "find_role", "find_text",
        "console", "errors", "highlight",
        "close",
      ] as const),
      url: Type.Optional(Type.String({ description: "URL for open/navigate/wait" })),
      ref: Type.Optional(Type.String({ description: "Element ref from snapshot (e.g. e9)" })),
      selector: Type.Optional(Type.String({ description: "CSS selector" })),
      text: Type.Optional(Type.String({ description: "Text for fill/type, key for press, value for select, JS for eval" })),
      code: Type.Optional(Type.String({ description: "JavaScript code for eval" })),
      attr: Type.Optional(Type.String({ description: "Attribute name for get_attr" })),
      role: Type.Optional(Type.String({ description: "ARIA role for find_role" })),
      name: Type.Optional(Type.String({ description: "Accessible name for find_role" })),
      dy: Type.Optional(Type.Number({ description: "Vertical scroll pixels" })),
      dx: Type.Optional(Type.Number({ description: "Horizontal scroll pixels" })),
      out: Type.Optional(Type.String({ description: "Output path for screenshot" })),
      max_depth: Type.Optional(Type.Number({ description: "Max depth for snapshot" })),
      timeout: Type.Optional(Type.Number({ description: "Timeout in seconds for wait" })),
      load_state: Type.Optional(Type.String({ description: "Wait load state: complete, interactive" })),
    }),

    async execute(toolCallId, params) {
      const { action } = params;

      try {
        switch (action) {
          // ── Open / Close ─────────────────────────────────────
          case "open": {
            const args = ["open"];
            if (params.url) args.push(params.url);
            const out = cmux(...args);
            const m = out.match(/surface=(\S+)/);
            if (m) {
              setSurface(m[1]);
              try { cmux(m[1], "wait", "--load-state", "complete", "--timeout-ms", "10000"); } catch { /* page may not reach complete */ }
              const snap = tryCmux(m[1], "snapshot", "--interactive", "--compact");
              return ok(`Browser opened (${m[1]})\nURL: ${params.url || "about:blank"}\n\n${snap}`);
            }
            return ok(`Browser opened\n${out}`);
          }

          case "close": {
            const s = getSurface();
            if (s) {
              try { execFileSync("cmux", ["close-surface", "--surface", s], { encoding: "utf-8", timeout: 10_000 }); } catch { /* already closed */ }
            }
            saveState({});
            return ok("Browser closed");
          }

          // ── Navigation (auto-snapshot-after) ─────────────────
          case "navigate": {
            if (!params.url) throw new Error("url required");
            return ok(`Navigated → ${params.url}\n\n${cmux(surf(), "navigate", params.url, "--snapshot-after")}`);
          }
          case "back":    return ok(`Back\n\n${cmux(surf(), "back", "--snapshot-after")}`);
          case "forward": return ok(`Forward\n\n${cmux(surf(), "forward", "--snapshot-after")}`);
          case "reload":  return ok(`Reloaded\n\n${cmux(surf(), "reload", "--snapshot-after")}`);

          // ── Observation ──────────────────────────────────────
          case "snapshot": {
            const args = [surf(), "snapshot", "--interactive", "--compact"];
            if (params.selector) args.push("--selector", params.selector);
            if (params.max_depth) args.push("--max-depth", String(params.max_depth));
            return ok(cmux(...args));
          }

          case "screenshot": {
            const args = [surf(), "screenshot"];
            if (params.out) args.push("--out", params.out);
            const out = cmux(...args);
            return ok(`Screenshot: ${out.replace(/^OK\s+/, "")}`);
          }

          case "eval": {
            const code = params.code || params.text;
            if (!code) throw new Error("code or text required");
            return ok(cmux(surf(), "eval", code));
          }

          // ── Interaction (auto-snapshot-after) ────────────────
          case "click":      return ok(`Clicked ${tgt(params)}\n\n${cmux(surf(), "click", tgt(params), "--snapshot-after")}`);
          case "dblclick":   return ok(`Double-clicked ${tgt(params)}\n\n${cmux(surf(), "dblclick", tgt(params), "--snapshot-after")}`);
          case "hover":      return ok(`Hovered ${tgt(params)}\n\n${cmux(surf(), "hover", tgt(params), "--snapshot-after")}`);
          case "focus":      return ok(`Focused ${tgt(params)}\n\n${cmux(surf(), "focus", tgt(params), "--snapshot-after")}`);
          case "check":      return ok(`Checked ${tgt(params)}\n\n${cmux(surf(), "check", tgt(params), "--snapshot-after")}`);
          case "uncheck":    return ok(`Unchecked ${tgt(params)}\n\n${cmux(surf(), "uncheck", tgt(params), "--snapshot-after")}`);

          case "fill": {
            const t = tgt(params);
            const args = [surf(), "fill", t];
            if (params.text != null) args.push("--text", params.text);
            args.push("--snapshot-after");
            return ok(`Filled ${t}${params.text ? ` → "${params.text}"` : " (cleared)"}\n\n${cmux(...args)}`);
          }

          case "type": {
            if (!params.text) throw new Error("text required");
            const t = tgt(params);
            return ok(`Typed "${params.text}" into ${t}\n\n${cmux(surf(), "type", t, params.text, "--snapshot-after")}`);
          }

          case "press": {
            const key = params.text;
            if (!key) throw new Error("text (key name) required");
            return ok(`Pressed ${key}\n\n${cmux(surf(), "press", key, "--snapshot-after")}`);
          }

          case "select": {
            if (!params.text) throw new Error("text (value) required");
            const t = tgt(params);
            return ok(`Selected "${params.text}" in ${t}\n\n${cmux(surf(), "select", t, params.text, "--snapshot-after")}`);
          }

          case "scroll": {
            const args = [surf(), "scroll"];
            if (params.selector) args.push("--selector", params.selector);
            if (params.dy != null) args.push("--dy", String(params.dy));
            if (params.dx != null) args.push("--dx", String(params.dx));
            args.push("--snapshot-after");
            return ok(`Scrolled\n\n${cmux(...args)}`);
          }

          case "scroll_into_view":
            return ok(`Scrolled into view: ${tgt(params)}\n\n${cmux(surf(), "scroll-into-view", tgt(params), "--snapshot-after")}`);

          // ── Wait ─────────────────────────────────────────────
          case "wait": {
            const args = [surf(), "wait"];
            if (params.selector) args.push("--selector", params.selector);
            if (params.text) args.push("--text", params.text);
            if (params.url) args.push("--url-contains", params.url);
            if (params.load_state) args.push("--load-state", params.load_state);
            args.push("--timeout-ms", String((params.timeout || 10) * 1000));
            cmux(...args);
            return ok("Wait condition met");
          }

          // ── Getters ──────────────────────────────────────────
          case "get_url":   return ok(cmux(surf(), "get", "url"));
          case "get_title": return ok(cmux(surf(), "get", "title"));
          case "get_text":  return ok(cmux(surf(), "get", "text", params.selector || "body"));
          case "get_html": {
            if (!params.selector) throw new Error("selector required");
            return ok(cmux(surf(), "get", "html", params.selector));
          }
          case "get_attr": {
            if (!params.selector || !params.attr) throw new Error("selector and attr required");
            return ok(cmux(surf(), "get", "attr", params.selector, "--attr", params.attr));
          }

          // ── State checks ─────────────────────────────────────
          case "is_visible": return ok(cmux(surf(), "is", "visible", tgt(params)));
          case "is_enabled": return ok(cmux(surf(), "is", "enabled", tgt(params)));
          case "is_checked": return ok(cmux(surf(), "is", "checked", tgt(params)));

          // ── Finders ──────────────────────────────────────────
          case "find_role": {
            if (!params.role) throw new Error("role required");
            const args = [surf(), "find", "role", params.role];
            if (params.name) args.push("--name", params.name);
            return ok(cmux(...args));
          }
          case "find_text": {
            if (!params.text) throw new Error("text required");
            return ok(cmux(surf(), "find", "text", params.text));
          }

          // ── Debug ────────────────────────────────────────────
          case "console":   return ok(cmux(surf(), "console", "list") || "No console messages");
          case "errors":    return ok(cmux(surf(), "errors", "list") || "No errors");
          case "highlight": return ok(`Highlighted: ${tgt(params)}\n${cmux(surf(), "highlight", tgt(params))}`);

          default:
            throw new Error(`Unknown action: ${action}`);
        }
      } catch (e: any) {
        throw new Error(e.message);
      }
    },
  });
}

// ── Helpers ────────────────────────────────────────────

function ok(text: string) {
  return { content: [{ type: "text" as const, text }], details: {} };
}

function tryCmux(...args: string[]): string {
  try { return cmux(...args); } catch { return ""; }
}
