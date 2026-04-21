# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in `baton`, please **do not open a public GitHub issue**.

Instead, email the maintainer at the address listed in the [repository owner's GitHub profile](https://github.com/nikolasgioannou), or open a private report via GitHub's [security advisory](https://github.com/nikolasgioannou/baton/security/advisories/new) flow.

You'll get an acknowledgement within a few days. I'll coordinate with you on disclosure timing once the issue is understood.

## Threat model

`baton` is a local file-manipulation tool — it reads Claude Code session files and repackages them. It does not run a server, accept untrusted network input at runtime, or execute code from `.baton` files.

Things I care about:

- A malicious `.baton` file triggering code execution, path traversal, or file overwrite outside of `~/.claude` during `baton import`.
- Secrets leaking into places users wouldn't expect (e.g., written to logs).

Things that are **not** in scope:

- A user voluntarily sharing secrets in a `.baton` file. Transcripts can contain anything the model saw; redacting is the user's responsibility. See the README's trust section.
- Claude Code itself (report upstream).
