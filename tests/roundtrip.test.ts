import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { packBaton, unpackBaton } from "../src/container.ts";
import type { BatonManifest } from "../src/format.ts";
import { BATON_FORMAT_VERSION } from "../src/format.ts";

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "baton-test-"));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function makeManifest(): BatonManifest {
  return {
    batonFormatVersion: BATON_FORMAT_VERSION,
    createdAt: "2026-01-01T00:00:00Z",
    sender: {
      cwd: "/Users/alice/proj",
      home: "/Users/alice",
      username: "alice",
      os: "darwin",
      arch: "arm64",
    },
    session: {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      claudeCodeVersion: "2.1.0",
      turnCount: 3,
      sizeBytes: 128,
    },
    fileHistory: { entryCount: 2, sizeBytes: 10 },
    toolsReferenced: ["Read", "Edit"],
    mcpServersReferenced: [],
    skillsReferenced: [],
  };
}

describe("baton container roundtrip", () => {
  test("pack then unpack recovers manifest and jsonl", async () => {
    const out = join(tmp, "a.baton");
    const manifest = makeManifest();
    const jsonl = '{"type":"user","message":{"role":"user","content":"hi"}}\n';
    await packBaton(out, {
      manifest,
      sessionJsonl: jsonl,
      fileHistoryEntries: [],
    });

    const unpacked = await unpackBaton(out);
    expect(unpacked.manifest).toEqual(manifest);
    expect(unpacked.sessionJsonl).toBe(jsonl);
    expect(unpacked.fileHistoryEntries).toEqual([]);
  });

  test("pack then unpack preserves file-history entries byte-for-byte", async () => {
    const out = join(tmp, "b.baton");
    const manifest = makeManifest();
    const jsonl = "{}\n";
    const entries = [
      { name: "abc123@v1", contents: Buffer.from("hello world") },
      { name: "def456@v2", contents: Buffer.from([0, 1, 2, 3, 255, 254]) },
    ];
    await packBaton(out, {
      manifest,
      sessionJsonl: jsonl,
      fileHistoryEntries: entries,
    });

    const unpacked = await unpackBaton(out);
    expect(unpacked.fileHistoryEntries).toHaveLength(2);
    const byName = new Map(unpacked.fileHistoryEntries.map((e) => [e.name, e.contents]));
    expect(byName.get("abc123@v1")?.toString("utf8")).toBe("hello world");
    expect(Array.from(byName.get("def456@v2") ?? [])).toEqual([0, 1, 2, 3, 255, 254]);
  });
});
