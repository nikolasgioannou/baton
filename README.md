# baton

Share Claude Code conversations with others. Like `claude --resume`, but for someone else.

## What it does

`baton` packages a Claude Code session into a portable file that a teammate can import and continue with `claude --resume`. Paths, usernames, and session IDs are rewritten for the recipient's machine. The `/undo` backup history travels with the session, so file-edit undo works across the handoff.

## Install

```
curl -fsSL https://raw.githubusercontent.com/nikolasgioannou/baton/main/install.sh | bash
```

Works on macOS (Apple Silicon, Intel) and Linux (x64, arm64).

## Usage

### Send a conversation

```
cd path/to/the/project/you/were/working/in
baton export              # interactive picker
baton export --latest     # grab the most recent session here
baton export <sessionId>  # specific session
```

Writes a `.baton` file to the current directory. Send it however you like — email, chat, scp, gist.

### Receive a conversation

```
cd path/to/your/clone/of/the/same/project
baton info  received.baton    # inspect before importing
baton import received.baton   # imports into ~/.claude
baton import received.baton --run   # imports and launches claude --resume
```

After import, `claude --resume <new-id>` picks up where the sender left off.

## What gets shared

- The full message history (user prompts, assistant responses, tool calls, tool results)
- The file-edit backup history that powers `/undo`
- A small header with the sender's Claude Code version, git SHA, and cwd — so the recipient can be warned if their environment differs

## What doesn't get shared

- **Working tree.** The recipient needs their own clone of the repo. If they're on a different git SHA, the model has stale views of files — `baton info` will warn.
- **MCP servers.** Past MCP tool calls are in the history, but the model can't call the sender's MCP servers from the recipient's machine.
- **Settings, hooks, skills.** The recipient's `~/.claude/settings.json`, custom skills, and hooks apply, not the sender's.

## Trust and secrets

**`baton` is a raw courier.** A session transcript can contain anything the model saw — file contents, API keys printed in tool output, internal URLs, customer data. `baton` does not redact. Only share sessions with people you'd trust to read the full terminal history.

## License

MIT
