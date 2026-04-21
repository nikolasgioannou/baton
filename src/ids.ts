import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import type { RewriteConfig } from "./rewrite.ts";

export function newSessionId(): string {
  return randomUUID();
}

export interface BuildConfigInput {
  senderCwd: string;
  senderHome: string;
  senderSessionId: string;
  recipientCwd: string;
  recipientHome?: string;
  recipientSessionId?: string;
}

export function buildRewriteConfig(input: BuildConfigInput): RewriteConfig {
  return {
    senderCwd: input.senderCwd,
    recipientCwd: input.recipientCwd,
    senderHome: input.senderHome,
    recipientHome: input.recipientHome ?? homedir(),
    senderSessionId: input.senderSessionId,
    recipientSessionId: input.recipientSessionId ?? newSessionId(),
  };
}
