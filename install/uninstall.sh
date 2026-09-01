#!/usr/bin/env bash
set -Eeuo pipefail

TOOL="${1:-}"
if [[ "$TOOL" == "--tool" ]]; then
  TOOL="${2:-}"
fi
if [[ -z "$TOOL" ]]; then
  echo "usage: uninstall.sh --tool claude-desktop|claude-code|cursor|vscode|opencode|continue" >&2
  exit 1
fi

case "$TOOL" in
  claude-desktop) CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
  claude-code) CONFIG_FILE="$HOME/.claude/settings.json"; rm -rf "$HOME/.claude/skills/data-mind-query" ;;
  cursor) CONFIG_FILE="$HOME/.cursor/mcp.json" ;;
  vscode)
    if [[ -d ".vscode" ]]; then CONFIG_FILE=".vscode/settings.json"
    else CONFIG_FILE="$HOME/.config/Code/User/settings.json"; fi
    ;;
  opencode) CONFIG_FILE="$HOME/.opencode.json" ;;
  continue) CONFIG_FILE="$HOME/.continue/config.json" ;;
  *) echo "error: unsupported tool $TOOL" >&2; exit 1 ;;
esac

if [[ -f "$CONFIG_FILE" ]]; then
  CONFIG_FILE="$CONFIG_FILE" python3 <<'PY'
import json
import os
import tempfile

path = os.environ["CONFIG_FILE"]
with open(path, encoding="utf-8") as handle:
    root = json.load(handle)
if isinstance(root, dict) and isinstance(root.get("mcpServers"), dict):
    root["mcpServers"].pop("datamind", None)
    directory = os.path.dirname(path) or "."
    fd, temporary = tempfile.mkstemp(prefix=".datamind-uninstall-", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(root, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.chmod(temporary, 0o600)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
PY
fi

rm -f "$HOME/.local/bin/datamind-mcp"
echo "DataMind MCP removed. Cloud API key profiles were not changed."
