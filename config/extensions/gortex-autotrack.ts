import { execFile } from "node:child_process";
import { homedir } from "node:os";
import { parse } from "node:path";
import { promisify } from "node:util";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const exec = promisify(execFile);

export default function gortexAutotrack(pi: ExtensionAPI): void {
  pi.on("session_start", async (_event, ctx) => {
    const cwd = ctx.cwd ?? process.cwd();
    let root: string;

    try {
      root = (await exec("/usr/bin/git", ["-C", cwd, "rev-parse", "--show-toplevel"])).stdout.trim();
    } catch {
      return;
    }

    if (!root || root === homedir() || root === parse(root).root) return;

    try {
      const gortex = "gortex";
      const repos = JSON.parse((await exec(gortex, ["repos", "--json"])).stdout) as Array<{ path?: string }>;
      if (repos.some((repo) => repo.path === root)) return;

      if (ctx.hasUI) ctx.ui.notify(`Gortex: indexing ${root}`, "info");
      await exec(gortex, ["track", root, "--wait", "--wait-timeout", "2m"]);
      if (ctx.hasUI) ctx.ui.notify("Gortex: project indexed", "info");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (ctx.hasUI) ctx.ui.notify(`Gortex auto-track failed: ${message}`, "warning");
    }
  });
}
