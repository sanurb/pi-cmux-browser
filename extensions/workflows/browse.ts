/**
 * Workflow: Open and control browser sessions via cmux browser.
 *
 * /browse <url>               — open URL in cmux browser pane
 * /browse --snapshot [ref]    — snapshot the browser page
 * /browse --list              — list browser surfaces
 * /browse --close [ref]       — close a browser surface
 *
 * cmux browser is the primary engine — zero install, visual, Playwright-like.
 * The browser skill teaches the agent to use `cmux browser` commands directly
 * for all subsequent interactions.
 *
 * Prerequisites: cmux running (guarded in index.ts).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { openBrowser, browserSnapshot, browserIdentify } from "../browser.js";
import { exec, getCallerInfo } from "../cmux.js";
import { debug } from "../debug.js";

const MODULE = "browse";

// ── Usage ──────────────────────────────────────────────

const USAGE = [
  "Usage:",
  "  /browse <url>               — open URL in browser pane",
  "  /browse --snapshot [ref]    — snapshot current browser page",
  "  /browse --list              — list browser surfaces",
  "  /browse --close [ref]       — close browser surface",
].join("\n");

// ── Argument parsing ───────────────────────────────────

type BrowseAction =
  | { type: "navigate"; url: string }
  | { type: "snapshot"; surfaceRef?: string }
  | { type: "list" }
  | { type: "close"; surfaceRef?: string };

function parseArgs(args: string): { ok: true; action: BrowseAction } | { ok: false; error: string } {
  const trimmed = args.trim();

  if (!trimmed) {
    return { ok: false, error: USAGE };
  }

  if (trimmed === "--list" || trimmed === "-l") {
    return { ok: true, action: { type: "list" } };
  }

  if (trimmed.startsWith("--snapshot") || trimmed.startsWith("-s")) {
    const ref = trimmed.replace(/^--(snapshot|s)\s*/, "").trim() || undefined;
    return { ok: true, action: { type: "snapshot", surfaceRef: ref } };
  }

  if (trimmed.startsWith("--close")) {
    const ref = trimmed.replace(/^--close\s*/, "").trim() || undefined;
    return { ok: true, action: { type: "close", surfaceRef: ref } };
  }

  // Treat as URL — add https:// if missing protocol
  let url = trimmed;
  if (!/^https?:\/\//i.test(url) && !url.startsWith("localhost") && !url.startsWith("127.")) {
    url = `https://${url}`;
  } else if (/^(localhost|127\.)/.test(url)) {
    url = `http://${url}`;
  }

  try {
    new URL(url);
  } catch {
    return { ok: false, error: `Invalid URL: ${trimmed}\n${USAGE}` };
  }

  return { ok: true, action: { type: "navigate", url } };
}

// ── Find browser surfaces ──────────────────────────────

interface PanelInfo {
  ref?: string;
  type?: string;
  title?: string;
  url?: string;
}

async function findBrowserSurfaces(pi: ExtensionAPI): Promise<PanelInfo[]> {
  const result = await exec(pi, ["--json", "list-panels"]);
  if (!result.ok) return [];

  try {
    const data = JSON.parse(result.stdout);
    const panels: PanelInfo[] = [];

    // list-panels returns surfaces/panels — filter for browser type
    const items = Array.isArray(data) ? data : data.panels || data.surfaces || [];
    for (const item of items) {
      if (item.type === "browser" || item.panel_type === "browser") {
        panels.push({
          ref: item.ref || item.surface_ref || item.id,
          type: "browser",
          title: item.title,
          url: item.url,
        });
      }
    }

    return panels;
  } catch {
    return [];
  }
}

// ── Registration ───────────────────────────────────────

export default function browseWorkflow(pi: ExtensionAPI): void {
  pi.registerCommand("browse", {
    description: "Open and control browser sessions via cmux browser",
    handler: async (args, ctx) => {
      const parsed = parseArgs(args);
      if (!parsed.ok) {
        ctx.ui.notify(parsed.error, "warning");
        return;
      }

      const { action } = parsed;
      debug(MODULE, "executing", { type: action.type });

      switch (action.type) {
        case "navigate": {
          // Get workspace context
          const callerResult = await getCallerInfo(pi);
          const workspace = callerResult.ok ? callerResult.caller.workspace_ref : undefined;

          const result = await openBrowser(pi, action.url, { workspace });
          if (!result.ok) {
            ctx.ui.notify(`Failed to open browser: ${result.error}`, "error");
            return;
          }

          const surfRef = result.surfaceRef || "unknown";
          let title = "";

          // Try to get the page title after a brief load
          if (result.surfaceRef) {
            // Wait a moment for page to start loading
            await new Promise((r) => setTimeout(r, 1_500));
            const id = await browserIdentify(pi, result.surfaceRef);
            if (id.ok) title = id.title;
          }

          const display = title ? `${title} (${surfRef})` : `${action.url} (${surfRef})`;
          ctx.ui.notify(`Browser opened: ${display}\nUse: cmux browser ${surfRef} <command>`, "info");
          break;
        }

        case "snapshot": {
          let surfRef = action.surfaceRef;

          // Auto-discover if no ref provided
          if (!surfRef) {
            const browsers = await findBrowserSurfaces(pi);
            if (browsers.length === 0) {
              ctx.ui.notify("No browser surfaces found. Open one with: /browse <url>", "warning");
              return;
            }
            surfRef = browsers[0].ref;
          }

          if (!surfRef) {
            ctx.ui.notify("Could not determine browser surface ref", "error");
            return;
          }

          const result = await browserSnapshot(pi, surfRef, {
            interactive: true,
            compact: true,
            maxDepth: 4,
          });

          if (!result.ok) {
            ctx.ui.notify(`Snapshot failed: ${result.error}`, "error");
            return;
          }

          // Truncate for notification, full output is in the command result
          const preview = result.stdout.slice(0, 200);
          ctx.ui.notify(`Snapshot of ${surfRef}:\n${preview}${result.stdout.length > 200 ? "..." : ""}`, "info");
          break;
        }

        case "list": {
          const browsers = await findBrowserSurfaces(pi);

          if (browsers.length === 0) {
            ctx.ui.notify("No browser surfaces open", "info");
            return;
          }

          const summary = browsers
            .map((b) => `${b.ref}: ${b.title || b.url || "—"}`)
            .join("\n");
          ctx.ui.notify(`Browser surfaces:\n${summary}`, "info");
          break;
        }

        case "close": {
          let surfRef = action.surfaceRef;

          if (!surfRef) {
            const browsers = await findBrowserSurfaces(pi);
            if (browsers.length === 0) {
              ctx.ui.notify("No browser surfaces to close", "info");
              return;
            }
            surfRef = browsers[0].ref;
          }

          if (!surfRef) {
            ctx.ui.notify("Could not determine browser surface to close", "error");
            return;
          }

          const result = await exec(pi, ["close-surface", "--surface", surfRef]);
          if (!result.ok) {
            ctx.ui.notify(`Close failed: ${result.error}`, "error");
            return;
          }

          ctx.ui.notify(`Closed browser: ${surfRef}`, "info");
          break;
        }
      }
    },
  });
}
