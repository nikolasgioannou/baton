#!/usr/bin/env bash
# baton installer
#
# usage:
#   curl -fsSL https://raw.githubusercontent.com/nikolasgioannou/baton/main/install.sh | bash
#
# env:
#   BATON_INSTALL_DIR   override install location (default: $HOME/.local/bin)
#   BATON_VERSION       install a specific release tag (default: latest)

set -euo pipefail

REPO="nikolasgioannou/baton"
INSTALL_DIR="${BATON_INSTALL_DIR:-$HOME/.local/bin}"

die() {
  printf "error: %s\n" "$1" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

detect_platform() {
  local os arch
  case "$(uname -s)" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *) die "unsupported OS: $(uname -s)" ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64)   arch="x64" ;;
    arm64|aarch64)  arch="arm64" ;;
    *) die "unsupported arch: $(uname -m)" ;;
  esac
  printf "%s-%s" "$os" "$arch"
}

latest_version() {
  curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | awk -F'"' '/"tag_name":/ { print $4; exit }'
}

main() {
  need curl
  need uname

  local platform version url tmp
  platform=$(detect_platform)
  version="${BATON_VERSION:-$(latest_version)}"

  if [ -z "$version" ]; then
    die "could not resolve a release version for $REPO (is there a release yet?)"
  fi

  url="https://github.com/$REPO/releases/download/$version/baton-$platform"

  mkdir -p "$INSTALL_DIR"
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT

  printf "installing baton %s (%s) -> %s/baton\n" "$version" "$platform" "$INSTALL_DIR"
  curl -fL --progress-bar -o "$tmp" "$url" \
    || die "download failed: $url"

  mv "$tmp" "$INSTALL_DIR/baton"
  chmod +x "$INSTALL_DIR/baton"

  printf "done.\n"
  if ! printf "%s" "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
    printf "\nnote: %s is not in your PATH.\n" "$INSTALL_DIR"
    printf "add this to your shell profile:\n"
    printf "  export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
  fi
}

main "$@"
