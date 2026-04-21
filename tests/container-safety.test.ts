import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { pack as tarPack } from "tar-stream";
import { unpackBaton } from "../src/container.ts";
import {
  MANIFEST_FILENAME,
  SESSION_FILENAME,
  FILE_HISTORY_DIR,
  BATON_FORMAT_VERSION,
} from "../src/format.ts";
import type { BatonManifest } from "../src/format.ts";

interface Entry {
  name: string;
  body: string | Buffer;
}

async function writeArchive(outPath: string, entries: Entry[]): Promise<void> {
  const pack = tarPack();
  for (const e of entries) {
    pack.entry({ name: e.name }, e.body);
  }
  pack.finalize();
  await pipeline(pack, createGzip(), createWriteStream(outPath));
}

function validManifest(): BatonManifest {
  return {
    batonFormatVersion: BATON_FORMAT_VERSION,
    createdAt: "2026-01-01T00:00:00Z",
    sender: { cwd: "/s", home: "/s", username: "x", os: "darwin", arch: "arm64" },
    session: { id: "x", turnCount: 0, sizeBytes: 0 },
    fileHistory: { entryCount: 0, sizeBytes: 0 },
    toolsReferenced: [],
    mcpServersReferenced: [],
    skillsReferenced: [],
  };
}

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "baton-safety-test-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("unpackBaton safety", () => {
  test("rejects a path-traversal entry in file-history", async () => {
    const out = join(tmp, "evil.baton");
    await writeArchive(out, [
      { name: MANIFEST_FILENAME, body: JSON.stringify(validManifest()) },
      { name: SESSION_FILENAME, body: "" },
      { name: `${FILE_HISTORY_DIR}/../etc/passwd`, body: "pwn" },
    ]);
    await expect(unpackBaton(out)).rejects.toThrow(/path-traversal/);
  });

  test("rejects an absolute-path entry", async () => {
    const out = join(tmp, "evil.baton");
    await writeArchive(out, [
      { name: MANIFEST_FILENAME, body: JSON.stringify(validManifest()) },
      { name: SESSION_FILENAME, body: "" },
      { name: "/etc/passwd", body: "pwn" },
    ]);
    await expect(unpackBaton(out)).rejects.toThrow(/absolute path/);
  });

  test("rejects an unknown top-level entry", async () => {
    const out = join(tmp, "evil.baton");
    await writeArchive(out, [
      { name: MANIFEST_FILENAME, body: JSON.stringify(validManifest()) },
      { name: SESSION_FILENAME, body: "" },
      { name: "README.md", body: "nope" },
    ]);
    await expect(unpackBaton(out)).rejects.toThrow(/unexpected entry/);
  });

  test("rejects duplicate manifest.json", async () => {
    const out = join(tmp, "evil.baton");
    const m = JSON.stringify(validManifest());
    await writeArchive(out, [
      { name: MANIFEST_FILENAME, body: m },
      { name: MANIFEST_FILENAME, body: m },
      { name: SESSION_FILENAME, body: "" },
    ]);
    await expect(unpackBaton(out)).rejects.toThrow(/duplicate manifest/);
  });

  test("rejects duplicate session.jsonl", async () => {
    const out = join(tmp, "evil.baton");
    await writeArchive(out, [
      { name: MANIFEST_FILENAME, body: JSON.stringify(validManifest()) },
      { name: SESSION_FILENAME, body: "a" },
      { name: SESSION_FILENAME, body: "b" },
    ]);
    await expect(unpackBaton(out)).rejects.toThrow(/duplicate session/);
  });

  test("rejects dotfile inside file-history", async () => {
    const out = join(tmp, "evil.baton");
    await writeArchive(out, [
      { name: MANIFEST_FILENAME, body: JSON.stringify(validManifest()) },
      { name: SESSION_FILENAME, body: "" },
      { name: `${FILE_HISTORY_DIR}/.hidden`, body: "x" },
    ]);
    await expect(unpackBaton(out)).rejects.toThrow(/dotfile/);
  });
});
