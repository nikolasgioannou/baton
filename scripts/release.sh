#!/usr/bin/env bash
# bump package.json, tag, push. the release workflow builds binaries.
#
# usage:
#   bun run release          # patch
#   bun run release:minor    # minor
#   bun run release:major    # major

set -euo pipefail

BUMP="${1:-patch}"

case "$BUMP" in
  patch | minor | major) ;;
  *)
    echo "usage: bun run release[:minor|:major]" >&2
    exit 1
    ;;
esac

if ! git diff-index --quiet HEAD --; then
  echo "working tree is not clean; commit or stash first" >&2
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "must be on main (currently on $BRANCH)" >&2
  exit 1
fi

git pull --ff-only origin main

CURRENT="$(bun -e 'console.log(JSON.parse(await Bun.file("package.json").text()).version)')"
IFS='.' read -r MAJ MIN PAT <<< "$CURRENT"

case "$BUMP" in
  patch) NEW_VERSION="$MAJ.$MIN.$((PAT + 1))" ;;
  minor) NEW_VERSION="$MAJ.$((MIN + 1)).0" ;;
  major) NEW_VERSION="$((MAJ + 1)).0.0" ;;
esac

bun -e "
const pkg = JSON.parse(await Bun.file('package.json').text());
pkg.version = '$NEW_VERSION';
await Bun.write('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

TAG="v$NEW_VERSION"

git add package.json
git commit -m "chore: release $TAG"
git tag "$TAG"

echo
echo "pushing $TAG — CI will build the release binaries."
git push origin main
git push origin "$TAG"

echo
echo "done: https://github.com/nikolasgioannou/baton/releases/tag/$TAG"
