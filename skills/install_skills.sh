#!/usr/bin/env bash
# Install bundled Antigravity skills to ~/.gemini/config/skills

TARGET_DIR="$HOME/.gemini/config/skills"
mkdir -p "$TARGET_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for skill_path in "$SCRIPT_DIR"/*; do
  if [ -d "$skill_path" ]; then
    skill_name="$(basename "$skill_path")"
    cp -r "$skill_path" "$TARGET_DIR/"
    echo "Installed skill: $skill_name -> $TARGET_DIR/$skill_name"
  fi
done

echo "All bundled skills successfully installed! They are now active in Antigravity CLI and IDE."
