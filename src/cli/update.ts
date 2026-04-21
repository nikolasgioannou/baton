import { parseArgs } from "node:util";
import { renameSync, unlinkSync, chmodSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import pkg from "../../package.json" with { type: "json" };

const USAGE = `baton update - upgrade to the latest release

usage:
  baton update [flags]

flags:
      --check            check for updates without installing
      --version <tag>    install a specific release tag (e.g. v0.1.0)
  -h, --help             show this help
`;

const REPO = "nikolasgioannou/baton";

export async function runUpdate(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      check: { type: "boolean" },
      version: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (parsed.values.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const current = pkg.version;
  const target = parsed.values.version ?? (await fetchLatestTag());
  if (!target) {
    process.stderr.write("could not resolve a release tag on github\n");
    return 1;
  }
  const targetVersion = target.replace(/^v/, "");

  if (parsed.values.check) {
    if (targetVersion === current) {
      process.stdout.write(`baton is up to date (v${current})\n`);
    } else {
      process.stdout.write(`update available: v${current} -> v${targetVersion}\n`);
    }
    return 0;
  }

  if (targetVersion === current && !parsed.values.version) {
    process.stdout.write(`baton is already at v${current}\n`);
    return 0;
  }

  const platform = detectPlatform();
  const url = `https://github.com/${REPO}/releases/download/${target}/baton-${platform}`;
  const binaryPath = process.execPath;

  if (!canWrite(binaryPath)) {
    process.stderr.write(`cannot write to ${binaryPath} — rerun with sudo or reinstall\n`);
    return 1;
  }

  process.stdout.write(`updating baton: v${current} -> ${target} (${platform})\n`);

  const tmpPath = join(dirname(binaryPath), `.baton-update-${process.pid}.tmp`);
  try {
    await downloadTo(url, tmpPath);
    chmodSync(tmpPath, 0o755);
    renameSync(tmpPath, binaryPath);
  } catch (err) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // tmp file may not exist; ignore
    }
    process.stderr.write(`update failed: ${(err as Error).message}\n`);
    return 1;
  }

  process.stdout.write(`done. ${binaryPath} is now ${target}\n`);
  return 0;
}

async function fetchLatestTag(): Promise<string | undefined> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
  if (!res.ok) return undefined;
  const json = (await res.json()) as { tag_name?: string };
  return json.tag_name;
}

function detectPlatform(): string {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : "";
  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : "";
  if (!os || !arch) {
    throw new Error(`unsupported platform: ${process.platform}-${process.arch}`);
  }
  return `${os}-${arch}`;
}

async function downloadTo(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);
  if (!res.body) throw new Error("empty response body");

  const total = Number(res.headers.get("content-length") ?? 0);
  const writer = Bun.file(dest).writer();
  let received = 0;
  const isTTY = process.stderr.isTTY;

  for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
    writer.write(chunk);
    received += chunk.length;
    if (isTTY && total > 0) {
      const pct = Math.min(100, Math.floor((received / total) * 100));
      process.stderr.write(`\rdownloading ${pct}%`);
    }
  }
  await writer.end();
  if (isTTY && total > 0) process.stderr.write("\n");
}

function canWrite(path: string): boolean {
  try {
    const parent = dirname(path);
    if (!existsSync(parent)) return false;
    // crude check: write a probe file in the parent dir
    const probe = join(parent, `.baton-write-probe-${process.pid}`);
    Bun.write(probe, "");
    unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}
