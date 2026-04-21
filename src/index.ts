#!/usr/bin/env bun

export function main(argv: string[]): number {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stdout.write(usage());
    return 0;
  }
  if (args[0] === "--version" || args[0] === "-v") {
    process.stdout.write(`baton ${version()}\n`);
    return 0;
  }
  process.stderr.write(`baton: unknown command '${args[0]}'\n`);
  process.stderr.write(usage());
  return 1;
}

function usage(): string {
  return `baton - share claude code conversations

usage:
  baton export [sessionId]   package a session into a .baton file
  baton import <file>        unpack a .baton file into your claude config
  baton info   <file>        inspect a .baton file without importing

flags:
  -h, --help       show help
  -v, --version    show version
`;
}

function version(): string {
  return "0.0.0";
}

if (import.meta.main) {
  process.exit(main(process.argv));
}
