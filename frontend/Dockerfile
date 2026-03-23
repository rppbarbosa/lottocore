# Build from repositório: docker compose build frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN npm ci -w frontend
COPY frontend ./frontend
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
