#!/usr/bin/env bash
# Install the vibe-preflight skill for Claude Code, Codex and/or OpenCode.
#   curl -fsSL https://raw.githubusercontent.com/globalmpc/vibe-preflight/main/install.sh | bash
#   bash install.sh                        all (Claude Code + Codex; OpenCode reads both)
#   bash install.sh --target codex         one harness: claude | codex | opencode | all
#   bash install.sh --ref v1.0             download that branch or tag from GitHub (even inside a clone)
# Without --ref, a clone installs itself; otherwise main is downloaded from GitHub.
set -eu

name=vibe-preflight
repo=globalmpc/vibe-preflight
ref=
target=all
root=$HOME

while [ $# -gt 0 ]; do
  case $1 in
    --target) target=${2:?--target needs a value}; shift 2 ;;
    --ref) ref=${2:?--ref needs a value}; shift 2 ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
  esac
done

# Skill source: the local clone if there is one, else a fresh download.
here=; [ -n "${BASH_SOURCE:-}" ] && here=$(dirname "$BASH_SOURCE")   # empty when piped from curl
if [ -z "$ref" ] && [ -n "$here" ] && [ -f "$here/$name/SKILL.md" ]; then
  src=$(cd "$here/$name" && pwd -P)
else
  command -v curl >/dev/null && command -v tar >/dev/null || { echo "curl and tar are required" >&2; exit 1; }
  ref=${ref:-main}
  tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
  curl -fsSL "https://codeload.github.com/$repo/tar.gz/$ref" | tar -xz -C "$tmp" --strip-components=1 \
    || { echo "Download failed: $repo@$ref" >&2; exit 1; }
  src=$tmp/$name
  [ -f "$src/SKILL.md" ] || { echo "No $name/SKILL.md in $repo@$ref" >&2; exit 1; }
fi

# Folder each harness reads skills from (OpenCode also reads the .claude and .agents ones).
dir_for() {
  case $1 in
    claude)   echo "$root/.claude/skills" ;;
    codex)    echo "$root/.agents/skills" ;;
    opencode) echo "$root/.config/opencode/skills" ;;
  esac
}

case $target in
  all) list="claude codex" ;;
  claude|codex|opencode) list=$target ;;
  *) echo "Unknown target: $target (use claude, codex, opencode or all)" >&2; exit 1 ;;
esac

for t in $list; do
  base=$(dir_for "$t")
  mkdir -p "$base"
  dest=$(cd "$base" && pwd -P)/$name        # physical path: resolves a symlinked skills folder
  here=$dest; [ -d "$dest" ] && here=$(cd "$dest" && pwd -P)
  # Never delete a folder that holds this checkout (equal to, or an ancestor of, $src).
  case $src/ in
    "$here"/*) echo "skip $t: this checkout is inside $dest; move it elsewhere and re-run"; continue ;;
  esac
  rm -rf "$dest"            # replace an older copy; only ever this skill's own folder
  mkdir "$dest"
  cp -r "$src/." "$dest/"
  echo "installed for $t: $dest"
done

[ "$target" = all ] && echo "OpenCode reads those same folders, so it is covered too."
exit 0
