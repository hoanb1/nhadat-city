#!/bin/bash
# Build nhadat-rs for the prod server (glibc 2.39) and install it as systemd service nhadat-web (:3005).
# Releases live in /opt/nhadat/releases/<ts>; /opt/nhadat/current points at the active one.
# Rollback: ln -sfn /opt/nhadat/releases/<old> /opt/nhadat/current && systemctl restart nhadat-web
set -euo pipefail

SERVER="${SERVER:-internal.example}"
TARGET="x86_64-unknown-linux-gnu"
GLIBC="2.39"
cd "$(dirname "$0")"

./build-assets.sh
export CARGO_ZIGBUILD_ZIG_PATH="${CARGO_ZIGBUILD_ZIG_PATH:-$HOME/.local/bin/python-zig}"
cargo zigbuild --release -j 8 --target "$TARGET.$GLIBC"

TS=$(date +%Y%m%d%H%M%S)
REL="/opt/nhadat/releases/$TS"
ssh root@$SERVER "mkdir -p $REL /etc/nhadat"
rsync -az "${CARGO_TARGET_DIR:-target}/$TARGET/release/nhadat-rs" "root@$SERVER:$REL/nhadat-web"
rsync -az --delete static/ "root@$SERVER:$REL/static/"

ssh root@$SERVER bash -s "$REL" << 'EOF'
set -euo pipefail
REL="$1"
if [ ! -f /etc/nhadat/nhadat-web.env ]; then
  echo "missing /etc/nhadat/nhadat-web.env (DATABASE_URL, GEOSERVER_URL, ...)" >&2; exit 1
fi
cat > /etc/systemd/system/nhadat-web.service << 'UNIT'
[Unit]
Description=NhaDat.City web (Rust)
After=network-online.target
Wants=network-online.target

[Service]
EnvironmentFile=/etc/nhadat/nhadat-web.env
Environment=HOST=0.0.0.0 PORT=3005 STATIC_DIR=/opt/nhadat/current/static TZ=Asia/Ho_Chi_Minh RUST_LOG=info
ExecStart=/opt/nhadat/current/nhadat-web
WorkingDirectory=/opt/nhadat/current
DynamicUser=yes
Restart=always
RestartSec=2
MemoryMax=1G
CPUQuota=200%
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes

[Install]
WantedBy=multi-user.target
UNIT
ln -sfn "$REL" /opt/nhadat/current
systemctl daemon-reload
systemctl enable --now nhadat-web >/dev/null 2>&1 || true
systemctl restart nhadat-web
for i in $(seq 20); do curl -fsS -m 2 http://127.0.0.1:3005/healthz >/dev/null 2>&1 && break; sleep 1; done
curl -fsS -m 2 http://127.0.0.1:3005/healthz && echo " <- healthz"
# keep the 5 newest releases
ls -1dt /opt/nhadat/releases/* | tail -n +6 | xargs -r rm -rf
EOF
