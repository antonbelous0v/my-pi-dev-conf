# Pi stress-test report

Date: 2026-10-21

## Scope

The configuration was tested with 45 independent Pi CLI sessions in nine parallel rounds of five. Tasks covered implementation and regression testing, whole-repository architecture/security/reliability reviews, large-document audits, Git history analysis, PDF analysis, browser research across official sources, emulator/spec conformance, and a native desktop attempt.

Each session used the installed configuration, wrote a JSON event log, and was evaluated for completion, useful final output, tool behavior, cost, and cleanup. Raw event logs total 543 MB and remain outside the repository because they contain verbose model/tool transcripts and are not portable configuration.

## Results by round

| Round | Main condition | Mechanical completion | Cost | Result that drove the next change |
|---:|---|---:|---:|---|
| 1 | Original control plane | 3/5 | $0.535649 | Browser work routed to Pro and ended at the output cap; implementations ran out of calls. |
| 2 | Larger call budgets | 5/5 | $0.213157 | One repository audit made 1,444 nested line-by-line reads and produced a 272 MB log. |
| 3 | Nested-read and batching guidance | 5/5 | $0.151534 | Browser API misuse and false browser intent were exposed; implementation used the wrong nested shell schema. |
| 4 | Browser/schema fixes | 5/5 | $0.233770 | Negated browser requests still routed incorrectly; Gortex localization could lock audits. |
| 5 | Intent and workflow fixes | 5/5 | $0.386368 | All requested deliverables completed, but a multi-symbol review still entered localization first. |
| 6 | Explore guidance | 4/5 | $0.200654 | A long document audit produced good analysis but hit the 8,000-token provider limit before finishing. |
| 7 | Compact-answer policy | 4/5 | $0.991947 | Auto-routed V4 Pro ignored low thinking, was slow/expensive, and lost one final answer; two tasks exhausted execution budgets. |
| 8 | Flash-only automatic routing, 56/20 call caps | 5/5 | $0.169182 | Ten requested deliverables completed; one audit still attempted Gortex `explore` and recovered via fallback. |
| 9 | Hard `explore` eligibility gate | 5/5 | $0.286807 | Clean confirmation: five complete results, zero `explore` calls, no length/provider failures, no leaked Pi MCP processes. |

Mechanical completion means the final assistant event ended with `stop` and contained text. It does not hide partial deliverables: rounds 2–7 also underwent manual quality review, which is why further changes were made despite many mechanically successful sessions.

## Aggregate measurements

- 45 sessions; 41 ended mechanically with a non-empty final answer.
- 1,387 model turns, 1,345 top-level tool calls, 3,334 nested tool calls, and 72 compactions.
- 2,198,192 input tokens, 21,870,336 cache-read tokens, 941,751 output tokens, and 595,862 reasoning tokens as reported by the provider.
- Total reported cost: **$3.169068**.
- Final two rounds: **10/10 complete**, total **$0.455989**, or **$0.0456 per heavy task**.
- Round 7 with automatic Pro cost **$0.1984 per task**; the final Flash configuration reduced average cost by about **77%** while improving completion from 4/5 to 10/10 across the next two rounds.
- The slowest round-7 task took 1,164 seconds. The slowest task in the clean final round took 367 seconds.

## Changes validated by the runs

- Automatic routing now stays on DeepSeek Flash. V4 Pro remains an explicit `/route pro` choice.
- Browser runs use Flash with low thinking and activate only for positive browser/action intent; negated phrases and code terms such as “browser database” do not start it.
- Browser instructions match the actual Codex CUA API, favor one initial-state read per source, batch DOM extraction, and forbid unsupported `goto`, `fetch`, `visible`, and object-probing patterns.
- Top-level calls are capped at 56, browser calls at 20, nested Gortex reads at 64, identical retries at three, and tool output at 6,000 characters.
- Gortex reads use exact schemas, buffered slices, bounded batching, and implementation-first behavior after a defect is proven.
- `explore` is allowed only for an explicit single-symbol localization request and is blocked for implementation, debugging, audit, review, assessment, and other multi-symbol work.
- Final answers default to fewer than 1,800 words and six sections, preserving conclusions, verification, and risks before the provider output limit.
- DeepSeek image blocks are stripped with an explicit marker, preventing unsupported-image request failures and transcript bloat.
- Browser and Computer Use MCP servers are connected only for relevant runs and unregistered when the run settles or the session shuts down.

## Final validation

Round 8 completed a long financial-system spec audit, a real database fix with 46 passing tests, a React autofix audit, six-source browser research, and a repository/spec conformance review. Round 9 completed two repository reliability audits, a 109 KB technical-document review with executable experiments, six-source WebGPU research, and a cross-platform CLI audit.

After both rounds, no benchmark Pi process, Pi browser bridge, or Pi Computer Use client remained. The only persistent `cua-repl` process belonged to the running ChatGPT desktop app, showed 0% CPU, and was not started by Pi.

## Residual limits

- The native desktop flow could not be exercised end-to-end while macOS was locked; failure-path cleanup was verified instead.
- Browser tabs created by research remain Chrome-owned UI state even though the Pi MCP bridge exits correctly.
- Flash can still consume many cached tokens on repository-wide audits; the $0.75 session cap, compaction, nested-read cap, and concise-answer policy bound the failure mode rather than making broad audits free.
- Benchmark implementation fixes were intentionally left uncommitted in isolated project worktrees; this repository contains only the reusable Pi configuration.
