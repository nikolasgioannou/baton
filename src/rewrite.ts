export interface RewriteConfig {
  senderCwd: string;
  recipientCwd: string;
  senderHome: string;
  recipientHome: string;
  senderSessionId: string;
  recipientSessionId: string;
}

const CWD_SENTINEL = "\x00__BATON_CWD__\x00";
const HOME_SENTINEL = "\x00__BATON_HOME__\x00";
const SESSION_SENTINEL = "\x00__BATON_SESSION__\x00";

export function rewriteSessionJsonl(jsonl: string, cfg: RewriteConfig): string {
  const out: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (line.length === 0) {
      out.push(line);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      out.push(rewriteString(line, cfg));
      continue;
    }
    out.push(JSON.stringify(rewriteValue(parsed, cfg)));
  }
  return out.join("\n");
}

function rewriteValue(value: unknown, cfg: RewriteConfig): unknown {
  if (typeof value === "string") return rewriteString(value, cfg);
  if (Array.isArray(value)) return value.map((v) => rewriteValue(v, cfg));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = rewriteValue(v, cfg);
    }
    return result;
  }
  return value;
}

/**
 * Two-phase replace via sentinels so that the recipient's values never
 * re-match a sender pattern mid-replacement (e.g. recipient cwd happens
 * to contain the sender's username).
 */
function rewriteString(s: string, cfg: RewriteConfig): string {
  let r = s;
  if (cfg.senderCwd && cfg.senderCwd !== cfg.recipientCwd) {
    r = splitJoin(r, cfg.senderCwd, CWD_SENTINEL);
  }
  if (cfg.senderHome && cfg.senderHome !== cfg.recipientHome) {
    r = splitJoin(r, cfg.senderHome, HOME_SENTINEL);
  }
  if (cfg.senderSessionId && cfg.senderSessionId !== cfg.recipientSessionId) {
    r = splitJoin(r, cfg.senderSessionId, SESSION_SENTINEL);
  }
  r = splitJoin(r, CWD_SENTINEL, cfg.recipientCwd);
  r = splitJoin(r, HOME_SENTINEL, cfg.recipientHome);
  r = splitJoin(r, SESSION_SENTINEL, cfg.recipientSessionId);
  return r;
}

function splitJoin(s: string, find: string, replace: string): string {
  if (!s.includes(find)) return s;
  return s.split(find).join(replace);
}
