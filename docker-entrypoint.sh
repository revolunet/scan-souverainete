#!/bin/bash
set -e

if [ ! -f /app/output/geoip/GeoLite2-Country.mmdb ]; then
    echo "[INFO] Téléchargement de la base GeoIP..."
    mkdir -p /app/output/geoip

    # P3TERX GeoIP mirror (up-to-date, no auth, ~8MB)
    GEOIP_URL="https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-Country.mmdb"

    if curl -L --max-time 120 -s -o /app/output/geoip/GeoLite2-Country.mmdb "$GEOIP_URL" && \
       [ -s /app/output/geoip/GeoLite2-Country.mmdb ]; then
        echo "[INFO] Base GeoIP téléchargée ($(du -h /app/output/geoip/GeoLite2-Country.mmdb | cut -f1))."
    else
        echo "[WARN] Impossible de télécharger la base GeoIP (pas de géolocalisation)."
        rm -f /app/output/geoip/GeoLite2-Country.mmdb
    fi
fi

exec node dist/index.js "$@"
