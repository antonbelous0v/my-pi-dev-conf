import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, McpServerConfig } from "@earendil-works/pi-coding-agent";

type Profile = "auto" | "code" | "browser" | "desktop" | "research" | "full";
type Routing = "auto" | "flash" | "pro" | "manual";
type McpName = "browser" | "computer-use";
type State = {
  profile: Profile;
  routing: Routing;
  goal?: string;
  checkpoint?: string;
  budgetUsd: number | null;
};
type Config = {
  sessionBudgetUsd: number;
  maxOutputTokens: number;
  maxBrowserToolCallsPerRun: number;
  maxNestedReadCallsPerRun: number;
  maxRepeatedToolCalls: number;
  maxToolResultChars: number;
};

const stateType = "control-plane-state";
const home = homedir();
const configPath = join(home, ".pi", "agent", "control-plane.json");
const defaults: Config = {
  sessionBudgetUsd: 0.75,
  maxOutputTokens: 8000,
  maxBrowserToolCallsPerRun: 20,
  maxNestedReadCallsPerRun: 64,
  maxRepeatedToolCalls: 3,
  maxToolResultChars: 6000,
};
const browserConfig: McpServerConfig = {
  command: "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
  args: [
    join(home, ".pi", "agent", "mcp-codex-bridge.mjs"),
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
    "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua-repl/bin/cua-repl.mjs",
  ],
  env: {
    NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS: "1000",
    NODE_REPL_NODE_MODULE_DIRS: "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules",
    NODE_REPL_NODE_PATH: "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
    NODE_REPL_TRUSTED_CODE_PATHS: `${join(home, ".codex")}:/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules`,
    CODEX_HOME: join(home, ".codex"),
    BROWSER_USE_AVAILABLE_BACKENDS: "chrome",
    BROWSER_USE_TINYSKY_ENABLED: "1",
    NODE_REPL_INSTRUCTIONS_USE_CASE_BROWSER: "Control the in-app browser in conjunction with the Browser Plugin.",
    NODE_REPL_INSTRUCTIONS_USE_CASE_CHROME: "Control the user's logged-in Chrome. Prefer this over Computer Use for websites.",
    NODE_REPL_INSTRUCTIONS_USE_CASE_COMPUTER_USE: "Control desktop apps on macOS through Computer Use.",
    BROWSER_USE_CODEX_APP_BUILD_FLAVOR: "prod",
    BROWSER_USE_CODEX_APP_VERSION: "26.1013.40934",
    NODE_REPL_TRUSTED_SERVICES: "{\"browser\":\"@oai/browser-desktop/service\",\"sky\":\"@oai/sky/service\"}",
    SKY_CUA_SERVICE_PATH: join(home, ".codex", "computer-use", "Codex Computer Use.app"),
    CODEX_CLI_PATH: "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
    CUA_REPL_NODE_REPL_PATH: "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl",
    CUA_REPL_ENABLED_SURFACES: "browser",
  },
  exposure: "hidden",
  toolExposure: { js: "direct", "*": "hidden" },
  description: "Logged-in Chrome through mcp__browser__js.",
};
const desktopConfig: McpServerConfig = {
  command: "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node",
  args: [
    join(home, ".pi", "agent", "mcp-codex-bridge.mjs"),
    join(home, ".codex", "computer-use", "Codex Computer Use.app", "Contents", "SharedSupport", "SkyComputerUseClient.app", "Contents", "MacOS", "SkyComputerUseClient"),
    "mcp",
  ],
  exposure: "codemode",
  description: "Inspect and control native macOS apps through Codex Computer Use",
};
const browserIntent = /\b(?:use|using|via|through|with|open|launch)\b.{0,20}\b(?:browser|chrome)\b|\b(?:open|visit|navigate|go to|log in|sign in|fill|submit|apply to)\b.{0,40}(?:https?:\/\/|website|site|page|form|job|position|vacancy)|(?:https?:\/\/|\bwebsite|\bsite|\bpage|\bform|\bjob|\bposition|\bvacancy).{0,40}\b(?:open|visit|navigate|go to|log in|sign in|fill|submit|apply to)\b|(?:используй|через|в|открой|запусти).{0,20}(?:браузер|хром)|(?:открой|перейди|зайди|авторизуйся|заполни|отправь|откликнись).{0,40}(?:https?:\/\/|сайт|страниц|форм|ваканси|позици)|(?:https?:\/\/|сайт|страниц|форм|ваканси|позици).{0,40}(?:открой|перейди|зайди|авторизуйся|заполни|отправь|откликнись)/iu;
const hasBrowserIntent = (prompt: string) => browserIntent.test(prompt
  .replace(/\b(?:do not|don't|never|without)\b.{0,40}\b(?:browser|chrome)\b/giu, "")
  .replace(/(?:не\s+используй|никогда\s+не|без).{0,40}(?:браузер|хром)/giu, ""));
const localizationIntent = /\b(?:where|which symbol|locate the (?:function|class|implementation)|find the (?:function|class|symbol) that)\b|\bгде\b.{0,40}\b(?:функци|класс|символ|реализ)|\bкакой символ\b/iu;
const desktopIntent = /\b(computer use|desktop|finder|xcode|terminal app|native app|click on screen)\b|компьютер юз|рабоч(?:ий стол|ем столе)|файндер|нативн|приложени[ея]|на экране|кликни/iu;
const browserContinuationIntent = /\b(?:continue|proceed|keep going|resume|salary|application|vacanc|browser|tab)\b|продолж|резюме|зарплат|отклик|ваканс|браузер|вкладк/iu;
const browserGuidance = (sessionName: string) => `Browser execution rules:
- Call mcp__browser__js directly. cua exists only inside its code string.
- Create exactly one tab for the whole run. The first call must contain exactly: let tab = await cua.createBrowserTab("chrome", "URL", { sessionName: "${sessionName}" }); Never call createBrowserTab again in this run. No waits, fills, output, visible option, or second API call in the first invocation.
- Reuse the persistent tab binding for every site. Navigate that same tab with await tab.goto("URL"), then inspect and act through tab.playwright. Never create a second tab, claim another tab, or replace the tab binding.
- Never access Chrome DevTools endpoints or port 9222, use CDP/Target.createTarget or /json/new, or write shell/Python/Node browser drivers. If the browser MCP or the retained tab fails, retry the same operation once, then report the blocker.
- The first call returns initial UI state. If it already contains the requested fact, answer immediately; do not issue a confirmation call.
- In the second call, reuse tab, perform all deterministic Playwright actions sequentially, verify in the same script, and emit only concise JSON with nodeRepl.write. Never use a top-level return or text(...).
  - For research with several known URLs, navigate the retained tab with await tab.goto("URL") and inspect each page before moving to the next. Never probe object keys, pass visible for Chrome, call tab.playwright.goto, use fetch, or assign location.href.
- The Playwright root is tab.playwright itself: use await tab.playwright.locator(selector).fill(value), .click(), .check(), and tab.playwright.evaluate(...). There is no tab.playwright.page, title(), page.fill, or page.check; do not query the page title.
- For DOM reads, use one tab.playwright.evaluate(...) call. Do not call locator.innerText(), dump broad HTML, or repeat inspection after the initial UI state already answered the request.
- Browser REPL bindings persist: use let, avoid redeclaring const names, and verify DOM values with direct document.querySelector selectors rather than FormData or named form properties.
- Do not inspect or claim existing tabs unless the user explicitly referenced one. If the single-tab bootstrap fails, report the blocker instead of exploring APIs or creating another tab.
- Treat <redacted> as successful privacy masking for contact fields. Never retry, encode, reconstruct, or bypass it.
- If told not to submit, simply never click the submit control. Verify requested field values only; do not invent a submitted-state heuristic from the URL.
  - Stop once the requested state is verified. A normal browser task should take two browser calls. Multi-source research may use one call per source and one focused extraction call only when the initial UI state is insufficient; do not inspect global state unless a tab identifier is genuinely missing.
  - For multi-source research, spend at most two calls per source. Extract every needed heading or keyword in one evaluate call, stop deep-reading once the requested source count is met, and reserve two calls for recovery and the final source.
- For uploads, start tab.playwright.waitForEvent("filechooser") before clicking, then call chooser.setFiles() with an absolute path. Do not use locator.setInputFiles().`;
const gortexGuidance = `Coding execution rules:
- Make the smallest complete change, preserve validation and unrelated work, inspect affected callers, and verify non-trivial changes.
  - Use Gortex through codemode for source discovery, reads, relationships, impact analysis, edits, and refactors. One codemode invocation should batch 2-6 independent calls with Promise.all when possible; never exceed eight nested calls or generate tool calls programmatically from line numbers. Do not spend one model turn per file or check.
  - Inside codemode, tools.bash is always available for builds, tests, package managers, Git, and operations Gortex cannot perform. Call it with an object, for example await tools.bash({command:"npm test",timeout_ms:120000}); never pass a bare string and never use a cmd key. Batch deterministic shell commands in one script when practical. For GitHub and CI workflows, batch repository and PR status queries, use one bounded watch instead of repeated sleep-and-poll calls, and finish explicitly authorized commit, push, or PR actions once the change is verified. Treat MCP results as opaque objects unless you have inspected their shape; do not assume result.content exists or is an array.
  - An exact name or symbol lookup must start with tools.mcp__gortex__search({operation:"symbols",query,options:{limit:5}}), never explore. If its result already answers the request, stop; read source only when body-level details are required, passing the returned ID exactly as tools.mcp__gortex__read({operation:"source",target:{symbol:"returned-id"},context:{max_lines:160}}). Put max_lines only under context, never under view. A source target never accepts path or line ranges. If a result is buffered or truncated, use tools.mcp__gortex__response({operation:"slice",arguments:{from:1,to:160}}) for a bounded slice; never re-read a file once per line. Never call describeTool; use the exact calls documented here. Use explore only when the user asks where or which symbol implements one behavior and a short localization answer is the final deliverable. Never use explore for implementation, debugging, audits, reviews, assessments, evaluations, or any task requiring multiple symbols. When an explore completion.required_action is respond, stop all tool calls and answer immediately. Do not rediscover these tools or pass new_user_task again. Keep tool output and the final answer narrow; omit rejected candidates and source dumps unless asked.
  - For review or assessment tasks, stop discovery as soon as the requested number of evidence-backed findings is complete. Do not exhaust the call budget trying to read the entire repository.
  - For implementation tasks, once a defect and its affected contract are proven, the next codemode call must edit it. Do not continue general exploration; verify the focused change and answer.
- If tool discovery is genuinely unavoidable, call searchTools with a query string as its first argument, never an object.
- Use Plan mode only for genuinely multi-step, risky, or multi-session work.`;
const toolGuidance = "Inside codemode, tools.bash is available. Call known tools directly; do not use searchTools or ALL_TOOLS discovery for standard shell operations. If discovery is unavoidable, searchTools takes a query string first.";
const answerGuidance = "Finish every requested part, but keep the final answer under 1,800 words and six sections unless the user explicitly asks for exhaustive or unabridged output. Prefer compact tables and evidence over narration; do not repeat source text or discovery history. Never run into the provider output limit: shorten prose before omitting conclusions, verification status, or risks.";

function loadConfig(): Config {
  try {
    return { ...defaults, ...JSON.parse(readFileSync(configPath, "utf8")) };
  } catch {
    return defaults;
  }
}

function isState(value: unknown): value is State {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<State>;
  return ["auto", "code", "browser", "desktop", "research", "full"].includes(state.profile ?? "")
    && ["auto", "flash", "pro", "manual"].includes(state.routing ?? "")
    && (state.budgetUsd === null || typeof state.budgetUsd === "number");
}

function sessionCost(ctx: ExtensionContext): number {
  return ctx.sessionManager.getBranch().reduce((total, entry) => {
    if (entry.type === "message" && entry.message.role === "assistant") {
      return total + ((entry.message as AssistantMessage).usage?.cost?.total ?? 0);
    }
    if (entry.type === "usage" || entry.type === "compaction" || entry.type === "branch_summary") {
      return total + (entry.usage?.cost?.total ?? 0);
    }
    return total;
  }, 0);
}

function lastState(ctx: ExtensionContext): State | undefined {
  let result: State | undefined;
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === stateType && isState(entry.data)) result = entry.data;
  }
  return result;
}

function truncateContent(content: Array<{ type: string; text?: string }>, limit: number) {
  const total = content.reduce((sum, block) => sum + (block.type === "text" ? block.text?.length ?? 0 : 0), 0);
  if (total <= limit) return;
  let remaining = limit;
  const shortened = content.flatMap((block) => {
    if (block.type !== "text" || typeof block.text !== "string") return [block];
    if (remaining <= 0) return [];
    const text = block.text.slice(0, remaining);
    remaining -= text.length;
    return [{ ...block, text }];
  });
  shortened.push({ type: "text", text: `\n[Control plane truncated ${total - limit} characters. Narrow the next query.]` });
  return shortened;
}

function stripImages(payload: Record<string, unknown>) {
  if (!Array.isArray(payload.messages)) return;
  for (const message of payload.messages) {
    if (!message || typeof message !== "object") continue;
    const item = message as Record<string, unknown>;
    if (Array.isArray(item.content)) {
      let removedImage = false;
      const content = item.content.filter((block) => {
        if (!block || typeof block !== "object") return true;
        const type = (block as Record<string, unknown>).type;
        const keep = type !== "image" && type !== "image_url" && type !== "input_image";
        if (!keep) removedImage = true;
        return keep;
      });
      if (removedImage) content.push({ type: "text", text: "[Image unavailable to this text-only model. Do not infer or claim its visual contents.]" });
      item.content = content.length ? content : "[Image omitted: the active model accepts text only.]";
    }
    delete item.image;
    delete item.images;
  }
}

export default function controlPlane(pi: ExtensionAPI): void {
  const config = loadConfig();
  let state: State = { profile: "auto", routing: "auto", budgetUsd: config.sessionBudgetUsd };
  let cost = 0;
  let toolCalls = 0;
  let nestedReadCalls = 0;
  let repeated = new Map<string, number>();
  let internalModelChange = false;
  let browserRun = false;
  let browserTabCreated = false;
  let allowGortexExplore = false;
  let budgetNotified = false;
  const browserSessionName = `🔎 Pi ${Date.now().toString(36).slice(-6)}`;
  const connected = new Set<McpName>();

  const persist = () => pi.appendEntry(stateType, state);
  const notify = (ctx: ExtensionContext, message: string, type: "info" | "warning" | "error" = "info") => {
    if (ctx.hasUI) ctx.ui.notify(message, type);
  };
  const connect = (name: McpName) => {
    if (connected.has(name)) return;
    pi.registerMcpServer(name, name === "browser" ? browserConfig : desktopConfig);
    connected.add(name);
  };
  const disconnect = (name: McpName) => {
    if (!connected.delete(name)) return;
    pi.unregisterMcpServer(name);
  };
  const applyProfile = (profile: Profile, prompt = "", continueBrowser = false) => {
    const wantsBrowser = continueBrowser || profile === "browser" || profile === "research" || profile === "full" || (profile === "auto" && hasBrowserIntent(prompt));
    const wantsDesktop = profile === "desktop" || profile === "full" || (profile === "auto" && desktopIntent.test(prompt));
    if (wantsBrowser) connect("browser"); else disconnect("browser");
    if (wantsDesktop) connect("computer-use"); else disconnect("computer-use");
  };
  const selectModel = async (ctx: ExtensionContext, route: "flash" | "pro", thinking: "low" | "medium" | "high") => {
    const id = route === "pro" ? "deepseek-v4-pro" : "deepseek-flash";
    if (ctx.model?.provider !== "deepseek" || ctx.model.id !== id) {
      const model = ctx.modelRegistry.find("deepseek", id);
      if (!model) return false;
      internalModelChange = true;
      try {
        if (!(await pi.setModel(model))) return false;
      } finally {
        internalModelChange = false;
      }
    }
    pi.setThinkingLevel(thinking);
    return true;
  };

  pi.registerCommand("control", {
    description: "Show Pi control-plane status",
    handler: async (_args, ctx) => {
      const usage = ctx.getContextUsage();
      const context = usage?.percent == null ? "unknown" : `${usage.percent.toFixed(1)}%`;
      notify(ctx, `profile=${state.profile} route=${state.routing} model=${ctx.model?.id ?? "none"} context=${context} cost=$${cost.toFixed(4)} budget=${state.budgetUsd == null ? "off" : `$${state.budgetUsd.toFixed(2)}`}`);
    },
  });

  pi.registerCommand("profile", {
    description: "Set capability profile: auto, code, browser, desktop, research, full",
    handler: async (args, ctx) => {
      const profile = args.trim() as Profile;
      if (!["auto", "code", "browser", "desktop", "research", "full"].includes(profile)) {
        notify(ctx, `Current profile: ${state.profile}. Use auto, code, browser, desktop, research, or full.`, "warning");
        return;
      }
      state = { ...state, profile };
      disconnect("browser");
      disconnect("computer-use");
      persist();
      notify(ctx, `Capability profile: ${profile}`);
    },
  });

  pi.registerCommand("route", {
    description: "Set model routing: auto, flash, pro",
    handler: async (args, ctx) => {
      const routing = args.trim() as Routing;
      if (!["auto", "flash", "pro"].includes(routing)) {
        notify(ctx, `Current route: ${state.routing}. Use auto, flash, or pro.`, "warning");
        return;
      }
      state = { ...state, routing };
      if (routing !== "auto" && !(await selectModel(ctx, routing, routing === "pro" ? "high" : "medium"))) {
        notify(ctx, `Could not select DeepSeek ${routing}.`, "error");
        return;
      }
      if (routing === "auto") await selectModel(ctx, "flash", "medium");
      persist();
      notify(ctx, `Model route: ${routing}`);
    },
  });

  pi.registerCommand("goal", {
    description: "Set, show, or clear the durable session goal",
    handler: async (args, ctx) => {
      const value = args.trim();
      if (!value || value === "status") {
        notify(ctx, state.goal ? `Goal: ${state.goal}${state.checkpoint ? `\nCheckpoint: ${state.checkpoint}` : ""}` : "No active goal.");
        return;
      }
      state = value === "clear" ? { ...state, goal: undefined, checkpoint: undefined } : { ...state, goal: value, checkpoint: undefined };
      persist();
      notify(ctx, value === "clear" ? "Goal cleared." : "Goal saved.");
    },
  });

  pi.registerCommand("checkpoint", {
    description: "Set or clear a concise continuation checkpoint for the active goal",
    handler: async (args, ctx) => {
      const value = args.trim();
      state = { ...state, checkpoint: !value || value === "clear" ? undefined : value };
      persist();
      notify(ctx, state.checkpoint ? "Checkpoint saved." : "Checkpoint cleared.");
    },
  });

  pi.registerCommand("limit", {
    description: "Set the session cost cap in USD or disable it with off",
    handler: async (args, ctx) => {
      const value = args.trim().toLowerCase();
      if (value === "off") state = { ...state, budgetUsd: null };
      else {
        const amount = Number(value);
        if (!Number.isFinite(amount) || amount <= 0) {
          notify(ctx, `Current budget: ${state.budgetUsd == null ? "off" : `$${state.budgetUsd.toFixed(2)}`}. Use /limit <usd> or /limit off.`, "warning");
          return;
        }
        state = { ...state, budgetUsd: amount };
      }
      budgetNotified = false;
      persist();
      notify(ctx, `Session budget: ${state.budgetUsd == null ? "off" : `$${state.budgetUsd.toFixed(2)}`}`);
    },
  });

  pi.registerCommand("queue", {
    description: "Queue a message after the current run",
    handler: async (args, ctx) => {
      if (!args.trim()) return notify(ctx, "Usage: /queue <message>", "warning");
      pi.sendUserMessage(args.trim(), { deliverAs: "followUp" });
    },
  });

  pi.registerCommand("steer", {
    description: "Steer the active run immediately",
    handler: async (args, ctx) => {
      if (!args.trim()) return notify(ctx, "Usage: /steer <message>", "warning");
      pi.sendUserMessage(args.trim(), { deliverAs: "steer" });
    },
  });

  pi.registerCommand("review", {
    description: "Review current repository changes",
    handler: async (args) => {
      const focus = args.trim() ? ` Focus especially on: ${args.trim()}` : "";
      pi.sendUserMessage(`Review the current repository changes. Inspect the surrounding code, identify correctness, security, performance, and missing-test risks, and report only actionable findings before any summary.${focus}`);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    state = lastState(ctx) ?? { profile: "auto", routing: "auto", budgetUsd: config.sessionBudgetUsd };
    cost = sessionCost(ctx);
  });

  pi.on("input", (event, ctx) => {
    if (ctx.model?.provider !== "deepseek" || !event.images?.length) return { action: "continue" };
    return {
      action: "transform",
      text: `${event.text}\n\n[Image unavailable to the active text-only DeepSeek model. Do not infer or claim its visual contents.]`,
      images: [],
    };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    toolCalls = 0;
    nestedReadCalls = 0;
    repeated = new Map();
    budgetNotified = false;
    cost = sessionCost(ctx);
    if (state.budgetUsd != null && cost >= state.budgetUsd) {
      budgetNotified = true;
      notify(ctx, `Session cost cap reached: $${cost.toFixed(4)} / $${state.budgetUsd.toFixed(2)}`, "warning");
      ctx.abort();
      return;
    }
    const prompt = event.messageType === "user" ? event.prompt : "";
    const continuingBrowserRun = browserRun && (event.messageType !== "user" || browserContinuationIntent.test(prompt));
    browserRun = state.profile === "browser" || state.profile === "research" || state.profile === "full" || (state.profile === "auto" && (hasBrowserIntent(prompt) || continuingBrowserRun));
    allowGortexExplore = localizationIntent.test(prompt);
    pi.setActiveTools(browserRun ? [] : ["bash", "codemode"]);
    applyProfile(state.profile, prompt, browserRun);
    if (browserRun) event.systemPromptOptions.sections.browser_execution = browserGuidance(browserSessionName);
    else delete event.systemPromptOptions.sections.browser_execution;
    if (browserRun || !event.systemPromptOptions.sections.workspace_context) delete event.systemPromptOptions.sections.coding_execution;
    else event.systemPromptOptions.sections.coding_execution = gortexGuidance;
    if (!browserRun && !event.systemPromptOptions.sections.workspace_context) event.systemPromptOptions.sections.tool_routing = toolGuidance;
    else delete event.systemPromptOptions.sections.tool_routing;
    event.systemPromptOptions.sections.answer_discipline = answerGuidance;
    if (state.routing === "auto" && ctx.model && (ctx.model.provider !== "deepseek" || !["deepseek-flash", "deepseek-v4-pro"].includes(ctx.model.id))) {
      state = { ...state, routing: "manual" };
      persist();
    }
    if (state.routing === "auto") {
      await selectModel(ctx, "flash", browserRun ? "low" : "medium");
    } else if (state.routing !== "manual") {
      await selectModel(ctx, state.routing, state.routing === "pro" ? "high" : browserRun ? "low" : "medium");
    }
    if (state.goal) {
      event.systemPromptOptions.sections.durable_goal = [
        `Active durable goal: ${state.goal}`,
        state.checkpoint ? `Continuation checkpoint: ${state.checkpoint}` : "",
        "Keep working toward this outcome across turns. Do not claim completion until the outcome and proportionate verification are complete.",
      ].filter(Boolean).join("\n");
    } else {
      delete event.systemPromptOptions.sections.durable_goal;
    }
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== "deepseek" || !event.payload || typeof event.payload !== "object") return;
    const payload = event.payload as Record<string, unknown>;
    stripImages(payload);
    const current = typeof payload.max_tokens === "number" ? payload.max_tokens : config.maxOutputTokens;
    payload.max_tokens = Math.min(current, config.maxOutputTokens);
  });

  pi.on("tool_call", (event) => {
    const input = JSON.stringify(event.input) ?? "";
    if (browserRun && /(?:127\.0\.0\.1:9222|Target\.createTarget|\/json\/new|remote-debugging-port|(?:^|[\\/])cdp\.js)/iu.test(input)) {
      return { block: true, reason: "Raw Chrome DevTools/CDP automation bypasses the session tab group. Use mcp__browser__js and cua.createBrowserTab with the required sessionName." };
    }
    if (browserRun && /createBrowserTab/iu.test(input)) {
      if (browserTabCreated) {
        return { block: true, reason: "This browser session already created its single tab. Reuse the persistent tab binding and navigate it with await tab.goto(\"URL\")." };
      }
      const sessionName = input.match(/sessionName\\?"?\s*:\s*\\?"([^"\\]+)\\?"/u)?.[1];
      if (sessionName !== browserSessionName) {
        return { block: true, reason: `Every browser tab in this run must use { sessionName: "${browserSessionName}" } so it stays in the session group.` };
      }
      browserTabCreated = true;
    }
    if (event.parentToolCallId) {
      if (/gortex.*explore/iu.test(event.toolName) && !allowGortexExplore) {
        return { block: true, reason: "Gortex explore is reserved for single-symbol localization answers. Use batched search and direct source reads for this task." };
      }
      if (/gortex.*(?:read|response)/iu.test(event.toolName) && ++nestedReadCalls > config.maxNestedReadCallsPerRun) {
        return { block: true, reason: `Nested read limit (${config.maxNestedReadCallsPerRun}) reached. Stop reading, use the evidence already collected, and complete the requested edit or answer.` };
      }
      return;
    }
    if (browserRun && ++toolCalls > config.maxBrowserToolCallsPerRun) {
      return { block: true, reason: `Browser tool-call limit (${config.maxBrowserToolCallsPerRun}) reached. Stop retrying, report the verified result and any concrete blocker.` };
    }
    const key = `${event.toolName}:${JSON.stringify(event.input)}`;
    const count = (repeated.get(key) ?? 0) + 1;
    repeated.set(key, count);
    if (count > config.maxRepeatedToolCalls) {
      return { block: true, reason: `Identical tool call repeated more than ${config.maxRepeatedToolCalls} times. Change the query or approach.` };
    }
  });

  pi.on("tool_result", (event, ctx) => {
    let content = event.content;
    if (ctx.model?.provider === "deepseek" && content.some((block) => block.type === "image")) {
      content = [
        ...content.filter((block) => block.type === "text"),
        { type: "text", text: "[Image tool output omitted for the active text-only model.]" },
      ];
    }
    const truncated = truncateContent(content, config.maxToolResultChars);
    if (truncated || content !== event.content) return { content: truncated ?? content };
  });

  pi.on("message_end", (event, ctx) => {
    if (event.message.role !== "assistant") return;
    cost += (event.message as AssistantMessage).usage?.cost?.total ?? 0;
    if (state.budgetUsd != null && cost >= state.budgetUsd && !budgetNotified) {
      budgetNotified = true;
      notify(ctx, `Session cost cap reached: $${cost.toFixed(4)} / $${state.budgetUsd.toFixed(2)}`, "warning");
      ctx.abort();
    }
  });

  pi.on("model_select", (event) => {
    if (internalModelChange || event.source === "restore") return;
    const routing: Routing = event.model.provider === "deepseek" && event.model.id === "deepseek-v4-pro"
      ? "pro"
      : event.model.provider === "deepseek" && event.model.id === "deepseek-flash"
        ? "flash"
        : "manual";
    if (routing !== state.routing) {
      state = { ...state, routing };
      persist();
    }
  });

  pi.on("agent_settled", () => {
    disconnect("browser");
    disconnect("computer-use");
  });

  pi.on("session_shutdown", () => {
    disconnect("browser");
    disconnect("computer-use");
  });
}
