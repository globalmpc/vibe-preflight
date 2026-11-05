#!/usr/bin/env bash
# Install the vibe-preflight skill for Claude Code, Codex and/or OpenCode.
#   bash install.sh                        all (Claude Code + Codex; OpenCode reads both)
#   bash install.sh --target codex         one harness: claude | codex | opencode | all
set -eu

name=vibe-preflight
src=$(cd "$(dirname "$0")" && pwd -P)
target=all
root=$HOME

while [ $# -gt 0 ]; do
  case $1 in
    --target) target=${2:?--target needs a value}; shift 2 ;;
    -h|--help) sed -n '2,4p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 1 ;;
  esac
done

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
  cp -r "$src/SKILL.md" "$src/checklists" "$src/templates" "$src/references" "$dest/"
  echo "installed for $t: $dest"
done

[ "$target" = all ] && echo "OpenCode reads those same folders, so it is covered too."
exit 0
