import { describe, test, expect } from "bun:test";
import { rewriteSessionJsonl } from "../src/rewrite.ts";
import type { RewriteConfig } from "../src/rewrite.ts";

const SENDER_CWD = "/Users/alice/Desktop/baton";
const SENDER_HOME = "/Users/alice";
const RECIPIENT_CWD = "/Users/bob/code/baton";
const RECIPIENT_HOME = "/Users/bob";
const SENDER_SESSION = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RECIPIENT_SESSION = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const cfg: RewriteConfig = {
  senderCwd: SENDER_CWD,
  recipientCwd: RECIPIENT_CWD,
  senderHome: SENDER_HOME,
  recipientHome: RECIPIENT_HOME,
  senderSessionId: SENDER_SESSION,
  recipientSessionId: RECIPIENT_SESSION,
};

describe("rewriteSessionJsonl", () => {
  test("rewrites cwd field in events", () => {
    const line = JSON.stringify({ type: "user", cwd: SENDER_CWD });
    const out = rewriteSessionJsonl(line, cfg);
    const parsed = JSON.parse(out) as { cwd: string };
    expect(parsed.cwd).toBe(RECIPIENT_CWD);
  });

  test("rewrites session id in events", () => {
    const line = JSON.stringify({ sessionId: SENDER_SESSION });
    const out = rewriteSessionJsonl(line, cfg);
    expect(JSON.parse(out)).toEqual({ sessionId: RECIPIENT_SESSION });
  });

  test("rewrites paths inside nested tool inputs", () => {
    const line = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          {
            type: "tool_use",
            name: "Read",
            input: { file_path: `${SENDER_CWD}/src/foo.ts` },
          },
        ],
      },
    });
    const out = rewriteSessionJsonl(line, cfg);
    expect(out).toContain(`${RECIPIENT_CWD}/src/foo.ts`);
    expect(out).not.toContain(SENDER_CWD);
  });

  test("rewrites home paths that are not inside cwd", () => {
    const line = JSON.stringify({
      content: `${SENDER_HOME}/.config/claude/settings.json`,
    });
    const out = rewriteSessionJsonl(line, cfg);
    expect(out).toContain(`${RECIPIENT_HOME}/.config/claude/settings.json`);
    expect(out).not.toContain(SENDER_HOME);
  });

  test("preserves unrelated content", () => {
    const line = JSON.stringify({ message: "hello world", answer: 42 });
    const out = rewriteSessionJsonl(line, cfg);
    expect(JSON.parse(out)).toEqual({ message: "hello world", answer: 42 });
  });

  test("does not double-replace when recipient contains sender username", () => {
    const trickyCfg: RewriteConfig = {
      ...cfg,
      recipientCwd: "/Users/bob/alice-backup/baton",
      recipientHome: "/Users/bob",
    };
    const line = JSON.stringify({
      cwd: SENDER_CWD,
      file: `${SENDER_HOME}/.ssh/config`,
    });
    const out = rewriteSessionJsonl(line, trickyCfg);
    const parsed = JSON.parse(out) as { cwd: string; file: string };
    expect(parsed.cwd).toBe("/Users/bob/alice-backup/baton");
    expect(parsed.file).toBe("/Users/bob/.ssh/config");
  });

  test("handles multiple lines with empty separators", () => {
    const line1 = JSON.stringify({ cwd: SENDER_CWD });
    const line2 = JSON.stringify({ cwd: SENDER_CWD });
    const input = `${line1}\n${line2}\n`;
    const out = rewriteSessionJsonl(input, cfg);
    const lines = out.split("\n");
    expect(lines[0]).toContain(RECIPIENT_CWD);
    expect(lines[1]).toContain(RECIPIENT_CWD);
    expect(lines[2]).toBe("");
  });

  test("passes through lines that fail JSON parse", () => {
    const input = "not valid json\n";
    const out = rewriteSessionJsonl(input, cfg);
    expect(out).toBe("not valid json\n");
  });

  test("no-op when sender and recipient are identical", () => {
    const sameCfg: RewriteConfig = {
      senderCwd: SENDER_CWD,
      recipientCwd: SENDER_CWD,
      senderHome: SENDER_HOME,
      recipientHome: SENDER_HOME,
      senderSessionId: SENDER_SESSION,
      recipientSessionId: SENDER_SESSION,
    };
    const line = JSON.stringify({ cwd: SENDER_CWD, session: SENDER_SESSION });
    const out = rewriteSessionJsonl(line, sameCfg);
    expect(JSON.parse(out)).toEqual({ cwd: SENDER_CWD, session: SENDER_SESSION });
  });
});
