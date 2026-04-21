import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { createReadStream, createWriteStream } from "node:fs";
import { pack as tarPack, extract as tarExtract } from "tar-stream";
import type { Headers as TarHeaders } from "tar-stream";
import {
  MANIFEST_FILENAME,
  SESSION_FILENAME,
  FILE_HISTORY_DIR,
  assertSupportedFormatVersion,
} from "./format.ts";
import type { BatonManifest } from "./format.ts";

export interface PackInput {
  manifest: BatonManifest;
  sessionJsonl: string;
  fileHistoryEntries: FileHistoryEntry[];
}

export interface FileHistoryEntry {
  /** Relative path within the file-history dir (e.g. "092f23416e5921bb@v2"). */
  name: string;
  /** Raw bytes of the backup blob. */
  contents: Buffer;
}

export async function packBaton(out: string, input: PackInput): Promise<void> {
  const pack = tarPack();

  pack.entry({ name: MANIFEST_FILENAME }, JSON.stringify(input.manifest, null, 2) + "\n");
  pack.entry({ name: SESSION_FILENAME }, input.sessionJsonl);

  for (const entry of input.fileHistoryEntries) {
    pack.entry({ name: `${FILE_HISTORY_DIR}/${entry.name}` }, entry.contents);
  }

  pack.finalize();

  await pipeline(pack, createGzip(), createWriteStream(out));
}

export interface UnpackedBaton {
  manifest: BatonManifest;
  sessionJsonl: string;
  fileHistoryEntries: FileHistoryEntry[];
}

export async function unpackBaton(src: string): Promise<UnpackedBaton> {
  const source: Readable =
    src === "-" ? (process.stdin as unknown as Readable) : createReadStream(src);

  let manifest: BatonManifest | undefined;
  let sessionJsonl: string | undefined;
  const fileHistoryEntries: FileHistoryEntry[] = [];
  let firstError: Error | undefined;

  const extract = tarExtract();

  extract.on("entry", (header: TarHeaders, stream, next) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      if (firstError) {
        next();
        return;
      }
      try {
        const buf = Buffer.concat(chunks);
        const result = processEntry(header.name, buf);
        if (result.kind === "manifest") {
          if (manifest !== undefined) {
            throw new Error("duplicate manifest.json in archive");
          }
          manifest = result.manifest;
        } else if (result.kind === "session") {
          if (sessionJsonl !== undefined) {
            throw new Error("duplicate session.jsonl in archive");
          }
          sessionJsonl = result.text;
        } else {
          fileHistoryEntries.push(result.entry);
        }
      } catch (err) {
        firstError = err instanceof Error ? err : new Error(String(err));
      }
      next();
    });
    stream.resume();
  });

  await pipeline(source, createGunzip(), extract);

  if (firstError) throw firstError;
  if (!manifest) throw new Error("baton archive missing manifest.json");
  if (sessionJsonl === undefined) throw new Error("baton archive missing session.jsonl");

  assertSupportedFormatVersion((manifest as { batonFormatVersion?: unknown }).batonFormatVersion);

  return { manifest, sessionJsonl, fileHistoryEntries };
}

type ProcessedEntry =
  | { kind: "manifest"; manifest: BatonManifest }
  | { kind: "session"; text: string }
  | { kind: "fileHistory"; entry: FileHistoryEntry };

function processEntry(name: string, buf: Buffer): ProcessedEntry {
  assertSafeTarEntryName(name);

  if (name === MANIFEST_FILENAME) {
    return { kind: "manifest", manifest: JSON.parse(buf.toString("utf8")) as BatonManifest };
  }
  if (name === SESSION_FILENAME) {
    return { kind: "session", text: buf.toString("utf8") };
  }
  if (name.startsWith(`${FILE_HISTORY_DIR}/`)) {
    const entryName = name.slice(FILE_HISTORY_DIR.length + 1);
    assertSafeEntryName(entryName);
    return { kind: "fileHistory", entry: { name: entryName, contents: buf } };
  }
  throw new Error(`unexpected entry in baton archive: ${JSON.stringify(name)}`);
}

/**
 * Reject absolute paths and any `..` segment across the whole tar, before we
 * even decide which slot the entry belongs to.
 */
function assertSafeTarEntryName(name: string): void {
  if (!name) throw new Error("empty tar entry name");
  if (name.startsWith("/")) {
    throw new Error(`refusing absolute path in archive: ${name}`);
  }
  const segments = name.split("/");
  for (const seg of segments) {
    if (seg === ".." || seg === ".") {
      throw new Error(`refusing path-traversal segment in archive: ${name}`);
    }
  }
}

/**
 * For file-history entries specifically: must be a single flat filename with
 * no separators, no leading dot, no traversal.
 */
function assertSafeEntryName(name: string): void {
  if (!name) throw new Error("empty file-history entry name");
  if (name.includes("/") || name.includes("\\")) {
    throw new Error(`refusing nested file-history entry: ${name}`);
  }
  if (name.startsWith(".")) {
    throw new Error(`refusing dotfile file-history entry: ${name}`);
  }
}
