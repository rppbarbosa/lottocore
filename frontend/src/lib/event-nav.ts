/** Rotas do workspace do evento — sidebar e navegação interna. */
export const EVENT_WORKSPACE_SEGMENTS = [
  {
    seg: 'resumo' as const,
    label: 'Visão geral',
    hint: 'Regras do jogo e estado das 5 rodadas.',
  },
  {
    seg: 'gerar-folhas' as const,
    label: 'Gerar folhas',
    hint: 'Criar folhas e escolher quantas cartelas (1–5) em cada uma.',
  },
  {
    seg: 'folhas' as const,
    label: 'Folhas & cartelas',
    hint: 'Listar folhas: disponíveis, vendidas e canceladas; PDF e tokens.',
  },
  {
    seg: 'controle-vendas' as const,
    label: 'Controle de vendas',
    hint: 'Vincular comprador às folhas disponíveis e consultar vendas.',
  },
  {
    seg: 'sorteio' as const,
    label: 'Sorteio',
    hint: 'Inserir números sorteados por rodada.',
  },
  {
    seg: 'vitorias' as const,
    label: 'Vitórias',
    hint: 'Confirmar ou dispensar prémios.',
  },
]

export type EventWorkspaceSeg = (typeof EVENT_WORKSPACE_SEGMENTS)[number]['seg']

export const EVENT_STEP_HEADER: Record<EventWorkspaceSeg, string> = {
  resumo: 'Visão geral',
  'gerar-folhas': 'Gerar folhas',
  folhas: 'Folhas & cartelas',
  'controle-vendas': 'Controle de vendas',
  sorteio: 'Sorteio',
  vitorias: 'Vitórias',
}
