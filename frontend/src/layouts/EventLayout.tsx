import { ArrowLeft, Loader2 } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { EventWorkspaceProvider, useEventWorkspace } from '@/context/EventWorkspaceContext'
import { EVENT_WORKSPACE_SEGMENTS } from '@/lib/event-nav'
import { cn } from '@/lib/utils'

function EventLayoutShell() {
  const { eventId } = useParams<{ eventId: string }>()
  const location = useLocation()
  const ctx = useEventWorkspace()

  const showRoundPicker =
    location.pathname.includes('/sorteio') || location.pathname.includes('/vitorias')

  const base = `/app/events/${eventId}`

  if (ctx.loadingEvent && !ctx.eventName) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        A carregar evento…
      </div>
    )
  }

  const roundOptions = ctx.rounds.map((r) => (
    <option key={r.id} value={r.id}>
      Rodada {r.round_number} ({r.status})
    </option>
  ))

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/app/events">
            <ArrowLeft className="h-4 w-4" />
            Eventos
          </Link>
        </Button>
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-2xl font-semibold tracking-tight">
            {ctx.eventName || 'Evento'}
          </h2>
          <div className="text-sm text-muted-foreground">
            <Badge variant="outline">{ctx.eventStatus}</Badge>{' '}
            <span className="ml-2 font-mono text-xs">{eventId}</span>
          </div>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {EVENT_WORKSPACE_SEGMENTS.map(({ seg, label, hint }) => (
          <NavLink
            key={seg}
            to={`${base}/${seg}`}
            end={seg === 'resumo'}
            title={hint}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {ctx.actionErr && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {ctx.actionErr}
        </p>
      )}

      {showRoundPicker && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>Rodada (sorteio e vitórias)</Label>
            <select
              className="flex h-9 w-64 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={ctx.selectedRoundId}
              onChange={(e) => ctx.setSelectedRoundId(e.target.value)}
            >
              {roundOptions}
            </select>
          </div>
        </div>
      )}

      <Outlet />
    </div>
  )
}

export function EventLayout() {
  const { eventId } = useParams<{ eventId: string }>()
  if (!eventId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evento inválido</CardTitle>
        </CardHeader>
      </Card>
    )
  }
  return (
    <EventWorkspaceProvider eventId={eventId}>
      <EventLayoutShell />
    </EventWorkspaceProvider>
  )
}
