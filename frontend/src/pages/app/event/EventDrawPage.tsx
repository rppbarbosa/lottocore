import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useEventWorkspace } from '@/context/EventWorkspaceContext'
import { cn } from '@/lib/utils'

const BINGO_COLUMNS = [
  { letter: 'B', start: 1, accent: 'bg-sky-600/90 text-white border-sky-700' },
  { letter: 'I', start: 16, accent: 'bg-red-600/90 text-white border-red-700' },
  { letter: 'N', start: 31, accent: 'bg-neutral-700 text-white border-neutral-800' },
  { letter: 'G', start: 46, accent: 'bg-green-700/90 text-white border-green-800' },
  { letter: 'O', start: 61, accent: 'bg-amber-600/90 text-white border-amber-800' },
] as const

const BOARD_ROWS = Array.from({ length: 15 }, (_, row) =>
  BINGO_COLUMNS.map((col) => col.start + row),
)

export default function EventDrawPage() {
  const { selectedRoundId, drawn, loadingRound, doDraw, doUndo } = useEventWorkspace()
  const [drawInput, setDrawInput] = useState('')
  const [confirmNumber, setConfirmNumber] = useState<number | null>(null)
  const [drawPending, setDrawPending] = useState(false)

  const drawnSet = useMemo(() => new Set(drawn.map((d) => d.number)), [drawn])

  const submit = async () => {
    const n = Number.parseInt(drawInput, 10)
    if (!Number.isFinite(n)) return
    const ok = await doDraw(n)
    if (ok) setDrawInput('')
  }

  const confirmDraw = async () => {
    if (confirmNumber === null) return
    setDrawPending(true)
    try {
      const ok = await doDraw(confirmNumber)
      if (ok) setConfirmNumber(null)
    } finally {
      setDrawPending(false)
    }
  }

  const boardDisabled = !selectedRoundId || loadingRound

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Sorteio</CardTitle>
          <CardDescription className="text-justify">
            Lançamento de números (1–75), sem repetir na rodada. Use a mesa abaixo (toque no número) ou o campo
            manual. Cada sorteio grava na base de dados; o histórico nesta página atualiza em tempo real (painel do
            organizador).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="draw-n">Número (manual)</Label>
            <Input
              id="draw-n"
              className="w-24"
              value={drawInput}
              onChange={(e) => setDrawInput(e.target.value)}
              placeholder="42"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <Button onClick={submit} disabled={!selectedRoundId}>
            Sortear
          </Button>
          <Button variant="outline" onClick={() => void doUndo()} disabled={!selectedRoundId}>
            Desfazer último
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mesa de números</CardTitle>
          <CardDescription className="text-justify">
            Vista tipo cartão de bingo americano (B–I–N–G–O). Toque numa esfera livre para confirmar o sorteio;
            números já saídos ficam realçados e não podem ser repetidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-1">
          <div
            className={cn(
              'inline-block min-w-full rounded-xl border bg-muted/20 p-2 sm:p-3',
              boardDisabled && 'pointer-events-none opacity-50',
            )}
            aria-busy={loadingRound}
          >
            <div
              className="grid gap-1 sm:gap-1.5"
              style={{ gridTemplateColumns: 'auto repeat(5, minmax(0, 1fr))' }}
            >
              <div className="h-8 w-6 sm:h-9 sm:w-7" aria-hidden />
              {BINGO_COLUMNS.map((col) => (
                <div
                  key={col.letter}
                  className={cn(
                    'flex h-8 items-center justify-center rounded-md border text-xs font-black tabular-nums sm:h-9 sm:text-sm',
                    col.accent,
                  )}
                >
                  {col.letter}
                </div>
              ))}
              {BOARD_ROWS.map((row, ri) => (
                <div key={`board-row-${ri}`} className="contents">
                  <div
                    className="flex h-7 items-center justify-end pr-1 text-[10px] font-medium tabular-nums text-muted-foreground sm:h-8 sm:text-xs"
                    aria-hidden
                  >
                    {ri + 1}
                  </div>
                  {row.map((n, ci) => {
                    const isDrawn = drawnSet.has(n)
                    const col = BINGO_COLUMNS[ci]
                    return (
                      <button
                        key={n}
                        type="button"
                        disabled={boardDisabled || isDrawn || drawPending}
                        onClick={() => setConfirmNumber(n)}
                        className={cn(
                          'relative flex aspect-square min-h-[1.75rem] w-full max-w-[2.75rem] items-center justify-center justify-self-center rounded-full border-2 text-[11px] font-bold tabular-nums shadow-sm transition-transform sm:min-h-[2rem] sm:max-w-[3rem] sm:text-sm',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                          isDrawn
                            ? cn(col.accent, 'ring-2 ring-primary ring-offset-1 ring-offset-background')
                            : 'border-border bg-gradient-to-b from-background to-muted/80 text-foreground hover:scale-105 hover:border-primary/50 active:scale-95',
                        )}
                        aria-label={
                          isDrawn
                            ? `Número ${n}, já sorteado`
                            : `Sortear número ${n}, coluna ${col.letter}`
                        }
                      >
                        {n}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            {!selectedRoundId && (
              <p className="mt-2 text-center text-xs text-muted-foreground">Selecione uma rodada acima.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico nesta rodada</CardTitle>
          <CardDescription>Ordem de saída dos números sorteados.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRound ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : drawn.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem números ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {drawn.map((d) => (
                <Badge key={d.draw_order} variant="secondary">
                  {d.number}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmNumber !== null}
        onOpenChange={(open) => {
          if (!open && !drawPending) setConfirmNumber(null)
        }}
      >
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => drawPending && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Confirmar sorteio</DialogTitle>
            <DialogDescription className="text-justify">
              Registar o número{' '}
              <span className="font-semibold tabular-nums text-foreground">{confirmNumber}</span> como sorteado nesta
              rodada? A operação será gravada na base de dados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={drawPending} onClick={() => setConfirmNumber(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={drawPending} onClick={() => void confirmDraw()}>
              {drawPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  A gravar…
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
