#!/usr/bin/env sh
# NOTE: this installer downloads published spacewalk release archives from
# GitHub. No sharmasuraj0123/space-walk releases exist yet, so this script will fail
# until the first release ships — build from source instead (see README:
# make setup && make build -> bin/spacewalk).
set -eu

REPO="${REPO:-sharmasuraj0123/space-walk}"
VERSION="${VERSION:-latest}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.local/bin}"

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: $1 is required" >&2
    exit 1
  fi
}

need curl
need tar

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return
  fi
  echo "error: sha256sum or shasum is required" >&2
  exit 1
}

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$os" in
  darwin|linux) ;;
  *)
    echo "error: unsupported OS: $os" >&2
    exit 1
    ;;
esac

case "$arch" in
  x86_64|amd64) arch="amd64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "error: unsupported architecture: $arch" >&2
    exit 1
    ;;
esac

archive="spacewalk_${os}_${arch}.tar.gz"
if [ "$VERSION" = "latest" ]; then
  base_url="https://github.com/$REPO/releases/latest/download"
  display_version="latest"
else
  base_url="https://github.com/$REPO/releases/download/$VERSION"
  display_version="$VERSION"
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

curl -fsSL "$base_url/$archive" -o "$tmpdir/$archive"
curl -fsSL "$base_url/checksums.txt" -o "$tmpdir/checksums.txt"

(
  cd "$tmpdir"
  expected="$(awk -v file="$archive" '{ name=$2; sub(/^\*/, "", name); if (name == file) { print $1; found=1 } } END { if (!found) exit 1 }' checksums.txt)"
  actual="$(sha256_file "$archive")"
  if [ "$expected" != "$actual" ]; then
    echo "error: checksum mismatch for $archive" >&2
    exit 1
  fi
  tar -xzf "$archive"
)

mkdir -p "$INSTALL_DIR"
mv "$tmpdir/spacewalk" "$INSTALL_DIR/spacewalk"
chmod +x "$INSTALL_DIR/spacewalk"

echo "installed spacewalk $display_version to $INSTALL_DIR/spacewalk"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *) echo "add $INSTALL_DIR to PATH before running spacewalk" ;;
esac
echo "run: spacewalk --help"
