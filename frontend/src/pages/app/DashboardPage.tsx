import {
  Activity,
  ArrowRight,
  CalendarDays,
  Layers,
  Loader2,
  QrCode,
  Sparkles,
  Target,
  Ticket,
  Trophy,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useDashboardEvent } from '@/context/DashboardEventContext'
import { EVENT_WORKSPACE_SEGMENTS } from '@/lib/event-nav'
import { ApiError, apiJson } from '@/lib/api'
import { formatBRLFromCents } from '@/lib/formatMoney'
import { eventStatusLabel } from '@/lib/eventStatus'

type Health = { ok?: boolean; database?: string }

type EventRow = { id: string; name: string; status: string }

type DashboardDto = {
  event: { id: string; name: string; status: string; created_at: string }
  sheets: {
    total: number
    sold: number
    available: number
    cancelled?: number
    total_received_cents?: number
    total_pending_cents?: number
  }
  cards: { total: number }
  rounds: { id: string; round_number: number; status: string; numbers_drawn: number }[]
  wins: { suggested: number; confirmed: number; dismissed: number }
  summary: {
    numbers_drawn_total: number
    open_round_number: number | null
    next_pending_round_number: number | null
  }
}

function roundBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'open') return 'default'
  if (status === 'closed') return 'outline'
  return 'secondary'
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string
  value: ReactNode
  subtitle?: string
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  loading?: boolean
}) {
  return (
    <Card className="overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 shrink-0 text-primary/80" aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
        ) : (
          <>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            {subtitle ? <p className="mt-1 text-xs text-muted-foreground text-pretty">{subtitle}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { focusedEventId, setEventFocus } = useDashboardEvent()
  const [health, setHealth] = useState<Health | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [events, setEvents] = useState<EventRow[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsErr, setEventsErr] = useState<string | null>(null)
  const [dash, setDash] = useState<DashboardDto | null>(null)
  const [dashLoading, setDashLoading] = useState(false)
  const [dashErr, setDashErr] = useState<string | null>(null)

  const selectedId = focusedEventId

  useEffect(() => {
    let c = false
    fetch('/api/health')
      .then((r) => r.json())
      .then((b) => {
        if (!c) setHealth(b)
      })
      .catch(() => {
        if (!c) setHealth({ ok: false })
      })
      .finally(() => {
        if (!c) setHealthLoading(false)
      })
    return () => {
      c = true
    }
  }, [])

  const loadEvents = useCallback(async () => {
    setEventsLoading(true)
    setEventsErr(null)
    try {
      const data = await apiJson<{ events: EventRow[] }>('/api/events')
      setEvents(data.events)
    } catch (e) {
      setEvents([])
      setEventsErr(e instanceof ApiError ? e.message : 'Erro ao listar eventos')
    } finally {
      setEventsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    if (eventsLoading) return
    if (events.length === 0) setEventFocus(null)
  }, [events.length, eventsLoading, setEventFocus])

  useEffect(() => {
    if (!events.length) return
    const exists = selectedId && events.some((e) => e.id === selectedId)
    if (exists) return
    const first = events[0]
    setEventFocus(first.id, first.name)
  }, [events, selectedId, setEventFocus])

  useEffect(() => {
    if (!selectedId) {
      setDash(null)
      setDashErr(null)
      return
    }
    let c = false
    setDashLoading(true)
    setDashErr(null)
    apiJson<DashboardDto>(`/api/events/${selectedId}/dashboard`)
      .then((d) => {
        if (!c) setDash(d)
      })
      .catch((e) => {
        if (!c) {
          setDash(null)
          setDashErr(e instanceof ApiError ? e.message : 'Erro ao carregar indicadores')
        }
      })
      .finally(() => {
        if (!c) setDashLoading(false)
      })
    return () => {
      c = true
    }
  }, [selectedId])

  const apiUp = health?.ok === true && health.database === 'up'
  const eventBase = selectedId ? `/app/events/${selectedId}` : null

  const salePct = useMemo(() => {
    if (!dash || dash.sheets.total === 0) return 0
    return Math.round((dash.sheets.sold / dash.sheets.total) * 100)
  }, [dash])

  const onEventChange = (id: string) => {
    const ev = events.find((e) => e.id === id)
    if (ev) setEventFocus(ev.id, ev.name)
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Painel do evento</h2>
          <p className="max-w-xl text-sm text-muted-foreground text-pretty">
            Indicadores operacionais para conduzir o bingo beneficente: folhas, vendas, sorteio e vitórias num
            só sítio. Escolha o evento e avance pelos atalhos ou pela sidebar.
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-72">
          <Label htmlFor="dash-event">Evento ativo</Label>
          {eventsLoading ? (
            <div className="flex h-9 items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              A carregar…
            </div>
          ) : eventsErr ? (
            <p className="text-sm text-destructive text-pretty">{eventsErr}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento criado ainda.</p>
          ) : (
            <select
              id="dash-event"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={selectedId ?? ''}
              onChange={(e) => onEventChange(e.target.value)}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({eventStatusLabel(ev.status)})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/80 sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {healthLoading ? (
              <div className="h-6 w-32 animate-pulse rounded bg-muted" />
            ) : apiUp ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">API OK</Badge>
                <span className="text-xs text-muted-foreground">Base de dados</span>
              </div>
            ) : (
              <Badge variant="destructive">Indisponível</Badge>
            )}
            <p className="text-xs text-muted-foreground text-pretty">
              Sessão com conta — cada utilizador vê apenas os seus eventos.
            </p>
          </CardContent>
        </Card>

        {events.length === 0 && !eventsLoading ? (
          <Card className="border-dashed sm:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Comece por um evento</CardTitle>
              <CardDescription>Cinco rodadas são criadas automaticamente em cada evento.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/app/events">
                  <CalendarDays className="h-4 w-4" />
                  Criar ou gerir eventos
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {selectedId && (
        <>
          {dashErr && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {dashErr}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Folhas"
              icon={Layers}
              loading={dashLoading}
              value={dash ? dash.sheets.total : '—'}
              subtitle={
                dash
                  ? `${dash.sheets.sold} vendidas · ${dash.sheets.available} disponíveis${
                      (dash.sheets.cancelled ?? 0) > 0 ? ` · ${dash.sheets.cancelled} canceladas` : ''
                    }`
                  : undefined
              }
            />
            <KpiCard
              title="Taxa de venda"
              icon={Ticket}
              loading={dashLoading}
              value={dash ? `${salePct}%` : '—'}
              subtitle={
                dash && dash.sheets.total > 0
                  ? 'Sobre o total de folhas geradas'
                  : 'Gere folhas em Gerar folhas'
              }
            />
            <KpiCard
              title="Cartelas no sistema"
              icon={QrCode}
              loading={dashLoading}
              value={dash ? dash.cards.total : '—'}
              subtitle="Instâncias por folha e rodada (impressão + QR)"
            />
            <KpiCard
              title="Números sorteados"
              icon={Target}
              loading={dashLoading}
              value={dash ? dash.summary.numbers_drawn_total : '—'}
              subtitle="Soma de todas as rodadas deste evento"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <KpiCard
              title="Em caixa (vendas)"
              icon={Wallet}
              loading={dashLoading}
              value={dash ? formatBRLFromCents(dash.sheets.total_received_cents ?? 0) : '—'}
              subtitle="Soma do já recebido nas folhas vendidas"
            />
            <KpiCard
              title="A receber (vendas)"
              icon={Wallet}
              loading={dashLoading}
              value={dash ? formatBRLFromCents(dash.sheets.total_pending_cents ?? 0) : '—'}
              subtitle="Preço menos recebido, por folha vendida"
            />
          </div>

          {dash && dash.sheets.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progresso de venda</span>
                <span className="tabular-nums">
                  {dash.sheets.sold}/{dash.sheets.total} folhas
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${salePct}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/80 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Rodadas</CardTitle>
                <CardDescription>
                  Cinco rodadas por evento; abra a rodada atual antes de sortear.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dashLoading ? (
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-16 flex-1 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : dash ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {dash.rounds.map((r) => (
                      <div
                        key={r.id}
                        className="flex flex-col rounded-lg border bg-card/80 px-2 py-3 text-center shadow-sm"
                      >
                        <span className="text-xs font-medium text-muted-foreground">R{r.round_number}</span>
                        <Badge variant={roundBadgeVariant(r.status)} className="mt-1 justify-center capitalize">
                          {r.status}
                        </Badge>
                        <span className="mt-2 text-lg font-semibold tabular-nums">{r.numbers_drawn}</span>
                        <span className="text-[10px] text-muted-foreground">números</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {dash && (
                  <p className="mt-4 text-sm text-muted-foreground text-pretty">
                    {dash.summary.open_round_number != null ? (
                      <>
                        <Sparkles className="mr-1 inline h-4 w-4 text-primary" />
                        Rodada <strong className="text-foreground">{dash.summary.open_round_number}</strong> está
                        aberta para sorteio.
                      </>
                    ) : dash.summary.next_pending_round_number != null ? (
                      <>
                        Próxima a abrir: rodada{' '}
                        <strong className="text-foreground">{dash.summary.next_pending_round_number}</strong> (nenhuma
                        aberta neste momento).
                      </>
                    ) : (
                      'Todas as rodadas estão fechadas ou ainda em preparação — ajuste em Visão geral.'
                    )}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="h-4 w-4 text-primary" />
                  Vitórias
                </CardTitle>
                <CardDescription>Confirmação manual após deteção automática.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashLoading ? (
                  <div className="h-20 animate-pulse rounded-md bg-muted" />
                ) : dash ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">A confirmar</span>
                      <Badge variant={dash.wins.suggested > 0 ? 'warning' : 'secondary'}>
                        {dash.wins.suggested}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Confirmadas</span>
                      <Badge variant="success">{dash.wins.confirmed}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Dispensadas</span>
                      <span className="tabular-nums text-muted-foreground">{dash.wins.dismissed}</span>
                    </div>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`${eventBase}/vitorias`}>Abrir vitórias</Link>
                    </Button>
                  </>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Operação rápida</CardTitle>
              <CardDescription>
                Fluxo: gerar → vender → sortear → validar → jogador em /f/&#123;token da folha&#125;
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {EVENT_WORKSPACE_SEGMENTS.map(({ seg, label, hint }) => (
                <Button key={seg} variant="secondary" size="sm" title={hint} asChild>
                  <Link to={`${eventBase}/${seg}`}>
                    {label}
                    <ArrowRight className="h-4 w-4 opacity-70" />
                  </Link>
                </Button>
              ))}
              <Button variant="outline" size="sm" asChild>
                <Link to="/app/events">Todos os eventos</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
