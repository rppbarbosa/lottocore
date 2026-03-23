# BINGO SYSTEM — DOCUMENTAÇÃO TÉCNICA

## Visão Geral
Sistema híbrido de bingo beneficente com:
- Cartelas impressas (A4 com 5 cartelas)
- Rastreamento por folha
- Validação automática de cartela cheia
- Acompanhamento público via QR Code
- Atualização em tempo real via WebSocket

---

## Stack

### Frontend
- React + Vite

### Backend
- Node.js + Express

### Banco
- PostgreSQL

### Outros
- Puppeteer (PDF)
- WebSocket (tempo real)
- QR Code

---

## Regras de Negócio

- Venda por folha
- Cada folha contém 5 cartelas (1 por rodada)
- Cartelas únicas por rodada
- Repetição permitida em rodadas diferentes
- Validação automática apenas para cartela cheia

---

## Estrutura da Cartela (JSONB)

Formato:

[
  [1, 16, 31, 46, 61],
  [2, 17, 32, 47, 62],
  [3, 18, null, 48, 63],
  [4, 19, 33, 49, 64],
  [5, 20, 34, 50, 65]
]

Regras:
- Centro = null (casa livre)
- Cabeçalho: B I N G O
- Faixas:
  B: 1–15
  I: 16–30
  N: 31–45
  G: 46–60
  O: 61–75

---

## Marcação Visual

- X estilizado
- Opacidade entre 0.3 e 0.5
- Número permanece visível

---

## Fluxo

1. Gerar folhas
2. Vender folhas
3. Sortear números
4. Validar automaticamente
5. Exibir via QR

---

## WebSocket

Endpoint: `/ws?eventId=<uuid do evento>` (mesmo host/porta da API HTTP).

Eventos (payload em JSON):
- `connected` — confirma `eventId`
- `number_drawn` — número sorteado na rodada
- `draw_undone` — desfeito o último sorteio (operador)
- `round_status` — rodada `pending` / `open` / `closed`
- `winner_detected` — `payload.phase`: `suggested` (cartela cheia vendida), `confirmed`, `dismissed`, `cleared` (após undo)

---

## QR Code (folha)

Formato (URL relativa ao site):
 `/f/{sheet_public_token}`

API pública: `GET /api/public/sheets/{token}` (JSON da folha completa para a UI).

---

## Prioridade

1. Banco
2. Geração cartela
3. Sorteio
4. Validação
5. PDF — `GET /api/sheets/:sheetId/pdf` (A4, 5 cartelas, um QR da folha com `PUBLIC_APP_URL`)
6. WebSocket
