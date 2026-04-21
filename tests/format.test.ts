import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSupportedFormatVersion, BATON_FORMAT_VERSION } from "../src/format.ts";
import { packBaton, unpackBaton } from "../src/container.ts";
import type { BatonManifest } from "../src/format.ts";

describe("assertSupportedFormatVersion", () => {
  test("accepts the current format version", () => {
    expect(() => assertSupportedFormatVersion(BATON_FORMAT_VERSION)).not.toThrow();
  });

  test("rejects an unknown future version", () => {
    expect(() => assertSupportedFormatVersion(999)).toThrow(/unsupported baton format version 999/);
  });

  test("rejects zero and negative integers", () => {
    expect(() => assertSupportedFormatVersion(0)).toThrow(/unsupported/);
    expect(() => assertSupportedFormatVersion(-1)).toThrow(/unsupported/);
  });

  test("rejects non-integer numbers", () => {
    expect(() => assertSupportedFormatVersion(1.5)).toThrow(/valid batonFormatVersion/);
  });

  test("rejects non-numeric values", () => {
    expect(() => assertSupportedFormatVersion("1")).toThrow(/valid batonFormatVersion/);
    expect(() => assertSupportedFormatVersion(undefined)).toThrow(/valid batonFormatVersion/);
    expect(() => assertSupportedFormatVersion(null)).toThrow(/valid batonFormatVersion/);
  });
});

describe("unpackBaton version enforcement", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "baton-format-test-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  test("rejects an archive packed with an unsupported version", async () => {
    const out = join(tmp, "bad.baton");
    const manifest: BatonManifest = {
      batonFormatVersion: 999 as number,
      createdAt: "2026-01-01T00:00:00Z",
      sender: { cwd: "/", home: "/", username: "x", os: "darwin", arch: "arm64" },
      session: { id: "x", turnCount: 0, sizeBytes: 0 },
      fileHistory: { entryCount: 0, sizeBytes: 0 },
      toolsReferenced: [],
      mcpServersReferenced: [],
      skillsReferenced: [],
    };
    await packBaton(out, { manifest, sessionJsonl: "", fileHistoryEntries: [] });
    await expect(unpackBaton(out)).rejects.toThrow(/unsupported baton format version 999/);
  });
});
