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

No host (predef.): UI **`8092`**, API **`3020`**, Postgres **`5440`** — configurável com `PUBLISH_*_PORT` no `.env`.

O browser fala sempre com o **mesmo host** (Nginx), o que evita problemas de CORS no painel.

## 3. Preparar a VPS

- Ubuntu 22.04/24.04 LTS ou similar.
- [Docker Engine](https://docs.docker.com/engine/install/) + [Docker Compose plugin](https://docs.docker.com/compose/install/linux/).
- **`docker-compose.yml` define `name: lottocore`**: no Docker Manager da Hostinger o projeto aparece como **lottocore** (como comissao360, sothia-legal-nexus, etc.), **não** dentro do stack **root**.
- **Traefik** no stack **`root`** (`/root/docker-compose.yml`). A rota **`lottocore.atus.tech`** está no **file provider** (pasta montada em `/etc/traefik/dynamic`), no mesmo estilo do Nexus: copie ou mantenha **`deploy/traefik/lottocore-http.yaml`** na VPS em **`/root/sothia-legal-nexus/traefik-dynamic/lottocore-http.yaml`** (caminho atual do `docker-compose` do root). O contentor **`lottocore-frontend-prod`** tem de estar na rede **`root_default`** (já definido no `docker-compose.yml` do LottoCore).
- **`deploy-vps.sh`** cria os volumes nomeados `lottocore_pgdata` e `lottocore_uploads` se ainda não existirem, depois corre `docker compose up -d --build` na pasta do repositório.
- **Portas no host** (como outros projetos no painel Hostinger): **`PUBLISH_FRONTEND_PORT`** (predef. **8092** → Nginx), **`PUBLISH_BACKEND_PORT`** (predef. **3020** → API), **`PUBLISH_POSTGRES_PORT`** (predef. **5440** → Postgres). Ajuste no `.env` se alguma porta estiver ocupada. O site pelo domínio continua a ir por **Traefik** (443); as portas servem para testes, ferramentas e o link **Abrir** do gestor.

### Rede do Traefik

O contentor `frontend` tem de estar na mesma rede Docker que o Traefik. O ficheiro usa por defeito `TRAEFIK_NETWORK=root_default`. Se o seu Traefik estiver noutra rede, defina `TRAEFIK_NETWORK` no `.env`. Confirme o nome com:

```bash
docker network ls | grep -E 'root|traefik'
```

### VPS com vários projetos (portas)

| Serviço (Compose) | Porta no host (predef.) | Contentor |
|---------------------|-------------------------|-----------|
| `frontend` | 8092 | 80 |
| `backend` | 3020 | 3000 |
| `postgres` | 5440 | 5432 |

Evite conflito com outros stacks (ex. comissao360: 3010, 5180, 5434). O **Traefik** continua a ser o ponto de entrada em **80/443** para `https://APP_HOST`.

```bash
ss -tlnp
docker ps --format '{{.Names}}\t{{.Ports}}'
```

```bash
sudo apt update && sudo apt install -y git
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/SEU_USUARIO/LottoCore.git
cd LottoCore
cp env.production.template .env
nano .env   # segredos, APP_HOST, PUBLIC_APP_URL, TRAEFIK_NETWORK, PUBLISH_*_PORT
```

**`DATABASE_URL` em Docker** tem de usar o hostname **`postgres`** (nome do serviço no Compose), não `127.0.0.1`:

```env
DATABASE_URL=postgresql://bingo:SUA_SENHA@postgres:5432/bingo
```

**`PUBLIC_APP_URL`** e **`APP_HOST`**: URL pública HTTPS e hostname (ex.: `https://lottocore.atus.tech` e `lottocore.atus.tech`). Devem coincidir com a regra **`Host(...)`** em `deploy/traefik/lottocore-http.yaml`.

### DNS e Let's Encrypt (`lottocore.atus.tech`)

1. **DNS** (painel do domínio `atus.tech`): registo **A** para **`lottocore`** → **IP público da VPS** (confirme no painel da Hostinger ou com `curl -s https://api.ipify.org` **na VPS**). Opcional: **AAAA** se usar IPv6.
2. **E-mail ACME**: em **`/root/.env`** defina **`SSL_EMAIL`** com um e-mail válido (Termos de Serviço Let's Encrypt). É o mesmo resolver **`mytlschallenge`** usado pelo Traefik.
3. **Só depois do DNS propagar** é que o certificado será emitido. Se tentar antes, verá erros `NXDOMAIN` nos logs do Traefik e a Let's Encrypt pode aplicar **rate limit** (várias falhas por hora no mesmo hostname). Espere a propagação e, se necessário, ~1 h após muitas tentativas falhadas.
4. **Credenciais da app** continuam no **`lottocore/.env`** (`POSTGRES_PASSWORD`, `JWT_SECRET`, `DATABASE_URL`); não confundir com o e-mail do ACME em `/root/.env`.

**`JWT_SECRET`**: em produção é obrigatório (o backend recusa arrancar sem ele). Gere por exemplo:

```bash
openssl rand -base64 48
```

## 4. Deploy via SSH (a partir do Windows)

O Windows 10/11 inclui cliente **OpenSSH** (`ssh`, `scp`). No PowerShell ou CMD:

```powershell
ssh root@IP_DA_VPS
```

Substitua `root` pelo utilizador real (ex.: `ubuntu`, `debian`) e `IP_DA_VPS` pelo IP ou hostname.

### 4.1 Primeira ligação e pasta do projeto

1. Na primeira vez, aceite a *host key* do servidor quando o `ssh` perguntar.
2. No servidor, instale Docker e Git se ainda não existirem (ver secção 3).
3. Clone o repositório com **URL SSH** e a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) que configurou no GitHub (chave privada em `~/.ssh/` no servidor, `~/.ssh/config` com `Host github.com-lottocore` se usar alias).
4. Copie `env.production.template` → `.env` e preencha variáveis (igual à secção 3).

Caminho típico no servidor: `~/apps/lottocore` ou **`/root/lottocore`** (alinhado ao Nexus em `/root/sothia-legal-nexus`).

### 4.2 Primeiro arranque (na sessão SSH)

Na pasta do repositório (ex.: `/root/lottocore`):

```bash
docker network create root_default 2>/dev/null || true
cp env.production.template .env
nano .env   # POSTGRES_PASSWORD, JWT_SECRET, DATABASE_URL, APP_HOST, PUBLIC_APP_URL
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

Ou manualmente (o script faz o mesmo, incluindo criar volumes se faltarem):

```bash
cd ~/apps/lottocore   # ou /root/lottocore
docker network create root_default 2>/dev/null || true
docker volume create lottocore_pgdata 2>/dev/null || true
docker volume create lottocore_uploads 2>/dev/null || true
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f --tail=50 backend
```

**Migração** se ainda tiver dados só em volumes antigos `root_lottocore_pgdata` / `root_lottocore_uploads`: pare e apague os contentores antigos do LottoCore no stack `root`, crie `lottocore_pgdata` e `lottocore_uploads` e copie com um contentor `alpine` de `/old` para `/new` (igual a uma cópia de ficheiros entre volumes); depois suba só com `docker compose` na pasta do repo.

Estes comandos **não** passam por painéis que injetam `--quiet-build`, por isso contornam o erro de alguns *hostings* geridos.

### 4.3 Atualizar depois de `git push` (no servidor)

```bash
cd ~/apps/lottocore
git pull
chmod +x scripts/deploy-vps.sh   # uma vez
./scripts/deploy-vps.sh
```

### 4.4 Disparar o deploy a partir do seu PC (sem entrar em modo interativo)

No **PowerShell**, na pasta do repositório clonado no Windows (ou em qualquer pasta):

```powershell
.\scripts\deploy-remote.ps1 -SshTarget root@IP_DA_VPS -RemotePath /root/apps/lottocore
```

Ajuste `-SshTarget` e `-RemotePath` ao seu caso. O script corre `git pull`, `docker compose build` e `docker compose up -d` no servidor.

Requisito: a sua chave SSH (password ou chave pública autorizada em `~/.ssh/authorized_keys` **no servidor**) tem de permitir login; isso é **independente** da deploy key do GitHub (que só serve para `git pull` no servidor).

## 5. Primeiro deploy e atualizações

Na pasta do repositório na VPS:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=80 backend
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
docker compose up -d --build
```

## 6. Hostinger (Docker Manager) e `unknown flag: --quiet-build`

O painel usa por defeito o ficheiro **`docker-compose.yml`** na raiz do repositório. A stack de produção (Postgres + backend + frontend) está **nesse ficheiro** desde a correção alinhada com esse comportamento.

Se o *build* falhar com:

```text
unknown flag: --quiet-build
```

o problema é a **versão do Docker Compose** no servidor do painel: o *wrapper* da Hostinger passa uma opção que o *plugin* `docker compose` instalado ainda não reconhece.

**O que pode fazer:**

1. **Suporte Hostinger** — pedir atualização do Docker Compose / correção do comando de build (a flag `--quiet-build` é deles, não do repositório).
2. **SSH na VPS** — ver **secção 4** deste guia (deploy manual completo, sem o assistente):
   ```bash
   cd /caminho/do/lottocore
   cp env.production.template .env   # se ainda não existir
   nano .env
   docker compose build
   docker compose up -d
   ```
   Estes comandos **não** usam `--quiet-build`.
3. Garantir que existe um **`.env`** no repositório na máquina de build com `POSTGRES_PASSWORD`, `JWT_SECRET`, `DATABASE_URL` (host `postgres`), `PUBLIC_APP_URL`, etc.; caso contrário o Compose pode falhar ao validar variáveis.

## 7. Traefik

1. **`/root/docker-compose.yml`**: Traefik com redirecionamento global **HTTP → HTTPS**; certificado Let's Encrypt via **`mytlschallenge`** (`SSL_EMAIL` no `/root/.env`).
2. **LottoCore**: roteamento em **`traefik-dynamic/lottocore-http.yaml`** (router **`lottocore-web`**, serviço → `http://lottocore-frontend-prod:80`, **`tls.certResolver: mytlschallenge`**). O Traefik recarrega a pasta dinâmica ao detetar alterações.
3. DNS e rate limits: ver secção **DNS e Let's Encrypt** acima.

O contentor **frontend** inclui **Nginx** só **dentro** da rede Docker (estático + proxy `/api` e `/ws` para o backend); quem expõe TLS na Internet é o **Traefik**.

## 8. CI no GitHub Actions

O workflow `.github/workflows/ci.yml` corre em cada *push* / PR para `main`: instala dependências com `npm ci`, faz build do frontend e valida que o projeto compila. Não faz deploy automático (pode acrescentar um job com SSH ou registry mais tarde).

## 9. Resolução de problemas

| Sintoma | Verificação |
|--------|-------------|
| Backend a sair logo ao arrancar | `docker compose ... logs backend` — falta `JWT_SECRET` ou `DATABASE_URL` errado |
| 502 em `/api` | Nginx não alcança `backend:3000`; confirme que o serviço `backend` está `healthy` / `running` |
| PDF falha no contentor | Chromium está na imagem; `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (definido no Dockerfile) |
| WebSocket não liga | Proxy `/ws` com `Upgrade`; mesmo domínio que o site; em HTTPS use `wss://` (Traefik termina TLS) |
| Browser mostra “Não seguro” / certificado Traefik | O Traefik usa **TLS-ALPN** (`tlschallenge` no `/root/docker-compose.yml`). Com DNS **A** correto para o host, o certificado Let's Encrypt fica em `acme.json`. Valide na VPS com `openssl s_client` na porta **443** e SNI igual ao domínio; o *issuer* deve ser Let's Encrypt. Causas comuns nos logs: **NXDOMAIN** (DNS ainda não propagado) e **429** (*rate limit* — esperar ~1 h e reiniciar o Traefik do stack root se preciso). |
| Login devolve **401** com “credenciais que deveriam estar certas” | A tabela `users` pode estar **vazia** (primeiro deploy). Crie conta em **`/register`** no site; não há utilizador pré-definido na BD. |
| Ligar ao PostgreSQL a partir do host | Utilizador e base por defeito **`bingo`**; senha: **`POSTGRES_PASSWORD`** em **`lottocore/.env`**. No host, porta publicada por defeito **`5440`** → 5432 no contentor (`PUBLISH_POSTGRES_PORT`). Ex.: `psql "postgresql://bingo:SENHA@127.0.0.1:5440/bingo"`. Dentro da rede Docker, use o hostname **`postgres`** como em `DATABASE_URL`. |
| Copiar a BD do PC para a VPS | No PC: `pg_dump -h 127.0.0.1 -p 5433 -U bingo -d bingo -Fc -f lottocore.dump` (ajuste porta/senha ao `.env` local). Envie o ficheiro para a VPS (`scp`, etc.) e na raiz do repo: **`./scripts/import-pg-dump-into-docker.sh /caminho/lottocore.dump`**. O login da app usa as linhas da tabela **`users`** (não confundir com `POSTGRES_PASSWORD`). |

## 10. Base de dados única

Não substitua o volume PostgreSQL em produção sem backup. Para cópias de segurança:

```bash
docker compose exec postgres \
  pg_dump -U bingo bingo > backup-$(date +%F).sql
```
