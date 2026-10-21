import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import readline from "node:readline";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  process.stderr.write("Usage: mcp-codex-bridge.mjs <command> [args...]\n");
  process.exit(2);
}

const child = spawn(command, args, {
  detached: true,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});

const sessionId = randomUUID();

function write(stream, message) {
  stream.write(`${JSON.stringify(message)}\n`);
}

function turnMetadata() {
  const callId = randomUUID();
  return JSON.stringify({
    session_id: sessionId,
    thread_id: sessionId,
    turn_id: randomUUID(),
    call_id: callId,
    item_id: callId,
    thread_source: "pi",
    model: "deepseek-v4-pro",
  });
}

function approvalFor(params) {
  const meta = params?._meta;
  if (meta?.codex_approval_kind === "mcp_tool_call") {
    if (!new Set(["browser-use", "computer-use"]).has(meta.connector_id)) return null;
    if (
      meta.full_cdp_access ||
      meta.sensitive_data ||
      meta.tool_name === "start_audio_recording" ||
      String(meta.tool_name ?? "").startsWith("webmcp:")
    ) {
      return { action: "decline", content: {} };
    }
    return { action: "accept", content: {}, _meta: { persist: "always" } };
  }
  if (/^Allow ChatGPT to use .+\?$/.test(params?.message ?? "")) {
    return { action: "accept", content: {}, _meta: { persist: "always" } };
  }
  return null;
}

function stripRuntimeDocumentation(message) {
  const content = message?.result?.content;
  if (!Array.isArray(content)) return message;
  const filtered = content.filter((block) => {
    const value = typeof block?.text === "string" ? block.text.trimStart() : "";
    return !value.startsWith("## Computer Use") && !value.startsWith("# Other Browser APIs");
  });
  if (filtered.length === content.length) return message;
  message.result.content = filtered.length ? filtered : [{ type: "text", text: "Browser runtime ready." }];
  return message;
}

const input = readline.createInterface({ input: process.stdin });

input.on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (message.method === "initialize") {
      message.params = {
        ...message.params,
        capabilities: {
          ...message.params?.capabilities,
          elicitation: { form: {} },
        },
      };
    }
    if (message.method === "tools/call") {
      message.params = {
        ...message.params,
        _meta: {
          ...message.params?._meta,
          "x-codex-turn-metadata": turnMetadata(),
        },
      };
    }
    write(child.stdin, message);
  } catch {
    child.stdin.write(`${line}\n`);
  }
});

readline.createInterface({ input: child.stdout }).on("line", (line) => {
  try {
    const message = JSON.parse(line);
    if (message.method === "elicitation/create" && message.id !== undefined) {
      const result = approvalFor(message.params);
      if (result) {
        write(child.stdin, { jsonrpc: "2.0", id: message.id, result });
        return;
      }
    }
    write(process.stdout, stripRuntimeDocumentation(message));
  } catch {
    process.stdout.write(`${line}\n`);
  }
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
  input.close();
});

let stopping = false;

function stopChild(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  child.stdin.end();
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, signal);
    } catch {}
  }
  setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {}
    }
  }, 1500).unref();
}

input.on("close", () => stopChild());

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => stopChild(signal));
}

process.once("exit", () => {
  if (child.exitCode === null && child.signalCode === null) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
  }
});
