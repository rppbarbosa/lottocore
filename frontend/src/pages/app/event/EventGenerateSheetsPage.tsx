import { LayoutTemplate, Loader2, PlusCircle } from 'lucide-react'
import { useState } from 'react'
import { EventPrintTemplateDialog } from '@/components/app/event/EventPrintTemplateDialog'
import { SheetLayoutPreview } from '@/components/sheets/SheetLayoutPreview'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useEventWorkspace } from '@/context/EventWorkspaceContext'
import { ApiError, apiJson } from '@/lib/api'

export default function EventGenerateSheetsPage() {
  const { eventId, loadSheets, setActionErr } = useEventWorkspace()
  const [count, setCount] = useState('10')
  const [cardsPerSheet, setCardsPerSheet] = useState('5')
  const [loading, setLoading] = useState(false)
  const [lastOk, setLastOk] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)

  const submit = async () => {
    const n = parseInt(count, 10)
    const cps = parseInt(cardsPerSheet, 10)
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setActionErr('Quantidade de folhas: use um número entre 1 e 500.')
      return
    }
    if (!Number.isFinite(cps) || cps < 1 || cps > 5) {
      setActionErr('Cartelas por folha: use um número entre 1 e 5 (uma por rodada).')
      return
    }
    setLoading(true)
    setActionErr(null)
    setLastOk(null)
    try {
      const res = await apiJson<{ sheets: { sheet_number: number }[] }>(`/api/events/${eventId}/sheets`, {
        method: 'POST',
        body: JSON.stringify({ count: n, cardsPerSheet: cps }),
      })
      setLastOk(`${res.sheets.length} folha(s) criada(s), cada uma com ${cps} cartela(s).`)
      void loadSheets()
      setCount('10')
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Erro ao gerar folhas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              Gerar folhas com cartelas
            </CardTitle>
            <CardDescription className="text-pretty">
              Cada cartela corresponde a uma rodada (até 5). Pode gerar folhas com menos cartelas se ainda não
              usar todas as rodadas — a unicidade dos números mantém-se por rodada na base de dados.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 gap-2 self-start sm:self-auto"
            onClick={() => setTemplateOpen(true)}
          >
            <LayoutTemplate className="size-4" />
            Modelo do PDF
          </Button>
        </CardHeader>
        <CardContent className="space-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="gen-count">Quantas folhas criar</Label>
              <Input
                id="gen-count"
                type="number"
                min={1}
                max={500}
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground text-pretty">Entre 1 e 500 por operação.</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gen-cps">Cartelas por folha</Label>
              <select
                id="gen-cps"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                value={cardsPerSheet}
                onChange={(e) => setCardsPerSheet(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((k) => (
                  <option key={k} value={k}>
                    {k} {k === 1 ? 'cartela' : 'cartelas'} (rodadas 1–{k})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground text-pretty">
                Ex.: 3 cartelas → folha só entra nas primeiras 3 rodadas.
              </p>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 sm:flex sm:items-start sm:gap-8">
            <SheetLayoutPreview cardsPerSheet={parseInt(cardsPerSheet, 10) || 1} className="sm:shrink-0" />
            <p className="mt-3 text-xs text-muted-foreground text-pretty sm:mt-0 sm:flex-1 sm:pt-1">
              O PDF segue a mesma disposição: até 3 cartelas numa linha, 4 em grelha 2×2, 5 com três em cima e duas
              centradas em baixo. Personalize fundo, cabeçalho e rodapé em <strong>Modelo do PDF</strong>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void submit()} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A gerar…
                </>
              ) : (
                'Gerar folhas'
              )}
            </Button>
          </div>
          {lastOk && (
            <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-pretty">{lastOk}</p>
          )}
        </CardContent>
      </Card>

      <EventPrintTemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} />
    </div>
  )
}
