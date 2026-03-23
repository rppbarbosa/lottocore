import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ThemeCycleButton } from '@/components/app/ThemeCycleButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

type RoundInfo = { id: string; number: number; status: string }

type PublicSheetCard = {
  grid: (number | null)[][]
  publicToken: string
  winStatus: string
  round: RoundInfo
  drawnNumbers: number[]
}

type PublicSheetPayload = {
  eventName: string
  sheetNumber: number
  publicToken: string
  cards: PublicSheetCard[]
}

const COLS = ['B', 'I', 'N', 'G', 'O'] as const

/** Sempre 4 algarismos no selo da folha (máx. 9999). */
function formatSheetNumberPadded(n: number): string {
  const v = Math.floor(Number(n))
  if (!Number.isFinite(v) || v < 0) return '0000'
  return String(Math.min(v, 9999)).padStart(4, '0')
}

function roundStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return 'Aguardando início'
    case 'open':
      return 'Em curso'
    case 'closed':
      return 'Encerrada'
    default:
      return status
  }
}

function winLabel(status: string) {
  switch (status) {
    case 'suggested':
      return 'Possível cartela cheia — aguardando confirmação do organizador.'
    case 'confirmed':
      return 'Vitória confirmada pelo organizador.'
    case 'dismissed':
      return 'Esta sugestão foi dispensada.'
    default:
      return null
  }
}

function SheetCardBlock({ data }: { data: PublicSheetCard }) {
  const drawnSet = useMemo(() => new Set(data.drawnNumbers), [data.drawnNumbers])
  const grid = data.grid
  const winMsg = winLabel(data.winStatus)

  return (
    <Card className="overflow-hidden border-2 shadow-md">
      <CardHeader className="space-y-1 text-center">
        <CardDescription>Rodada {data.round.number}</CardDescription>
        <p className="text-sm text-muted-foreground">
          Estado:{' '}
          <span className="font-medium text-foreground">{roundStatusLabel(data.round.status)}</span>
        </p>
        {winMsg && (
          <p className="pt-2 text-justify text-sm text-foreground/90 leading-relaxed">{winMsg}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-5 border-b bg-muted/80">
            {COLS.map((c) => (
              <div
                key={c}
                className="py-2 text-center text-xs font-bold tracking-wider text-muted-foreground"
              >
                {c}
              </div>
            ))}
          </div>
          {grid.map((row, ri) => (
            <div key={ri} className="grid grid-cols-5 border-b last:border-0">
              {row.map((cell, ci) => {
                const isFree = cell === null || cell === undefined
                const marked = !isFree && drawnSet.has(cell as number)
                return (
                  <div
                    key={ci}
                    className="relative flex aspect-square items-center justify-center border-r last:border-0 bg-background"
                  >
                    <span
                      className={`relative z-10 text-sm font-semibold tabular-nums ${
                        isFree ? 'text-muted-foreground' : 'text-foreground'
                      }`}
                    >
                      {isFree ? '★' : cell}
                    </span>
                    {marked && (
                      <span
                        className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-4xl font-bold text-foreground opacity-40"
                        aria-hidden
                      >
                        ✕
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <Separator />

        <div>
          <h3 className="mb-2 text-sm font-medium">Números já sorteados nesta rodada</h3>
          {data.drawnNumbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há números.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.drawnNumbers.map((n) => (
                <Badge key={n} variant="outline" className="tabular-nums">
                  {n}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function PublicSheetPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PublicSheetPayload | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'ready'>('loading')

  useEffect(() => {
    if (!token) {
      setLoadState('error')
      return
    }
    let cancelled = false
    setLoadState('loading')
    fetch(`/api/public/sheets/${encodeURIComponent(token)}`)
      .then(async (r) => {
        if (r.status === 404) throw new Error('notfound')
        if (!r.ok) throw new Error('bad')
        return r.json() as Promise<PublicSheetPayload>
      })
      .then((json) => {
        if (!cancelled) {
          setData(json)
          setLoadState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState('error')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  if (loadState === 'loading') {
    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6">
        <div className="absolute right-4 top-4 z-10">
          <ThemeCycleButton />
        </div>
        <p className="text-sm text-muted-foreground">Carregando a folha…</p>
        <Button variant="outline" asChild>
          <Link to="/app">Painel organizador</Link>
        </Button>
      </div>
    )
  }

  if (loadState === 'error' || !data) {
    return (
      <div className="relative flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <div className="absolute right-4 top-4 z-10">
          <ThemeCycleButton />
        </div>
        <p className="max-w-md text-sm text-destructive text-pretty">
          Não foi possível encontrar esta folha. Verifique o link ou o QR Code.
        </p>
        <Button asChild>
          <Link to="/app">Ir para o painel</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-gradient-to-b from-background to-muted/30 px-4 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <Badge variant="secondary">LottoCore</Badge>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <span
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-input bg-background px-3.5 text-sm font-extrabold tabular-nums shadow-sm tracking-wide"
              role="status"
              aria-label={`Folha número ${data.sheetNumber}`}
            >
              <span className="text-foreground">Nº </span>
              <span className="text-red-600">{formatSheetNumberPadded(data.sheetNumber)}</span>
            </span>
            <ThemeCycleButton />
            <Button variant="ghost" size="sm" asChild>
              <Link to="/app">Painel</Link>
            </Button>
          </div>
        </header>

        <p className="text-justify text-xs text-muted-foreground leading-relaxed">
          Os números marcados correspondem ao estado do sorteio quando abriu esta página. Recarregue após novos
          sorteios para ver a lista atualizada.
        </p>

        {data.cards.map((card) => (
          <SheetCardBlock key={card.round.id} data={card} />
        ))}
      </div>
    </div>
  )
}
