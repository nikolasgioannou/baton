import { parseArgs } from "node:util";
import { unlinkSync, existsSync } from "node:fs";
import { confirm } from "@inquirer/prompts";

const USAGE = `baton uninstall - remove the baton binary

usage:
  baton uninstall [flags]

flags:
  -y, --yes     skip the confirmation prompt
  -h, --help    show this help

notes:
  only the baton binary is removed. imported sessions in ~/.claude/projects
  and restored file-history in ~/.claude/file-history are left alone — delete
  them manually if you no longer need them.
`;

export async function runUninstall(args: string[]): Promise<number> {
  const parsed = parseArgs({
    args,
    options: {
      yes: { type: "boolean", short: "y" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (parsed.values.help) {
    process.stdout.write(USAGE);
    return 0;
  }

  const path = process.execPath;
  if (!existsSync(path)) {
    process.stderr.write(`baton binary not found at ${path}\n`);
    return 1;
  }

  if (!parsed.values.yes) {
    if (!process.stdin.isTTY) {
      process.stderr.write("baton uninstall: not a tty; pass --yes to confirm non-interactively\n");
      return 2;
    }
    const ok = await confirm({
      message: `remove baton from ${path}?`,
      default: false,
    });
    if (!ok) {
      process.stderr.write("aborted\n");
      return 130;
    }
  }

  try {
    unlinkSync(path);
  } catch (err) {
    process.stderr.write(`could not remove ${path}: ${(err as Error).message}\n`);
    return 1;
  }

  process.stdout.write(`removed ${path}\n`);
  return 0;
}
