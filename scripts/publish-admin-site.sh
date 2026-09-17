#!/usr/bin/env bash
# Publish admin.html as https://admin.railroadradar.com/ (GitHub Pages repo: RailroadRadarDeveloper/admin)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${TMPDIR:-/tmp}/rr-admin-site"
git config --global --get-regexp 'credential' >/dev/null || true
rm -rf "$DEST"
git -c credential.helper=/usr/local/bin/grok_connectors_credential_helper.sh clone --depth 1 https://github.com/RailroadRadarDeveloper/admin.git "$DEST"
cp "$ROOT/admin.html" "$DEST/index.html"
printf 'admin.railroadradar.com\n' > "$DEST/CNAME"
# GitHub Pages 404 → home
cp "$DEST/index.html" "$DEST/404.html" 2>/dev/null || true
cat > "$DEST/404.html" <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>RailroadRadar Admin</title>
  <meta http-equiv="refresh" content="0;url=/">
  <script>location.replace('/');</script>
</head>
<body>
  <p><a href="/">Open admin dashboard</a></p>
</body>
</html>
HTML
cd "$DEST"
git add index.html CNAME 404.html
if git diff --cached --quiet; then
  echo "admin site already up to date"
  exit 0
fi
git -c user.email="67028963+RailroadRadarDeveloper@users.noreply.github.com" \
    -c user.name="RailroadRadar" \
    commit -m "Publish RailroadRadar admin dashboard"
git -c credential.helper=/usr/local/bin/grok_connectors_credential_helper.sh push origin HEAD:main
echo "published RailroadRadarDeveloper/admin"
