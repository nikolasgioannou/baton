import { execFileSync } from "node:child_process";

export interface GitInfo {
  branch?: string;
  sha?: string;
  remote?: string;
}

export function detectGit(cwd: string): GitInfo | undefined {
  const run = (args: string[]): string | undefined => {
    try {
      return execFileSync("git", ["-C", cwd, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return undefined;
    }
  };
  const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
  const sha = run(["rev-parse", "HEAD"]);
  const remote = run(["config", "--get", "remote.origin.url"]);
  if (!branch && !sha && !remote) return undefined;
  return { branch, sha, remote };
}
