# Plano de ação — Sistema de bingo híbrido (MVP)

Documentos de referência: [bingo-system-prd.md](./bingo-system-prd.md), [bingo-system-spec.md](./bingo-system-spec.md).

---

## Objetivo do plano

Entregar o **MVP para um único evento** (Fase 1 do PRD), seguindo a ordem de prioridade da spec técnica e cobrindo escopo, regras de negócio e mitigação de riscos citados nos documentos.

---

## Fase 0 — Fundação do projeto

| # | Entrega | Detalhes |
|---|---------|----------|
| 0.1 | Monorepo ou pastas `frontend` / `backend` | React + Vite; Node + Express conforme spec |
| 0.2 | PostgreSQL acessível | Local ou Docker; variáveis em `.env` (sem commitar segredos) |
| 0.3 | Convenções | Migrações versionadas, README mínimo apontando para `docs/` |

**Critério de pronto:** backend sobe, frontend builda, banco conecta.

---

## Fase 1 — Banco de dados (prioridade 1 da spec)

| # | Entrega | Detalhes |
|---|---------|----------|
| 1.1 | Modelo conceitual | **Evento** (MVP: 1 ativo); **Rodada** (1–5); **Folha**; **Cartela** (grid JSONB como na spec); vínculo folha ↔ 5 cartelas (1 por rodada) |
| 1.2 | Unicidade | Garantir no banco ou na aplicação que a **combinação da cartela é única por rodada** (repetição ok entre rodadas) |
| 1.3 | Venda | Campos de **status de venda**, **comprador** (texto ou contato — sem login de participante no MVP) |
| 1.4 | Sorteio | Tabela ou estrutura para **números sorteados por rodada**, ordem e timestamp |
| 1.5 | Token público | Identificador opaco por cartela/folha para rota **`/c/{token}`** e QR |

**Critério de pronto:** migrações aplicadas; regras de integridade alinhadas ao PRD/spec.

---

## Fase 2 — Geração de cartelas (prioridade 2)

| # | Entrega | Detalhes |
|---|---------|----------|
| 2.1 | Gerador de grid | Algoritmo que respeita colunas B–I–N–G–O, faixas 1–15 … 61–75, **centro `null`** |
| 2.2 | Geração em lote | API interna: criar **folhas com 5 cartelas**; associar tokens |
| 2.3 | Unicidade | Validação ao persistir (constraint ou checagem pré-insert) |

**Critério de pronto:** é possível gerar folhas válidas e listá-las no painel (mesmo que UI ainda simples).

---

## Fase 3 — Sorteio (prioridade 3)

| # | Entrega | Detalhes |
|---|---------|----------|
| 3.1 | Lançamento de número | Endpoint protegido (organizador); número válido 1–75; **sem repetir na mesma rodada** |
| 3.2 | Histórico | Consulta dos números já sorteados **por rodada** |
| 3.3 | Mitigação operacional | Opcional no MVP: **desfazer último número** ou confirmação dupla para erro de operador (risco PRD §10) |

**Critério de pronto:** fluxo completo de “abrir rodada → sortear vários números → ver histórico”.

---

## Fase 4 — Validação automática (prioridade 4)

| # | Entrega | Detalhes |
|---|---------|----------|
| 4.1 | Regra “cartela cheia” | Considerar centro livre; comparar com números sorteados da rodada |
| 4.2 | Bloqueio | **Não** candidatar folha/cartela **não vendida** a vitória automática |
| 4.3 | Confirmação manual | Estado “sugerido” vs “confirmado” pelo organizador (PRD §5.4) |
| 4.4 | Métrica | Caminho de validação projetado para **&lt; 10 s** após último número (PRD §8) |

**Critério de pronto:** ao completar linha/coluna/diagonal/full house (definir com stakeholder qual padrão de “cartela cheia”), sistema **detecta** e exige **confirmação manual** para fechar.

---

## Fase 5 — Venda (paralelizável após Fase 1–2)

| # | Entrega | Detalhes |
|---|---------|----------|
| 5.1 | Registrar venda | Por folha; nome/contato do comprador; status |
| 5.2 | Painel organizador | Lista folhas; filtro vendida/disponível |

**Critério de pronto:** venda bloqueia corretamente a validação (integração com Fase 4).

---

## Fase 6 — Página pública + QR (MVP PRD §5.5 e spec)

| # | Entrega | Detalhes |
|---|---------|----------|
| 6.1 | Rota pública | **`/c/{token}`** — sem login do participante |
| 6.2 | UI | Grid da cartela; **marcação automática** nos números já sorteados; **X** com opacidade 0,3–0,5 (spec); número visível |
| 6.3 | QR Code | Gerar URL absoluta com token (impressão na folha/PDF) |

**Critério de pronto:** escaneando o QR, o jogador vê a mesma rodada e marcações coerentes com o backend.

---

## Fase 7 — PDF com Puppeteer (prioridade 5)

| # | Entrega | Detalhes |
|---|---------|----------|
| 7.1 | Layout A4 | **5 cartelas por folha** + QRs |
| 7.2 | Fonte da verdade | PDF gerado a partir dos **mesmos dados** persistidos no PostgreSQL (mitiga risco “PDF vs banco”, PRD §10) |
| 7.3 | Download/impressão | Fluxo no painel do organizador |

**Critério de pronto:** comparar amostra PDF ↔ registro no banco (auditoria manual).

---

## Fase 8 — WebSocket (prioridade 6)

| # | Entrega | Detalhes |
|---|---------|----------|
| 8.1 | Eventos | `number_drawn`, `winner_detected` (spec) |
| 8.2 | Cliente público | Página `/c/{token}` atualiza sem refresh |
| 8.3 | Painel | Opcional: painel organizador em tempo real |

**Critério de pronto:** novo número reflete na visualização pública em tempo real.

---

## Fase 9 — UI/UX painel SaaS (frontend)

Objetivo: experiência de **produto** (não só API), alinhada a aplicações SaaS: navegação clara, hierarquia visual, modais para ações pontuais e página pública separada.

| # | Entrega | Detalhes |
|---|---------|----------|
| 9.1 | **Design system** | Tailwind CSS + componentes reutilizáveis (padrão shadcn/Radix): botões, cartões, tabelas, separadores, separação clara primário/secundário |
| 9.2 | **Layout** | **Sidebar** fixa (desktop) com todas as áreas do painel; **sheet** (gaveta) no mobile; **cabeçalho** com título contextual e menu Conta |
| 9.3 | **Rotas do app** | `/app` início, `/app/events` lista, `/app/events/:id/*` espaço do evento com **rotas por módulo PRD §5** (não só abas): `resumo`, `gerar-folhas`, `folhas`, `controle-vendas`, `sorteio`, `vitorias`; redirecionamentos legados `cartelas` → `gerar-folhas`, `vendas` → `controle-vendas`, `validacao` → `vitorias`; `/app/ajuda` documentação de UX |
| 9.4 | **Autenticação na UI** | Registo / login (`/registo`, `/login`); **JWT** em `sessionStorage`; rotas `/app/*` protegidas; eventos filtrados por `owner_user_id` |
| 9.5 | **Modais** | Criar evento, gerar folhas (quantidade), registar venda (comprador opcional), confirmar vitória (confirmação explícita) |
| 9.6 | **Página pública** | `/c/:token` **sem** sidebar: foco na cartela, marcações, lista de sorteados, link discreto para o painel; visual coerente com tokens do tema |
| 9.7 | **Tempo real no painel** | WebSocket por `eventId` no detalhe do evento para atualizar folhas, sorteio e vitórias sem refresh manual |
| 9.8 | **Tema** | **Modo claro** por defeito; **dark mode** e opção **Sistema** (SO) com persistência em `localStorage`; classe `dark` na raiz |

**Critério de pronto:** organizador conduz um evento completo só pela UI (criar → folhas → venda → sorteio → vitórias → PDF), sem Postman.

**Sitemap (painel organizador):**

| Rota | PRD | Conteúdo principal |
|------|-----|---------------------|
| `/app` | — | **Painel**: indicadores do evento (KPIs), selector, atalhos §5 |
| `/app/events` | — | Lista e criar evento |
| `/app/events/:id/resumo` | §6 + rodadas | **Visão geral**: regras, abrir/fechar rodadas |
| `/app/events/:id/gerar-folhas` | §5.1 | Gerar folhas (cartelas por folha 1–5), PDF |
| `/app/events/:id/folhas` | §5.1 + gestão | **Folhas & cartelas**: listar (disponível / vendida / cancelada), PDF, tokens |
| `/app/events/:id/controle-vendas` | §5.2 | Vincular comprador às folhas disponíveis |
| `/app/events/:id/sorteio` | §5.3 | Lançar números, histórico |
| `/app/events/:id/vitorias` | §5.4 | **Vitórias**: confirmar/dispensar |
| `/c/:token` | §5.5 | Cartela pública (sem sidebar) |

**Não objetivo desta fase:** login multi-utilizador, permissões granulares, white-label (logos por cliente).

---

## Ordem sugerida de execução (resumo)

```text
0 → 1 → 2 → 3 → 4 → 5 (pode sobrepor 2–5) → 6 → 7 → 8 → 9
```

- **5 (venda)** pode começar logo após o modelo de folha existir (Fase 1–2).
- **6 (pública + QR)** pode usar polling no MVP e **substituir por WebSocket na Fase 8**.
- **9 (UI)** assume API das fases 1–8; pode evoluir em paralelo após **GET /api/events** e rotas estáveis.

---

## Fora do escopo MVP (não fazer agora)

- Pagamento online, login do participante, app mobile (PRD §9).
- Multi-evento / SaaS (Fase 2 — após MVP estável).

---

## Checklist de aceite do MVP

- [x] Gerar folhas com 5 cartelas únicas por rodada.
- [x] Vender por folha e vincular comprador.
- [x] Sortear números com histórico por rodada.
- [x] Detectar cartela cheia automaticamente; ignorar não vendidas; confirmar manualmente.
- [x] QR + página `/c/{token}` com marcação e estado da rodada.
- [x] PDF consistente com o banco.
- [x] Tempo real via WebSocket para sorteio (e opcionalmente vitória).
- [x] Painel SaaS: sidebar, rotas por evento alinhadas ao PRD §5, modais, login + JWT em sessão (Fase 9).

---

## Próximo passo imediato

Evoluir **Fase 9**: testes E2E do fluxo na UI, acessibilidade (foco em modais, labels), e opcionalmente **login** / convites (fora do MVP atual).
