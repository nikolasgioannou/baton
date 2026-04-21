import { createGzip, createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";
import { createReadStream, createWriteStream } from "node:fs";
import { pack as tarPack, extract as tarExtract } from "tar-stream";
import type { Headers as TarHeaders } from "tar-stream";
import { MANIFEST_FILENAME, SESSION_FILENAME, FILE_HISTORY_DIR } from "./format.ts";
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

  const extract = tarExtract();

  extract.on("entry", (header: TarHeaders, stream, next) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      const buf = Buffer.concat(chunks);
      if (header.name === MANIFEST_FILENAME) {
        manifest = JSON.parse(buf.toString("utf8")) as BatonManifest;
      } else if (header.name === SESSION_FILENAME) {
        sessionJsonl = buf.toString("utf8");
      } else if (header.name.startsWith(`${FILE_HISTORY_DIR}/`)) {
        const name = header.name.slice(FILE_HISTORY_DIR.length + 1);
        if (name.length > 0) {
          fileHistoryEntries.push({ name, contents: buf });
        }
      }
      next();
    });
    stream.resume();
  });

  await pipeline(source, createGunzip(), extract);

  if (!manifest) throw new Error("baton archive missing manifest.json");
  if (sessionJsonl === undefined) throw new Error("baton archive missing session.jsonl");

  return { manifest, sessionJsonl, fileHistoryEntries };
}
