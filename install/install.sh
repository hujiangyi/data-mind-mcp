#!/usr/bin/env bash
set -Eeuo pipefail

TOOL=""
API_BASE=""
CREDENTIAL=""
MASTER_KEY=""
VERSION="${DATAMIND_MCP_VERSION:-latest}"
RELEASE_BASE="${DATAMIND_RELEASE_BASE:-https://github.com/hujiangyi/data-mind-mcp/releases/download}"
BINARY_URL=""
SKILL_BASE_URL="${DATAMIND_SKILL_BASE_URL:-https://raw.githubusercontent.com/hujiangyi/data-mind-mcp/main/skills}"
SKIP_CHECKSUM=0

require_value() {
  if [[ $# -lt 2 || -z "$2" ]]; then
    echo "error: $1 requires a value" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tool) require_value "$@"; TOOL="$2"; shift 2 ;;
    --api-base) require_value "$@"; API_BASE="$2"; shift 2 ;;
    --credential) require_value "$@"; CREDENTIAL="$2"; shift 2 ;;
    --master-key) require_value "$@"; MASTER_KEY="$2"; shift 2 ;;
    --version) require_value "$@"; VERSION="$2"; shift 2 ;;
    --release-base) require_value "$@"; RELEASE_BASE="$2"; shift 2 ;;
    --binary-url) require_value "$@"; BINARY_URL="$2"; shift 2 ;;
    --skill-base-url) require_value "$@"; SKILL_BASE_URL="$2"; shift 2 ;;
    --skip-checksum) SKIP_CHECKSUM=1; shift ;;
    *) echo "error: unknown argument $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TOOL" || -z "$API_BASE" || -z "$CREDENTIAL" || -z "$MASTER_KEY" ]]; then
  echo "error: --tool, --api-base, --credential, and --master-key are required" >&2
  exit 1
fi

case "$TOOL" in
  claude-desktop|claude-code|cursor|vscode|opencode|continue) ;;
  *) echo "error: unsupported tool $TOOL" >&2; exit 1 ;;
esac

if [[ ! "$API_BASE" =~ ^https?://[^[:space:]]+$ ]]; then
  echo "error: --api-base must be an HTTP or HTTPS URL" >&2
  exit 1
fi

OS_TYPE="linux"
if [[ "$OSTYPE" == "darwin"* ]]; then
  OS_TYPE="darwin"
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) BINARY_ARCH="amd64" ;;
  arm64|aarch64) BINARY_ARCH="arm64" ;;
  *) echo "error: unsupported architecture $ARCH" >&2; exit 1 ;;
esac

download() {
  local url="$1"
  local destination="$2"
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --location --max-time 60 -o "$destination" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet --timeout=60 -O "$destination" "$url"
  else
    echo "error: curl or wget is required" >&2
    exit 1
  fi
}

verify_checksum() {
  local file="$1"
  local asset="$2"
  local checksum_file="$3"
  local expected
  expected="$(awk -v asset="$asset" '$2 == asset || $2 == "*" asset {print $1; exit}' "$checksum_file")"
  if [[ ! "$expected" =~ ^[a-fA-F0-9]{64}$ ]]; then
    echo "error: checksum for $asset was not found" >&2
    exit 1
  fi
  local actual
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 "$file" | awk '{print $1}')"
  else
    actual="$(sha256sum "$file" | awk '{print $1}')"
  fi
  if [[ "${actual,,}" != "${expected,,}" ]]; then
    echo "error: checksum verification failed for $asset" >&2
    exit 1
  fi
}

release_root() {
  local base="${RELEASE_BASE%/}"
  if [[ "$VERSION" == "latest" && "$base" == */download ]]; then
    printf '%s/latest/download\n' "${base%/download}"
  else
    printf '%s/%s\n' "$base" "$VERSION"
  fi
}

umask 077
BINARY_DIR="$HOME/.local/bin"
BINARY_PATH="$BINARY_DIR/datamind-mcp"
mkdir -p "$BINARY_DIR"
TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/datamind-mcp.XXXXXX")"
trap 'rm -rf "$TEMP_ROOT"' EXIT

ASSET="datamind-mcp-${OS_TYPE}-${BINARY_ARCH}"
if [[ -n "$BINARY_URL" ]]; then
  DOWNLOAD_URL="$BINARY_URL"
else
  DOWNLOAD_URL="$(release_root)/$ASSET"
fi

echo "Installing DataMind MCP for $TOOL ($OS_TYPE-$BINARY_ARCH)..."
download "$DOWNLOAD_URL" "$TEMP_ROOT/$ASSET"
[[ -s "$TEMP_ROOT/$ASSET" ]] || { echo "error: downloaded MCP file is empty" >&2; exit 1; }

if [[ "$SKIP_CHECKSUM" != "1" && -z "$BINARY_URL" ]]; then
  CHECKSUMS="$TEMP_ROOT/checksums.txt"
  download "$(release_root)/checksums.txt" "$CHECKSUMS"
  verify_checksum "$TEMP_ROOT/$ASSET" "$ASSET" "$CHECKSUMS"
fi

mv "$TEMP_ROOT/$ASSET" "$BINARY_PATH"
chmod 700 "$BINARY_PATH"

write_config() {
  local config_file="$1"
  mkdir -p "$(dirname "$config_file")"
  command -v python3 >/dev/null 2>&1 || {
    echo "error: python3 is required to update MCP configuration" >&2
    exit 1
  }
  DATAMIND_CONFIG_FILE="$config_file" \
  DATAMIND_BINARY_PATH="$BINARY_PATH" \
  DATAMIND_CREDENTIAL_VALUE="$CREDENTIAL" \
  DATAMIND_MASTER_KEY_VALUE="$MASTER_KEY" \
  DATAMIND_API_BASE_VALUE="$API_BASE" \
  python3 <<'PY'
import json
import os
import tempfile

path = os.environ["DATAMIND_CONFIG_FILE"]
if os.path.exists(path):
    with open(path, encoding="utf-8") as handle:
        root = json.load(handle)
else:
    root = {}
if not isinstance(root, dict):
    raise SystemExit("MCP configuration root must be a JSON object")
servers = root.get("mcpServers", {})
if not isinstance(servers, dict):
    raise SystemExit("mcpServers must be a JSON object")
servers["datamind"] = {
    "command": os.environ["DATAMIND_BINARY_PATH"],
    "args": [],
    "env": {
        "DATAMIND_API_BASE": os.environ["DATAMIND_API_BASE_VALUE"],
        "DATAMIND_CREDENTIAL": os.environ["DATAMIND_CREDENTIAL_VALUE"],
        "DATAMIND_MASTER_KEY": os.environ["DATAMIND_MASTER_KEY_VALUE"],
    },
}
root["mcpServers"] = servers
directory = os.path.dirname(path) or "."
fd, temporary = tempfile.mkstemp(prefix=".datamind-config-", dir=directory)
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
  chmod 600 "$config_file"
}

install_skill() {
  local skill_dir="$HOME/.claude/skills/data-mind-query"
  mkdir -p "$skill_dir"
  download "${SKILL_BASE_URL%/}/data-mind-query/SKILL.md" "$skill_dir/SKILL.md"
  [[ -s "$skill_dir/SKILL.md" ]] || { echo "error: downloaded Skill is empty" >&2; exit 1; }
  chmod 600 "$skill_dir/SKILL.md"
}

case "$TOOL" in
  claude-desktop) CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json" ;;
  claude-code) CONFIG_FILE="$HOME/.claude/settings.json"; INSTALL_SKILL=1 ;;
  cursor) CONFIG_FILE="$HOME/.cursor/mcp.json" ;;
  vscode)
    if [[ -d ".vscode" ]]; then CONFIG_FILE=".vscode/settings.json"
    else CONFIG_FILE="$HOME/.config/Code/User/settings.json"; fi
    ;;
  opencode) CONFIG_FILE="$HOME/.opencode.json" ;;
  continue) CONFIG_FILE="$HOME/.continue/config.json" ;;
esac

write_config "$CONFIG_FILE"
if [[ "${INSTALL_SKILL:-0}" == "1" ]]; then
  install_skill
fi

if command -v curl >/dev/null 2>&1; then
  USE_PAYLOAD="$(CREDENTIAL="$CREDENTIAL" MASTER_KEY="$MASTER_KEY" python3 -c \
    'import json, os; print(json.dumps({"credential": os.environ["CREDENTIAL"], "masterKey": os.environ["MASTER_KEY"]}))')"
  curl --fail --silent --show-error --location --max-time 30 \
      -X POST "${API_BASE%/}/api/v1/mcp/setup/use" \
      -H "Content-Type: application/json" \
      --data "$USE_PAYLOAD" \
      >/dev/null
fi

echo "DataMind MCP installed at $BINARY_PATH"
echo "MCP configuration updated at $CONFIG_FILE"
echo "The cloud API key is configured separately in the Go service."
