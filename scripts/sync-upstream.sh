#!/usr/bin/env bash
# Re-vendor the Ship Notes components, unmodified, from upstream at a ref.
# Usage: scripts/sync-upstream.sh [branch | tag | commit]   (default: main)
set -euo pipefail

repo="aqualang89/shipnotes-components"
ref="${1:-main}"
dest="$(cd "$(dirname "$0")/.." && pwd)/vendor/shipnotes"
components=(pull-lamp signal-orb project-stack)

# Pin to a commit so the raw files and UPSTREAM.md agree even if main moves mid-sync.
sha="$(git ls-remote "https://github.com/$repo.git" "$ref" | head -n1 | cut -f1)"
sha="${sha:-$ref}"
raw="https://raw.githubusercontent.com/$repo/$sha"

for c in "${components[@]}"; do
  curl -fsSL "$raw/components/$c/$c.js" -o "$dest/$c.js"
done
curl -fsSL "$raw/LICENSE" -o "$dest/LICENSE"

cat > "$dest/UPSTREAM.md" <<EOF
# Upstream

- Source: https://github.com/$repo
- Ref: $ref
- Commit: $sha
- Synced: $(date +%F)

Copied unmodified:

$(for c in "${components[@]}"; do echo "- \`components/$c/$c.js\` → \`$c.js\`"; done)
- \`LICENSE\` → \`LICENSE\`

Update with \`scripts/sync-upstream.sh [ref]\`.
EOF

echo "Synced ${components[*]} at ${sha:0:7}."
echo "Components upstream at this ref (add new ones to the list above):"
curl -fsSL "https://api.github.com/repos/$repo/contents/components?ref=$sha" |
  sed -n 's/.*"name": "\([^"]*\)".*/  \1/p'
