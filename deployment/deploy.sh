#!/usr/bin/env bash
# =============================================================
# ORION — Deployment script
# Usage: bash deployment/deploy.sh
# Jalankan dari root project di VPS: /var/www/orion
# =============================================================

set -euo pipefail

APP_DIR="/var/www/orion"
PHP="/usr/bin/php"

echo "==> [ORION] Starting deployment $(date '+%Y-%m-%d %H:%M:%S')"

# Verify production safety checks
if grep -q "MQTT_TLS_ENABLED=false" .env; then
    echo "⚠️  WARNING: MQTT TLS is disabled. Set MQTT_TLS_ENABLED=true and MQTT_PORT=8883 for production."
fi

cd "$APP_DIR"

# 1. Pull latest code
echo "==> Pulling latest code..."
git pull origin main

# 2. Install PHP dependencies (production, no dev)
echo "==> Installing Composer dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction

# 3. Build frontend assets
echo "==> Building frontend assets..."
npm ci --omit=dev
npm run build

# 4. Run database migrations
echo "==> Running migrations..."
$PHP artisan migrate --force --no-interaction

# 5. Clear and rebuild caches
echo "==> Rebuilding caches..."
$PHP artisan config:cache
$PHP artisan route:cache
$PHP artisan view:cache
$PHP artisan event:cache

# 6. Fix storage permissions
echo "==> Setting permissions..."
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# 7. Restart Supervisor processes
echo "==> Restarting services..."
supervisorctl restart orion-reverb orion-mqtt orion-queue:*

echo "==> [ORION] Deployment complete! $(date '+%Y-%m-%d %H:%M:%S')"
