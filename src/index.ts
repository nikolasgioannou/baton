#!/usr/bin/env bun

import { runExport } from "./cli/export.ts";
import { runImport } from "./cli/import.ts";
import { runInfo } from "./cli/info.ts";
import { runUpdate } from "./cli/update.ts";
import { runUninstall } from "./cli/uninstall.ts";
import pkg from "../package.json" with { type: "json" };

export async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(usage());
    return 0;
  }
  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write(`baton ${version()}\n`);
    return 0;
  }

  const cmd = args[0];
  const rest = args.slice(1);

  switch (cmd) {
    case "export":
      return await runExport(rest);
    case "import":
      return await runImport(rest);
    case "info":
      return await runInfo(rest);
    case "update":
      return await runUpdate(rest);
    case "uninstall":
      return await runUninstall(rest);
    default:
      process.stderr.write(`baton: unknown command '${cmd}'\n`);
      process.stderr.write(usage());
      return 1;
  }
}

function usage(): string {
  return `baton - share claude code conversations

usage:
  baton export [sessionId]   package a session into a .baton file
  baton import <file>        unpack a .baton file into your claude config
  baton info   <file>        inspect a .baton file without importing
  baton update               upgrade baton to the latest release
  baton uninstall            remove the baton binary

flags:
  -h, --help       show help
  -v, --version    show version
`;
}

function version(): string {
  return pkg.version;
}

if (import.meta.main) {
  process.exit(await main(process.argv));
}
