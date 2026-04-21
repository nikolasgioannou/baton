import { describe, test, expect } from "bun:test";
import { resolveSessionIdFromList } from "../src/sessions.ts";

const IDS = [
  "aaaaaaaa-1111-1111-1111-111111111111",
  "aaaabbbb-2222-2222-2222-222222222222",
  "cccccccc-3333-3333-3333-333333333333",
];

describe("resolveSessionIdFromList", () => {
  test("exact match wins even if it is also a prefix of another id", () => {
    const ids = ["abc", "abcdef"];
    expect(resolveSessionIdFromList("abc", ids)).toEqual({ ok: true, id: "abc" });
  });

  test("unique prefix resolves to the full id", () => {
    expect(resolveSessionIdFromList("cccccccc", IDS)).toEqual({
      ok: true,
      id: "cccccccc-3333-3333-3333-333333333333",
    });
  });

  test("ambiguous prefix returns all matches", () => {
    const r = resolveSessionIdFromList("aaaa", IDS);
    expect(r).toEqual({
      ok: false,
      reason: "ambiguous",
      matches: ["aaaaaaaa-1111-1111-1111-111111111111", "aaaabbbb-2222-2222-2222-222222222222"],
    });
  });

  test("no match returns none", () => {
    expect(resolveSessionIdFromList("zzzz", IDS)).toEqual({ ok: false, reason: "none" });
  });

  test("works on empty list", () => {
    expect(resolveSessionIdFromList("anything", [])).toEqual({ ok: false, reason: "none" });
  });

  test("empty prefix matches all (ambiguous if multiple)", () => {
    const r = resolveSessionIdFromList("", IDS);
    expect(r).toEqual({ ok: false, reason: "ambiguous", matches: IDS });
  });

  test("empty prefix on single-item list resolves to that item", () => {
    expect(resolveSessionIdFromList("", ["only-one"])).toEqual({ ok: true, id: "only-one" });
  });
});
