# Pi control plane

The default setup uses DeepSeek Flash with medium thinking, Gortex through code mode, aggressive context compaction, and a $0.75 session cost cap. Browser runs automatically use low thinking; complex Pro runs use high thinking.

## Automatic behavior

- Complex architecture, audit, security, migration, performance, refactoring, root-cause, and review requests temporarily use DeepSeek V4 Pro.
- Ordinary work stays on DeepSeek Flash. Automatic Pro runs return to Flash when settled.
- Prompt length alone never selects Pro; only an explicit complex-task signal does.
- Image inputs are removed before they enter a DeepSeek session because the configured text endpoint rejects them; a clear marker prevents fabricated visual claims and large base64 session entries. Images remain available when the user manually selects a vision-capable provider.
- Manually selecting a non-DeepSeek or custom model switches routing to `manual`, so the control plane no longer replaces it before the request. `/route auto` resumes automatic routing.
- Image blocks returned by tools are removed before entering a text-only DeepSeek transcript, preventing hidden session growth.
- Exact Gortex lookups stop after `search.symbols` when location metadata is enough and call `read.source` only for body-level details; broad tasks use localization. Both avoid schema discovery, invalid `new_user_task` retries, rejected-candidate recaps, and unsolicited source dumps.
- Any Gortex `required_action: respond` is a hard stop for further tool calls.
- Browser and Computer Use MCP servers start only for a run that needs them and stop whenever the run settles, including explicit capability profiles.
- Browser intent requires an explicit browser name or an action-target pair, avoiding accidental startup for coding phrases such as “open source” or “apply patch”.
- Browser runs expose only the direct `mcp__browser__js` tool; desktop runs expose only `codemode`. The usual `bash` and `codemode` set is restored automatically for ordinary coding turns.
- MCP servers cannot silently reactivate `codemode`; it remains explicitly available through the normal default tool set.
- Gortex MCP stays connected because Pi cannot reliably expose a dynamically registered code-mode server in the same turn; this avoids costly shell fallbacks.
- Browser instructions are injected only into browser runs, and first-use MCP documentation is stripped after the bridge initializes the runtime.
- Browser bootstrap UI state is treated as usable evidence, avoiding redundant DOM confirmation when it already answers the request.
- Browser uploads use Playwright's `filechooser` event followed by `chooser.setFiles()` with an absolute path.
- Non-submit form tasks verify the requested field values without speculative URL-based submission checks.
- Browser file transfers are auto-approved; full CDP, sensitive-data access, audio recording, and WebMCP remain blocked.
- Coding/Gortex instructions are omitted from browser runs, while browser instructions are omitted from ordinary coding runs.
- Coding/Gortex instructions are also omitted outside tracked repositories. Repository discovery and pinned memories are cached for the session; only task-relevant memory lookup repeats per turn.
- Outside repositories, a short routing hint prevents tool-schema discovery before ordinary shell commands.
- Tool results over 6,000 characters are truncated with a visible marker.
- More than 40 top-level calls, eight calls during browser runs, or three identical calls are blocked. Nested code-mode and browser calls are not counted against this guard.
- Provider output is capped at 8,000 tokens.
- Session cost accounting includes assistant calls, compaction, branch summaries, and auxiliary usage; a session already at its cap is stopped before another provider request.
- The compaction policy summarizes at approximately 32,000 context tokens while retaining the latest 8,000.

## Commands

- `/control` shows profile, routing, model, context, session cost, and budget.
- `/profile auto|code|browser|desktop|research|full` controls available external capabilities.
- `/route auto|flash|pro` controls model routing.
- `/goal <objective>`, `/goal status`, and `/goal clear` manage a durable session objective.
- `/checkpoint <state>` and `/checkpoint clear` manage continuation state.
- `/limit <usd>` and `/limit off` control the session cost cap.
- `/queue <message>` waits until the current run completes.
- `/steer <message>` redirects the active run.
- `/review [focus]` starts a repository-aware review on Pro.

## Isolated coding work

Run `pi-worktree <name> [base-ref]` inside a Git repository. It creates `~/.pi/worktrees/<repository>-<name>` on branch `pi/<name>` and starts Pi there. Uncommitted changes from the original checkout are intentionally not copied.
