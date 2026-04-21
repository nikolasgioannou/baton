export const BATON_FORMAT_VERSION = 1;

export const SUPPORTED_FORMAT_VERSIONS: readonly number[] = [1];

export function assertSupportedFormatVersion(v: unknown): void {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new Error(`baton manifest missing a valid batonFormatVersion (got ${JSON.stringify(v)})`);
  }
  if (!SUPPORTED_FORMAT_VERSIONS.includes(v)) {
    throw new Error(
      `unsupported baton format version ${v}. this binary supports: ${SUPPORTED_FORMAT_VERSIONS.join(", ")}. run 'baton update' to get the latest.`,
    );
  }
}

/**
 * A .baton archive is a gzipped tarball with:
 *   - manifest.json          (BatonManifest, required)
 *   - session.jsonl          (the raw Claude Code session, required)
 *   - file-history/**        (backup blobs referenced by file-history-snapshot events, optional)
 */
export interface BatonManifest {
  batonFormatVersion: number;
  createdAt: string;
  sender: {
    cwd: string;
    home: string;
    username: string;
    os: string;
    arch: string;
  };
  session: {
    id: string;
    claudeCodeVersion?: string;
    turnCount: number;
    sizeBytes: number;
  };
  git?: {
    branch?: string;
    sha?: string;
    remote?: string;
  };
  fileHistory: {
    entryCount: number;
    sizeBytes: number;
  };
  toolsReferenced: string[];
  mcpServersReferenced: string[];
  skillsReferenced: string[];
}

export const MANIFEST_FILENAME = "manifest.json";
export const SESSION_FILENAME = "session.jsonl";
export const FILE_HISTORY_DIR = "file-history";

export function defaultBatonFilename(manifest: BatonManifest): string {
  const shortId = manifest.session.id.slice(0, 8);
  const cwdBase = manifest.sender.cwd.split("/").filter(Boolean).pop() ?? "session";
  const sanitized = cwdBase.replace(/[^a-zA-Z0-9._-]/g, "-");
  return `${sanitized}-${shortId}.baton`;
}
