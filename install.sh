#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
agent_dir="$HOME/.pi/agent"
backup_dir="$agent_dir/backups/portable-config-$(date +%Y%m%d-%H%M%S)"

for command_name in node npm pi gortex; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$command_name" >&2
    exit 1
  fi
done

mkdir -p "$agent_dir/extensions" "$agent_dir/bin" "$backup_dir"

for item in settings.json control-plane.json mcp.json models.json pi-plan-build.json SYSTEM.md APPEND_SYSTEM.md CONTROL_PLANE.md mcp-codex-bridge.mjs; do
  if [ -e "$agent_dir/$item" ]; then
    cp -p "$agent_dir/$item" "$backup_dir/$item"
  fi
done

for directory in extensions bin; do
  if [ -d "$agent_dir/$directory" ]; then
    mkdir -p "$backup_dir/$directory"
    cp -R "$agent_dir/$directory/." "$backup_dir/$directory/"
  fi
done

home_replacement=$(printf '%s' "$HOME" | sed 's/[\\&|]/\\&/g')
agent_replacement=$(printf '%s' "$agent_dir" | sed 's/[\\&|]/\\&/g')
sed -e "s|__HOME__|$home_replacement|g" -e "s|__AGENT_DIR__|$agent_replacement|g" "$repo_dir/config/settings.json" > "$agent_dir/settings.json"

for item in control-plane.json mcp.json models.json pi-plan-build.json SYSTEM.md APPEND_SYSTEM.md CONTROL_PLANE.md mcp-codex-bridge.mjs; do
  cp "$repo_dir/config/$item" "$agent_dir/$item"
done

cp -R "$repo_dir/config/extensions/." "$agent_dir/extensions/"
cp -R "$repo_dir/config/bin/." "$agent_dir/bin/"
chmod +x "$agent_dir/bin/pi-worktree"

install_package() {
  package=$1
  path=$2
  version=$3
  installed=$(node -e 'try { process.stdout.write(require(process.argv[1]).version) } catch {}' "$agent_dir/npm/node_modules/$path/package.json")
  if [ "$installed" != "$version" ]; then
    pi install "$package@$version"
  fi
}

install_package npm:pi-gortex pi-gortex 0.3.0
install_package npm:@janvitos/pi-plan-build @janvitos/pi-plan-build 0.1.120
install_package npm:@tian.zuo/pi-usage @tian.zuo/pi-usage 0.5.0

mkdir -p "$HOME/.local/bin"
launcher="$HOME/.local/bin/pi-worktree"
if [ ! -e "$launcher" ] || [ -L "$launcher" ]; then
  ln -sfn "$agent_dir/bin/pi-worktree" "$launcher"
else
  printf 'Kept existing non-symlink launcher: %s\n' "$launcher" >&2
fi

node -e 'for (const path of process.argv.slice(1)) JSON.parse(require("node:fs").readFileSync(path, "utf8"))' \
  "$agent_dir/settings.json" \
  "$agent_dir/control-plane.json" \
  "$agent_dir/mcp.json" \
  "$agent_dir/models.json" \
  "$agent_dir/pi-plan-build.json" \
  "$agent_dir/extensions/gortex.json"
sh -n "$agent_dir/bin/pi-worktree"
pi mcp list >/dev/null

if [ ! -d "/Applications/ChatGPT.app" ]; then
  printf 'Installed, but browser/Computer Use requires ChatGPT.app in /Applications.\n' >&2
fi

printf 'Pi configuration installed. Backup: %s\n' "$backup_dir"
printf 'Credentials were not changed. Configure provider authentication separately if needed.\n'
