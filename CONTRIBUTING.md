# Contributing to baton

Thanks for your interest in contributing. Bug reports, feature requests, and pull requests are all welcome.

## Development setup

```
git clone https://github.com/nikolasgioannou/baton.git
cd baton
bun install
```

`bun install` installs the git hooks (via `lefthook`) that run on every commit.

## Common scripts

```
bun run dev         # run the CLI from source
bun run build       # compile a single-file binary to dist/baton
bun run test        # run the test suite
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run format      # prettier --write
```

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org). Messages are validated by `commitlint` on commit.

Common prefixes: `feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`, `ci:`, `build:`.

## Pull requests

- Keep PRs focused — one logical change per PR.
- Add or update tests when changing behavior.
- Make sure `bun run typecheck`, `bun run test`, and `bun run lint` all pass.
- The pre-commit hooks handle formatting and lint autofixes for you.

## Reporting bugs

Open an issue with:

- What you were trying to do
- What happened instead
- The output of `baton --version` and your OS
- Ideally, a minimal `.baton` file that reproduces the issue (redacted — see the trust warning in the README)

## Security

Please do not open public issues for security vulnerabilities. See [SECURITY.md](./SECURITY.md).
