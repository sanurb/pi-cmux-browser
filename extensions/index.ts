/**
 * pi-cmux-browser — extension entrypoint.
 *
 * Registers:
 * - cmux_browser tool (typed, agent-facing)
 * - /browse command (user-facing convenience)
 *
 * Guards:
 * 1. PI_CMUX_CHILD=1 → bail (prevents recursive spawning)
 * 2. cmux ping → bail if cmux is not available
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isAvailable } from "./cmux.js";
import { debug } from "./debug.js";
import { registerBrowserTool } from "./cmux-browser-tool.js";
import browseWorkflow from "./workflows/browse.js";

const MODULE = "init";

export default async function piCmuxBrowser(pi: ExtensionAPI): Promise<void> {
  if (process.env.PI_CMUX_CHILD === "1") {
    debug(MODULE, "skipping — running as child process");
    return;
  }

  const available = await isAvailable(pi);
  if (!available) {
    debug(MODULE, "skipping — cmux not available");
    return;
  }

  debug(MODULE, "registering tool and workflows");

  registerBrowserTool(pi);
  browseWorkflow(pi);

  debug(MODULE, "pi-cmux-browser ready");
}
