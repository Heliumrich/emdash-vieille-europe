#!/usr/bin/env bash
set -euo pipefail
cd /var/www/v2-vieille-europe.ch
npm ci --include=dev
# Existing CMS keeps serving media while the isolated build is prepared.
npm run deploy:prepare
sudo systemctl restart emdash
sudo nginx -t
sudo systemctl reload nginx
