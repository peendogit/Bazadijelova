#!/bin/bash
# Povlači novi kod sa GitHuba, gradi frontend i restartuje aplikaciju.
# Ručno: bash deploy.sh
# Automatski (cron svakih 5 min, samo kad ima promjena):
#   */5 * * * * cd /var/www/bazadijelova && bash deploy.sh >> /var/log/bazadijelova-deploy.log 2>&1
set -e
cd "$(dirname "$0")"

git fetch -q origin main
if [ "$1" != "--force" ] && [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  exit 0
fi

echo "=== $(date) deploy ==="
git reset -q --hard origin/main

cd server && npm install --omit=dev --no-audit --no-fund && cd ..
cd client && npm install --no-audit --no-fund && npm run build && cd ..

if pm2 describe bazadijelova > /dev/null 2>&1; then
  pm2 restart bazadijelova --update-env
else
  pm2 start ecosystem.config.cjs && pm2 save
fi
echo "=== gotovo ==="
