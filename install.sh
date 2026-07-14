#!/usr/bin/env bash
#
# Installs the WebTAK Video Viewer plugin into TAK Server's extracted WebTAK app.
#
# WebTAK loads plugins listed in webtak-manifest.json via loadScript() (a classic
# <script>), so this installer:
#   1. copies the bundled classic-script into  <webtak>/plugins/takvv-video-viewer/
#   2. adds an entry to the manifest's "plugins" array (idempotent)
#
# Both steps are safe to re-run — do so after a WAR upgrade (setup-for-extracted-war.sh),
# which rewrites extract/ and drops these changes.
#
# Usage:  sudo ./install.sh            # install / re-apply
#         sudo ./install.sh --remove   # uninstall
set -euo pipefail

WEBTAK_DIR="${WEBTAK_DIR:-/opt/tak/extract/webtak}"
PLUGIN_ID="takvv-video-viewer"
BUNDLE="webtak-video-viewer.plugin.js"
TITLE="Video Viewer"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MANIFEST="$WEBTAK_DIR/webtak-manifest.json"
DEST_DIR="$WEBTAK_DIR/plugins/$PLUGIN_ID"
REL_PATH="plugins/$PLUGIN_ID/$BUNDLE"       # path as WebTAK resolves it (relative to webtak root)
SRC_BUNDLE="$SCRIPT_DIR/dist/$BUNDLE"

command -v python3 >/dev/null || { echo "ERROR: python3 required to patch the manifest."; exit 1; }
[ -f "$MANIFEST" ] || { echo "ERROR: $MANIFEST not found. Set WEBTAK_DIR."; exit 1; }

# Guard: refuse to touch a manifest that is already invalid JSON (would wipe icon sets etc.).
python3 -c "import json,sys; json.load(open('$MANIFEST'))" 2>/dev/null \
  || { echo "ERROR: $MANIFEST is not valid JSON. Fix it first (e.g. the \"Incident Icons\" quote), then re-run."; exit 1; }

REMOVE=0
[ "${1:-}" = "--remove" ] && REMOVE=1

if [ "$REMOVE" = "1" ]; then
  rm -rf "$DEST_DIR"
else
  [ -f "$SRC_BUNDLE" ] || { echo "ERROR: $SRC_BUNDLE missing. Run 'node build.js' first."; exit 1; }
  mkdir -p "$DEST_DIR"
  cp "$SRC_BUNDLE" "$DEST_DIR/"
  echo "Copied bundle -> $DEST_DIR/$BUNDLE"
fi

# Patch the manifest's plugins[] array. Backup first, write atomically.
cp "$MANIFEST" "$MANIFEST.bak.$(date +%s)"
python3 - "$MANIFEST" "$REL_PATH" "$TITLE" "$REMOVE" <<'PY'
import json, sys, os
manifest, rel, title, remove = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] == "1"
with open(manifest) as f:
    data = json.load(f)
plugins = data.get("plugins")
if not isinstance(plugins, list):
    plugins = []

def entry_path(e):
    return e if isinstance(e, str) else (e.get("path") if isinstance(e, dict) else None)

# Drop any existing entry for our path (string or object form).
plugins = [e for e in plugins if entry_path(e) != rel]
if not remove:
    # Register as a plain STRING path. This WebTAK build's manifest validator rejects
    # object-form entries ({path,title,enabled}) and crashes the whole app before any
    # plugin loads; the string form is accepted by both the validator and the loader.
    plugins.append(rel)

data["plugins"] = plugins
tmp = manifest + ".tmp"
with open(tmp, "w") as f:
    json.dump(data, f, indent=2)
os.replace(tmp, manifest)
print(("Removed" if remove else "Registered") + f" plugin entry: {rel}")
PY

if [ "$REMOVE" = "1" ]; then
  echo "Uninstalled. Hard-refresh WebTAK (Ctrl-Shift-R)."
else
  echo "Done. Hard-refresh WebTAK (Ctrl-Shift-R). Look for the plugin (or the 📹 button, bottom-right)."
fi
