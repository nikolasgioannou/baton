import { parseArgs } from "node:util";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir, userInfo, platform, arch } from "node:os";
import { listSessionsForCwd, projectDirForCwd } from "../sessions.ts";
import { analyzeSessionJsonl } from "../analyze.ts";
import { collectFileHistoryForSession, fileHistorySizeBytes } from "../backups.ts";
import { packBaton } from "../container.ts";
import { defaultBatonFilename, BATON_FORMAT_VERSION } from "../format.ts";
import type { BatonManifest } from "../format.ts";
import { formatBytes } from "../util.ts";
import { detectGit } from "../git.ts";

const EXPORT_USAGE = `baton export - package a claude code session

usage:
  baton export [sessionId] [flags]

flags:
  -o, --out <path>   output file (default: ./<slug>.baton)
      --latest       export the most recent session in this dir
  -h, --help         show this help
`;

export async function runExport(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      out: { type: "string", short: "o" },
      latest: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (parsed.values.help) {
    process.stdout.write(EXPORT_USAGE);
    return 0;
  }

  const cwd = process.cwd();
  let sessionId = parsed.positionals[0];

  if (!sessionId) {
    if (parsed.values.latest) {
      const latest = listSessionsForCwd(cwd)[0];
      if (!latest) {
        process.stderr.write(`no claude code sessions found for ${cwd}\n`);
        return 1;
      }
      sessionId = latest.id;
    } else {
      process.stderr.write(
        "baton export: specify a sessionId or --latest\n" + "(interactive picker is coming soon)\n",
      );
      return 2;
    }
  }

  const sessionPath = join(projectDirForCwd(cwd), `${sessionId}.jsonl`);
  if (!existsSync(sessionPath)) {
    process.stderr.write(`session not found: ${sessionPath}\n`);
    return 1;
  }

  const jsonl = await Bun.file(sessionPath).text();
  const analysis = analyzeSessionJsonl(jsonl);
  const fhEntries = collectFileHistoryForSession(sessionId);

  const manifest: BatonManifest = {
    batonFormatVersion: BATON_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    sender: {
      cwd,
      home: homedir(),
      username: userInfo().username,
      os: platform(),
      arch: arch(),
    },
    session: {
      id: sessionId,
      claudeCodeVersion: analysis.claudeCodeVersion,
      turnCount: analysis.turnCount,
      sizeBytes: Buffer.byteLength(jsonl, "utf8"),
    },
    git: detectGit(cwd),
    fileHistory: {
      entryCount: fhEntries.length,
      sizeBytes: fileHistorySizeBytes(fhEntries),
    },
    toolsReferenced: [...analysis.tools].sort(),
    mcpServersReferenced: [...analysis.mcpServers].sort(),
    skillsReferenced: [...analysis.skills].sort(),
  };

  const outPath = parsed.values.out
    ? resolve(parsed.values.out)
    : resolve(cwd, defaultBatonFilename(manifest));

  await packBaton(outPath, {
    manifest,
    sessionJsonl: jsonl,
    fileHistoryEntries: fhEntries,
  });

  const size = statSync(outPath).size;
  process.stdout.write(`wrote ${outPath} (${formatBytes(size)}, ${analysis.turnCount} turns)\n`);
  return 0;
}
