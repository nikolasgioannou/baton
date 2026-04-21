import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { unpackBaton } from "../container.ts";
import { formatBytes } from "../util.ts";
import { detectGit } from "../git.ts";
import type { BatonManifest } from "../format.ts";

const INFO_USAGE = `baton info - inspect a .baton file

usage:
  baton info <file>
  baton info -        (read from stdin)

flags:
  -h, --help          show this help
`;

export async function runInfo(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: { help: { type: "boolean", short: "h" } },
    allowPositionals: true,
    strict: true,
  });

  if (parsed.values.help) {
    process.stdout.write(INFO_USAGE);
    return 0;
  }

  const src = parsed.positionals[0];
  if (!src) {
    process.stderr.write("baton info: missing .baton file (use '-' for stdin)\n");
    return 2;
  }
  if (src !== "-" && !existsSync(src)) {
    process.stderr.write(`not found: ${src}\n`);
    return 1;
  }

  const { manifest, sessionJsonl, fileHistoryEntries } = await unpackBaton(src);

  printManifest(manifest, sessionJsonl.length, fileHistoryEntries.length);
  printWarnings(manifest);
  return 0;
}

function printManifest(m: BatonManifest, jsonlBytes: number, fhCount: number): void {
  const write = (s: string): void => {
    process.stdout.write(s + "\n");
  };
  write(`baton archive`);
  write(`  format version:   ${m.batonFormatVersion}`);
  write(`  created at:       ${m.createdAt}`);
  write("");
  write(`sender`);
  write(`  user:             ${m.sender.username}`);
  write(`  cwd:              ${m.sender.cwd}`);
  write(`  os / arch:        ${m.sender.os} / ${m.sender.arch}`);
  write("");
  write(`session`);
  write(`  id:               ${m.session.id}`);
  write(`  claude code ver:  ${m.session.claudeCodeVersion ?? "(unknown)"}`);
  write(`  turns (events):   ${m.session.turnCount}`);
  write(`  jsonl size:       ${formatBytes(jsonlBytes)}`);
  if (m.git) {
    write("");
    write(`git`);
    if (m.git.branch) write(`  branch:           ${m.git.branch}`);
    if (m.git.sha) write(`  sha:              ${m.git.sha}`);
    if (m.git.remote) write(`  remote:           ${m.git.remote}`);
  }
  write("");
  write(`file-history backups`);
  write(
    `  entries:          ${m.fileHistory.entryCount} (${formatBytes(m.fileHistory.sizeBytes)})`,
  );
  if (fhCount !== m.fileHistory.entryCount) {
    write(`  (note: ${fhCount} entries actually present in archive)`);
  }
  if (m.toolsReferenced.length > 0) {
    write("");
    write(`tools referenced (${m.toolsReferenced.length})`);
    for (const t of m.toolsReferenced.slice(0, 20)) write(`  - ${t}`);
    if (m.toolsReferenced.length > 20) {
      write(`  ... and ${m.toolsReferenced.length - 20} more`);
    }
  }
  if (m.mcpServersReferenced.length > 0) {
    write("");
    write(`mcp servers referenced`);
    for (const s of m.mcpServersReferenced) write(`  - ${s}`);
  }
  if (m.skillsReferenced.length > 0) {
    write("");
    write(`skills referenced`);
    for (const s of m.skillsReferenced) write(`  - ${s}`);
  }
}

function printWarnings(m: BatonManifest): void {
  const warnings: string[] = [];
  if (m.git?.sha) {
    const here = detectGit(process.cwd())?.sha;
    if (here && here !== m.git.sha) {
      warnings.push(
        `git SHA differs from yours: sender ${m.git.sha.slice(0, 7)}, you ${here.slice(0, 7)}`,
      );
    }
  }
  if (m.mcpServersReferenced.length > 0) {
    warnings.push(
      `${m.mcpServersReferenced.length} MCP server(s) referenced — calls will fail without local config`,
    );
  }
  if (warnings.length > 0) {
    process.stdout.write("\nwarnings\n");
    for (const w of warnings) process.stdout.write(`  - ${w}\n`);
  }
}
