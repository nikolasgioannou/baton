import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface SessionInfo {
  id: string;
  path: string;
  projectDir: string;
  mtime: Date;
  sizeBytes: number;
  firstUserMessage?: string;
  turnCount?: number;
  version?: string;
  cwd?: string;
  gitBranch?: string;
}

export function claudeProjectsRoot(): string {
  return join(homedir(), ".claude", "projects");
}

export function claudeFileHistoryRoot(): string {
  return join(homedir(), ".claude", "file-history");
}

export function cwdToProjectDir(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

export function projectDirForCwd(cwd: string): string {
  return join(claudeProjectsRoot(), cwdToProjectDir(cwd));
}

export function listSessionsForCwd(cwd: string): SessionInfo[] {
  const dir = projectDirForCwd(cwd);
  if (!existsSync(dir)) return [];
  return listSessionsInDir(dir);
}

export function listSessionsInDir(projectDir: string): SessionInfo[] {
  const entries = readdirSync(projectDir);
  return entries
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => {
      const p = join(projectDir, f);
      const s = statSync(p);
      return {
        id: f.replace(/\.jsonl$/, ""),
        path: p,
        projectDir,
        mtime: s.mtime,
        sizeBytes: s.size,
      };
    })
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export type ResolveResult =
  | { ok: true; id: string }
  | { ok: false; reason: "none" }
  | { ok: false; reason: "ambiguous"; matches: string[] };

export function resolveSessionIdFromList(prefix: string, ids: string[]): ResolveResult {
  if (ids.includes(prefix)) return { ok: true, id: prefix };
  const matches = ids.filter((id) => id.startsWith(prefix));
  if (matches.length === 1) return { ok: true, id: matches[0]! };
  if (matches.length === 0) return { ok: false, reason: "none" };
  return { ok: false, reason: "ambiguous", matches };
}

export function resolveSessionId(prefix: string, projectDir: string): ResolveResult {
  const ids = existsSync(projectDir) ? listSessionsInDir(projectDir).map((s) => s.id) : [];
  return resolveSessionIdFromList(prefix, ids);
}

export async function enrichSessionPreview(info: SessionInfo): Promise<SessionInfo> {
  const text = await Bun.file(info.path).text();
  const lines = text.split("\n").filter(Boolean);

  let firstUserMessage: string | undefined;
  let turnCount = 0;
  let version: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;

  for (const line of lines) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    if (event.type === "user" || event.type === "assistant") {
      turnCount++;
    }

    if (!firstUserMessage && event.type === "user") {
      const message = event.message as Record<string, unknown> | undefined;
      if (message && typeof message.content === "string") {
        firstUserMessage = message.content;
      }
    }

    if (!version && typeof event.version === "string") {
      version = event.version;
    }
    if (!cwd && typeof event.cwd === "string") {
      cwd = event.cwd;
    }
    if (!gitBranch && typeof event.gitBranch === "string") {
      gitBranch = event.gitBranch;
    }
  }

  return { ...info, firstUserMessage, turnCount, version, cwd, gitBranch };
}
