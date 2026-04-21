import { parseArgs } from "node:util";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { unpackBaton } from "../container.ts";
import { buildRewriteConfig } from "../ids.ts";
import { rewriteSessionJsonl } from "../rewrite.ts";
import { projectDirForCwd } from "../sessions.ts";
import { restoreFileHistoryForSession } from "../backups.ts";
import { formatBytes } from "../util.ts";
import { detectGit } from "../git.ts";
import type { BatonManifest } from "../format.ts";

const IMPORT_USAGE = `baton import - unpack a .baton file

usage:
  baton import <file> [flags]
  baton import -           (read from stdin)

flags:
      --run          launch 'claude --resume' on success
  -h, --help         show this help
`;

export async function runImport(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      run: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  if (parsed.values.help) {
    process.stdout.write(IMPORT_USAGE);
    return 0;
  }

  const src = parsed.positionals[0];
  if (!src) {
    process.stderr.write("baton import: missing .baton file (use '-' for stdin)\n");
    return 2;
  }
  if (src !== "-" && !existsSync(src)) {
    process.stderr.write(`not found: ${src}\n`);
    return 1;
  }

  const { manifest, sessionJsonl, fileHistoryEntries } = await unpackBaton(src);

  const cwd = process.cwd();
  const cfg = buildRewriteConfig({
    senderCwd: manifest.sender.cwd,
    senderHome: manifest.sender.home,
    senderSessionId: manifest.session.id,
    recipientCwd: cwd,
  });

  const rewritten = rewriteSessionJsonl(sessionJsonl, cfg);

  const projectDir = projectDirForCwd(cwd);
  mkdirSync(projectDir, { recursive: true });
  const outPath = join(projectDir, `${cfg.recipientSessionId}.jsonl`);
  writeFileSync(outPath, rewritten);

  restoreFileHistoryForSession(cfg.recipientSessionId, fileHistoryEntries);

  printWarnings(manifest, cwd);

  process.stdout.write(`\nimported as session ${cfg.recipientSessionId}\n`);
  process.stdout.write(`wrote ${outPath} (${formatBytes(Buffer.byteLength(rewritten))})\n`);
  if (fileHistoryEntries.length > 0) {
    process.stdout.write(`${fileHistoryEntries.length} file-history entries restored\n`);
  }
  process.stdout.write(`\nnext: claude --resume ${cfg.recipientSessionId}\n`);

  if (parsed.values.run) {
    return await launchClaude(cfg.recipientSessionId);
  }
  return 0;
}

function printWarnings(manifest: BatonManifest, cwd: string): void {
  const warnings: string[] = [];

  if (manifest.git?.sha) {
    const senderSha = manifest.git.sha;
    const recipientSha = detectGit(cwd)?.sha;
    if (recipientSha && recipientSha !== senderSha) {
      warnings.push(
        `git SHA differs: sender at ${senderSha.slice(0, 7)}, you at ${recipientSha.slice(0, 7)} — model has stale file views`,
      );
    }
  }

  if (manifest.mcpServersReferenced.length > 0) {
    warnings.push(
      `session references MCP server(s): ${manifest.mcpServersReferenced.join(", ")} — calls will fail unless configured`,
    );
  }

  if (warnings.length > 0) {
    process.stdout.write("\nwarnings:\n");
    for (const w of warnings) process.stdout.write(`  - ${w}\n`);
  }
}

async function launchClaude(sessionId: string): Promise<number> {
  return await new Promise<number>((resolveExit) => {
    const child = spawn("claude", ["--resume", sessionId], { stdio: "inherit" });
    child.on("exit", (code) => resolveExit(code ?? 0));
    child.on("error", (err) => {
      process.stderr.write(`failed to launch claude: ${err.message}\n`);
      resolveExit(1);
    });
  });
}
