/**
 * Browser engine wrappers — cmux browser (primary) and dev-browser (fallback).
 *
 * cmux browser: native browser pane in cmux, zero install, visual.
 * dev-browser: Playwright scripting via CLI, for complex multi-step flows.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { exec, type ExecResult } from "./cmux.js";

const DEV_BROWSER_TIMEOUT_MS = 30_000;
const VERSION_TIMEOUT_MS = 5_000;
const HEREDOC_DELIM = "PI_BROWSER_EOF";

// ── cmux browser ───────────────────────────────────────

export interface BrowserOpenResult {
  ok: boolean;
  surfaceRef?: string;
  paneRef?: string;
  error?: string;
}

/**
 * Open a URL in a cmux browser pane.
 * Parses the "OK surface=surface:N pane=pane:M" output.
 */
export async function openBrowser(
  pi: ExtensionAPI,
  url: string,
  options?: { workspace?: string },
): Promise<BrowserOpenResult> {
  const args = ["browser", "open"];
  if (options?.workspace) args.push("--workspace", options.workspace);
  args.push(url);

  const result = await exec(pi, args);
  if (!result.ok) {
    return { ok: false, error: result.error || "Failed to open browser" };
  }

  // Parse: OK surface=surface:N pane=pane:M placement=split
  const surfaceMatch = result.stdout.match(/surface=(surface:\d+)/);
  const paneMatch = result.stdout.match(/pane=(pane:\d+)/);

  return {
    ok: true,
    surfaceRef: surfaceMatch?.[1],
    paneRef: paneMatch?.[1],
  };
}

/**
 * Run a cmux browser command on a specific surface.
 */
export async function browserCommand(
  pi: ExtensionAPI,
  surfaceRef: string,
  command: string[],
): Promise<ExecResult> {
  return exec(pi, ["browser", surfaceRef, ...command]);
}

/**
 * Get a snapshot of the browser page.
 */
export async function browserSnapshot(
  pi: ExtensionAPI,
  surfaceRef: string,
  options?: { interactive?: boolean; compact?: boolean; maxDepth?: number; selector?: string },
): Promise<ExecResult> {
  const args = ["snapshot"];
  if (options?.interactive) args.push("--interactive");
  if (options?.compact) args.push("--compact");
  if (options?.maxDepth) args.push("--max-depth", String(options.maxDepth));
  if (options?.selector) args.push("--selector", options.selector);

  return browserCommand(pi, surfaceRef, args);
}

/**
 * Identify a browser surface (get URL + title).
 */
export async function browserIdentify(
  pi: ExtensionAPI,
  surfaceRef: string,
): Promise<{ ok: true; url: string; title: string } | { ok: false; error: string }> {
  const result = await exec(pi, ["--json", "browser", surfaceRef, "identify"]);
  if (!result.ok) {
    return { ok: false, error: result.error || "Failed to identify browser" };
  }

  try {
    const data = JSON.parse(result.stdout);
    return {
      ok: true,
      url: data.browser?.url || "",
      title: data.browser?.title || "",
    };
  } catch {
    return { ok: false, error: "Failed to parse browser identify response" };
  }
}

// ── dev-browser (fallback for scripting) ───────────────

export interface ScriptResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  error?: string;
}

export interface ScriptOptions {
  connect?: boolean | string;
  headless?: boolean;
  browser?: string;
  timeout?: number;
}

export async function isDevBrowserInstalled(pi: ExtensionAPI): Promise<boolean> {
  const result = await pi.exec("dev-browser", ["--version"], { timeout: VERSION_TIMEOUT_MS });
  return !result.killed && result.code === 0;
}

function buildFlags(options?: ScriptOptions): string[] {
  const flags: string[] = [];
  if (options?.connect) {
    flags.push("--connect");
    if (typeof options.connect === "string") flags.push(options.connect);
  }
  if (options?.headless) flags.push("--headless");
  if (options?.browser) flags.push("--browser", options.browser);
  if (options?.timeout) flags.push("--timeout", String(options.timeout));
  return flags;
}

/**
 * Run a dev-browser script via bash heredoc.
 */
export async function runScript(
  pi: ExtensionAPI,
  script: string,
  options?: ScriptOptions,
): Promise<ScriptResult> {
  const flags = buildFlags(options);
  const flagStr = flags.length > 0 ? ` ${flags.join(" ")}` : "";
  const cmd = `dev-browser${flagStr} <<'${HEREDOC_DELIM}'\n${script}\n${HEREDOC_DELIM}`;

  const timeoutMs = options?.timeout
    ? options.timeout * 1_000 + 5_000
    : DEV_BROWSER_TIMEOUT_MS;

  const result = await pi.exec("bash", ["-c", cmd], { timeout: timeoutMs });

  if (result.killed) {
    return { ok: false, stdout: result.stdout, stderr: result.stderr, error: "Script timed out" };
  }
  if (result.code !== 0) {
    const error = result.stderr.trim() || result.stdout.trim() || `dev-browser exited with code ${result.code}`;
    return { ok: false, stdout: result.stdout, stderr: result.stderr, error };
  }

  return { ok: true, stdout: result.stdout, stderr: result.stderr };
}
