# =============================================================
# ORION — production image for Coolify (Dockerfile build pack)
# One container runs: nginx + php-fpm, Reverb, MQTT subscriber,
# queue worker and the scheduler (all under supervisord).
# =============================================================

FROM php:8.4-fpm-alpine AS base

COPY --from=mlocati/php-extension-installer:2.7 /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_mysql pcntl bcmath intl zip gd opcache sockets \
    && apk add --no-cache nginx supervisor tzdata \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/php.ini $PHP_INI_DIR/conf.d/zz-orion.ini
WORKDIR /var/www/html

# ---------- build: composer + vite (wayfinder needs PHP during vite build) ----------
FROM base AS build

COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer
RUN apk add --no-cache nodejs npm git

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && php artisan package:discover --ansi

# Baked into the JS bundle — set these as "Build Variables" in Coolify.
ARG VITE_APP_NAME=ORION
ARG VITE_REVERB_APP_KEY
ARG VITE_REVERB_HOST
ARG VITE_REVERB_PORT=443
ARG VITE_REVERB_SCHEME=https
ENV VITE_APP_NAME=$VITE_APP_NAME \
    VITE_REVERB_APP_KEY=$VITE_REVERB_APP_KEY \
    VITE_REVERB_HOST=$VITE_REVERB_HOST \
    VITE_REVERB_PORT=$VITE_REVERB_PORT \
    VITE_REVERB_SCHEME=$VITE_REVERB_SCHEME

RUN npm run build

# ---------- runtime (no node_modules, no build tools) ----------
FROM base AS runtime

COPY --from=build --chown=www-data:www-data /var/www/html/app ./app
COPY --from=build --chown=www-data:www-data /var/www/html/bootstrap ./bootstrap
COPY --from=build --chown=www-data:www-data /var/www/html/config ./config
COPY --from=build --chown=www-data:www-data /var/www/html/database ./database
COPY --from=build --chown=www-data:www-data /var/www/html/public ./public
COPY --from=build --chown=www-data:www-data /var/www/html/resources/views ./resources/views
COPY --from=build --chown=www-data:www-data /var/www/html/routes ./routes
COPY --from=build --chown=www-data:www-data /var/www/html/storage ./storage
COPY --from=build --chown=www-data:www-data /var/www/html/vendor ./vendor
COPY --from=build --chown=www-data:www-data /var/www/html/artisan /var/www/html/composer.json ./

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD wget -qO- http://127.0.0.1/up >/dev/null || exit 1

ENTRYPOINT ["entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisord.conf"]
