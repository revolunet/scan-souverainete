FROM --platform=$TARGETPLATFORM node:22-bookworm-slim AS build

ARG TARGETPLATFORM

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM --platform=$TARGETPLATFORM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    whois \
    dnsutils \
    bind9-host \
    chromium \
    chromium-l10n \
    mmdb-bin \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY data/ ./data/

RUN mkdir -p /app/output/geoip /app/output/results /app/output/raw/logs

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
