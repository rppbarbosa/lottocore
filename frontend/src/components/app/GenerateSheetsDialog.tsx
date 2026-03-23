import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
import { ApiError, apiJson } from '@/lib/api'

type Props = {
  eventId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onDone: () => void
}

export function GenerateSheetsDialog({ eventId, open, onOpenChange, onDone }: Props) {
  const [count, setCount] = useState('5')
  const [cardsPerSheet, setCardsPerSheet] = useState('5')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = async () => {
    const n = Number.parseInt(count, 10)
    const cps = Number.parseInt(cardsPerSheet, 10)
    if (!Number.isFinite(n) || n < 1 || n > 500) {
      setErr('Indique um número entre 1 e 500')
      return
    }
    if (!Number.isFinite(cps) || cps < 1 || cps > 5) {
      setErr('Cartelas por folha: entre 1 e 5')
      return
    }
    setLoading(true)
    setErr(null)
    try {
      await apiJson(`/api/events/${eventId}/sheets`, {
        method: 'POST',
        body: JSON.stringify({ count: n, cardsPerSheet: cps }),
      })
      onOpenChange(false)
      setCount('5')
      onDone()
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Erro ao gerar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar folhas</DialogTitle>
          <DialogDescription>Escolha quantas folhas e quantas cartelas (1–5) em cada uma.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="sh-count">Quantidade de folhas</Label>
            <Input
              id="sh-count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sh-cps">Cartelas por folha</Label>
            <select
              id="sh-cps"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={cardsPerSheet}
              onChange={(e) => setCardsPerSheet(e.target.value)}
            >
              {[1, 2, 3, 4, 5].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={submit} disabled={loading}>
            {loading ? 'A gerar…' : 'Gerar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
