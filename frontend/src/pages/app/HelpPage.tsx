import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Ajuda &amp; UI/UX</h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">
          Resumo da experiência planeada. O detalhe completo está em{' '}
          <code className="rounded bg-muted px-1">docs/plano-de-acao.md</code> (secção UI/UX) e no PRD em{' '}
          <code className="rounded bg-muted px-1">docs/bingo-system-prd.md</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mapa PRD §5 → páginas</CardTitle>
          <CardDescription>Estrutura alinhada à documentação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-pretty">
            Dentro de cada evento, as rotas espelham as funcionalidades do PRD:
          </p>
          <ul className="list-disc space-y-1 pl-5 text-pretty">
            <li>
              <strong className="text-foreground">Painel</strong> (<code className="rounded bg-muted px-1">/app</code>)
              — indicadores do evento ativo (folhas, vendas, rodadas, vitórias).
            </li>
            <li>
              <strong className="text-foreground">Visão geral</strong> — regras do jogo (§6) e gestão de estado das
              rodadas (abrir / fechar).
            </li>
            <li>
              <strong className="text-foreground">Gerar folhas</strong> — §5.1 quantidade de folhas e cartelas por
              folha (1–5), PDF com um QR por folha.
            </li>
            <li>
              <strong className="text-foreground">Folhas &amp; cartelas</strong> — listagem com estados, PDF e link
              público <code className="rounded bg-muted px-1">/f/…</code> por folha.
            </li>
            <li>
              <strong className="text-foreground">Controle de vendas</strong> — §5.2 vincular dados do comprador às
              folhas disponíveis.
            </li>
            <li>
              <strong className="text-foreground">Sorteio</strong> — §5.3 números e histórico (rodada selecionada).
            </li>
            <li>
              <strong className="text-foreground">Vitórias</strong> — §5.4 sugestões automáticas e confirmação manual.
            </li>
            <li>
              <strong className="text-foreground">§5.5</strong> — jogador em{' '}
              <code className="rounded bg-muted px-1">/f/:token</code> (folha completa, sem tempo real).
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Navegação</CardTitle>
          <CardDescription>Layout tipo SaaS</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground text-pretty">
          <p>
            <strong className="text-foreground">Sidebar fixa</strong> (desktop) com Painel, Eventos, Documentação e
            grupo <strong className="text-foreground">Eventos</strong> (lista + atalhos ao evento em foco). Em telemóvel, o menu abre num painel
            lateral (<em>sheet</em>).
          </p>
          <Separator />
          <p>
            <strong className="text-foreground">Cabeçalho</strong> com título contextual e menu Conta (email, tema,
            terminar sessão). O painel exige <strong className="text-foreground">início de sessão</strong> (
            <code className="rounded bg-muted px-1">/login</code>); cada conta vê apenas os seus eventos.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modais e formulários</CardTitle>
          <CardDescription>Padrões de interação</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground text-pretty">
          <ul className="list-disc space-y-2 pl-5">
            <li>Criar evento, gerar folhas e registar venda abrem <strong>diálogos</strong> (foco e menos ruído).</li>
            <li>Confirmações sensíveis (vitória) usam o mesmo padrão para evitar cliques acidentais.</li>
            <li>Tabelas com ações por linha (PDF, venda) mantêm a hierarquia visual clara.</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tema (claro / escuro)</CardTitle>
          <CardDescription>Por defeito o painel abre em modo claro</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-pretty">
          Use o ícone sol / lua / ecrã no cabeçalho para alternar entre <strong className="text-foreground">Claro</strong>,{' '}
          <strong className="text-foreground">Escuro</strong> e <strong className="text-foreground">Sistema</strong> (segue o SO). A
          escolha fica guardada neste navegador (<code className="rounded bg-muted px-1">localStorage</code>). Em{' '}
          <strong className="text-foreground">Conta</strong> pode escolher o modo com precisão.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Página pública</CardTitle>
          <CardDescription>Jogador via QR</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground text-pretty">
          A rota <code className="rounded bg-muted px-1">/f/:token</code> mostra todas as cartelas da folha e os
          números já sorteados por rodada (dados estáticos à abertura; o jogador pode recarregar após novos sorteios).
          O tema guardado aplica-se aqui.
        </CardContent>
      </Card>
    </div>
  )
}
