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

Caminho típico no servidor: `~/apps/lottocore` ou `/root/lottocore`.

### 4.2 Primeiro arranque (na sessão SSH)

```bash
cd ~/apps/lottocore   # ajuste ao seu caminho
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f --tail=50 backend
```

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

## 7. Traefik (mesma VPS que Comissão 360 / outros projetos)

Vários domínios podem apontar (registro **A**) para o **mesmo IP**. O Traefik escolhe o contentor pelo cabeçalho **`Host`**. Se o LottoCore estiver escutando na **porta 80/443 do host** sem regra `Host` correta, ou se só existir um site ocupando a porta, **outro domínio pode cair no login errado**.

### 7.1 Overlay incluído no repositório

1. No `.env` da VPS defina **`DOMAIN`** = FQDN **só** do LottoCore (ex.: `bingo.exemplo.com`), diferente do domínio da Comissão 360.
2. Alinhe **`PUBLIC_APP_URL`** a esse domínio (`https://...`, sem barra final).
3. Suba com **dois** arquivos Compose (o overlay usa `ports: !reset []` para não publicar `HTTP_PORT` no host):

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

Ou: `./scripts/deploy-vps-traefik.sh` (faz `git pull` + build + up).

4. Rede externa **`root_default`** tem de existir (criada pelo stack do Traefik em `/root` ou equivalente).
5. O **certificate resolver** nas labels usa o nome **`mytlschallenge`**, o mesmo descrito na documentação da Comissão 360. Se o seu Traefik usar outro nome, altere a label `tls.certresolver` em `docker-compose.traefik.yml`.

O router **`lottocore`** usa a regra Traefik `Host` com o FQDN definido em **`DOMAIN`** no `.env` e envia tráfego para a porta **80** do contentor `frontend` (Nginx interno, que já faz proxy de `/api` e `/ws`). O overlay usa `ports: !reset []` porque o Compose **concatena** listas `ports` entre arquivos; sem `!reset`, a porta `HTTP_PORT` continuaria publicada no host (Docker Compose **v2.23+**).

### 7.2 Depois de corrigir

- Pare qualquer stack LottoCore antiga que publique **80:80** ou **443:443** no host sem passar pelo Traefik.
- Confirme no painel/API do Traefik que existem routers **distintos** por domínio (Comissão 360 vs LottoCore).

## 8. CI no GitHub Actions

O workflow `.github/workflows/ci.yml` corre em cada *push* / PR para `main`: instala dependências com `npm ci`, faz build do frontend e valida que o projeto compila. Não faz deploy automático (pode acrescentar um job com SSH ou registry mais tarde).

## 9. Resolução de problemas

| Sintoma | Verificação |
|--------|-------------|
| Backend a sair logo ao arrancar | `docker compose ... logs backend` — falta `JWT_SECRET` ou `DATABASE_URL` errado |
| 502 em `/api` | Nginx não alcança `backend:3000`; confirme que o serviço `backend` está `healthy` / `running` |
| PDF falha no contentor | Chromium está na imagem; `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (definido no Dockerfile) |
| WebSocket não liga | Proxy `/ws` com `Upgrade`; mesmo domínio que o site; em HTTPS use `wss://` (Traefik termina TLS) |
| Domínio da Comissão 360 abre o LottoCore (ou o contrário) | Mesmo IP é normal; falta roteamento por **Host**. Use overlay `docker-compose.traefik.yml`, `DOMAIN` diferente por projeto, e **não** publique dois frontends na mesma porta 80 sem Traefik |

## 10. Base de dados única

Não substitua o volume PostgreSQL em produção sem backup. Para cópias de segurança:

```bash
docker compose exec postgres \
  pg_dump -U bingo bingo > backup-$(date +%F).sql
```
