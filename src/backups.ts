import { readdirSync, readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { claudeFileHistoryRoot } from "./sessions.ts";
import type { FileHistoryEntry } from "./container.ts";

export function collectFileHistoryForSession(sessionId: string): FileHistoryEntry[] {
  const dir = join(claudeFileHistoryRoot(), sessionId);
  if (!existsSync(dir)) return [];
  const entries: FileHistoryEntry[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (!s.isFile()) continue;
    entries.push({ name, contents: readFileSync(p) });
  }
  return entries;
}

export function fileHistorySizeBytes(entries: FileHistoryEntry[]): number {
  return entries.reduce((sum, e) => sum + e.contents.length, 0);
}

export function restoreFileHistoryForSession(sessionId: string, entries: FileHistoryEntry[]): void {
  if (entries.length === 0) return;
  const dir = join(claudeFileHistoryRoot(), sessionId);
  mkdirSync(dir, { recursive: true });
  for (const entry of entries) {
    if (entry.name.includes("/") || entry.name.includes("\\") || entry.name.startsWith("..")) {
      throw new Error(`refusing to write suspicious file-history entry: ${entry.name}`);
    }
    writeFileSync(join(dir, entry.name), entry.contents);
  }
}
