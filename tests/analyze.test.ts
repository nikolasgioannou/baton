import { describe, test, expect } from "bun:test";
import { analyzeSessionJsonl } from "../src/analyze.ts";

describe("analyzeSessionJsonl", () => {
  test("counts user and assistant events", () => {
    const jsonl = [
      JSON.stringify({ type: "user", message: { role: "user", content: "hello" } }),
      JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }),
      JSON.stringify({ type: "user", message: { role: "user", content: "bye" } }),
    ].join("\n");
    const r = analyzeSessionJsonl(jsonl);
    expect(r.turnCount).toBe(3);
  });

  test("captures first user message content", () => {
    const jsonl = [
      JSON.stringify({ type: "user", message: { role: "user", content: "first" } }),
      JSON.stringify({ type: "user", message: { role: "user", content: "second" } }),
    ].join("\n");
    expect(analyzeSessionJsonl(jsonl).firstUserMessage).toBe("first");
  });

  test("captures version and cwd from first event that has them", () => {
    const jsonl = [
      JSON.stringify({ type: "user", version: "2.1.0", cwd: "/a" }),
      JSON.stringify({ type: "user", version: "2.1.1", cwd: "/b" }),
    ].join("\n");
    const r = analyzeSessionJsonl(jsonl);
    expect(r.claudeCodeVersion).toBe("2.1.0");
    expect(r.cwd).toBe("/a");
  });

  test("extracts tool_use names from assistant content", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "tool_use", name: "Read", input: {} },
          { type: "tool_use", name: "Edit", input: {} },
        ],
      },
    });
    const r = analyzeSessionJsonl(jsonl);
    expect(r.tools.has("Read")).toBe(true);
    expect(r.tools.has("Edit")).toBe(true);
  });

  test("extracts mcp server names from tool names", () => {
    const jsonl = JSON.stringify({
      type: "assistant",
      message: {
        content: [{ type: "tool_use", name: "mcp__myserver__dothething", input: {} }],
      },
    });
    const r = analyzeSessionJsonl(jsonl);
    expect(r.mcpServers.has("myserver")).toBe(true);
  });

  test("extracts skills from skill_listing attachment", () => {
    const jsonl = JSON.stringify({
      type: "attachment",
      attachment: {
        type: "skill_listing",
        content: "- foo: do foo things\n- bar: do bar things",
      },
    });
    const r = analyzeSessionJsonl(jsonl);
    expect(r.skills.has("foo")).toBe(true);
    expect(r.skills.has("bar")).toBe(true);
  });

  test("ignores malformed JSON lines", () => {
    const jsonl = [
      JSON.stringify({ type: "user" }),
      "not json",
      JSON.stringify({ type: "user" }),
    ].join("\n");
    expect(analyzeSessionJsonl(jsonl).turnCount).toBe(2);
  });
});
