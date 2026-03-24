# LottoCore — Bingo híbrido

Sistema de bingo beneficente (cartela física + validação e transparência digitais).

## Documentação

- [PRD](docs/bingo-system-prd.md)
- [Especificação técnica](docs/bingo-system-spec.md)
- [Plano de ação](docs/plano-de-acao.md)
- [**Deploy na VPS e GitHub**](docs/DEPLOY.md)

## GitHub e CI

1. Crie o repositório em GitHub e ligue o remoto: `git remote add origin …` (passos detalhados em [docs/DEPLOY.md](docs/DEPLOY.md)).
2. O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre `npm ci` e o build do frontend em cada push/PR para `main`.

## Produção (Docker)

Ficheiros principais:

| Ficheiro | Descrição |
|----------|-----------|
| `docker-compose.yml` | Produção: Postgres + API + Nginx; `name: lottocore` (stack próprio no painel); proxy `/api` e `/ws` |
| `docker-compose.traefik.yml` | Overlay VPS (opcional): `Host(DOMAIN)` + rede `root_default` (sem portas HTTP duplicadas no host) |
| `docker-compose.postgres-dev.yml` | Só Postgres local (dev, porta 5433) |
| `backend/Dockerfile` | API com Chromium para PDFs |
| `frontend/Dockerfile` | Build Vite + Nginx (servidor interno; roteador público = Traefik) |
| `env.production.template` | Variáveis para copiar para `.env` na VPS |

Resumo: na VPS, `cp env.production.template .env`, preencher segredos. **Portas no host** (predef. 8092 / 3020 / 5440) + Traefik com ficheiro dinâmico (`deploy/traefik/lottocore-http.yaml`) **ou** overlay `docker-compose.traefik.yml` com `DOMAIN` (vários sites no mesmo IP). `./scripts/deploy-vps.sh` ou `docker compose up -d --build`; com overlay: `./scripts/deploy-vps-traefik.sh` ou `docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build`. Windows → VPS: `.\scripts\deploy-remote.ps1`. Ver [docs/DEPLOY.md](docs/DEPLOY.md).

## Pré-requisitos

- Node.js 20+
- Docker (opcional, para PostgreSQL)

## Configuração

1. Copie `env.template` para `.env` na raiz e ajuste se necessário.
2. Suba o banco: `docker compose -f docker-compose.postgres-dev.yml up -d`  
   O Postgres do Compose usa a porta **5433** no host (evita conflito com PostgreSQL local na 5432). Ajuste `DATABASE_URL` e `POSTGRES_PORT` no `.env` se mudar isso.
3. Instale dependências na raiz: `npm install`
4. Rode migrações: `npm run migrate`
5. Desenvolvimento (API + UI): **`npm run dev` na raiz do repositório** (inicia backend na 3003 e Vite na 5173).  
   **Não** use só `cd frontend && npm run dev` sem o API a correr — o proxy devolve **502** e o registo/login falham.  
   Alternativa: dois terminais — `npm run dev:backend` e `npm run dev:frontend`.

| Serviço    | URL padrão        |
|-----------|-------------------|
| API       | http://localhost:3003 |
| Frontend  | http://localhost:5173 |

## Estrutura

```
backend/     Express + PostgreSQL (migrações em backend/migrations)
frontend/    React + Vite + TypeScript + Tailwind + Radix (UI estilo SaaS)
docs/        PRD, spec e plano
```

### Painel (UI)

- Abra **http://localhost:5173** — será pedido **início de sessão** (`/login`) ou **registo** (`/registo`). Cada utilizador vê apenas os **seus** eventos (`owner_user_id` na base de dados).
- Navegação: **Painel**, **Eventos** (submenu com módulos do evento em foco), **Documentação**.
- Página pública do jogador: **`/f/:token`** (folha completa, sem login).

### Erro `EADDRINUSE` na porta 3003

Só pode haver **uma** API a escutar nessa porta (não combine `npm run dev` na raiz **e** outro `npm run dev` dentro de `backend/`).

No **Windows**, `npm run dev` no backend (e o da raiz, que chama o mesmo script) **termina processos que já estejam em escuta nessa porta** antes de subir o servidor — evita ficar preso a um Node antigo.

Se ainda falhar: `netstat -ano | findstr :3003` e `taskkill /PID <pid> /F`, ou use `npm run dev:watch-only` no backend só se quiser **não** libertar a porta automaticamente.

## API (painel autenticado)

Rotas em `/api/events`, `/api/sheets`, `/api/rounds` e `/api/cards` exigem **`Authorization: Bearer <JWT>`**. Cada utilizador acede apenas a eventos da sua conta.

### Autenticação (`/api/auth`)

- `POST /api/auth/register` — corpo `{ "email": "...", "password": "..." }` (palavra-passe ≥ 8 caracteres) — cria utilizador e devolve `{ token, user }`
- `POST /api/auth/login` — mesmo corpo — devolve `{ token, user }`
- `GET /api/auth/me` — com `Authorization: Bearer …` — devolve `{ user }`

### Eventos

- `GET /api/events` — lista eventos **do utilizador** (mais recentes primeiro)
- `POST /api/events` — corpo `{ "name": "Nome do evento" }` — cria evento em rascunho e **5 rodadas**
- `POST /api/events/:eventId/sheets` — corpo `{ "count": 1 }` — gera folhas com **5 cartelas** (1 por rodada)
- `GET /api/events/:eventId` — evento e rodadas
- `GET /api/events/:eventId/sheets` — lista folhas e contagem de cartelas

### Rodadas e sorteio (`/api/rounds`)

- `GET /api/rounds/:roundId` — rodada + números já sorteados (ordenados)
- `POST /api/rounds/:roundId/draw` — corpo `{ "number": 42 }` — registra sorteio (1–75, sem repetir na rodada). Rodada `pending` vira `open` no primeiro sorteio; `closed` não aceita
- `POST /api/rounds/:roundId/draw/undo` — remove o **último** número da rodada (erro do operador)
- `PATCH /api/rounds/:roundId/status` — corpo `{ "status": "pending" | "open" | "closed" }`

### WebSocket (tempo real)

Conecte em `ws://localhost:3003/ws?eventId=<uuid do evento>` (em produção, use `wss://`).

Mensagens JSON:

| `type` | Quando |
|--------|--------|
| `connected` | Confirma inscrição no evento |
| `number_drawn` | Novo número sorteado |
| `draw_undone` | Último sorteio desfeito |
| `round_status` | Status da rodada alterado (`PATCH .../status`) |
| `winner_detected` | Vitória: `payload.phase` = `suggested` · `confirmed` · `dismissed` · `cleared` |

### Vitória (cartela cheia), cartelas e venda

- `GET /api/rounds/:roundId/winners` — cartelas com estado de vitória na rodada (`win_status` ≠ `none`)
- `GET /api/cards/:cardId` — detalhe da cartela (inclui `grid`) para conferência manual
- `POST /api/cards/:cardId/win/confirm` — confirma vitória **sugerida**
- `POST /api/cards/:cardId/win/dismiss` — dispensa falso positivo (`dismissed`; não volta a sugerir automaticamente)
- `POST /api/sheets/:sheetId/sell` — corpo opcional `{ "buyerName", "buyerContact" }` — marca folha como vendida (só vendidas entram na deteção automática)

**Cartela cheia:** todas as casas preenchidas (exceto o centro livre) já foram sorteadas na rodada. Após cada `POST .../draw`, a API reavalia; ao `draw/undo`, sugestões que deixam de fechar cartela são revogadas (`phase: cleared`).

### Público (sem chave)

- `GET /api/public/sheets/:token` — JSON com folha, cartelas, rodadas e números sorteados para a página pública e WebSocket.

No frontend, a rota **`/f/:token`** mostra as cinco cartelas da folha, marca números sorteados e atualiza em tempo real via `/ws?eventId=...`.

### PDF da folha (Puppeteer)

- `GET /api/sheets/:sheetId/pdf` — devolve **A4** com as **5 cartelas** e **um QR** da folha apontando para `{PUBLIC_APP_URL}/f/{sheet_public_token}`.
- Defina **`PUBLIC_APP_URL`** no `.env` (ex.: `https://seu-dominio.com` em produção). Em desenvolvimento, o padrão é `http://localhost:5173`.

A primeira instalação do **Puppeteer** pode descarregar o Chromium. Em **Docker/Linux**, o browser já é lançado com `--no-sandbox` (adequado a contentores).

## Scripts úteis

- `npm run migrate` — aplica migrações SQL pendentes
- `npm run build` — build de produção do frontend
- `docker compose up -d --build` — stack de produção (na VPS, com `.env` preenchido; ficheiro `docker-compose.yml`)
- `./scripts/deploy-vps.sh` — `git pull` + rebuild + `up -d` (Linux/macOS na VPS)
