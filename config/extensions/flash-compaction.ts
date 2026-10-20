import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

export default function flashCompaction(pi: ExtensionAPI): void {
  pi.on("session_before_compact", async (event, ctx) => {
    const model = ctx.modelRegistry.find("deepseek", "deepseek-flash");
    if (!model) return;

    const { preparation, customInstructions, signal } = event;
    const messages = [...preparation.messagesToSummarize, ...preparation.turnPrefixMessages];
    const conversation = serializeConversation(convertToLlm(messages));
    const previous = preparation.previousSummary
      ? `\nUpdate and preserve every still-relevant fact from this previous summary:\n${preparation.previousSummary}\n`
      : "";
    const focus = customInstructions ? `\nAdditional user focus: ${customInstructions}\n` : "";

    try {
      const response = await ctx.modelRegistry.complete(
        model,
        {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Create a precise continuation checkpoint for a coding agent. Preserve concrete facts and remove obsolete exploration.${previous}${focus}

Use these sections:
- Goal
- Constraints and durable preferences
- Progress: done, in progress, remaining
- Decisions and rationale
- Verification results and failures
- Next exact actions
- Critical files, symbols, commands, IDs, and values

Keep exact paths, identifiers, errors, measurements, and unresolved blockers. State uncertainty explicitly. Do not invent completion. The recent unsummarized conversation remains available after this checkpoint.

<conversation>
${conversation}
</conversation>`,
                },
              ],
              timestamp: Date.now(),
            },
          ],
        },
        {
          maxTokens: 2048,
          signal,
          cacheRetention: "none",
          sessionId: uuidv7(),
        },
      );
      const summary = response.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      if (!summary || response.stopReason !== "stop") return;
      const modifiedFiles = [...new Set([...preparation.fileOps.written, ...preparation.fileOps.edited])].sort();
      const readFiles = [...preparation.fileOps.read].filter((path) => !modifiedFiles.includes(path)).sort();

      return {
        compaction: {
          summary,
          firstKeptEntryId: preparation.firstKeptEntryId,
          tokensBefore: preparation.tokensBefore,
          usage: response.usage,
          details: {
            readFiles,
            modifiedFiles,
            model: "deepseek/deepseek-flash",
          },
        },
      };
    } catch {
      return;
    }
  });
}
