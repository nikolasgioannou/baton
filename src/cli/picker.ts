import { select } from "@inquirer/prompts";
import { listSessionsForCwd, enrichSessionPreview } from "../sessions.ts";
import { formatBytes } from "../util.ts";
import type { SessionInfo } from "../sessions.ts";

export async function pickSession(cwd: string): Promise<string | undefined> {
  const sessions = listSessionsForCwd(cwd);
  if (sessions.length === 0) return undefined;
  if (!process.stdin.isTTY) {
    throw new Error("no tty available for interactive picker; pass a sessionId or --latest");
  }

  const enriched = await Promise.all(sessions.slice(0, 25).map(enrichSessionPreview));

  const choices = enriched.map((s) => ({
    name: formatChoice(s),
    value: s.id,
    description: s.firstUserMessage
      ? truncate(s.firstUserMessage.replace(/\s+/g, " "), 300)
      : "(no user messages)",
  }));

  const picked = await select({
    message: "pick a session to export",
    choices,
    pageSize: Math.min(choices.length, 10),
  });
  return picked;
}

function formatChoice(s: SessionInfo): string {
  const age = relativeAge(s.mtime);
  const preview = s.firstUserMessage
    ? `"${truncate(s.firstUserMessage.replace(/\s+/g, " "), 60)}"`
    : "(empty)";
  const turns = s.turnCount ?? "?";
  const size = formatBytes(s.sizeBytes);
  return `${age.padEnd(10)} ${preview.padEnd(65)} ${String(turns).padStart(4)} turns · ${size}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function relativeAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
