export interface SessionAnalysis {
  turnCount: number;
  tools: Set<string>;
  mcpServers: Set<string>;
  skills: Set<string>;
  claudeCodeVersion?: string;
  gitBranch?: string;
  cwd?: string;
  firstUserMessage?: string;
  sessionId?: string;
}

export function analyzeSessionJsonl(jsonl: string): SessionAnalysis {
  const result: SessionAnalysis = {
    turnCount: 0,
    tools: new Set(),
    mcpServers: new Set(),
    skills: new Set(),
  };

  for (const line of jsonl.split("\n")) {
    if (!line) continue;

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.type === "user" || event.type === "assistant") result.turnCount++;

    if (!result.firstUserMessage && event.type === "user") {
      const msg = event.message as Record<string, unknown> | undefined;
      if (msg && typeof msg.content === "string") result.firstUserMessage = msg.content;
    }

    if (!result.claudeCodeVersion && typeof event.version === "string") {
      result.claudeCodeVersion = event.version;
    }
    if (!result.cwd && typeof event.cwd === "string") result.cwd = event.cwd;
    if (!result.gitBranch && typeof event.gitBranch === "string") {
      result.gitBranch = event.gitBranch;
    }
    if (!result.sessionId && typeof event.sessionId === "string") {
      result.sessionId = event.sessionId;
    }

    if (event.type === "assistant") {
      const msg = event.message as Record<string, unknown> | undefined;
      const content = msg?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!block || typeof block !== "object") continue;
          const b = block as Record<string, unknown>;
          if (b.type === "tool_use" && typeof b.name === "string") {
            recordTool(result, b.name);
          }
        }
      }
    }

    if (event.type === "attachment") {
      const att = event.attachment as Record<string, unknown> | undefined;
      if (!att) continue;
      if (att.type === "deferred_tools_delta" && Array.isArray(att.addedNames)) {
        for (const n of att.addedNames) {
          if (typeof n === "string") recordTool(result, n);
        }
      } else if (att.type === "skill_listing" && typeof att.content === "string") {
        for (const skillLine of att.content.split("\n")) {
          const match = skillLine.match(/^-\s+([a-zA-Z0-9_.:-]+):/);
          if (match?.[1]) result.skills.add(match[1]);
        }
      }
    }
  }

  return result;
}

function recordTool(result: SessionAnalysis, name: string): void {
  result.tools.add(name);
  if (name.startsWith("mcp__")) {
    const parts = name.split("__");
    if (parts.length >= 3 && parts[1]) result.mcpServers.add(parts[1]);
  }
}
