import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const exec = promisify(execFile);
const gortex = "gortex";

type Memory = { id: string; title?: string; body: string; kind?: string };
type MemoryResult = { memories?: Memory[] };
type Roots = { index?: string; workspace?: string };

async function rootsFor(cwd: string): Promise<Roots> {
  try {
    const workspace = (await exec("/usr/bin/git", ["-C", cwd, "rev-parse", "--show-toplevel"])).stdout.trim();
    return { index: workspace, workspace };
  } catch {
    const repos = JSON.parse((await exec(gortex, ["repos", "--json"])).stdout) as Array<{ path?: string; indexed?: boolean }>;
    return { index: repos.find((repo) => repo.indexed && repo.path)?.path };
  }
}

async function memories(args: string[], cwd: string): Promise<Memory[]> {
  const result = JSON.parse((await exec(gortex, ["memory", ...args, "--format", "json"], { cwd })).stdout) as MemoryResult;
  return result.memories ?? [];
}

export default function gortexMemory(pi: ExtensionAPI): void {
  let cachedRoots: Promise<Roots> | undefined;
  let cachedPinned: Promise<Memory[]> | undefined;

  pi.on("session_start", (_event, ctx) => {
    cachedRoots = rootsFor(ctx.cwd);
    cachedPinned = undefined;
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (event.messageType !== "user") return;

    try {
      const { index, workspace } = await (cachedRoots ??= rootsFor(ctx.cwd));
      if (!index) return;
      if (workspace) event.systemPromptOptions.sections.workspace_context = `Current repository root: ${workspace}`;

      const [pinned, relevant] = await Promise.all([
        cachedPinned ??= memories(["recall", "--index", index, "--scope", "global", "--pinned", "--limit", "8"], ctx.cwd),
        memories(["surface", "--index", index, "--scope", workspace ? "both" : "global", "--task", event.prompt, "--limit", "3"], ctx.cwd),
      ]);
      const unique = [...new Map([...pinned, ...relevant].map((memory) => [memory.id, memory])).values()];
      if (!unique.length) return;

      event.systemPromptOptions.sections.durable_memory = [
        "User-approved cross-session memories. Follow applicable entries; explicit current user instructions win.",
        ...unique.map((memory) => `- [${memory.id}] ${memory.title ? `${memory.title}: ` : ""}${memory.body}`),
      ].join("\n");
    } catch {}
  });
}
