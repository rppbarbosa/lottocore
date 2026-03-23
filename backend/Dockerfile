# Build from repositório: docker compose -f docker-compose.prod.yml build backend
# Contexto na raiz do projeto (.) — ver docker-compose.prod.yml
FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev -w backend

COPY backend/ ./backend/
WORKDIR /app/backend
RUN chmod +x docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
