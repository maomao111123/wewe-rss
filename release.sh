#!/bin/bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <new-version>"
  exit 1
fi

NEW_VERSION=$1

pnpm version "$NEW_VERSION" --no-git-tag-version

echo "Root package version updated to $NEW_VERSION"
echo "Next steps:"
echo "  1. Review package.json and pnpm-lock.yaml"
echo "  2. git add package.json pnpm-lock.yaml"
echo "  3. git commit -m \"chore: release v$NEW_VERSION\""
echo "  4. git tag \"v$NEW_VERSION\""
echo "  5. git push && git push origin --tags"
