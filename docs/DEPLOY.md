# Deploy na VPS (Docker) e GitHub

Guia para versionar o LottoCore no GitHub e publicar em produção com Docker Compose.

## 1. Repositório no GitHub

1. Em [github.com/new](https://github.com/new) crie um repositório (ex.: `LottoCore`), **sem** README automático se já tiver um localmente.
2. Na máquina de desenvolvimento (com Git instalado):

```bash
cd /caminho/para/LottoCore
git remote add origin https://github.com/SEU_USUARIO/LottoCore.git
git branch -M main
git push -u origin main
```

Use SSH se preferir: `git@github.com:SEU_USUARIO/LottoCore.git`.

**Nunca** faça commit de `.env` — já está no `.gitignore`. Use `env.template` (dev) e `env.production.template` (VPS) como referência.

## 2. O que sobe em produção

| Serviço    | Contentor              | Função |
|-----------|-------------------------|--------|
| `postgres` | `lottocore-postgres-prod` | PostgreSQL 16 |
| `backend`  | `lottocore-backend-prod`  | API Node (Express), migrações ao arranque, Puppeteer + Chromium |
| `frontend` | `lottocore-frontend-prod` | Nginx a servir o build estático e *proxy* de `/api` e `/ws` para o backend |

O browser fala sempre com o **mesmo host** (Nginx), o que evita problemas de CORS no painel.

## 3. Preparar a VPS

- Ubuntu 22.04/24.04 LTS ou similar.
- [Docker Engine](https://docs.docker.com/engine/install/) + [Docker Compose plugin](https://docs.docker.com/compose/install/linux/).
- Firewall: abrir a porta escolhida (ex.: `8080`) ou `80`/`443` se usar Traefik na frente.

```bash
sudo apt update && sudo apt install -y git
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/SEU_USUARIO/LottoCore.git
cd LottoCore
cp env.production.template .env
nano .env   # ou vim: preencher POSTGRES_PASSWORD, JWT_SECRET, DATABASE_URL, PUBLIC_APP_URL, HTTP_PORT
```

**`DATABASE_URL` em Docker** tem de usar o hostname **`postgres`** (nome do serviço no Compose), não `127.0.0.1`:

```env
DATABASE_URL=postgresql://bingo:SUA_SENHA@postgres:5432/bingo
```

**`PUBLIC_APP_URL`** deve ser a URL **pública** que os jogadores e o QR code usam (ex.: `https://bingo.exemplo.pt`), sem barra no fim.

**`JWT_SECRET`**: em produção é obrigatório (o backend recusa arrancar sem ele). Gere por exemplo:

```bash
openssl rand -base64 48
```

## 4. Primeiro deploy e atualizações

Na pasta do repositório na VPS:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=80 backend
```

- Migrações SQL correm **automaticamente** antes de iniciar a API (`backend/docker-entrypoint.sh`).
- Ficheiros de modelo de impressão ficam no volume `lottocore_uploads` → `/app/backend/uploads` no contentor.

Atualizar após `git pull`:

```bash
./scripts/deploy-vps.sh
```

Ou manualmente:

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## 5. Traefik (opcional)

Se já usa Traefik na mesma VPS:

1. Crie/edite a rede externa que o Traefik usa (ex.: `root_default`).
2. No `docker-compose.prod.yml`, no serviço `frontend`:
   - Remova ou comente `ports`.
   - Adicione `networks: [default, traefik]` e labels semelhantes a:

```yaml
networks:
  default:
  traefik_net:
    external: true
    name: root_default

services:
  frontend:
    # ports: ...
    networks:
      - default
      - traefik_net
    labels:
      - traefik.enable=true
      - traefik.http.routers.lottocore.rule=Host(`bingo.seudominio.com`)
      - traefik.http.routers.lottocore.entrypoints=websecure
      - traefik.http.routers.lottocore.tls=true
      - traefik.http.routers.lottocore.tls.certresolver=myresolver
      - traefik.http.services.lottocore.loadbalancer.server.port=80
```

Ajuste `Host`, `entrypoints`, `certresolver` ao seu `docker-compose` do Traefik. O router deve apontar para a **porta 80 do contentor** `frontend` (Nginx interno).

## 6. CI no GitHub Actions

O workflow `.github/workflows/ci.yml` corre em cada *push* / PR para `main`: instala dependências com `npm ci`, faz build do frontend e valida que o projeto compila. Não faz deploy automático (pode acrescentar um job com SSH ou registry mais tarde).

## 7. Resolução de problemas

| Sintoma | Verificação |
|--------|-------------|
| Backend a sair logo ao arrancar | `docker compose ... logs backend` — falta `JWT_SECRET` ou `DATABASE_URL` errado |
| 502 em `/api` | Nginx não alcança `backend:3000`; confirme que o serviço `backend` está `healthy` / `running` |
| PDF falha no contentor | Chromium está na imagem; `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (definido no Dockerfile) |
| WebSocket não liga | Proxy `/ws` com `Upgrade`; mesmo domínio que o site; em HTTPS use `wss://` (Traefik termina TLS) |

## 8. Base de dados única

Não substitua o volume PostgreSQL em produção sem backup. Para cópias de segurança:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U bingo bingo > backup-$(date +%F).sql
```
