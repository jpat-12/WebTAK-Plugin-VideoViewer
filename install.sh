#!/usr/bin/env bash
#
# Installs the WebTAK Video Viewer plugin into TAK Server's extracted WebTAK app.
#
# WebTAK loads plugins listed in webtak-manifest.json via loadScript() (a classic
# <script>), so this installer:
#   1. prompts once for the Restreamer config and bakes it into the served bundle
#      (so operators never have to open the plugin's Settings tab)
#   2. copies the bundle into  <webtak>/plugins/takvv-video-viewer/
#   3. adds an entry to the manifest's "plugins" array (idempotent)
#
# Answers are saved to .takvv-deploy.env and reused on re-run (re-run after a WAR
# upgrade / setup-for-extracted-war.sh, which rewrites extract/ and drops these).
#
# Usage:  sudo ./install.sh              # install / re-apply (prompts first time)
#         sudo ./install.sh --reconfigure # re-prompt for Restreamer settings
#         sudo ./install.sh --remove      # uninstall
set -euo pipefail

WEBTAK_DIR="${WEBTAK_DIR:-/opt/tak/extract/webtak}"
PLUGIN_ID="takvv-video-viewer"
BUNDLE="webtak-video-viewer.plugin.js"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MANIFEST="$WEBTAK_DIR/webtak-manifest.json"
DEST_DIR="$WEBTAK_DIR/plugins/$PLUGIN_ID"
REL_PATH="plugins/$PLUGIN_ID/$BUNDLE"       # path as WebTAK resolves it (relative to webtak root)
SRC_BUNDLE="$SCRIPT_DIR/dist/$BUNDLE"
ENV_FILE="$SCRIPT_DIR/.takvv-deploy.env"

command -v python3 >/dev/null || { echo "ERROR: python3 required."; exit 1; }
[ -f "$MANIFEST" ] || { echo "ERROR: $MANIFEST not found. Set WEBTAK_DIR."; exit 1; }

# Guard: refuse to touch a manifest that is already invalid JSON (would wipe icon sets etc.).
python3 -c "import json; json.load(open('$MANIFEST'))" 2>/dev/null \
  || { echo "ERROR: $MANIFEST is not valid JSON. Fix it first, then re-run."; exit 1; }

MODE=install
case "${1:-}" in
  --remove)      MODE=remove ;;
  --reconfigure) MODE=reconfigure ;;
  "")            ;;
  *)             echo "Unknown arg: $1"; exit 1 ;;
esac
REMOVE=0; [ "$MODE" = "remove" ] && REMOVE=1

# --- Restreamer configuration (prompt once, persist, reuse) -------------------
configure_defaults() {
  # shellcheck disable=SC1090
  [ -f "$ENV_FILE" ] && . "$ENV_FILE"
  local need_prompt=0
  [ "$MODE" = "reconfigure" ] && need_prompt=1
  [ -z "${TAKVV_HOST:-}" ] && need_prompt=1

  if [ "$need_prompt" = "1" ] && [ -e /dev/tty ]; then
    echo "── Restreamer configuration (baked into the plugin so users don't set it) ──"
    local x
    read -r -p "Restreamer host [${TAKVV_HOST:-stream.prod.ilwg.us}]: " x </dev/tty || true
    TAKVV_HOST="${x:-${TAKVV_HOST:-stream.prod.ilwg.us}}"
    read -r -p "Scheme https/http [${TAKVV_SCHEME:-https}]: " x </dev/tty || true
    TAKVV_SCHEME="${x:-${TAKVV_SCHEME:-https}}"
    read -r -p "API port — blank if reverse-proxied on 443/80 [${TAKVV_APIPORT:-<blank>}]: " x </dev/tty || true
    TAKVV_APIPORT="${x:-${TAKVV_APIPORT:-}}"
    read -r -p "HLS mode proxy/abr/direct [${TAKVV_HLSMODE:-proxy}]: " x </dev/tty || true
    TAKVV_HLSMODE="${x:-${TAKVV_HLSMODE:-proxy}}"
    read -r -p "API key (X-API-Key, for the stream list) [${TAKVV_APIKEY:+<keep existing>}]: " x </dev/tty || true
    TAKVV_APIKEY="${x:-${TAKVV_APIKEY:-}}"
    echo "NOTE: the API key is embedded in the plugin JS served to WebTAK clients (auth-gated at :8446)."
  elif [ "$need_prompt" = "1" ]; then
    echo "No TTY & no saved config — installing with blank defaults; set the host in the plugin's Settings tab."
  else
    echo "Using saved Restreamer config from .takvv-deploy.env (use --reconfigure to change)."
  fi

  local old_umask
  old_umask="$(umask)"
  umask 077
  cat > "$ENV_FILE" <<EOF
TAKVV_HOST='${TAKVV_HOST:-}'
TAKVV_SCHEME='${TAKVV_SCHEME:-https}'
TAKVV_APIPORT='${TAKVV_APIPORT:-}'
TAKVV_HLSMODE='${TAKVV_HLSMODE:-proxy}'
TAKVV_APIKEY='${TAKVV_APIKEY:-}'
EOF
  # Restore the caller's umask — leaking 077 into later file writes (e.g. the
  # manifest rewrite below) silently made webtak-manifest.json root-only and
  # WebTAK's server process couldn't read it anymore (403 on manifest.json,
  # grey screen). See install.sh history / commit fixing this.
  umask "$old_umask"
}

# --- Install / remove --------------------------------------------------------
if [ "$REMOVE" = "1" ]; then
  rm -rf "$DEST_DIR"
else
  [ -f "$SRC_BUNDLE" ] || { echo "ERROR: $SRC_BUNDLE missing. Run 'node build.js' first."; exit 1; }
  configure_defaults
  mkdir -p "$DEST_DIR"
  # Prepend the deploy-time defaults, then the bundle. json.dumps keeps it valid + escaped.
  python3 - "${TAKVV_HOST:-}" "${TAKVV_SCHEME:-https}" "${TAKVV_APIPORT:-}" "${TAKVV_APIKEY:-}" "${TAKVV_HLSMODE:-proxy}" <<'PY' > "$DEST_DIR/$BUNDLE"
import json, sys
h, scheme, port, key, mode = sys.argv[1:6]
print("window.__TAKVV_DEFAULTS__=" + json.dumps({
    "restreamerHost": h, "scheme": scheme, "apiPort": port, "apiKey": key, "hlsMode": mode,
}) + ";")
PY
  cat "$SRC_BUNDLE" >> "$DEST_DIR/$BUNDLE"
  echo "Copied bundle (with baked config) -> $DEST_DIR/$BUNDLE"
fi

# Patch the manifest's plugins[] array. Backup first, write atomically.
cp "$MANIFEST" "$MANIFEST.bak.$(date +%s)"
python3 - "$MANIFEST" "$REL_PATH" "$REMOVE" <<'PY'
import json, sys, os
manifest, rel, remove = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
with open(manifest) as f:
    data = json.load(f)
plugins = data.get("plugins")
if not isinstance(plugins, list):
    plugins = []

def entry_path(e):
    return e if isinstance(e, str) else (e.get("path") if isinstance(e, dict) else None)

# Drop any existing entry for our path (string or object form), then re-add as a
# plain STRING — this WebTAK build's manifest validator rejects object entries.
plugins = [e for e in plugins if entry_path(e) != rel]
if not remove:
    plugins.append(rel)

data["plugins"] = plugins
orig_mode = os.stat(manifest).st_mode
tmp = manifest + ".tmp"
with open(tmp, "w") as f:
    json.dump(data, f, indent=2)
# Preserve the original file's permissions regardless of the process umask —
# os.replace keeps the *new* tmp file's mode (umask-derived), not the original's,
# so a restrictive umask here would silently make the manifest unreadable by
# WebTAK's server process (403 on manifest.json -> grey screen).
os.chmod(tmp, orig_mode)
os.replace(tmp, manifest)
print(("Removed" if remove else "Registered") + f" plugin entry: {rel}")
PY

if [ "$REMOVE" = "1" ]; then
  echo "Uninstalled. Hard-refresh WebTAK (Ctrl-Shift-R)."
else
  echo "Done. Hard-refresh WebTAK (Ctrl-Shift-R). The plugin is preconfigured — no Settings needed."
fi
